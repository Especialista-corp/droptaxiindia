"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cancelarPedidoAction } from "./actions";
import { FREE_CANCELLATION_WINDOW_HOURS } from "@/lib/constants";

export function CancelarPedidoButton({
  orderId,
  dataAgendada,
}: {
  orderId: string;
  dataAgendada: string;
}) {
  const router = useRouter();
  const [gratuito, setGratuito] = useState<boolean>();
  const [pending, setPending] = useState(false);

  async function handleCancelar() {
    setPending(true);
    try {
      await cancelarPedidoAction(orderId, gratuito ? "Cancelado pelo cliente" : "Cancelado pelo cliente (fora do prazo gratuito)");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (gratuito === undefined) {
    return (
      <Button
        variant="ghost"
        onClick={() => {
          const horasAteAgendamento = (new Date(dataAgendada).getTime() - Date.now()) / 3_600_000;
          setGratuito(horasAteAgendamento >= FREE_CANCELLATION_WINDOW_HOURS);
        }}
        className="mt-4"
      >
        Cancelar pedido
      </Button>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-[#E2E2E2] p-4">
      <p className="mb-3 text-sm text-[#545454]">
        {gratuito
          ? "Cancelamento gratuito, ainda estamos fora da janela de 24h antes do agendamento."
          : `Estamos a menos de ${FREE_CANCELLATION_WINDOW_HOURS}h do agendamento — uma taxa de cancelamento pode ser retida.`}
      </p>
      <div className="flex gap-2">
        <Button variant="danger" onClick={handleCancelar} disabled={pending} fullWidth={false} className="flex-1">
          {pending ? "Cancelando…" : "Confirmar cancelamento"}
        </Button>
        <Button variant="secondary" onClick={() => setGratuito(undefined)} fullWidth={false} className="flex-1">
          Voltar
        </Button>
      </div>
    </div>
  );
}
