"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/require-role";

export async function criarCategoriaAction(formData: FormData) {
  await requireRole("admin");
  const nome = String(formData.get("nome") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const tipoPrecificacao = String(formData.get("tipoPrecificacao") ?? "tabela");
  if (!nome || !slug) return;

  const admin = createAdminClient();
  await admin.from("service_categories").insert({
    nome,
    slug,
    tipo_precificacao: tipoPrecificacao as "tabela" | "distancia",
  });
  revalidatePath("/admin/catalogo");
}

export async function alternarCategoriaAtivaAction(categoryId: string, ativo: boolean) {
  await requireRole("admin");
  const admin = createAdminClient();
  await admin.from("service_categories").update({ ativo: !ativo }).eq("id", categoryId);
  revalidatePath("/admin/catalogo");
}

export async function criarItemAction(formData: FormData) {
  await requireRole("admin");
  const admin = createAdminClient();
  await admin.from("service_items").insert({
    category_id: String(formData.get("categoryId")),
    nome: String(formData.get("nome")),
    tipo_item: String(formData.get("tipoItem") ?? "padrao") as "padrao" | "adicional",
    unidade: String(formData.get("unidade") ?? "serviço"),
    preco_base: Number(formData.get("precoBase")),
    faixa_min: Number(formData.get("faixaMin")),
    faixa_max: Number(formData.get("faixaMax")),
    tempo_estimado_min: Number(formData.get("tempoEstimadoMin") ?? 60),
  });
  revalidatePath("/admin/catalogo");
}

export async function atualizarItemAction(itemId: string, formData: FormData) {
  await requireRole("admin");
  const admin = createAdminClient();
  await admin
    .from("service_items")
    .update({
      nome: String(formData.get("nome")),
      preco_base: Number(formData.get("precoBase")),
      faixa_min: Number(formData.get("faixaMin")),
      faixa_max: Number(formData.get("faixaMax")),
    })
    .eq("id", itemId);
  revalidatePath("/admin/catalogo");
}

export async function removerItemAction(itemId: string) {
  await requireRole("admin");
  const admin = createAdminClient();
  await admin.from("service_items").update({ ativo: false }).eq("id", itemId);
  revalidatePath("/admin/catalogo");
}
