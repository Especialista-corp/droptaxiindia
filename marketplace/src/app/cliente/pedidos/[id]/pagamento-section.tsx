import { Card } from "@/components/ui/card";
import { formatBRL } from "@/lib/utils";
import type { PaymentsRow } from "@/types/database";
import { GerarCobrancaButton } from "./gerar-cobranca-button";

const LABELS = {
  sinal_50: {
    titulo: "Pagamento do sinal (50%)",
    descricao:
      "Pague o sinal via Pix para confirmar o agendamento. O valor fica retido com a plataforma até a conclusão do serviço.",
    retidoPrefixo: "Sinal",
  },
  final_50: {
    titulo: "Pagamento do saldo final (50%)",
    descricao:
      "Pague o restante via Pix. O valor fica retido em garantia e só é liberado ao montador quando você confirmar que o serviço ficou bom.",
    retidoPrefixo: "Saldo final",
  },
} as const;

export function PagamentoSection({
  orderId,
  payments,
  tipo,
}: {
  orderId: string;
  payments: PaymentsRow[];
  tipo: "sinal_50" | "final_50";
}) {
  const pagamento = payments.find((p) => p.tipo === tipo);
  const labels = LABELS[tipo];

  return (
    <Card className="mb-4">
      <p className="mb-2 font-bold">{labels.titulo}</p>
      {!pagamento || pagamento.status === "pendente" ? (
        <>
          <p className="mb-3 text-sm text-[#545454]">{labels.descricao}</p>
          <GerarCobrancaButton orderId={orderId} tipo={tipo} />
        </>
      ) : pagamento.status === "retido" ? (
        <p className="text-sm font-medium text-[#127A3E]">
          {labels.retidoPrefixo} de {formatBRL(pagamento.valor)} pago e retido em garantia.
        </p>
      ) : pagamento.status === "liberado" ? (
        <p className="text-sm font-medium text-[#127A3E]">
          {labels.retidoPrefixo} de {formatBRL(pagamento.valor)} liberado ao montador.
        </p>
      ) : (
        <p className="text-sm text-[#545454]">Status do pagamento: {pagamento.status}</p>
      )}
    </Card>
  );
}
