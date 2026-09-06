"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { concluirServicoAction } from "../../actions-execucao";

export function ConclusaoForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    const formData = new FormData(event.currentTarget);
    const fotos = formData.getAll("fotos").filter((f): f is File => f instanceof File && f.size > 0);

    try {
      await concluirServicoAction(orderId, fotos);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Falha ao concluir");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3 rounded-xl border border-[#E2E2E2] p-4">
      <p className="font-bold">Concluir serviço</p>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Fotos do móvel montado
        <input type="file" name="fotos" accept="image/*" multiple required />
      </label>
      {error && <p className="text-sm text-[#BB032A]">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Enviando…" : "Marcar como concluído"}
      </Button>
    </form>
  );
}
