"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { novoPedidoSchema } from "@/lib/validations";
import { calcularValorTabela } from "@/lib/pricing";
import { DEFAULT_COMMISSION_PERCENT } from "@/lib/constants";

export type NovoPedidoState = { error?: string } | undefined;

export async function criarPedidoAction(
  _prev: NovoPedidoState,
  formData: FormData,
): Promise<NovoPedidoState> {
  const rawItens = formData.get("itensJson");
  const fotos = formData.getAll("fotos").filter((f): f is File => f instanceof File && f.size > 0);

  const parsed = novoPedidoSchema.safeParse({
    categoryId: formData.get("categoryId"),
    itens: rawItens ? JSON.parse(String(rawItens)) : [],
    descricao: formData.get("descricao") || undefined,
    dataAgendada: formData.get("dataAgendada"),
    janelaInicio: formData.get("janelaInicio"),
    janelaFim: formData.get("janelaFim"),
    endereco: formData.get("endereco"),
    numero: formData.get("numero") || undefined,
    complemento: formData.get("complemento") || undefined,
    bairro: formData.get("bairro") || undefined,
    cidade: formData.get("cidade") || undefined,
    estado: formData.get("estado") || undefined,
    cep: formData.get("cep") || undefined,
    lat: formData.get("lat") || undefined,
    lng: formData.get("lng") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const { data: serviceItems, error: itemsError } = await supabase
    .from("service_items")
    .select("id, preco_base")
    .in(
      "id",
      parsed.data.itens.map((item) => item.serviceItemId),
    );
  if (itemsError || !serviceItems) return { error: "Não foi possível carregar o catálogo" };

  const itensComPreco = parsed.data.itens.map((item) => {
    const catalogItem = serviceItems.find((si) => si.id === item.serviceItemId);
    return {
      service_item_id: item.serviceItemId,
      quantidade: item.quantidade,
      valor_unitario: catalogItem?.preco_base ?? 0,
    };
  });
  const valorTabela = calcularValorTabela(itensComPreco);

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      cliente_id: user.id,
      category_id: parsed.data.categoryId,
      status: "aberto",
      descricao: parsed.data.descricao ?? null,
      fotos_pedido: [],
      data_agendada: parsed.data.dataAgendada,
      janela_inicio: parsed.data.janelaInicio,
      janela_fim: parsed.data.janelaFim,
      endereco: parsed.data.endereco,
      numero: parsed.data.numero ?? null,
      complemento: parsed.data.complemento ?? null,
      bairro: parsed.data.bairro ?? null,
      cidade: parsed.data.cidade ?? null,
      estado: parsed.data.estado ?? null,
      cep: parsed.data.cep ?? null,
      lat: parsed.data.lat ?? null,
      lng: parsed.data.lng ?? null,
      valor_tabela: valorTabela,
      comissao_percent: DEFAULT_COMMISSION_PERCENT,
    })
    .select("id")
    .single();

  if (orderError || !order) return { error: orderError?.message ?? "Erro ao criar pedido" };

  const { error: orderItemsError } = await supabase.from("order_items").insert(
    itensComPreco.map((item) => ({
      order_id: order.id,
      service_item_id: item.service_item_id,
      quantidade: item.quantidade,
      valor_unitario: item.valor_unitario,
    })),
  );
  if (orderItemsError) return { error: orderItemsError.message };

  if (fotos.length > 0) {
    const paths: string[] = [];
    for (const [index, foto] of fotos.entries()) {
      const path = `${order.id}/${index}-${foto.name}`;
      const { error: uploadError } = await supabase.storage
        .from("pedidos-fotos")
        .upload(path, foto, { upsert: true });
      if (!uploadError) paths.push(path);
    }
    if (paths.length > 0) {
      await supabase.from("orders").update({ fotos_pedido: paths }).eq("id", order.id);
    }
  }

  redirect(`/cliente/pedidos/${order.id}`);
}
