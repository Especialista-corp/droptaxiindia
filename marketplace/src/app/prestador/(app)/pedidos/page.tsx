import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, ListRow } from "@/components/ui/card";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/constants";
import { formatBRL, formatDataAgendada } from "@/lib/utils";
import { distanciaKm } from "@/lib/geo";

export default async function PrestadorPedidosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: provider }, { data: categorias }] = await Promise.all([
    supabase
      .from("provider_profiles")
      .select("raio_km, lat_base, lng_base")
      .eq("user_id", user!.id)
      .single(),
    supabase.from("provider_service_categories").select("category_id").eq("provider_id", user!.id),
  ]);

  const categoryIds = (categorias ?? []).map((c) => c.category_id);

  const { data: abertos } = categoryIds.length
    ? await supabase
        .from("orders")
        .select("id, status, data_agendada, valor_tabela, lat, lng, endereco, cidade")
        .in("status", ["aberto", "proposto"])
        .in("category_id", categoryIds)
        .order("data_agendada")
    : { data: [] };

  const abertosNoRaio = (abertos ?? []).filter((pedido) => {
    if (!provider?.lat_base || !provider?.lng_base || !pedido.lat || !pedido.lng) return true;
    return distanciaKm(provider.lat_base, provider.lng_base, pedido.lat, pedido.lng) <= provider.raio_km;
  });

  const { data: meusPedidos } = await supabase
    .from("orders")
    .select("id, status, data_agendada, valor_acordado")
    .eq("prestador_id", user!.id)
    .not("status", "in", "(aceito_cliente,cancelado)")
    .order("data_agendada");

  return (
    <div className="px-6 py-8">
      <h1 className="mb-6 text-2xl font-bold">Pedidos</h1>

      <h2 className="mb-3 font-bold">Meus pedidos ativos</h2>
      <Card className="mb-8">
        {(meusPedidos ?? []).map((pedido) => (
          <Link key={pedido.id} href={`/prestador/pedidos/${pedido.id}`}>
            <ListRow
              title={formatDataAgendada(pedido.data_agendada)}
              subtitle={`${ORDER_STATUS_LABELS[pedido.status as OrderStatus]} · ${formatBRL(pedido.valor_acordado ?? 0)}`}
            />
          </Link>
        ))}
        {(meusPedidos ?? []).length === 0 && (
          <p className="py-2 text-sm text-[#545454]">Nenhum pedido ativo no momento.</p>
        )}
      </Card>

      <h2 className="mb-3 font-bold">Pedidos disponíveis perto de você</h2>
      <Card>
        {abertosNoRaio.map((pedido) => (
          <Link key={pedido.id} href={`/prestador/pedidos/${pedido.id}`}>
            <ListRow
              title={`${formatDataAgendada(pedido.data_agendada)} · ${pedido.cidade ?? pedido.endereco}`}
              subtitle={`Tabela: ${formatBRL(pedido.valor_tabela)}`}
            />
          </Link>
        ))}
        {abertosNoRaio.length === 0 && (
          <p className="py-2 text-sm text-[#545454]">
            Nenhum pedido disponível no seu raio de atuação agora.
          </p>
        )}
      </Card>
    </div>
  );
}
