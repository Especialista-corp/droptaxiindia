import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, ListRow } from "@/components/ui/card";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/constants";
import { formatDataAgendada } from "@/lib/utils";

export default async function ClientePedidosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: pedidos } = await supabase
    .from("orders")
    .select("id, status, data_agendada")
    .eq("cliente_id", user!.id)
    .order("criado_em", { ascending: false });

  return (
    <div className="px-6 py-8">
      <h1 className="mb-6 text-2xl font-bold">Meus pedidos</h1>
      <Card>
        {(pedidos ?? []).map((pedido) => (
          <Link key={pedido.id} href={`/cliente/pedidos/${pedido.id}`}>
            <ListRow
              title={formatDataAgendada(pedido.data_agendada)}
              subtitle={ORDER_STATUS_LABELS[pedido.status as OrderStatus]}
            />
          </Link>
        ))}
        {(pedidos ?? []).length === 0 && (
          <p className="py-2 text-sm text-[#545454]">Você ainda não fez nenhum pedido.</p>
        )}
      </Card>
    </div>
  );
}
