import { createAdminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import { formatBRL, formatDataAgendada } from "@/lib/utils";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/constants";

export default async function AdminPedidosPage() {
  const admin = createAdminClient();
  const { data: pedidos } = await admin
    .from("orders")
    .select(
      "id, status, data_agendada, valor_acordado, valor_tabela, comissao_percent, no_show_prestador, cliente:cliente_id(nome), prestador:prestador_id(nome)",
    )
    .order("criado_em", { ascending: false })
    .limit(100);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Pedidos</h1>
      <div className="flex flex-col gap-3">
        {(pedidos ?? []).map((pedido) => {
          const cliente = Array.isArray(pedido.cliente) ? pedido.cliente[0] : pedido.cliente;
          const prestador = Array.isArray(pedido.prestador) ? pedido.prestador[0] : pedido.prestador;
          const valor = pedido.valor_acordado ?? pedido.valor_tabela;
          const comissao = (valor * pedido.comissao_percent) / 100;
          return (
            <Card key={pedido.id} className="flex items-center justify-between gap-4">
              <div>
                <p className="font-bold">
                  {formatDataAgendada(pedido.data_agendada)} · {cliente?.nome ?? "—"} →{" "}
                  {prestador?.nome ?? "sem prestador"}
                </p>
                <p className="text-sm text-[#545454]">
                  {formatBRL(valor)} · comissão {formatBRL(comissao)}
                  {pedido.no_show_prestador && " · no-show do prestador"}
                </p>
              </div>
              <span
                className={
                  pedido.status === "disputa"
                    ? "rounded-full bg-[#BB032A] px-3 py-1 text-xs font-bold text-white"
                    : "rounded-full bg-[#F6F6F6] px-3 py-1 text-xs font-medium"
                }
              >
                {ORDER_STATUS_LABELS[pedido.status as OrderStatus]}
              </span>
            </Card>
          );
        })}
        {(pedidos ?? []).length === 0 && <p className="text-[#545454]">Nenhum pedido ainda.</p>}
      </div>
    </div>
  );
}
