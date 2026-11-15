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
  if (error) {
    if (error.code === "email_not_confirmed") {
      return { error: "Confirme seu e-mail antes de entrar. Procure a mensagem na caixa de entrada ou no spam." };
    }
    if (error.code === "invalid_credentials") return { error: "E-mail ou senha incorretos." };
    return { error: error.message };
  }

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
    cpf: formData.get("cpf"),
    nome: formData.get("nome"),
    email: formData.get("email"),
    telefone: formData.get("telefone"),
    senha: formData.get("senha"),
    confirmaSenha: formData.get("confirmaSenha"),
    cep: formData.get("cep"),
    endereco: formData.get("endereco"),
    numero: formData.get("numero"),
    complemento: formData.get("complemento") || undefined,
    bairro: formData.get("bairro") || undefined,
    cidade: formData.get("cidade") || undefined,
    estado: formData.get("estado") || undefined,
    raioKm: formData.get("raioKm"),
    veiculos: [
      {
        tipo: formData.get("veiculo1Tipo"),
        cor: formData.get("veiculo1Cor"),
        porte: formData.get("veiculo1Porte") || undefined,
        placa: formData.get("veiculo1Placa"),
      },
      ...(formData.get("temSegundoVeiculo")
        ? [
            {
              tipo: formData.get("veiculo2Tipo"),
              cor: formData.get("veiculo2Cor"),
              porte: formData.get("veiculo2Porte") || undefined,
              placa: formData.get("veiculo2Placa"),
            },
          ]
        : []),
    ],
    categoriaIds: formData.getAll("categoriaIds"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  // Confere o CPF antes de criar o login, para não deixar conta órfã.
  const admin = createAdminClient();
  const { data: cpfExistente } = await admin
    .from("provider_profiles")
    .select("user_id")
    .eq("cpf", parsed.data.cpf)
    .maybeSingle();
  if (cpfExistente) return { error: "Já existe um cadastro de montador com este CPF." };

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
  // Com confirmação de e-mail ligada, o Supabase não devolve erro para um e-mail
  // já cadastrado: devolve um usuário "fantasma" sem identidades.
  if (signUpData.user?.identities?.length === 0) {
    return { error: "Este e-mail já está cadastrado. Entre com a sua senha." };
  }

  // A criação da linha em public.users acontece via trigger on_auth_user_created.
  // Usamos o client admin aqui pois a sessão do usuário recém-criado ainda não
  // está disponível neste request (confirmação de e-mail pendente).
  // Aprovação automática: o prestador já pode receber pedidos, mas tem
  // PROVIDER_DOCS_DEADLINE_DAYS para enviar comprovante de endereço e certidão
  // negativa de antecedentes criminais — senão o cron o suspende.
  const prazoDocumentos = new Date(
    Date.now() + PROVIDER_DOCS_DEADLINE_DAYS * 24 * 3_600_000,
  ).toISOString();

  const { error: profileError } = await admin.from("provider_profiles").insert({
    user_id: userId,
    cpf: parsed.data.cpf,
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
  });
  if (profileError) return { error: profileError.message };

  // O primeiro veículo entra como "em uso" — é o exibido no mapa do cliente.
  const { error: veiculosError } = await admin.from("provider_vehicles").insert(
    parsed.data.veiculos.map((veiculo, index) => ({
      provider_id: userId,
      tipo: veiculo.tipo,
      cor: veiculo.cor,
      porte: veiculo.tipo === "caminhao" ? (veiculo.porte ?? null) : null,
      placa: veiculo.placa,
      em_uso: index === 0,
    })),
  );
  if (veiculosError) return { error: veiculosError.message };

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

  // Sem sessão = o Supabase exige confirmar o e-mail antes do primeiro acesso.
  if (!signUpData.session) {
    redirect(`/cadastro/prestador/verifique-email?email=${encodeURIComponent(parsed.data.email)}`);
  }

  redirect("/prestador/documentos");
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
