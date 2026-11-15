import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const CONFIRMED_EVENTS = ["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"];

export async function POST(request: Request) {
  const token = request.headers.get("asaas-access-token");
  if (process.env.ASAAS_WEBHOOK_TOKEN && token !== process.env.ASAAS_WEBHOOK_TOKEN) {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }

  const body = (await request.json()) as {
    event: string;
    payment: { id: string; status: string };
  };

  const admin = createAdminClient();

  if (CONFIRMED_EVENTS.includes(body.event)) {
    await admin
      .from("payments")
      .update({ status: "retido", pago_em: new Date().toISOString() })
      .eq("gateway_id", body.payment.id);
  } else if (body.event === "PAYMENT_REFUNDED") {
    await admin
      .from("payments")
      .update({ status: "reembolsado", reembolsado_em: new Date().toISOString() })
      .eq("gateway_id", body.payment.id);
  } else if (["PAYMENT_OVERDUE", "PAYMENT_DELETED"].includes(body.event)) {
    await admin.from("payments").update({ status: "falhou" }).eq("gateway_id", body.payment.id);
  }

  return NextResponse.json({ ok: true });
}
