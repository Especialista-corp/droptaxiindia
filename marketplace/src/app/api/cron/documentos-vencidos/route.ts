import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verificarCronSecret } from "@/lib/cron-auth";
import { notificarUsuario } from "@/lib/notify";

/**
 * Prestadores são aprovados automaticamente no cadastro, mas têm 7 dias para
 * enviar comprovante de endereço e certidão negativa de antecedentes
 * criminais. Vencido o prazo sem os dois documentos, a conta é suspensa até o
 * envio (a reativação é automática ao completar os uploads).
 */
export async function GET(request: Request) {
  const unauthorized = verificarCronSecret(request);
  if (unauthorized) return unauthorized;

  const admin = createAdminClient();
  const { data: vencidos } = await admin
    .from("provider_profiles")
    .select("user_id, comprovante_endereco_url, certidao_negativa_url")
    .eq("status", "aprovado")
    .lt("documentos_prazo_em", new Date().toISOString())
    .or("comprovante_endereco_url.is.null,certidao_negativa_url.is.null");

  let suspensos = 0;
  for (const provider of vencidos ?? []) {
    await admin
      .from("provider_profiles")
      .update({ status: "suspenso" })
      .eq("user_id", provider.user_id);

    await notificarUsuario(
      provider.user_id,
      "suspensao_documentos",
      "Conta suspensa — documentos pendentes",
      "O prazo de 7 dias para envio dos documentos venceu. Envie o comprovante de endereço e a certidão negativa para reativar sua conta automaticamente.",
      {},
      "/prestador/cadastro-pendente",
    );
    suspensos += 1;
  }

  return NextResponse.json({ suspensos });
}
