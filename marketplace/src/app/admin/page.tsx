import { createAdminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import { AtivarNotificacoesButton } from "@/components/pwa/ativar-notificacoes-button";
import { formatBRL, cn } from "@/lib/utils";
import { obterUsoDaPlataforma, type NivelDeUso } from "@/lib/usage";

const COR_DA_BARRA: Record<NivelDeUso, string> = {
  ok: "bg-[#127A3E]",
  atencao: "bg-black",
  critico: "bg-[#BB032A]",
};

export default async function AdminDashboardPage() {
  const admin = createAdminClient();

  const [
    { count: totalPedidos },
    { count: pedidosHoje },
    { count: prestadoresPendentes },
    { data: pedidosConcluidos },
    { data: pedidosCancelados },
    uso,
  ] = await Promise.all([
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
    obterUsoDaPlataforma(),
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

  const piorNivel: NivelDeUso = uso?.some((m) => m.nivel === "critico")
    ? "critico"
    : uso?.some((m) => m.nivel === "atencao")
      ? "atencao"
      : "ok";

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Painel</h1>

      {piorNivel !== "ok" && (
        <div
          className={cn(
            "mb-6 rounded-lg p-4 text-sm font-medium text-white",
            piorNivel === "critico" ? "bg-[#BB032A]" : "bg-black",
          )}
        >
          {piorNivel === "critico"
            ? "O plano do Supabase está quase no limite. Faça o upgrade agora para o app não parar de aceitar dados."
            : "O consumo do plano do Supabase passou de 70%. Planeje o upgrade nas próximas semanas."}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <p className="text-sm text-[#545454]">{metric.label}</p>
            <p className="mt-1 text-2xl font-bold">{metric.value}</p>
          </Card>
        ))}
      </div>

      <h2 className="mb-3 mt-10 text-lg font-bold">Consumo do plano (Supabase)</h2>
      <Card>
        {uso ? (
          <div className="flex flex-col gap-5">
            {uso.map((metrica) => (
              <div key={metrica.chave}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium">{metrica.rotulo}</span>
                  <span className="text-[#545454]">
                    {metrica.usadoTexto} de {metrica.limiteTexto} · {metrica.percent}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#F6F6F6]">
                  <div
                    className={cn("h-full rounded-full", COR_DA_BARRA[metrica.nivel])}
                    style={{ width: `${Math.max(metrica.percent, 1)}%` }}
                  />
                </div>
              </div>
            ))}
            <p className="text-xs text-[#545454]">
              Você é avisado por notificação quando qualquer item passar de 70% e de novo em 90%.
              O tráfego de dados (egress) não é medido aqui — confira no painel do Supabase.
            </p>
          </div>
        ) : (
          <p className="text-sm text-[#545454]">
            Medição indisponível. Aplique a migração 0004_uso_plataforma.sql no banco.
          </p>
        )}
      </Card>

      <div className="mt-6 max-w-sm">
        <AtivarNotificacoesButton />
      </div>
    </div>
  );
}
