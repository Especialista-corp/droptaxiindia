import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { logoutAction } from "../../../(auth)/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AtivarNotificacoesButton } from "@/components/pwa/ativar-notificacoes-button";

export default async function PrestadorPerfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: provider }] = await Promise.all([
    supabase.from("users").select("nome, email, telefone").eq("id", user.id).single(),
    supabase
      .from("provider_profiles")
      .select("raio_km, nota_media, total_avaliacoes, selo_verificado, veiculo_tipo, veiculo_cor, veiculo_porte, strikes")
      .eq("user_id", user.id)
      .single(),
  ]);

  return (
    <div className="px-6 py-8">
      <h1 className="mb-6 text-2xl font-bold">Meu perfil</h1>
      <Card className="mb-4">
        <div className="mb-2 flex items-center gap-2">
          <p className="font-bold">{profile?.nome}</p>
          {provider?.selo_verificado && (
            <span className="rounded-full bg-black px-2 py-0.5 text-xs font-bold text-white">
              Montador Verificado
            </span>
          )}
        </div>
        <p className="text-sm text-[#545454]">{profile?.email}</p>
        <p className="text-sm text-[#545454]">{profile?.telefone}</p>
      </Card>
      <Card className="mb-4">
        <p className="mb-2 font-bold">Atuação</p>
        <p className="text-sm text-[#545454]">Raio: {provider?.raio_km}km</p>
        <p className="text-sm text-[#545454]">
          Veículo: {provider?.veiculo_tipo} {provider?.veiculo_cor}
          {provider?.veiculo_porte ? ` (${provider.veiculo_porte})` : ""}
        </p>
        <p className="text-sm text-[#545454]">
          Nota média: {provider?.nota_media?.toFixed(1) ?? "—"} ({provider?.total_avaliacoes ?? 0}{" "}
          avaliações)
        </p>
        {(provider?.strikes ?? 0) > 0 && (
          <p className="text-sm text-[#BB032A]">{provider?.strikes} strike(s) de no-show</p>
        )}
      </Card>
      <Link
        href="/prestador/documentos"
        className="mb-4 flex items-center justify-between rounded-xl border border-[#E2E2E2] bg-white p-4"
      >
        <span className="font-medium">Meus documentos</span>
        <ChevronRight size={20} className="text-[#545454]" />
      </Link>
      <div className="mb-4">
        <AtivarNotificacoesButton />
      </div>
      <form action={logoutAction}>
        <Button variant="secondary" type="submit">
          Sair
        </Button>
      </form>
    </div>
  );
}
