"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { MAX_NO_SHOW_STRIKES } from "@/lib/constants";
import type { ProviderProfilesRow } from "@/types/database";

const CAMPOS_PERMITIDOS = {
  documento: "documento_url",
  selfie: "selfie_url",
  comprovante_endereco: "comprovante_endereco_url",
  certidao_negativa: "certidao_negativa_url",
} as const;

export type TipoDocumento = keyof typeof CAMPOS_PERMITIDOS;

export async function salvarDocumentoAction(tipo: TipoDocumento, path: string) {
  const campo = CAMPOS_PERMITIDOS[tipo];
  if (!campo) return { error: "Tipo de documento inválido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const atualizacao: Partial<ProviderProfilesRow> = { [campo]: path };
  const { error } = await supabase
    .from("provider_profiles")
    .update(atualizacao)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  // Se a conta foi suspensa por falta de documentos, reativa automaticamente
  // assim que os dois obrigatórios estiverem arquivados (desde que o prestador
  // não esteja suspenso por strikes de no-show).
  const { data: provider } = await supabase
    .from("provider_profiles")
    .select("status, comprovante_endereco_url, certidao_negativa_url, strikes")
    .eq("user_id", user.id)
    .single();

  if (
    provider?.status === "suspenso" &&
    provider.comprovante_endereco_url &&
    provider.certidao_negativa_url &&
    provider.strikes < MAX_NO_SHOW_STRIKES
  ) {
    await supabase
      .from("provider_profiles")
      .update({ status: "aprovado" })
      .eq("user_id", user.id);
  }

  revalidatePath("/prestador/documentos");
  revalidatePath("/prestador", "layout");
  return { error: undefined };
}
