"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function salvarDocumentosAction(urls: {
  documentoUrl: string;
  selfieUrl: string;
  comprovanteEnderecoUrl: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const { error } = await supabase
    .from("provider_profiles")
    .update({
      documento_url: urls.documentoUrl,
      selfie_url: urls.selfieUrl,
      comprovante_endereco_url: urls.comprovanteEnderecoUrl,
    })
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/prestador/cadastro-pendente");
  return { error: undefined };
}
