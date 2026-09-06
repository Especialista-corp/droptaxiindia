import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, ListRow } from "@/components/ui/card";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/constants";
import { formatDataAgendada } from "@/lib/utils";

export default async function PrestadorAgendaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: pedidos } = await supabase
    .from("orders")
    .select("id, status, data_agendada, janela_inicio, janela_fim")
    .eq("prestador_id", user!.id)
    .in("status", ["agendado", "confirmado", "em_deslocamento", "em_execucao"])
    .order("data_agendada");

  const porDia = new Map<string, typeof pedidos>();
  for (const pedido of pedidos ?? []) {
    const lista = porDia.get(pedido.data_agendada) ?? [];
    lista.push(pedido);
    porDia.set(pedido.data_agendada, lista);
  }

  return (
    <div className="px-6 py-8">
      <h1 className="mb-6 text-2xl font-bold">Agenda</h1>
      {[...porDia.entries()].map(([dia, itens]) => (
        <div key={dia} className="mb-4">
          <p className="mb-2 font-bold">{formatDataAgendada(dia)}</p>
          <Card>
            {itens!.map((pedido) => (
              <Link key={pedido.id} href={`/prestador/pedidos/${pedido.id}`}>
                <ListRow
                  title={`${pedido.janela_inicio.slice(0, 5)}–${pedido.janela_fim.slice(0, 5)}`}
                  subtitle={ORDER_STATUS_LABELS[pedido.status as OrderStatus]}
                />
              </Link>
            ))}
          </Card>
        </div>
      ))}
      {(pedidos ?? []).length === 0 && (
        <p className="text-sm text-[#545454]">Nenhum compromisso agendado.</p>
      )}
    </div>
  );
}
