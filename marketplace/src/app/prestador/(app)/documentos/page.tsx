import { redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { CERTIDAO_ANTECEDENTES_URL } from "@/lib/constants";
import { diasRestantesAte } from "@/lib/utils";
import { DocumentoUpload } from "./documento-upload";

export default async function PrestadorDocumentosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: provider } = await supabase
    .from("provider_profiles")
    .select(
      "documento_url, selfie_url, comprovante_endereco_url, certidao_negativa_url, documentos_prazo_em",
    )
    .eq("user_id", user.id)
    .single();

  if (!provider) redirect("/prestador/cadastro-pendente");

  const obrigatoriosPendentes =
    !provider.comprovante_endereco_url || !provider.certidao_negativa_url;
  const dias = diasRestantesAte(provider.documentos_prazo_em);

  return (
    <div className="px-6 py-8">
      <h1 className="mb-2 text-2xl font-bold">Meus documentos</h1>

      {obrigatoriosPendentes && dias !== null && (
        <div
          className={`mb-6 rounded-lg p-4 text-sm font-medium text-white ${
            dias <= 2 ? "bg-[#BB032A]" : "bg-black"
          }`}
        >
          Você tem {dias} {dias === 1 ? "dia" : "dias"} para enviar o comprovante de endereço e a
          certidão negativa de antecedentes criminais. Após o prazo, sua conta será suspensa até o
          envio.
        </div>
      )}
      {!obrigatoriosPendentes && (
        <p className="mb-6 text-sm font-medium text-[#127A3E]">
          Documentos obrigatórios enviados. Nossa equipe pode revisá-los a qualquer momento.
        </p>
      )}

      <Card className="mb-4">
        <p className="mb-1 font-bold">Obrigatórios</p>
        <DocumentoUpload
          userId={user.id}
          tipo="comprovante_endereco"
          titulo="Comprovante de endereço"
          descricao="Conta de água, luz ou telefone no seu nome (últimos 90 dias)."
          enviado={Boolean(provider.comprovante_endereco_url)}
        />
        <DocumentoUpload
          userId={user.id}
          tipo="certidao_negativa"
          titulo="Certidão negativa de antecedentes criminais"
          descricao="Emitida gratuitamente no site da Polícia Federal."
          enviado={Boolean(provider.certidao_negativa_url)}
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

      <Card>
        <p className="mb-1 font-bold">Identificação</p>
        <DocumentoUpload
          userId={user.id}
          tipo="documento"
          titulo="Documento com foto (RG ou CNH)"
          enviado={Boolean(provider.documento_url)}
        />
        <DocumentoUpload
          userId={user.id}
          tipo="selfie"
          titulo="Selfie segurando o documento"
          enviado={Boolean(provider.selfie_url)}
        />
      </Card>

      <p className="mt-4 text-xs text-[#545454]">
        Seus documentos ficam arquivados com segurança na plataforma e são usados apenas para
        verificação do seu cadastro.
      </p>
    </div>
  );
}
