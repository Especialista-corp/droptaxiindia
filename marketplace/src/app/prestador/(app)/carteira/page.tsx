import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { formatBRL, formatDataAgendada } from "@/lib/utils";

export default async function PrestadorCarteiraPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: pedidos } = await supabase
    .from("orders")
    .select("id, data_agendada, valor_acordado, comissao_percent, status, payments(*)")
    .eq("prestador_id", user!.id)
    .in("status", ["agendado", "confirmado", "em_deslocamento", "em_execucao", "concluido_prestador", "aceito_cliente"])
    .order("data_agendada", { ascending: false });

  let saldoRetido = 0;
  let saldoLiberado = 0;
  const historico: { data: string; valor: number; status: string }[] = [];

  for (const pedido of pedidos ?? []) {
    for (const pagamento of pedido.payments) {
      const liquido = pagamento.valor - pagamento.comissao;
      if (pagamento.status === "retido") saldoRetido += liquido;
      if (pagamento.status === "liberado") {
        saldoLiberado += liquido;
        historico.push({ data: pedido.data_agendada, valor: liquido, status: "liberado" });
      }
    }
  }

  return (
    <div className="px-6 py-8">
      <h1 className="mb-6 text-2xl font-bold">Carteira</h1>
      <div className="mb-6 grid grid-cols-2 gap-4">
        <Card>
          <p className="text-sm text-[#545454]">Saldo retido</p>
          <p className="mt-1 text-2xl font-bold">{formatBRL(saldoRetido)}</p>
        </Card>
        <Card>
          <p className="text-sm text-[#545454]">Saldo liberado</p>
          <p className="mt-1 text-2xl font-bold text-[#127A3E]">{formatBRL(saldoLiberado)}</p>
        </Card>
      </div>

      <h2 className="mb-3 font-bold">Histórico de repasses</h2>
      <Card>
        {historico.map((item, index) => (
          <div
            key={index}
            className="flex justify-between border-b border-[#E2E2E2] py-2 text-sm last:border-b-0"
          >
            <span>{formatDataAgendada(item.data)}</span>
            <span className="font-medium text-[#127A3E]">+{formatBRL(item.valor)}</span>
          </div>
        ))}
        {historico.length === 0 && (
          <p className="py-2 text-sm text-[#545454]">Nenhum repasse ainda.</p>
        )}
      </Card>
      <p className="mt-4 text-xs text-[#545454]">
        Os saques via Pix para sua conta cadastrada são processados automaticamente pelo Asaas
        após a liberação de cada pagamento.
      </p>
    </div>
  );
}
