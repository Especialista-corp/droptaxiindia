export const BRAND = {
  name: "MontaJá",
  tagline: "O Uber dos Montadores",
};

export const COLORS = {
  primary: "#000000",
  background: "#FFFFFF",
  surface: "#F6F6F6",
  border: "#E2E2E2",
  textSecondary: "#545454",
  success: "#127A3E",
  danger: "#BB032A",
} as const;

/** Percentual de comissão padrão da plataforma sobre o valor do serviço. Configurável no admin. */
export const DEFAULT_COMMISSION_PERCENT = 18;

/** Percentual do sinal pago no fechamento do pedido, retido em garantia até a conclusão. */
export const SIGNAL_PERCENT = 50;

/** Janela para pagamento do sinal antes do pedido voltar para a fila. */
export const SIGNAL_PAYMENT_WINDOW_HOURS = 2;

/** Contrapropostas só podem variar até este percentual em relação ao preço tabelado. */
export const COUNTER_PROPOSAL_MAX_DEVIATION_PERCENT = 60;

/** Liberação automática do pagamento final após a postagem das fotos, se o cliente não contestar. */
export const AUTO_RELEASE_WINDOW_HOURS = 72;

/** Cancelamento gratuito pelo cliente até esse prazo antes do horário agendado. */
export const FREE_CANCELLATION_WINDOW_HOURS = 24;

/** Percentual retido em caso de cancelamento fora da janela gratuita. */
export const LATE_CANCELLATION_FEE_PERCENT = 30;

/** Número de strikes por no-show até a suspensão automática do prestador. */
export const MAX_NO_SHOW_STRIKES = 3;

export const VEHICLE_TYPES = ["moto", "carro", "pickup", "caminhao"] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const VEHICLE_COLORS: Record<VehicleType, string[]> = {
  moto: ["preta", "vermelha"],
  carro: ["preto", "branco", "prata"],
  pickup: ["branca", "prata"],
  caminhao: ["branca"],
};

export const TRUCK_SIZES = ["vuc", "3_4", "toco"] as const;
export type TruckSize = (typeof TRUCK_SIZES)[number];

export const TRUCK_SIZE_LABELS: Record<TruckSize, string> = {
  vuc: "VUC (urbano pequeno)",
  "3_4": "3/4",
  toco: "Toco",
};

export const ORDER_STATUS = [
  "aberto",
  "proposto",
  "agendado",
  "confirmado",
  "em_deslocamento",
  "em_execucao",
  "concluido_prestador",
  "aceito_cliente",
  "disputa",
  "cancelado",
] as const;
export type OrderStatus = (typeof ORDER_STATUS)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  aberto: "Aberto",
  proposto: "Proposta recebida",
  agendado: "Agendado",
  confirmado: "Confirmado",
  em_deslocamento: "Prestador a caminho",
  em_execucao: "Em execução",
  concluido_prestador: "Aguardando seu aceite",
  aceito_cliente: "Concluído",
  disputa: "Em disputa",
  cancelado: "Cancelado",
};

/** Etapas exibidas no stepper horizontal de acompanhamento do pedido. */
export const ORDER_TRACKING_STEPS: OrderStatus[] = [
  "agendado",
  "confirmado",
  "em_deslocamento",
  "em_execucao",
  "aceito_cliente",
];
