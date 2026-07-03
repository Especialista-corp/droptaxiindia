"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { buildVehicleIconDataUrl } from "@/lib/vehicle-icons";
import type { TruckSize, VehicleType } from "@/lib/constants";

declare global {
  interface Window {
    google?: typeof google;
    __montajaMapsCallback?: () => void;
  }
}

let mapsLoadingPromise: Promise<void> | null = null;

function loadGoogleMaps(apiKey: string): Promise<void> {
  if (window.google?.maps) return Promise.resolve();
  if (mapsLoadingPromise) return mapsLoadingPromise;

  mapsLoadingPromise = new Promise((resolve) => {
    window.__montajaMapsCallback = () => resolve();
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=__montajaMapsCallback`;
    script.async = true;
    document.head.appendChild(script);
  });

  return mapsLoadingPromise;
}

export function LiveMap({
  orderId,
  destino,
  veiculoTipo,
  veiculoCor,
  veiculoPorte,
}: {
  orderId: string;
  destino: { lat: number; lng: number };
  veiculoTipo: VehicleType;
  veiculoCor: string;
  veiculoPorte?: TruckSize | null;
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map>(null);
  const marker = useRef<google.maps.Marker>(null);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    if (!apiKey) return;

    let cancelado = false;
    loadGoogleMaps(apiKey).then(() => {
      if (cancelado || !mapRef.current || !window.google) return;

      mapInstance.current = new window.google.maps.Map(mapRef.current, {
        center: destino,
        zoom: 14,
        disableDefaultUI: true,
        zoomControl: true,
      });

      new window.google.maps.Marker({
        position: destino,
        map: mapInstance.current,
        title: "Endereço do serviço",
      });

      setCarregado(true);
    });

    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!carregado) return;
    const supabase = createClient();

    async function carregarUltimaPosicao() {
      const { data } = await supabase
        .from("tracking_positions")
        .select("lat, lng, heading")
        .eq("order_id", orderId)
        .order("criado_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) atualizarMarcador(data.lat, data.lng, data.heading ?? 0);
    }

    function atualizarMarcador(lat: number, lng: number, heading: number) {
      if (!window.google || !mapInstance.current) return;
      const posicao = { lat, lng };
      const icon = {
        url: buildVehicleIconDataUrl(veiculoTipo, veiculoCor, heading, veiculoPorte),
        scaledSize: new window.google.maps.Size(56, 56),
        anchor: new window.google.maps.Point(28, 28),
      };

      if (!marker.current) {
        marker.current = new window.google.maps.Marker({
          position: posicao,
          map: mapInstance.current,
          icon,
        });
      } else {
        marker.current.setPosition(posicao);
        marker.current.setIcon(icon);
      }

      mapInstance.current.panTo(posicao);
    }

    carregarUltimaPosicao();

    const channel = supabase
      .channel(`tracking:${orderId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tracking_positions", filter: `order_id=eq.${orderId}` },
        (payload) => {
          const nova = payload.new as { lat: number; lng: number; heading: number | null };
          atualizarMarcador(nova.lat, nova.lng, nova.heading ?? 0);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregado, orderId]);

  if (!apiKey) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl bg-[#F6F6F6] text-center text-sm text-[#545454]">
        Configure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY para ver o mapa ao vivo.
      </div>
    );
  }

  return <div ref={mapRef} className="h-64 w-full rounded-xl bg-[#F6F6F6]" />;
}
