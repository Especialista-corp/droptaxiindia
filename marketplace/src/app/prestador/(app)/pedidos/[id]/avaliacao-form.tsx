"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { avaliarClienteAction } from "./avaliar-cliente-action";

export function PrestadorAvaliacaoForm({
  orderId,
  alvoId,
  alvoNome,
}: {
  orderId: string;
  alvoId: string;
  alvoNome: string;
}) {
  const router = useRouter();
  const [nota, setNota] = useState(5);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    formData.set("nota", String(nota));
    try {
      await avaliarClienteAction(formData);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="mt-4">
      <p className="mb-3 font-bold">Avalie {alvoNome}</p>
      <form action={handleSubmit} className="flex flex-col gap-3">
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="alvoId" value={alvoId} />
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((valor) => (
            <button key={valor} type="button" onClick={() => setNota(valor)}>
              <Star
                size={28}
                className={cn(valor <= nota ? "fill-black text-black" : "text-[#E2E2E2]")}
              />
            </button>
          ))}
        </div>
        <textarea
          name="comentario"
          rows={2}
          placeholder="Comentário (opcional)"
          className="rounded-lg border border-[#E2E2E2] p-2 text-sm"
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Enviando…" : "Enviar avaliação"}
        </Button>
      </form>
    </Card>
  );
}
