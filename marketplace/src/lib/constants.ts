const APP_NAME = "MontaJá";

/** Fonte única do nome e dos textos de marca. Para renomear o app, edite só aqui. */
export const BRAND = {
  name: APP_NAME,
  tagline: "O Uber dos Montadores",
  /** Título das abas do navegador. */
  pageTitle: `${APP_NAME} — Montagem de móveis sob demanda`,
  manifestName: `${APP_NAME} — Montagem de móveis`,
  description:
    "Agende um montador verificado em minutos. Pagamento em garantia: você só paga quando o serviço estiver pronto.",
  manifestDescription:
    "Agende um montador verificado, acompanhe a chegada em tempo real e pague em garantia.",
  /** E-mail de contato (domínio é independente do nome; sobrescrito por VAPID_SUBJECT/RESEND_FROM_EMAIL). */
  contactEmail: "contato@montaja.com.br",
  /** Remetente padrão dos e-mails. */
  emailFrom: `${APP_NAME} <contato@montaja.com.br>`,
} as const;

/**
 * Paleta do app. Os valores aqui espelham os tokens de src/app/globals.css
 * (usados pelas classes bg-*, text-*, border-*); só PWA/manifest leem este objeto.
 */
export const COLORS = {
  background: "#16161A",
  surface: "#1F1F26",
  surface2: "#272730",
  line: "#2E2E38",
  foreground: "#FEF8FB",
  muted: "#A9A5B3",
  violet: "#4B03CF",
  magenta: "#BB0189",
  orange: "#D2630D",
  coral: "#D33D3A",
  success: "#2BB673",
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

/**
 * O prestador é aprovado automaticamente no cadastro, mas tem este prazo para
 * enviar comprovante de endereço e certidão negativa de antecedentes criminais.
 */
export const PROVIDER_DOCS_DEADLINE_DAYS = 7;

/** Emissão gratuita da certidão negativa de antecedentes criminais (Polícia Federal / gov.br). */
export const CERTIDAO_ANTECEDENTES_URL =
  "https://www.gov.br/pt-br/servicos/emitir-certidao-de-antecedentes-criminais";

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
