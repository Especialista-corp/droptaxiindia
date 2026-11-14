import Link from "next/link";
import { MailCheck } from "lucide-react";
import { PROVIDER_DOCS_DEADLINE_DAYS } from "@/lib/constants";

export default async function VerifiqueEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12">
      <div className="mx-auto w-full max-w-sm text-center">
        <MailCheck className="mx-auto mb-4 text-brand-soft" size={48} />
        <h1 className="mb-2 text-2xl font-bold">Confirme seu e-mail</h1>
        <p className="mb-2 text-muted">
          Enviamos uma mensagem{email ? <> para <strong className="text-foreground">{email}</strong></> : ""}.
          Abra o e-mail e clique no link para confirmar o seu cadastro.
        </p>
        <p className="mb-8 text-sm text-muted">
          Não achou? Olhe também a caixa de spam. Depois de confirmar, entre e envie seus documentos:
          você tem {PROVIDER_DOCS_DEADLINE_DAYS} dias.
        </p>
        <Link
          href="/login"
          className="inline-flex h-14 w-full items-center justify-center rounded-full bg-brand-gradient font-bold text-on-brand"
        >
          Ir para o login
        </Link>
      </div>
    </div>
  );
}
