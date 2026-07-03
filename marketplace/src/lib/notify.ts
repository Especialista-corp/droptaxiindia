import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarPushParaUsuario } from "@/lib/push";
import { enviarEmail } from "@/lib/email";

/**
 * Registra a notificação in-app (sempre) e tenta push + e-mail (best-effort,
 * dependem de VAPID_* e RESEND_API_KEY estarem configurados).
 */
export async function notificarUsuario(
  userId: string,
  tipo: string,
  titulo: string,
  mensagem: string,
  payload: Record<string, unknown> = {},
  url?: string,
) {
  const admin = createAdminClient();
  await admin.from("notifications").insert({ user_id: userId, tipo, payload });

  const { data: user } = await admin.from("users").select("email").eq("id", userId).single();

  await Promise.allSettled([
    enviarPushParaUsuario(userId, { title: titulo, body: mensagem, url }),
    user?.email
      ? enviarEmail({
          to: user.email,
          subject: titulo,
          html: `<p>${mensagem}</p>`,
        })
      : Promise.resolve(),
  ]);
}
