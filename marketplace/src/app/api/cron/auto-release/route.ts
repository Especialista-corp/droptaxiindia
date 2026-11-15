import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verificarCronSecret } from "@/lib/cron-auth";
import { AUTO_RELEASE_WINDOW_HOURS } from "@/lib/constants";

/**
 * Regra de negócio 3: liberação automática do pagamento final 72h após a
 * postagem das fotos de conclusão, caso o cliente não conteste.
 */
export async function GET(request: Request) {
  const unauthorized = verificarCronSecret(request);
  if (unauthorized) return unauthorized;

  const admin = createAdminClient();
  const limite = new Date(Date.now() - AUTO_RELEASE_WINDOW_HOURS * 3_600_000).toISOString();

  const { data: pedidos } = await admin
    .from("orders")
    .select("id, completion_photos(enviado_em)")
    .eq("status", "concluido_prestador");

  let liberados = 0;
  for (const pedido of pedidos ?? []) {
    const primeiraFoto = pedido.completion_photos
      .map((f) => f.enviado_em)
      .sort()[0];
    if (!primeiraFoto || primeiraFoto > limite) continue;

    await admin.from("orders").update({ status: "aceito_cliente" }).eq("id", pedido.id);
    await admin
      .from("payments")
      .update({ status: "liberado", liberado_em: new Date().toISOString() })
      .eq("order_id", pedido.id)
      .eq("status", "retido");
    liberados += 1;
  }

  return NextResponse.json({ liberados });
}
