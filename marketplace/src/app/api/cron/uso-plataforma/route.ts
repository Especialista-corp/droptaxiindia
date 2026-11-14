import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verificarCronSecret } from "@/lib/cron-auth";
import { notificarUsuario } from "@/lib/notify";
import { obterUsoDaPlataforma } from "@/lib/usage";

const INTERVALO_ENTRE_AVISOS_DIAS = 7;

/**
 * Avisa os administradores quando o consumo se aproxima do limite do plano do
 * Supabase (70% = atenção, 90% = crítico). O mesmo aviso só se repete a cada 7
 * dias; se o nível piorar (atenção → crítico), avisa de novo na hora.
 */
export async function GET(request: Request) {
  const unauthorized = verificarCronSecret(request);
  if (unauthorized) return unauthorized;

  const metricas = await obterUsoDaPlataforma();
  if (!metricas) {
    return NextResponse.json({ error: "platform_usage indisponível" }, { status: 500 });
  }

  const emAlerta = metricas.filter((metrica) => metrica.nivel !== "ok");
  if (emAlerta.length === 0) return NextResponse.json({ avisos: 0, metricas });

  const admin = createAdminClient();
  const { data: admins } = await admin.from("users").select("id").eq("role", "admin");
  const desde = new Date(
    Date.now() - INTERVALO_ENTRE_AVISOS_DIAS * 24 * 3_600_000,
  ).toISOString();

  let avisos = 0;
  for (const metrica of emAlerta) {
    for (const { id: adminId } of admins ?? []) {
      const { data: jaAvisado } = await admin
        .from("notifications")
        .select("id")
        .eq("user_id", adminId)
        .eq("tipo", "uso_limite")
        .contains("payload", { chave: metrica.chave, nivel: metrica.nivel })
        .gte("criado_em", desde)
        .limit(1);
      if (jaAvisado?.length) continue;

      await notificarUsuario(
        adminId,
        "uso_limite",
        metrica.nivel === "critico"
          ? `URGENTE: ${metrica.rotulo} em ${metrica.percent}% do limite`
          : `Atenção: ${metrica.rotulo} em ${metrica.percent}% do limite`,
        `${metrica.rotulo}: ${metrica.usadoTexto} de ${metrica.limiteTexto} do plano atual do Supabase. ` +
          (metrica.nivel === "critico"
            ? "Faça o upgrade do plano agora para o app não parar de aceitar dados."
            : "Planeje o upgrade do plano nas próximas semanas."),
        { chave: metrica.chave, nivel: metrica.nivel, percent: metrica.percent },
        "/admin",
      );
      avisos += 1;
    }
  }

  return NextResponse.json({ avisos, metricas });
}
