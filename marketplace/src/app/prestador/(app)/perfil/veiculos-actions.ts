"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function usarVeiculoAction(veiculoId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { data: veiculo } = await supabase
    .from("provider_vehicles")
    .select("id, provider_id")
    .eq("id", veiculoId)
    .single();
  if (!veiculo || veiculo.provider_id !== user.id) throw new Error("Veículo não encontrado");

  // Desativa o atual antes de ativar o novo (índice único parcial garante 1 em uso).
  await supabase
    .from("provider_vehicles")
    .update({ em_uso: false })
    .eq("provider_id", user.id)
    .eq("em_uso", true);
  await supabase.from("provider_vehicles").update({ em_uso: true }).eq("id", veiculoId);

  revalidatePath("/prestador/perfil");
}
