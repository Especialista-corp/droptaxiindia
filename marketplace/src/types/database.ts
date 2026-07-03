export type UserRole = "cliente" | "prestador" | "admin";
export type ProviderStatus = "pendente" | "aprovado" | "suspenso";
export type PricingType = "tabela" | "distancia";
export type VehicleType = "moto" | "carro" | "pickup" | "caminhao";
export type TruckSize = "vuc" | "3_4" | "toco";
export type OrderStatus =
  | "aberto"
  | "proposto"
  | "agendado"
  | "confirmado"
  | "em_deslocamento"
  | "em_execucao"
  | "concluido_prestador"
  | "aceito_cliente"
  | "disputa"
  | "cancelado";
export type ProposalStatus = "pendente" | "aceita" | "recusada" | "expirada";
export type PaymentKind = "sinal_50" | "final_50";
export type PaymentStatus = "pendente" | "retido" | "liberado" | "reembolsado" | "falhou";
export type ServiceItemTipo = "padrao" | "adicional";

export type UsersRow = {
  id: string;
  role: UserRole;
  nome: string;
  telefone: string | null;
  telefone_verificado: boolean;
  email: string | null;
  avatar_url: string | null;
  criado_em: string;
};

export type ProviderProfilesRow = {
  user_id: string;
  status: ProviderStatus;
  documento_url: string | null;
  selfie_url: string | null;
  comprovante_endereco_url: string | null;
  raio_km: number;
  nota_media: number;
  total_avaliacoes: number;
  selo_verificado: boolean;
  strikes: number;
  dados_bancarios: Record<string, unknown> | null;
  lat_base: number | null;
  lng_base: number | null;
  veiculo_tipo: VehicleType | null;
  veiculo_cor: string | null;
  veiculo_porte: TruckSize | null;
  aprovado_em: string | null;
  aprovado_por: string | null;
  criado_em: string;
};

export type ProviderServiceCategoriesRow = {
  provider_id: string;
  category_id: string;
};

export type ServiceCategoriesRow = {
  id: string;
  nome: string;
  slug: string;
  ativo: boolean;
  tipo_precificacao: PricingType;
  icone: string | null;
  criado_em: string;
};

export type ServiceItemsRow = {
  id: string;
  category_id: string;
  nome: string;
  tipo_item: ServiceItemTipo;
  unidade: string;
  preco_base: number;
  faixa_min: number;
  faixa_max: number;
  tempo_estimado_min: number;
  ativo: boolean;
  ordem: number;
  criado_em: string;
};

export type OrdersRow = {
  id: string;
  cliente_id: string;
  prestador_id: string | null;
  category_id: string;
  status: OrderStatus;
  descricao: string | null;
  fotos_pedido: string[];
  data_agendada: string;
  janela_inicio: string;
  janela_fim: string;
  endereco: string;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  lat: number | null;
  lng: number | null;
  valor_tabela: number;
  valor_acordado: number | null;
  comissao_percent: number;
  sinal_prazo_em: string | null;
  confirmado_prestador_em: string | null;
  cancelado_em: string | null;
  cancelado_motivo: string | null;
  cancelado_por: string | null;
  no_show_prestador: boolean;
  criado_em: string;
  atualizado_em: string;
};

export type OrderItemsRow = {
  id: string;
  order_id: string;
  service_item_id: string;
  quantidade: number;
  valor_unitario: number;
};

export type ProposalsRow = {
  id: string;
  order_id: string;
  prestador_id: string;
  valor: number;
  mensagem: string | null;
  status: ProposalStatus;
  criado_em: string;
};

export type PaymentsRow = {
  id: string;
  order_id: string;
  tipo: PaymentKind;
  status: PaymentStatus;
  gateway_id: string | null;
  gateway_qrcode_payload: string | null;
  valor: number;
  comissao: number;
  pago_em: string | null;
  liberado_em: string | null;
  reembolsado_em: string | null;
  criado_em: string;
  atualizado_em: string;
};

export type CompletionPhotosRow = {
  id: string;
  order_id: string;
  url: string;
  enviado_em: string;
};

export type ReviewsRow = {
  id: string;
  order_id: string;
  autor_id: string;
  alvo_id: string;
  nota: number;
  comentario: string | null;
  criado_em: string;
};

export type TrackingPositionsRow = {
  id: number;
  order_id: string;
  prestador_id: string;
  lat: number;
  lng: number;
  heading: number | null;
  criado_em: string;
};

export type NotificationsRow = {
  id: string;
  user_id: string;
  tipo: string;
  payload: Record<string, unknown>;
  lida: boolean;
  criado_em: string;
};

export type ProviderStrikesRow = {
  id: string;
  provider_id: string;
  order_id: string | null;
  motivo: string;
  criado_em: string;
};

export type PushSubscriptionsRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  criado_em: string;
};

export type ProviderPublicProfilesRow = {
  user_id: string;
  nome: string;
  avatar_url: string | null;
  nota_media: number;
  total_avaliacoes: number;
  selo_verificado: boolean;
  veiculo_tipo: VehicleType | null;
  veiculo_cor: string | null;
  veiculo_porte: TruckSize | null;
};

type Relationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne?: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

type TableDef<Row, R extends Relationship[] = []> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: R;
};

export type Database = {
  public: {
    Tables: {
      users: TableDef<UsersRow>;
      provider_profiles: TableDef<
        ProviderProfilesRow,
        [
          {
            foreignKeyName: "provider_profiles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ]
      >;
      provider_service_categories: TableDef<
        ProviderServiceCategoriesRow,
        [
          {
            foreignKeyName: "provider_service_categories_provider_id_fkey";
            columns: ["provider_id"];
            isOneToOne: false;
            referencedRelation: "provider_profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "provider_service_categories_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "service_categories";
            referencedColumns: ["id"];
          },
        ]
      >;
      service_categories: TableDef<ServiceCategoriesRow>;
      service_items: TableDef<
        ServiceItemsRow,
        [
          {
            foreignKeyName: "service_items_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "service_categories";
            referencedColumns: ["id"];
          },
        ]
      >;
      orders: TableDef<
        OrdersRow,
        [
          {
            foreignKeyName: "orders_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_prestador_id_fkey";
            columns: ["prestador_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "service_categories";
            referencedColumns: ["id"];
          },
        ]
      >;
      order_items: TableDef<
        OrderItemsRow,
        [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_service_item_id_fkey";
            columns: ["service_item_id"];
            isOneToOne: false;
            referencedRelation: "service_items";
            referencedColumns: ["id"];
          },
        ]
      >;
      proposals: TableDef<
        ProposalsRow,
        [
          {
            foreignKeyName: "proposals_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "proposals_prestador_id_fkey";
            columns: ["prestador_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ]
      >;
      payments: TableDef<
        PaymentsRow,
        [
          {
            foreignKeyName: "payments_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ]
      >;
      completion_photos: TableDef<
        CompletionPhotosRow,
        [
          {
            foreignKeyName: "completion_photos_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ]
      >;
      reviews: TableDef<
        ReviewsRow,
        [
          {
            foreignKeyName: "reviews_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_autor_id_fkey";
            columns: ["autor_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_alvo_id_fkey";
            columns: ["alvo_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ]
      >;
      tracking_positions: TableDef<
        TrackingPositionsRow,
        [
          {
            foreignKeyName: "tracking_positions_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ]
      >;
      notifications: TableDef<NotificationsRow>;
      provider_strikes: TableDef<
        ProviderStrikesRow,
        [
          {
            foreignKeyName: "provider_strikes_provider_id_fkey";
            columns: ["provider_id"];
            isOneToOne: false;
            referencedRelation: "provider_profiles";
            referencedColumns: ["user_id"];
          },
        ]
      >;
      push_subscriptions: TableDef<PushSubscriptionsRow>;
    };
    Views: {
      provider_public_profiles: {
        Row: ProviderPublicProfilesRow;
        Relationships: [];
      };
    };
    Functions: {
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      current_user_role: {
        Args: Record<string, never>;
        Returns: UserRole;
      };
    };
    Enums: {
      user_role: UserRole;
      provider_status: ProviderStatus;
      pricing_type: PricingType;
      vehicle_type: VehicleType;
      truck_size: TruckSize;
      order_status: OrderStatus;
      proposal_status: ProposalStatus;
      payment_kind: PaymentKind;
      payment_status: PaymentStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
