"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export function AtivarNotificacoesButton() {
  const [status, setStatus] = useState<"idle" | "pending" | "ativo" | "erro">("idle");

  async function ativar() {
    setStatus("pending");
    try {
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) throw new Error("Notificações push não configuradas");

      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Permissão negada");

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });

      setStatus("ativo");
    } catch {
      setStatus("erro");
    }
  }

  if (status === "ativo") {
    return <p className="text-sm font-medium text-[#127A3E]">Notificações ativadas ✓</p>;
  }

  return (
    <Button variant="secondary" onClick={ativar} disabled={status === "pending"}>
      {status === "pending" ? "Ativando…" : "Ativar notificações"}
    </Button>
  );
}
