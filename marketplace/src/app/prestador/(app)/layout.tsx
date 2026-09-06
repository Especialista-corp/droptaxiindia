import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/nav/bottom-nav";
import { diasRestantesAte } from "@/lib/utils";

export default async function PrestadorLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("provider_profiles")
    .select("status, comprovante_endereco_url, certidao_negativa_url, documentos_prazo_em")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.status !== "aprovado") {
    redirect("/prestador/cadastro-pendente");
  }

  const documentosPendentes =
    !profile.comprovante_endereco_url || !profile.certidao_negativa_url;
  const diasRestantes = diasRestantesAte(profile.documentos_prazo_em);

  return (
    <div className="flex min-h-full flex-1 flex-col pb-20">
      {documentosPendentes && (
        <Link
          href="/prestador/documentos"
          className="flex items-center gap-2 bg-black px-4 py-3 text-sm font-medium text-white"
        >
          <AlertTriangle size={18} className="shrink-0" />
          <span>
            Envie seus documentos
            {diasRestantes !== null &&
              ` — ${diasRestantes} ${diasRestantes === 1 ? "dia restante" : "dias restantes"}`}
            . Toque aqui.
          </span>
        </Link>
      )}
      {children}
      <BottomNav
        items={[
          { href: "/prestador/pedidos", label: "Pedidos", icon: "pedidos" },
          { href: "/prestador/agenda", label: "Agenda", icon: "agenda" },
          { href: "/prestador/carteira", label: "Carteira", icon: "carteira" },
          { href: "/prestador/perfil", label: "Perfil", icon: "perfil" },
        ]}
      />
    </div>
  );
}
