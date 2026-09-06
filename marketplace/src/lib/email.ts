import "server-only";
import { Resend } from "resend";

let client: Resend | null = null;

function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  if (!client) client = new Resend(process.env.RESEND_API_KEY);
  return client;
}

export async function enviarEmail(params: { to: string; subject: string; html: string }) {
  const resend = getResend();
  if (!resend) return; // RESEND_API_KEY não configurada — e-mail não enviado.

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "MontaJá <contato@montaja.com.br>",
    to: params.to,
    subject: params.subject,
    html: params.html,
  });
}
