"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  cadastroClienteSchema,
  cadastroPrestadorSchema,
  loginSchema,
} from "@/lib/validations";

export type ActionState = { error?: string } | undefined;

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    senha: formData.get("senha"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.senha,
  });
  if (error) return { error: error.message };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user!.id)
    .single();

  redirect(
    profile?.role === "prestador" ? "/prestador" : profile?.role === "admin" ? "/admin" : "/cliente",
  );
}

export async function cadastroClienteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = cadastroClienteSchema.safeParse({
    nome: formData.get("nome"),
    email: formData.get("email"),
    telefone: formData.get("telefone"),
    senha: formData.get("senha"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.senha,
    options: {
      data: { nome: parsed.data.nome, telefone: parsed.data.telefone, role: "cliente" },
    },
  });
  if (error) return { error: error.message };

  redirect("/cliente");
}

export async function cadastroPrestadorAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = cadastroPrestadorSchema.safeParse({
    nome: formData.get("nome"),
    email: formData.get("email"),
    telefone: formData.get("telefone"),
    senha: formData.get("senha"),
    raioKm: formData.get("raioKm"),
    veiculoTipo: formData.get("veiculoTipo"),
    veiculoCor: formData.get("veiculoCor"),
    veiculoPorte: formData.get("veiculoPorte") || undefined,
    categoriaIds: formData.getAll("categoriaIds"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  const { data: signUpData, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.senha,
    options: {
      data: { nome: parsed.data.nome, telefone: parsed.data.telefone, role: "prestador" },
    },
  });
  if (error) return { error: error.message };

  const userId = signUpData.user?.id;
  if (!userId) {
    return { error: "Não foi possível concluir o cadastro. Tente novamente." };
  }

  // A criação da linha em public.users acontece via trigger on_auth_user_created.
  // Usamos o client admin aqui pois a sessão do usuário recém-criado ainda não
  // está disponível neste request (confirmação de e-mail pendente).
  const admin = createAdminClient();

  const { error: profileError } = await admin.from("provider_profiles").insert({
    user_id: userId,
    status: "pendente",
    raio_km: parsed.data.raioKm,
    veiculo_tipo: parsed.data.veiculoTipo,
    veiculo_cor: parsed.data.veiculoCor,
    veiculo_porte: parsed.data.veiculoPorte ?? null,
  });
  if (profileError) return { error: profileError.message };

  const { error: categoriasError } = await admin.from("provider_service_categories").insert(
    parsed.data.categoriaIds.map((categoryId) => ({
      provider_id: userId,
      category_id: categoryId,
    })),
  );
  if (categoriasError) return { error: categoriasError.message };

  redirect("/prestador/cadastro-pendente");
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
