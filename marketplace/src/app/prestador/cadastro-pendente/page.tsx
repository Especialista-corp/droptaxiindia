import { redirect } from "next/navigation";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { DocumentUploadForm } from "./upload-form";
import { logoutAction } from "../../(auth)/actions";
import { Button } from "@/components/ui/button";

export default async function CadastroPendentePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("provider_profiles")
    .select("status, documento_url, selfie_url, comprovante_endereco_url")
    .eq("user_id", user.id)
    .single();

  if (profile?.status === "aprovado") {
    redirect("/prestador/pedidos");
  }

  const documentosEnviados = Boolean(
    profile?.documento_url && profile?.selfie_url && profile?.comprovante_endereco_url,
  );

  return (
    <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12">
      <div className="mx-auto w-full max-w-sm text-center">
        {profile?.status === "suspenso" ? (
          <>
            <XCircle className="mx-auto mb-4 text-[#BB032A]" size={48} />
            <h1 className="mb-2 text-2xl font-bold text-black">Cadastro suspenso</h1>
            <p className="text-[#545454]">
              Sua conta de montador foi suspensa. Entre em contato com o suporte para mais
              informações.
            </p>
          </>
        ) : !documentosEnviados ? (
          <>
            <h1 className="mb-2 text-2xl font-bold text-black">Falta pouco</h1>
            <p className="mb-6 text-[#545454]">
              Envie seus documentos para que nossa equipe possa validar seu cadastro.
            </p>
            <div className="text-left">
              <DocumentUploadForm userId={user.id} />
            </div>
          </>
        ) : (
          <>
            <Clock className="mx-auto mb-4 text-black" size={48} />
            <h1 className="mb-2 text-2xl font-bold text-black">Cadastro em análise</h1>
            <p className="text-[#545454]">
              Recebemos seus documentos. Nossa equipe vai revisar e liberar seu acesso em breve.
            </p>
            <CheckCircle2 className="mx-auto mt-6 text-[#127A3E]" size={32} />
          </>
        )}

        <form action={logoutAction} className="mt-8">
          <Button type="submit" variant="ghost">
            Sair
          </Button>
        </form>
      </div>
    </div>
  );
}
