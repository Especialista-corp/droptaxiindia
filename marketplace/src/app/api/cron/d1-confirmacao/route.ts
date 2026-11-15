import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verificarCronSecret } from "@/lib/cron-auth";
import { notificarUsuario } from "@/lib/notify";

/**
 * 1 dia antes do agendamento, notifica o prestador para confirmar presença
 * (regra de negócio 2 — quem não confirma até D-1 perde o pedido).
 */
export async function GET(request: Request) {
  const unauthorized = verificarCronSecret(request);
  if (unauthorized) return unauthorized;

  const admin = createAdminClient();
  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  const amanhaISO = amanha.toISOString().slice(0, 10);

  const { data: pedidos } = await admin
    .from("orders")
    .select("id, prestador_id")
    .eq("status", "agendado")
    .eq("data_agendada", amanhaISO)
    .is("confirmado_prestador_em", null);

  let notificados = 0;
  for (const pedido of pedidos ?? []) {
    if (!pedido.prestador_id) continue;

    const { data: jaNotificado } = await admin
      .from("notifications")
      .select("id")
      .eq("user_id", pedido.prestador_id)
      .eq("tipo", "confirmacao_d1")
      .contains("payload", { order_id: pedido.id })
      .maybeSingle();
    if (jaNotificado) continue;

    await notificarUsuario(
      pedido.prestador_id,
      "confirmacao_d1",
      "Confirme sua presença amanhã",
      "Você tem um serviço agendado para amanhã. Confirme sua presença ou o pedido será liberado para outro montador.",
      { order_id: pedido.id },
      `/prestador/pedidos/${pedido.id}`,
    );
    notificados += 1;
  }

  return NextResponse.json({ notificados });
}
