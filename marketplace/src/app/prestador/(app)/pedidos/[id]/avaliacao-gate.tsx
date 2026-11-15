import { createClient } from "@/lib/supabase/server";
import { PrestadorAvaliacaoForm } from "./avaliacao-form";

export async function PrestadorAvaliacaoGate({
  orderId,
  clienteId,
  prestadorId,
}: {
  orderId: string;
  clienteId: string;
  prestadorId: string;
}) {
  const supabase = await createClient();
  const { data: minhaAvaliacao } = await supabase
    .from("reviews")
    .select("id")
    .eq("order_id", orderId)
    .eq("autor_id", prestadorId)
    .maybeSingle();

  if (minhaAvaliacao) return null;

  const { data: cliente } = await supabase.from("users").select("nome").eq("id", clienteId).single();

  return <PrestadorAvaliacaoForm orderId={orderId} alvoId={clienteId} alvoNome={cliente?.nome ?? "cliente"} />;
}
