"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/require-role";

export async function aprovarPrestadorAction(providerId: string) {
  const admin = await requireRole("admin");
  const supabaseAdmin = createAdminClient();
  await supabaseAdmin
    .from("provider_profiles")
    .update({ status: "aprovado", aprovado_em: new Date().toISOString(), aprovado_por: admin.id })
    .eq("user_id", providerId);
  revalidatePath("/admin/prestadores");
}

export async function suspenderPrestadorAction(providerId: string) {
  await requireRole("admin");
  const supabaseAdmin = createAdminClient();
  await supabaseAdmin.from("provider_profiles").update({ status: "suspenso" }).eq("user_id", providerId);
  revalidatePath("/admin/prestadores");
}

export async function reativarPrestadorAction(providerId: string) {
  await requireRole("admin");
  const supabaseAdmin = createAdminClient();
  await supabaseAdmin.from("provider_profiles").update({ status: "aprovado" }).eq("user_id", providerId);
  revalidatePath("/admin/prestadores");
}
