import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verificarCronSecret } from "@/lib/cron-auth";

/**
 * Regra de negócio 2: prestador que não confirmar presença até D-1 perde o
 * pedido automaticamente — reabre para outros montadores.
 */
export async function GET(request: Request) {
  const unauthorized = verificarCronSecret(request);
  if (unauthorized) return unauthorized;

  const admin = createAdminClient();
  const hojeISO = new Date().toISOString().slice(0, 10);

  const { data: pedidos } = await admin
    .from("orders")
    .select("id, prestador_id")
    .eq("status", "agendado")
    .lte("data_agendada", hojeISO)
    .is("confirmado_prestador_em", null);

  let realocados = 0;
  for (const pedido of pedidos ?? []) {
    await admin
      .from("orders")
      .update({ status: "aberto", prestador_id: null, valor_acordado: null })
      .eq("id", pedido.id);

    await admin
      .from("proposals")
      .update({ status: "expirada" })
      .eq("order_id", pedido.id)
      .eq("status", "aceita");

    if (pedido.prestador_id) {
      await admin.from("notifications").insert({
        user_id: pedido.prestador_id,
        tipo: "pedido_perdido_sem_confirmacao",
        payload: { order_id: pedido.id },
      });
    }
    realocados += 1;
  }

  return NextResponse.json({ realocados });
}
