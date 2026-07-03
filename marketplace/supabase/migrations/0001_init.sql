-- MontaJá — schema inicial (Fase 1 / MVP)
-- Arquitetura multi-categoria desde o dia 1: service_categories/service_items
-- suportam qualquer serviço tabelado (montagem hoje, encanador/eletricista/frete depois).

create extension if not exists "pgcrypto";

-- ============================================================================
-- ENUMS
-- ============================================================================
create type user_role as enum ('cliente', 'prestador', 'admin');

create type provider_status as enum ('pendente', 'aprovado', 'suspenso');

create type pricing_type as enum ('tabela', 'distancia');

create type vehicle_type as enum ('moto', 'carro', 'pickup', 'caminhao');

create type truck_size as enum ('vuc', '3_4', 'toco');

create type order_status as enum (
  'aberto',
  'proposto',
  'agendado',
  'confirmado',
  'em_deslocamento',
  'em_execucao',
  'concluido_prestador',
  'aceito_cliente',
  'disputa',
  'cancelado'
);

create type proposal_status as enum ('pendente', 'aceita', 'recusada', 'expirada');

create type payment_kind as enum ('sinal_50', 'final_50');

create type payment_status as enum ('pendente', 'retido', 'liberado', 'reembolsado', 'falhou');

-- ============================================================================
-- USERS (espelha auth.users)
-- ============================================================================
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  role user_role not null default 'cliente',
  nome text not null,
  telefone text,
  telefone_verificado boolean not null default false,
  email text,
  avatar_url text,
  criado_em timestamptz not null default now()
);

-- Cria automaticamente a linha em public.users quando alguém se cadastra via Supabase Auth.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, role, nome, telefone, email)
  values (
    new.id,
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'cliente'),
    coalesce(new.raw_user_meta_data ->> 'nome', 'Usuário'),
    new.raw_user_meta_data ->> 'telefone',
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================================
-- CATÁLOGO DE SERVIÇOS (multi-categoria desde o MVP)
-- ============================================================================
create table public.service_categories (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null unique,
  ativo boolean not null default true,
  tipo_precificacao pricing_type not null default 'tabela',
  icone text,
  criado_em timestamptz not null default now()
);

create table public.service_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.service_categories (id) on delete cascade,
  nome text not null,
  tipo_item text not null default 'padrao' check (tipo_item in ('padrao', 'adicional')),
  unidade text not null default 'serviço',
  preco_base numeric(10, 2) not null,
  faixa_min numeric(10, 2) not null,
  faixa_max numeric(10, 2) not null,
  tempo_estimado_min integer not null default 60,
  ativo boolean not null default true,
  ordem integer not null default 0,
  criado_em timestamptz not null default now()
);

-- ============================================================================
-- PROVIDER PROFILES
-- ============================================================================
create table public.provider_profiles (
  user_id uuid primary key references public.users (id) on delete cascade,
  status provider_status not null default 'pendente',
  documento_url text,
  selfie_url text,
  comprovante_endereco_url text,
  certidao_negativa_url text,
  -- Aprovação é automática no cadastro; o prestador tem até este prazo (7 dias)
  -- para enviar comprovante de endereço + certidão negativa, senão é suspenso.
  documentos_prazo_em timestamptz,
  cep text,
  endereco text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  estado text,
  raio_km numeric(5, 1) not null default 10,
  nota_media numeric(3, 2) not null default 0,
  total_avaliacoes integer not null default 0,
  selo_verificado boolean not null default false,
  strikes integer not null default 0,
  dados_bancarios jsonb,
  lat_base double precision,
  lng_base double precision,
  veiculo_tipo vehicle_type,
  veiculo_cor text,
  veiculo_porte truck_size,
  aprovado_em timestamptz,
  aprovado_por uuid references public.users (id),
  criado_em timestamptz not null default now(),
  constraint veiculo_porte_apenas_caminhao check (
    veiculo_porte is null or veiculo_tipo = 'caminhao'
  )
);

-- Categorias e itens que o prestador atende.
create table public.provider_service_categories (
  provider_id uuid not null references public.provider_profiles (user_id) on delete cascade,
  category_id uuid not null references public.service_categories (id) on delete cascade,
  primary key (provider_id, category_id)
);

-- ============================================================================
-- ORDERS
-- ============================================================================
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.users (id),
  prestador_id uuid references public.users (id),
  category_id uuid not null references public.service_categories (id),
  status order_status not null default 'aberto',
  descricao text,
  fotos_pedido text[] not null default '{}',
  data_agendada date not null,
  janela_inicio time not null,
  janela_fim time not null,
  endereco text not null,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  estado text,
  cep text,
  lat double precision,
  lng double precision,
  valor_tabela numeric(10, 2) not null default 0,
  valor_acordado numeric(10, 2),
  comissao_percent numeric(5, 2) not null default 18,
  sinal_prazo_em timestamptz,
  confirmado_prestador_em timestamptz,
  cancelado_em timestamptz,
  cancelado_motivo text,
  cancelado_por uuid references public.users (id),
  no_show_prestador boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index orders_cliente_id_idx on public.orders (cliente_id);
create index orders_prestador_id_idx on public.orders (prestador_id);
create index orders_status_idx on public.orders (status);
create index orders_data_agendada_idx on public.orders (data_agendada);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  service_item_id uuid not null references public.service_items (id),
  quantidade integer not null default 1,
  valor_unitario numeric(10, 2) not null
);

create index order_items_order_id_idx on public.order_items (order_id);

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  prestador_id uuid not null references public.users (id),
  valor numeric(10, 2) not null,
  mensagem text,
  status proposal_status not null default 'pendente',
  criado_em timestamptz not null default now()
);

create index proposals_order_id_idx on public.proposals (order_id);

-- ============================================================================
-- PAGAMENTOS (integração Asaas na Fase 1 — ver src/lib/asaas.ts)
-- ============================================================================
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  tipo payment_kind not null,
  status payment_status not null default 'pendente',
  gateway_id text,
  gateway_qrcode_payload text,
  valor numeric(10, 2) not null,
  comissao numeric(10, 2) not null default 0,
  pago_em timestamptz,
  liberado_em timestamptz,
  reembolsado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index payments_order_id_idx on public.payments (order_id);

create table public.completion_photos (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  url text not null,
  enviado_em timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  autor_id uuid not null references public.users (id),
  alvo_id uuid not null references public.users (id),
  nota integer not null check (nota between 1 and 5),
  comentario text,
  criado_em timestamptz not null default now(),
  unique (order_id, autor_id)
);

create table public.tracking_positions (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  prestador_id uuid not null references public.users (id),
  lat double precision not null,
  lng double precision not null,
  heading numeric(5, 1),
  criado_em timestamptz not null default now()
);

create index tracking_positions_order_id_idx on public.tracking_positions (order_id, criado_em desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  tipo text not null,
  payload jsonb not null default '{}',
  lida boolean not null default false,
  criado_em timestamptz not null default now()
);

create index notifications_user_id_idx on public.notifications (user_id, lida);

create table public.provider_strikes (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.provider_profiles (user_id) on delete cascade,
  order_id uuid references public.orders (id),
  motivo text not null,
  criado_em timestamptz not null default now()
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  criado_em timestamptz not null default now()
);

-- ============================================================================
-- HELPERS
-- ============================================================================
create function public.current_user_role()
returns user_role
language sql stable security definer set search_path = public
as $$
  select role from public.users where id = auth.uid();
$$;

create function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select role = 'admin' from public.users where id = auth.uid()), false);
$$;

create function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

create trigger orders_set_updated_at before update on public.orders
  for each row execute procedure public.set_updated_at();

create trigger payments_set_updated_at before update on public.payments
  for each row execute procedure public.set_updated_at();

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.users enable row level security;
alter table public.provider_profiles enable row level security;
alter table public.provider_service_categories enable row level security;
alter table public.service_categories enable row level security;
alter table public.service_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.proposals enable row level security;
alter table public.payments enable row level security;
alter table public.completion_photos enable row level security;
alter table public.reviews enable row level security;
alter table public.tracking_positions enable row level security;
alter table public.notifications enable row level security;
alter table public.provider_strikes enable row level security;
alter table public.push_subscriptions enable row level security;

-- users
create policy "users_select_own_or_admin" on public.users
  for select using (id = auth.uid() or public.is_admin());
create policy "users_update_own" on public.users
  for update using (id = auth.uid()) with check (id = auth.uid());

-- provider_profiles: dono e admin têm acesso total; qualquer autenticado pode
-- ler o perfil de um prestador aprovado (dados públicos ficam a cargo da view
-- provider_public_profile abaixo, que expõe apenas colunas não sensíveis).
create policy "provider_profiles_owner_all" on public.provider_profiles
  for all using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());
create policy "provider_profiles_select_approved" on public.provider_profiles
  for select using (status = 'aprovado');

create policy "provider_service_categories_owner" on public.provider_service_categories
  for all using (
    provider_id = auth.uid() or public.is_admin()
  ) with check (provider_id = auth.uid() or public.is_admin());
create policy "provider_service_categories_select_all" on public.provider_service_categories
  for select using (true);

-- catálogo: leitura pública, escrita só admin
create policy "service_categories_select_all" on public.service_categories
  for select using (true);
create policy "service_categories_admin_write" on public.service_categories
  for insert with check (public.is_admin());
create policy "service_categories_admin_update" on public.service_categories
  for update using (public.is_admin());
create policy "service_categories_admin_delete" on public.service_categories
  for delete using (public.is_admin());

create policy "service_items_select_all" on public.service_items
  for select using (true);
create policy "service_items_admin_write" on public.service_items
  for insert with check (public.is_admin());
create policy "service_items_admin_update" on public.service_items
  for update using (public.is_admin());
create policy "service_items_admin_delete" on public.service_items
  for delete using (public.is_admin());

-- orders
create policy "orders_select_participants" on public.orders
  for select using (
    cliente_id = auth.uid() or prestador_id = auth.uid() or public.is_admin()
  );
create policy "orders_select_open_for_providers" on public.orders
  for select using (
    status in ('aberto', 'proposto') and public.current_user_role() = 'prestador'
  );
create policy "orders_insert_cliente" on public.orders
  for insert with check (cliente_id = auth.uid());
create policy "orders_update_participants" on public.orders
  for update using (
    cliente_id = auth.uid() or prestador_id = auth.uid() or public.is_admin()
  );

-- order_items segue a visibilidade do pedido pai
create policy "order_items_select_via_order" on public.order_items
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (o.cliente_id = auth.uid() or o.prestador_id = auth.uid() or public.is_admin())
    )
  );
create policy "order_items_insert_via_order" on public.order_items
  for insert with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.cliente_id = auth.uid()
    )
  );

-- proposals
create policy "proposals_select_participants" on public.proposals
  for select using (
    prestador_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.orders o where o.id = proposals.order_id and o.cliente_id = auth.uid())
  );
create policy "proposals_insert_prestador" on public.proposals
  for insert with check (prestador_id = auth.uid());
create policy "proposals_update_participants" on public.proposals
  for update using (
    prestador_id = auth.uid()
    or exists (select 1 from public.orders o where o.id = proposals.order_id and o.cliente_id = auth.uid())
    or public.is_admin()
  );

-- payments: só participantes do pedido e admin
create policy "payments_select_participants" on public.payments
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.orders o
      where o.id = payments.order_id
        and (o.cliente_id = auth.uid() or o.prestador_id = auth.uid())
    )
  );

-- completion_photos
create policy "completion_photos_select_participants" on public.completion_photos
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.orders o
      where o.id = completion_photos.order_id
        and (o.cliente_id = auth.uid() or o.prestador_id = auth.uid())
    )
  );
create policy "completion_photos_insert_prestador" on public.completion_photos
  for insert with check (
    exists (
      select 1 from public.orders o
      where o.id = completion_photos.order_id and o.prestador_id = auth.uid()
    )
  );

-- reviews
create policy "reviews_select_participants" on public.reviews
  for select using (
    autor_id = auth.uid() or alvo_id = auth.uid() or public.is_admin()
  );
create policy "reviews_insert_participants" on public.reviews
  for insert with check (
    autor_id = auth.uid()
    and exists (
      select 1 from public.orders o
      where o.id = reviews.order_id
        and (o.cliente_id = auth.uid() or o.prestador_id = auth.uid())
    )
  );

-- tracking_positions: cliente e prestador do pedido; prestador insere a própria posição
create policy "tracking_positions_select_participants" on public.tracking_positions
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.orders o
      where o.id = tracking_positions.order_id
        and (o.cliente_id = auth.uid() or o.prestador_id = auth.uid())
    )
  );
create policy "tracking_positions_insert_prestador" on public.tracking_positions
  for insert with check (prestador_id = auth.uid());

-- notifications
create policy "notifications_select_own" on public.notifications
  for select using (user_id = auth.uid());
create policy "notifications_update_own" on public.notifications
  for update using (user_id = auth.uid());

-- provider_strikes
create policy "provider_strikes_select_own_or_admin" on public.provider_strikes
  for select using (provider_id = auth.uid() or public.is_admin());

-- push_subscriptions
create policy "push_subscriptions_owner" on public.push_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================================
-- REALTIME
-- ============================================================================
alter publication supabase_realtime add table public.tracking_positions;
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.notifications;

-- ============================================================================
-- VIEW pública do prestador (sem documentos/dados bancários)
-- ============================================================================
create view public.provider_public_profiles
  with (security_invoker = true) as
select
  pp.user_id,
  u.nome,
  u.avatar_url,
  pp.nota_media,
  pp.total_avaliacoes,
  pp.selo_verificado,
  pp.veiculo_tipo,
  pp.veiculo_cor,
  pp.veiculo_porte
from public.provider_profiles pp
join public.users u on u.id = pp.user_id
where pp.status = 'aprovado';
