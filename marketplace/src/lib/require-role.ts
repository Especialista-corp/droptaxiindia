import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database";

export async function requireRole(role: UserRole) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (profile?.role !== role) throw new Error("Acesso negado");

  return user;
}
