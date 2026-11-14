"use client";

import { useEffect } from "react";
import { BRAND } from "@/lib/constants";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register(`/sw.js?name=${encodeURIComponent(BRAND.name)}`).catch(() => {
      // Falha silenciosa: app continua funcional sem PWA offline support.
    });
  }, []);

  return null;
}
