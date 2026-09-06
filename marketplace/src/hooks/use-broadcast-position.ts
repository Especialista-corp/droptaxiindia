"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Enquanto o pedido está "em_deslocamento", o navegador do prestador observa
 * a geolocalização e grava a posição em tracking_positions. O cliente recebe
 * essas posições via Supabase Realtime (ver components/map/live-map.tsx).
 */
export function useBroadcastPosition(orderId: string, prestadorId: string, ativo: boolean) {
  const [erro, setErro] = useState<string>();
  const ultimaGravacao = useRef(0);

  useEffect(() => {
    if (!ativo || typeof navigator === "undefined" || !("geolocation" in navigator)) return;

    const supabase = createClient();
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const agora = Date.now();
        if (agora - ultimaGravacao.current < 4000) return; // throttle ~4s
        ultimaGravacao.current = agora;

        supabase.from("tracking_positions").insert({
          order_id: orderId,
          prestador_id: prestadorId,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          heading: position.coords.heading ?? null,
        });
      },
      (geoError) => setErro(geoError.message),
      { enableHighAccuracy: true, maximumAge: 5000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [orderId, prestadorId, ativo]);

  return { erro };
}
