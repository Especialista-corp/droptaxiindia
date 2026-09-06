"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { salvarDocumentoAction, type TipoDocumento } from "./actions";

export function DocumentoUpload({
  userId,
  tipo,
  titulo,
  descricao,
  enviado,
}: {
  userId: string;
  tipo: TipoDocumento;
  titulo: string;
  descricao?: string;
  enviado: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPending(true);
    setError(undefined);

    try {
      const supabase = createClient();
      const path = `${userId}/${tipo}-${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("prestador-documentos")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const result = await salvarDocumentoAction(tipo, path);
      if (result?.error) throw new Error(result.error);
      router.refresh();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Falha no envio");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-3 border-b border-[#E2E2E2] py-4 last:border-b-0">
      {enviado ? (
        <CheckCircle2 className="shrink-0 text-[#127A3E]" size={24} />
      ) : (
        <Upload className="shrink-0 text-[#545454]" size={24} />
      )}
      <div className="min-w-0 flex-1">
        <p className="font-medium">{titulo}</p>
        {descricao && <p className="text-sm text-[#545454]">{descricao}</p>}
        {error && <p className="text-sm text-[#BB032A]">{error}</p>}
      </div>
      <label className="shrink-0 cursor-pointer rounded-lg border border-[#E2E2E2] px-3 py-2 text-sm font-medium">
        {pending ? "Enviando…" : enviado ? "Substituir" : "Enviar"}
        <input
          type="file"
          accept="image/*,.pdf"
          className="hidden"
          onChange={handleChange}
          disabled={pending}
        />
      </label>
    </div>
  );
}
