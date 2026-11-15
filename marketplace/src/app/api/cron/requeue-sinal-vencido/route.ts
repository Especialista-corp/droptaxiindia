import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verificarCronSecret } from "@/lib/cron-auth";

/**
 * Regra de negócio 1: sem pagamento do sinal em até 2h após o fechamento do
 * pedido, ele volta para a fila (status "aberto") e libera o montador para
 * atender outros pedidos.
 */
export async function GET(request: Request) {
  const unauthorized = verificarCronSecret(request);
  if (unauthorized) return unauthorized;

  const admin = createAdminClient();
  const { data: vencidos } = await admin
    .from("orders")
    .select("id, sinal_prazo_em, payments(status, tipo)")
    .eq("status", "agendado")
    .lt("sinal_prazo_em", new Date().toISOString());

  let requeued = 0;
  for (const order of vencidos ?? []) {
    const sinal = order.payments.find((p) => p.tipo === "sinal_50");
    if (sinal?.status === "retido" || sinal?.status === "liberado") continue;

    await admin
      .from("orders")
      .update({
        status: "aberto",
        prestador_id: null,
        valor_acordado: null,
        sinal_prazo_em: null,
      })
      .eq("id", order.id);
    await admin
      .from("proposals")
      .update({ status: "expirada" })
      .eq("order_id", order.id)
      .eq("status", "aceita");
    requeued += 1;
  }

  return NextResponse.json({ requeued });
}
