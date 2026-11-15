"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { propostaSchema } from "@/lib/validations";
import { propostaDentroDoLimite } from "@/lib/pricing";

export async function enviarPropostaAction(formData: FormData) {
  const parsed = propostaSchema.safeParse({
    orderId: formData.get("orderId"),
    valor: formData.get("valor"),
    mensagem: formData.get("mensagem") || undefined,
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { data: provider } = await supabase
    .from("provider_profiles")
    .select("status")
    .eq("user_id", user.id)
    .single();
  if (provider?.status !== "aprovado") throw new Error("Cadastro de prestador não aprovado");

  const { data: order } = await supabase
    .from("orders")
    .select("id, status, valor_tabela")
    .eq("id", parsed.data.orderId)
    .single();
  if (!order || (order.status !== "aberto" && order.status !== "proposto")) {
    throw new Error("Este pedido não está mais disponível para propostas");
  }

  if (!propostaDentroDoLimite(parsed.data.valor, order.valor_tabela)) {
    throw new Error("Contraproposta fora do limite de ±60% do preço tabelado");
  }

  const { error: proposalError } = await supabase.from("proposals").insert({
    order_id: parsed.data.orderId,
    prestador_id: user.id,
    valor: parsed.data.valor,
    mensagem: parsed.data.mensagem ?? null,
  });
  if (proposalError) throw new Error(proposalError.message);

  if (order.status === "aberto") {
    await supabase.from("orders").update({ status: "proposto" }).eq("id", order.id);
  }

  revalidatePath(`/prestador/pedidos/${order.id}`);
  revalidatePath("/prestador/pedidos");
}
