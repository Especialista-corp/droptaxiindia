"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  cadastroClienteSchema,
  cadastroPrestadorSchema,
  loginSchema,
} from "@/lib/validations";
import { PROVIDER_DOCS_DEADLINE_DAYS } from "@/lib/constants";

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
    cep: formData.get("cep"),
    endereco: formData.get("endereco"),
    numero: formData.get("numero"),
    complemento: formData.get("complemento") || undefined,
    bairro: formData.get("bairro") || undefined,
    cidade: formData.get("cidade") || undefined,
    estado: formData.get("estado") || undefined,
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

  // Aprovação automática: o prestador já pode receber pedidos, mas tem
  // PROVIDER_DOCS_DEADLINE_DAYS para enviar comprovante de endereço e certidão
  // negativa de antecedentes criminais — senão o cron o suspende.
  const prazoDocumentos = new Date(
    Date.now() + PROVIDER_DOCS_DEADLINE_DAYS * 24 * 3_600_000,
  ).toISOString();

  const { error: profileError } = await admin.from("provider_profiles").insert({
    user_id: userId,
    status: "aprovado",
    aprovado_em: new Date().toISOString(),
    documentos_prazo_em: prazoDocumentos,
    cep: parsed.data.cep,
    endereco: parsed.data.endereco,
    numero: parsed.data.numero,
    complemento: parsed.data.complemento ?? null,
    bairro: parsed.data.bairro ?? null,
    cidade: parsed.data.cidade ?? null,
    estado: parsed.data.estado ?? null,
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

  await admin.from("notifications").insert({
    user_id: userId,
    tipo: "documentos_prazo",
    payload: { prazo: prazoDocumentos },
  });

  redirect("/prestador/documentos");
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
