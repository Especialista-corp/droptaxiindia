import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Bike, Car, Truck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { logoutAction } from "../../../(auth)/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AtivarNotificacoesButton } from "@/components/pwa/ativar-notificacoes-button";
import { TRUCK_SIZE_LABELS } from "@/lib/constants";
import { usarVeiculoAction } from "./veiculos-actions";

const VEICULO_LABEL = {
  moto: "Moto",
  carro: "Carro",
  pickup: "Pickup / Fiorino",
  caminhao: "Caminhão",
} as const;

export default async function PrestadorPerfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: provider }, { data: veiculos }] = await Promise.all([
    supabase.from("users").select("nome, email, telefone").eq("id", user.id).single(),
    supabase
      .from("provider_profiles")
      .select("raio_km, nota_media, total_avaliacoes, selo_verificado, strikes")
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("provider_vehicles")
      .select("id, tipo, cor, porte, placa, em_uso")
      .eq("provider_id", user.id)
      .order("criado_em"),
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
          Nota média: {provider?.nota_media?.toFixed(1) ?? "—"} ({provider?.total_avaliacoes ?? 0}{" "}
          avaliações)
        </p>
        {(provider?.strikes ?? 0) > 0 && (
          <p className="text-sm text-[#BB032A]">{provider?.strikes} strike(s) de no-show</p>
        )}
      </Card>

      <Card className="mb-4">
        <p className="mb-2 font-bold">Meus veículos</p>
        {(veiculos ?? []).map((veiculo) => {
          const Icone = veiculo.tipo === "moto" ? Bike : veiculo.tipo === "caminhao" ? Truck : Car;
          return (
            <div
              key={veiculo.id}
              className="flex items-center gap-3 border-b border-[#E2E2E2] py-3 last:border-b-0"
            >
              <Icone size={22} className="shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {VEICULO_LABEL[veiculo.tipo]} {veiculo.cor}
                  {veiculo.porte ? ` · ${TRUCK_SIZE_LABELS[veiculo.porte]}` : ""}
                </p>
                <p className="text-sm text-[#545454]">Placa {veiculo.placa}</p>
              </div>
              {veiculo.em_uso ? (
                <span className="shrink-0 rounded-full bg-black px-3 py-1 text-xs font-bold text-white">
                  Em uso
                </span>
              ) : (
                <form
                  action={async () => {
                    "use server";
                    await usarVeiculoAction(veiculo.id);
                  }}
                >
                  <button
                    type="submit"
                    className="shrink-0 rounded-full border border-[#E2E2E2] px-3 py-1 text-xs font-medium"
                  >
                    Usar este
                  </button>
                </form>
              )}
            </div>
          );
        })}
        {(veiculos ?? []).length === 0 && (
          <p className="py-2 text-sm text-[#545454]">Nenhum veículo cadastrado.</p>
        )}
        <p className="mt-2 text-xs text-[#545454]">
          O veículo &ldquo;em uso&rdquo; é o que o cliente vê no mapa durante o deslocamento.
        </p>
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
