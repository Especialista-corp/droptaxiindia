import Link from "next/link";
import { Wrench } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, ListRow } from "@/components/ui/card";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/constants";
import { formatDataAgendada } from "@/lib/utils";

export default async function ClienteHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: pedidosAtivos } = await supabase
    .from("orders")
    .select("id, status, data_agendada")
    .eq("cliente_id", user!.id)
    .not("status", "in", "(aceito_cliente,cancelado)")
    .order("criado_em", { ascending: false })
    .limit(5);

  return (
    <div className="px-6 py-8">
      <h1 className="mb-6 text-2xl font-bold">Olá 👋</h1>

      <Link href="/cliente/novo-pedido">
        <Card className="mb-8 flex items-center gap-4 border-black">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black text-white">
            <Wrench size={22} />
          </div>
          <div className="flex-1">
            <p className="font-bold">Montar um móvel</p>
            <p className="text-sm text-[#545454]">Veja o preço e agende em minutos</p>
          </div>
        </Card>
      </Link>

      <h2 className="mb-3 font-bold">Pedidos em andamento</h2>
      <Card>
        {(pedidosAtivos ?? []).map((pedido) => (
          <Link key={pedido.id} href={`/cliente/pedidos/${pedido.id}`}>
            <ListRow
              title={formatDataAgendada(pedido.data_agendada)}
              subtitle={ORDER_STATUS_LABELS[pedido.status as OrderStatus]}
            />
          </Link>
        ))}
        {(pedidosAtivos ?? []).length === 0 && (
          <p className="py-2 text-sm text-[#545454]">Nenhum pedido em andamento.</p>
        )}
      </Card>

      <Link href="/cliente/pedidos" className="mt-4 block">
        <Button variant="ghost">Ver todos os pedidos</Button>
      </Link>
    </div>
  );
}
