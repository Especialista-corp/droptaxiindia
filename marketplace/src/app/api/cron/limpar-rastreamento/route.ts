import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verificarCronSecret } from "@/lib/cron-auth";

/** Tempo suficiente para servir de evidência em uma disputa sobre o deslocamento. */
const RETENCAO_DIAS = 7;

/**
 * Cada deslocamento grava uma posição de GPS a cada ~4 segundos; sem limpeza a
 * tabela cresce sem parar e consome o espaço do banco.
 */
export async function GET(request: Request) {
  const unauthorized = verificarCronSecret(request);
  if (unauthorized) return unauthorized;

  const limite = new Date(Date.now() - RETENCAO_DIAS * 24 * 3_600_000).toISOString();
  const { error, count } = await createAdminClient()
    .from("tracking_positions")
    .delete({ count: "exact" })
    .lt("criado_em", limite);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ removidas: count ?? 0 });
}
