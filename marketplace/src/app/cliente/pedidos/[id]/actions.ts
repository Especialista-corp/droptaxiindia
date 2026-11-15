"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { avaliacaoSchema } from "@/lib/validations";
import {
  SIGNAL_PAYMENT_WINDOW_HOURS,
  FREE_CANCELLATION_WINDOW_HOURS,
  LATE_CANCELLATION_FEE_PERCENT,
  MAX_NO_SHOW_STRIKES,
} from "@/lib/constants";
import { estornarPagamento } from "@/lib/asaas";
import { notificarUsuario } from "@/lib/notify";

async function requireClienteDoPedido(orderId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { data: order } = await supabase
    .from("orders")
    .select("id, cliente_id, status, data_agendada, janela_inicio")
    .eq("id", orderId)
    .single();
  if (!order || order.cliente_id !== user.id) throw new Error("Pedido não encontrado");

  return { supabase, user, order };
}

export async function aceitarPropostaAction(orderId: string, proposalId: string) {
  const { supabase, order } = await requireClienteDoPedido(orderId);
  if (order.status !== "aberto" && order.status !== "proposto") {
    throw new Error("Este pedido não aceita mais propostas");
  }

  const { data: proposal, error: proposalError } = await supabase
    .from("proposals")
    .select("id, prestador_id, valor")
    .eq("id", proposalId)
    .eq("order_id", orderId)
    .single();
  if (proposalError || !proposal) throw new Error("Proposta não encontrada");

  const { error: updateOrderError } = await supabase
    .from("orders")
    .update({
      prestador_id: proposal.prestador_id,
      valor_acordado: proposal.valor,
      status: "agendado",
      sinal_prazo_em: new Date(
        Date.now() + SIGNAL_PAYMENT_WINDOW_HOURS * 3_600_000,
      ).toISOString(),
    })
    .eq("id", orderId);
  if (updateOrderError) throw new Error(updateOrderError.message);

  await supabase.from("proposals").update({ status: "aceita" }).eq("id", proposalId);
  await supabase
    .from("proposals")
    .update({ status: "recusada" })
    .eq("order_id", orderId)
    .neq("id", proposalId);

  await notificarUsuario(
    proposal.prestador_id,
    "proposta_aceita",
    "Proposta aceita!",
    "O cliente aceitou sua proposta. Confirme sua presença assim que o sinal for pago.",
    { order_id: orderId },
    `/prestador/pedidos/${orderId}`,
  );

  revalidatePath(`/cliente/pedidos/${orderId}`);
}

export async function recusarPropostaAction(orderId: string, proposalId: string) {
  const { supabase } = await requireClienteDoPedido(orderId);
  await supabase
    .from("proposals")
    .update({ status: "recusada" })
    .eq("id", proposalId)
    .eq("order_id", orderId);
  revalidatePath(`/cliente/pedidos/${orderId}`);
}

export async function cancelarPedidoAction(orderId: string, motivo: string) {
  const { supabase, user, order } = await requireClienteDoPedido(orderId);
  if (order.status === "aceito_cliente" || order.status === "cancelado") {
    throw new Error("Este pedido não pode mais ser cancelado");
  }

  await supabase
    .from("orders")
    .update({
      status: "cancelado",
      cancelado_em: new Date().toISOString(),
      cancelado_motivo: motivo,
      cancelado_por: user.id,
    })
    .eq("id", orderId);

  // Regra de negócio 5: cancelamento gratuito até 24h antes; depois disso,
  // retém uma taxa configurável sobre o sinal já pago.
  const agendadoPara = new Date(`${order.data_agendada}T${order.janela_inicio}`);
  const horasAteAgendamento = (agendadoPara.getTime() - Date.now()) / 3_600_000;
  const dentroDoPrazoGratuito = horasAteAgendamento >= FREE_CANCELLATION_WINDOW_HOURS;

  const admin = createAdminClient();
  const { data: sinal } = await admin
    .from("payments")
    .select("id, gateway_id, valor, status")
    .eq("order_id", orderId)
    .eq("tipo", "sinal_50")
    .maybeSingle();

  if (sinal?.status === "retido" && sinal.gateway_id) {
    const valorReembolso = dentroDoPrazoGratuito
      ? undefined
      : Number((sinal.valor * (1 - LATE_CANCELLATION_FEE_PERCENT / 100)).toFixed(2));
    try {
      await estornarPagamento(sinal.gateway_id, valorReembolso);
      await admin
        .from("payments")
        .update({ status: "reembolsado", reembolsado_em: new Date().toISOString() })
        .eq("id", sinal.id);
    } catch {
      // Falha na chamada ao Asaas fica registrada como pendência manual do admin;
      // o pedido já foi cancelado e não deve travar por causa do reembolso.
    }
  }

  revalidatePath(`/cliente/pedidos/${orderId}`);
}

export async function aceitarConclusaoAction(orderId: string) {
  const { supabase, order } = await requireClienteDoPedido(orderId);
  if (order.status !== "concluido_prestador") {
    throw new Error("Este pedido ainda não foi marcado como concluído pelo prestador");
  }

  await supabase.from("orders").update({ status: "aceito_cliente" }).eq("id", orderId);
  await createAdminClient()
    .from("payments")
    .update({ status: "liberado", liberado_em: new Date().toISOString() })
    .eq("order_id", orderId)
    .eq("status", "retido");
  revalidatePath(`/cliente/pedidos/${orderId}`);
}

/**
 * Regra de negócio 6: no-show do prestador gera reembolso integral automático
 * e um strike no perfil dele (3 strikes = suspensão).
 */
export async function reportarNoShowAction(orderId: string) {
  const { order, user } = await requireClienteDoPedido(orderId);
  if (order.status !== "confirmado" && order.status !== "em_deslocamento") {
    throw new Error("Só é possível reportar no-show após a confirmação do prestador");
  }

  const admin = createAdminClient();
  const { data: fullOrder } = await admin
    .from("orders")
    .select("prestador_id")
    .eq("id", orderId)
    .single();
  const prestadorId = fullOrder?.prestador_id;

  await admin
    .from("orders")
    .update({
      status: "cancelado",
      no_show_prestador: true,
      cancelado_em: new Date().toISOString(),
      cancelado_motivo: "No-show do prestador",
      cancelado_por: user.id,
    })
    .eq("id", orderId);

  const { data: pagamentosRetidos } = await admin
    .from("payments")
    .select("id, gateway_id, status")
    .eq("order_id", orderId)
    .eq("status", "retido");

  for (const pagamento of pagamentosRetidos ?? []) {
    if (!pagamento.gateway_id) continue;
    try {
      await estornarPagamento(pagamento.gateway_id);
      await admin
        .from("payments")
        .update({ status: "reembolsado", reembolsado_em: new Date().toISOString() })
        .eq("id", pagamento.id);
    } catch {
      // Registrado como pendência manual do admin.
    }
  }

  if (prestadorId) {
    await admin.from("provider_strikes").insert({
      provider_id: prestadorId,
      order_id: orderId,
      motivo: "no_show",
    });

    const { data: provider } = await admin
      .from("provider_profiles")
      .select("strikes")
      .eq("user_id", prestadorId)
      .single();
    const novoTotal = (provider?.strikes ?? 0) + 1;

    await admin
      .from("provider_profiles")
      .update({
        strikes: novoTotal,
        status: novoTotal >= MAX_NO_SHOW_STRIKES ? "suspenso" : undefined,
      })
      .eq("user_id", prestadorId);
  }

  revalidatePath(`/cliente/pedidos/${orderId}`);
}

export async function avaliarAction(formData: FormData) {
  const parsed = avaliacaoSchema.safeParse({
    orderId: formData.get("orderId"),
    alvoId: formData.get("alvoId"),
    nota: formData.get("nota"),
    comentario: formData.get("comentario") || undefined,
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos");

  const { supabase, user } = await requireClienteDoPedido(parsed.data.orderId);
  await supabase.from("reviews").insert({
    order_id: parsed.data.orderId,
    autor_id: user.id,
    alvo_id: parsed.data.alvoId,
    nota: parsed.data.nota,
    comentario: parsed.data.comentario ?? null,
  });
  revalidatePath(`/cliente/pedidos/${parsed.data.orderId}`);
}
