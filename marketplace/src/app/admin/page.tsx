import { createAdminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import { formatBRL } from "@/lib/utils";

export default async function AdminDashboardPage() {
  const admin = createAdminClient();

  const [{ count: totalPedidos }, { count: pedidosHoje }, { count: prestadoresPendentes }, { data: pedidosConcluidos }, { data: pedidosCancelados }] =
    await Promise.all([
      admin.from("orders").select("*", { count: "exact", head: true }),
      admin
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("data_agendada", new Date().toISOString().slice(0, 10)),
      admin
        .from("provider_profiles")
        .select("*", { count: "exact", head: true })
        .eq("status", "pendente"),
      admin.from("orders").select("valor_acordado").eq("status", "aceito_cliente"),
      admin.from("orders").select("id").eq("status", "cancelado"),
    ]);

  const gmv = (pedidosConcluidos ?? []).reduce((acc, o) => acc + Number(o.valor_acordado ?? 0), 0);
  const totalFinalizados = pedidosConcluidos?.length ?? 0;
  const totalCancelados = pedidosCancelados?.length ?? 0;
  const taxaConclusao =
    totalFinalizados + totalCancelados > 0
      ? ((totalFinalizados / (totalFinalizados + totalCancelados)) * 100).toFixed(0)
      : "—";

  const metrics = [
    { label: "GMV (pedidos concluídos)", value: formatBRL(gmv) },
    { label: "Pedidos no total", value: totalPedidos ?? 0 },
    { label: "Pedidos hoje", value: pedidosHoje ?? 0 },
    { label: "Taxa de conclusão", value: `${taxaConclusao}%` },
    { label: "Prestadores aguardando aprovação", value: prestadoresPendentes ?? 0 },
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Painel</h1>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <p className="text-sm text-[#545454]">{metric.label}</p>
            <p className="mt-1 text-2xl font-bold">{metric.value}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
