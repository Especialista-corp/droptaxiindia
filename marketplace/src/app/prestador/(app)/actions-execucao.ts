"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notificarUsuario } from "@/lib/notify";

async function requirePrestadorDoPedido(orderId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { data: order } = await supabase
    .from("orders")
    .select("id, prestador_id, cliente_id, status")
    .eq("id", orderId)
    .single();
  if (!order || order.prestador_id !== user.id) throw new Error("Pedido não encontrado");

  return { supabase, user, order };
}

export async function confirmarPresencaAction(orderId: string) {
  const { supabase, order } = await requirePrestadorDoPedido(orderId);
  if (order.status !== "agendado") throw new Error("Pedido não está aguardando confirmação");

  const { data: sinal } = await supabase
    .from("payments")
    .select("status")
    .eq("order_id", orderId)
    .eq("tipo", "sinal_50")
    .single();
  if (sinal?.status !== "retido") {
    throw new Error("O sinal ainda não foi pago pelo cliente");
  }

  await supabase
    .from("orders")
    .update({ status: "confirmado", confirmado_prestador_em: new Date().toISOString() })
    .eq("id", orderId);
  revalidatePath(`/prestador/pedidos/${orderId}`);
}

export async function iniciarDeslocamentoAction(orderId: string) {
  const { supabase, order } = await requirePrestadorDoPedido(orderId);
  if (order.status !== "confirmado") throw new Error("Pedido não está confirmado");
  await supabase.from("orders").update({ status: "em_deslocamento" }).eq("id", orderId);
  revalidatePath(`/prestador/pedidos/${orderId}`);
}

export async function marcarChegueiAction(orderId: string) {
  const { supabase, order } = await requirePrestadorDoPedido(orderId);
  if (order.status !== "em_deslocamento") throw new Error("Pedido não está em deslocamento");
  await supabase.from("orders").update({ status: "em_execucao" }).eq("id", orderId);
  revalidatePath(`/prestador/pedidos/${orderId}`);
}

export async function concluirServicoAction(orderId: string, fotos: File[]) {
  const { supabase, order } = await requirePrestadorDoPedido(orderId);
  if (order.status !== "em_execucao") throw new Error("Pedido não está em execução");
  if (fotos.length === 0) throw new Error("Envie ao menos uma foto do serviço concluído");

  const { data: saldoFinal } = await supabase
    .from("payments")
    .select("status")
    .eq("order_id", orderId)
    .eq("tipo", "final_50")
    .maybeSingle();
  if (saldoFinal?.status !== "retido") {
    throw new Error("O cliente ainda não pagou o saldo final deste pedido");
  }

  for (const [index, foto] of fotos.entries()) {
    const path = `${orderId}/${Date.now()}-${index}-${foto.name}`;
    const { error: uploadError } = await supabase.storage
      .from("conclusao-fotos")
      .upload(path, foto);
    if (uploadError) throw new Error(uploadError.message);
    await supabase.from("completion_photos").insert({ order_id: orderId, url: path });
  }

  await supabase.from("orders").update({ status: "concluido_prestador" }).eq("id", orderId);

  await notificarUsuario(
    order.cliente_id,
    "servico_concluido",
    "Seu móvel foi montado!",
    "O montador enviou fotos do serviço concluído. Confira e confirme para liberar o pagamento.",
    { order_id: orderId },
    `/cliente/pedidos/${orderId}`,
  );

  revalidatePath(`/prestador/pedidos/${orderId}`);
  revalidatePath(`/cliente/pedidos/${orderId}`);
}
