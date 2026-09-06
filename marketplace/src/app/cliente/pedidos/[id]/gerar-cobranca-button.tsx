"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function GerarCobrancaButton({
  orderId,
  tipo,
}: {
  orderId: string;
  tipo: "sinal_50" | "final_50";
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [qrCode, setQrCode] = useState<{ payload: string; image?: string }>();

  async function gerarCobranca() {
    setPending(true);
    setError(undefined);
    try {
      const response = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, tipo }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Falha ao gerar cobrança");
      setQrCode({ payload: data.qrCodePayload, image: data.qrCodeImage });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Erro inesperado");
    } finally {
      setPending(false);
    }
  }

  if (qrCode) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        {qrCode.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`data:image/png;base64,${qrCode.image}`}
            alt="QR Code Pix"
            className="h-48 w-48"
          />
        )}
        <p className="w-full break-all rounded-lg bg-[#F6F6F6] p-3 text-xs text-[#545454]">
          {qrCode.payload}
        </p>
        <Button
          type="button"
          variant="secondary"
          onClick={() => navigator.clipboard.writeText(qrCode.payload)}
        >
          Copiar código Pix
        </Button>
      </div>
    );
  }

  return (
    <div>
      <Button type="button" onClick={gerarCobranca} disabled={pending}>
        {pending ? "Gerando cobrança…" : "Pagar com Pix"}
      </Button>
      {error && <p className="mt-2 text-sm text-[#BB032A]">{error}</p>}
    </div>
  );
}
