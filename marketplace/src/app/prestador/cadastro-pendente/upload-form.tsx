"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { salvarDocumentosAction } from "./actions";

/**
 * O bucket "prestador-documentos" é privado — guardamos apenas o path do
 * objeto (não uma URL pública) e geramos signed URLs sob demanda quando o
 * admin precisa revisar os documentos.
 */
async function uploadFile(userId: string, file: File, prefixo: string) {
  const supabase = createClient();
  const path = `${userId}/${prefixo}-${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from("prestador-documentos").upload(path, file, {
    upsert: true,
  });
  if (error) throw error;
  return path;
}

export function DocumentUploadForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(undefined);

    const formData = new FormData(event.currentTarget);
    const documento = formData.get("documento") as File;
    const selfie = formData.get("selfie") as File;
    const comprovante = formData.get("comprovante") as File;

    try {
      const [documentoUrl, selfieUrl, comprovanteEnderecoUrl] = await Promise.all([
        uploadFile(userId, documento, "documento"),
        uploadFile(userId, selfie, "selfie"),
        uploadFile(userId, comprovante, "comprovante"),
      ]);

      const result = await salvarDocumentosAction({
        documentoUrl,
        selfieUrl,
        comprovanteEnderecoUrl,
      });
      if (result?.error) {
        setError(result.error);
      } else {
        router.refresh();
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Falha no envio");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm font-medium text-black">
        Documento com foto (RG/CNH)
        <input type="file" name="documento" accept="image/*,.pdf" required />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-black">
        Selfie segurando o documento
        <input type="file" name="selfie" accept="image/*" required />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-black">
        Comprovante de endereço
        <input type="file" name="comprovante" accept="image/*,.pdf" required />
      </label>
      {error && <p className="text-sm text-[#BB032A]">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Enviando…" : "Enviar documentos"}
      </Button>
    </form>
  );
}
