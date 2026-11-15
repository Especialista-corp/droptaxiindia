"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { avaliacaoSchema } from "@/lib/validations";

export async function avaliarClienteAction(formData: FormData) {
  const parsed = avaliacaoSchema.safeParse({
    orderId: formData.get("orderId"),
    alvoId: formData.get("alvoId"),
    nota: formData.get("nota"),
    comentario: formData.get("comentario") || undefined,
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { data: order } = await supabase
    .from("orders")
    .select("id, prestador_id")
    .eq("id", parsed.data.orderId)
    .single();
  if (!order || order.prestador_id !== user.id) throw new Error("Pedido não encontrado");

  await supabase.from("reviews").insert({
    order_id: parsed.data.orderId,
    autor_id: user.id,
    alvo_id: parsed.data.alvoId,
    nota: parsed.data.nota,
    comentario: parsed.data.comentario ?? null,
  });

  revalidatePath(`/prestador/pedidos/${parsed.data.orderId}`);
}
