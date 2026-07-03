import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { findOrCreateAsaasCustomer, criarCobrancaPix, obterQrCodePix } from "@/lib/asaas";
import { SIGNAL_PERCENT } from "@/lib/constants";

export async function POST(request: Request) {
  const { orderId, tipo } = (await request.json()) as {
    orderId: string;
    tipo: "sinal_50" | "final_50";
  };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data: order } = await supabase
    .from("orders")
    .select("id, cliente_id, valor_acordado, valor_tabela, comissao_percent")
    .eq("id", orderId)
    .single();
  if (!order || order.cliente_id !== user.id) {
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  }

  const { data: existente } = await supabase
    .from("payments")
    .select("*")
    .eq("order_id", orderId)
    .eq("tipo", tipo)
    .maybeSingle();

  if (existente?.status === "retido" || existente?.status === "liberado") {
    return NextResponse.json({ error: "Este pagamento já foi realizado" }, { status: 400 });
  }
  if (existente?.gateway_id) {
    const qrCode = await obterQrCodePix(existente.gateway_id);
    return NextResponse.json({
      qrCodePayload: qrCode.payload,
      qrCodeImage: qrCode.encodedImage,
      paymentId: existente.id,
    });
  }

  const valorTotal = order.valor_acordado ?? order.valor_tabela;
  const valorInstallment = Number(((valorTotal * SIGNAL_PERCENT) / 100).toFixed(2));

  const { data: profile } = await supabase
    .from("users")
    .select("nome, email, telefone")
    .eq("id", user.id)
    .single();

  try {
    const customer = await findOrCreateAsaasCustomer({
      name: profile?.nome ?? "Cliente MontaJá",
      email: profile?.email ?? user.email ?? "",
      phone: profile?.telefone ?? undefined,
      externalReference: user.id,
    });

    const charge = await criarCobrancaPix({
      customerId: customer.id,
      value: valorInstallment,
      description: `MontaJá — ${tipo === "sinal_50" ? "sinal" : "saldo final"} do pedido ${orderId}`,
      externalReference: `${orderId}:${tipo}`,
    });

    const qrCode = await obterQrCodePix(charge.id);
    const comissao = Number(((valorInstallment * order.comissao_percent) / 100).toFixed(2));

    const { data: payment, error: upsertError } = await supabase
      .from("payments")
      .upsert(
        {
          id: existente?.id,
          order_id: orderId,
          tipo,
          status: "pendente",
          gateway_id: charge.id,
          gateway_qrcode_payload: qrCode.payload,
          valor: valorInstallment,
          comissao,
        },
        { onConflict: "id" },
      )
      .select("id")
      .single();
    if (upsertError) throw upsertError;

    return NextResponse.json({
      qrCodePayload: qrCode.payload,
      qrCodeImage: qrCode.encodedImage,
      paymentId: payment.id,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao gerar cobrança" },
      { status: 500 },
    );
  }
}
