import type { TruckSize, VehicleType } from "./constants";

const VEHICLE_EMOJI: Record<VehicleType, string> = {
  moto: "🏍",
  carro: "🚗",
  pickup: "🛻",
  caminhao: "🚚",
};

const COLOR_HEX: Record<string, string> = {
  preta: "#000000",
  vermelha: "#BB032A",
  preto: "#000000",
  branco: "#FFFFFF",
  branca: "#FFFFFF",
  prata: "#C4C4C4",
};

/**
 * Cada combinação tipo+cor tem seu próprio ícone no mapa: um pino colorido
 * com uma seta que rotaciona conforme o heading do GPS, mais o emoji do
 * veículo para diferenciar o tipo (moto/carro/pickup/caminhão) à primeira vista.
 */
export function buildVehicleIconDataUrl(
  tipo: VehicleType,
  cor: string,
  heading: number,
  porte?: TruckSize | null,
) {
  const emoji = VEHICLE_EMOJI[tipo] ?? "🚗";
  const fill = COLOR_HEX[cor.toLowerCase()] ?? "#000000";
  const strokeContraste = fill === "#FFFFFF" ? "#000000" : "#FFFFFF";

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56">
      <g transform="rotate(${heading} 28 28)">
        <circle cx="28" cy="28" r="20" fill="${fill}" stroke="${strokeContraste}" stroke-width="3" />
        <path d="M28 12 L34 24 L28 20 L22 24 Z" fill="${strokeContraste}" />
      </g>
      <text x="28" y="34" font-size="20" text-anchor="middle">${emoji}</text>
      ${porte ? `<text x="28" y="52" font-size="9" text-anchor="middle" fill="#000">${porte.toUpperCase()}</text>` : ""}
    </svg>
  `.trim();

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
