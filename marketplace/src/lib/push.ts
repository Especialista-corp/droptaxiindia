import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

let configurado = false;

function configurarWebPush() {
  if (configurado) return;
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;

  webpush.setVapidDetails(
    VAPID_SUBJECT ?? "mailto:contato@montaja.com.br",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY,
  );
  configurado = true;
}

export async function enviarPushParaUsuario(
  userId: string,
  payload: { title: string; body: string; url?: string },
) {
  configurarWebPush();
  if (!configurado) return; // VAPID não configurado — notificação in-app já foi salva.

  const admin = createAdminClient();
  const { data: subscriptions } = await admin
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", userId);

  for (const subscription of subscriptions ?? []) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        JSON.stringify(payload),
      );
    } catch {
      // Subscrição expirada/inválida — removemos para não tentar de novo.
      await admin.from("push_subscriptions").delete().eq("id", subscription.id);
    }
  }
}
