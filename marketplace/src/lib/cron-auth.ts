import "server-only";
import { NextResponse } from "next/server";

/**
 * Protege rotas de cron: exige `Authorization: Bearer ${CRON_SECRET}`.
 * Em produção, sem CRON_SECRET definido as rotas ficam fechadas — elas mexem
 * em pedidos e pagamentos e estão expostas na internet.
 */
export function verificarCronSecret(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV !== "production") return null;
    return NextResponse.json({ error: "CRON_SECRET não configurado" }, { status: 503 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  return null;
}
