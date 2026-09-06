import "server-only";
import { NextResponse } from "next/server";

/** Protege rotas de cron: exige `Authorization: Bearer ${CRON_SECRET}`. */
export function verificarCronSecret(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) return null; // Sem secret configurado, roda livre (uso local/dev).
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  return null;
}
