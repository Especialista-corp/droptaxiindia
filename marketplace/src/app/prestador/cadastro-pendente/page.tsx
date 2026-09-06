import { redirect } from "next/navigation";
import { ExternalLink, XCircle, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CERTIDAO_ANTECEDENTES_URL, MAX_NO_SHOW_STRIKES } from "@/lib/constants";
import { logoutAction } from "../../(auth)/actions";
import { DocumentoUpload } from "../(app)/documentos/documento-upload";

export default async function CadastroPendentePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: provider } = await supabase
    .from("provider_profiles")
    .select("status, comprovante_endereco_url, certidao_negativa_url, strikes")
    .eq("user_id", user.id)
    .single();

  if (provider?.status === "aprovado") {
    redirect("/prestador/pedidos");
  }

  const suspensoPorStrikes = (provider?.strikes ?? 0) >= MAX_NO_SHOW_STRIKES;
  const documentosPendentes =
    !provider?.comprovante_endereco_url || !provider?.certidao_negativa_url;

  return (
    <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12">
      <div className="mx-auto w-full max-w-sm">
        {suspensoPorStrikes ? (
          <div className="text-center">
            <XCircle className="mx-auto mb-4 text-[#BB032A]" size={48} />
            <h1 className="mb-2 text-2xl font-bold">Conta suspensa</h1>
            <p className="text-[#545454]">
              Sua conta foi suspensa após {MAX_NO_SHOW_STRIKES} faltas em serviços agendados.
              Entre em contato com o suporte para mais informações.
            </p>
          </div>
        ) : documentosPendentes ? (
          <>
            <div className="mb-6 text-center">
              <Clock className="mx-auto mb-4 text-black" size={48} />
              <h1 className="mb-2 text-2xl font-bold">Conta suspensa temporariamente</h1>
              <p className="text-[#545454]">
                O prazo para envio dos documentos obrigatórios venceu. Envie-os abaixo e sua
                conta será reativada automaticamente.
              </p>
            </div>
            <Card>
              <DocumentoUpload
                userId={user.id}
                tipo="comprovante_endereco"
                titulo="Comprovante de endereço"
                descricao="Conta de água, luz ou telefone no seu nome (últimos 90 dias)."
                enviado={Boolean(provider?.comprovante_endereco_url)}
              />
              <DocumentoUpload
                userId={user.id}
                tipo="certidao_negativa"
                titulo="Certidão negativa de antecedentes criminais"
                descricao="Emitida gratuitamente no site da Polícia Federal."
                enviado={Boolean(provider?.certidao_negativa_url)}
              />
              <a
                href={CERTIDAO_ANTECEDENTES_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex items-center gap-2 text-sm font-bold text-black underline"
              >
                <ExternalLink size={16} />
                Emitir certidão de antecedentes criminais (gov.br — grátis)
              </a>
            </Card>
          </>
        ) : (
          <div className="text-center">
            <Clock className="mx-auto mb-4 text-black" size={48} />
            <h1 className="mb-2 text-2xl font-bold">Conta em análise</h1>
            <p className="text-[#545454]">
              Seus documentos foram recebidos e estão em revisão pela nossa equipe. Você será
              avisado assim que sua conta for liberada.
            </p>
          </div>
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
