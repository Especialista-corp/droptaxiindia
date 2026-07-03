"use client";

import { useBroadcastPosition } from "@/hooks/use-broadcast-position";

export function TrackingBroadcaster({
  orderId,
  prestadorId,
}: {
  orderId: string;
  prestadorId: string;
}) {
  const { erro } = useBroadcastPosition(orderId, prestadorId, true);

  if (erro) {
    return (
      <p className="mt-2 text-xs text-[#BB032A]">
        Não foi possível compartilhar sua localização: {erro}. Ative o GPS do navegador.
      </p>
    );
  }

  return (
    <p className="mt-2 text-xs text-[#545454]">
      Compartilhando sua localização em tempo real com o cliente.
    </p>
  );
}
