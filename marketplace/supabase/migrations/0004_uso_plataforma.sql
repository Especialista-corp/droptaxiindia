-- Consumo da plataforma frente aos limites do plano do Supabase, para o painel
-- admin e para o cron de alerta avisarem antes de o limite ser atingido.
--
-- security definer: precisa ler auth.users e storage.objects, que as roles da
-- API não enxergam. Por isso a execução é liberada apenas para service_role
-- (usada só no servidor) — nunca para anon/authenticated.
create function public.platform_usage()
returns table (
  db_bytes bigint,
  storage_bytes bigint,
  usuarios_ativos_30d bigint,
  posicoes_rastreamento bigint
)
language sql stable security definer set search_path = public
as $$
  select
    pg_database_size(current_database()),
    coalesce((select sum((o.metadata ->> 'size')::bigint) from storage.objects o), 0)::bigint,
    (select count(*) from auth.users u where u.last_sign_in_at > now() - interval '30 days'),
    (select count(*) from public.tracking_positions);
$$;

revoke all on function public.platform_usage() from public, anon, authenticated;
grant execute on function public.platform_usage() to service_role;

-- A limpeza diária apaga posições antigas por data.
create index tracking_positions_criado_em_idx on public.tracking_positions (criado_em);
