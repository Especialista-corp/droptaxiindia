-- Correções encontradas no teste do ciclo completo.

-- 1) Cliente e montador de um mesmo pedido precisam ver nome/telefone um do
--    outro. A política original só deixava cada um ler a própria linha, então o
--    cartão "Montador", o cartão "Cliente" e o formulário de avaliação ficavam
--    vazios. O acesso só existe depois que o pedido tem prestador atribuído
--    (proposta aceita) — antes disso ninguém vê telefone de ninguém.
create policy "users_select_contraparte_do_pedido" on public.users
  for select using (
    exists (
      select 1 from public.orders o
      where (o.cliente_id = users.id and o.prestador_id = auth.uid())
         or (o.prestador_id = users.id and o.cliente_id = auth.uid())
    )
  );

-- 2) A vitrine pública do prestador (nome, nota, selo, veículo em uso) precisa
--    ser legível por quem ainda não tem pedido fechado com ele — é o que o
--    cliente vê ao comparar propostas. Com security_invoker a view herdava a
--    RLS de users e voltava vazia. Como view "definer" ela expõe só as colunas
--    listadas, nunca telefone, e-mail, documentos ou dados bancários.
alter view public.provider_public_profiles set (security_invoker = false);
revoke all on public.provider_public_profiles from anon;
grant select on public.provider_public_profiles to authenticated;

-- 3) A nota média do prestador nunca era recalculada: as avaliações eram
--    gravadas, mas nota_media/total_avaliacoes ficavam em zero para sempre.
create function public.recalcular_nota_prestador()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update public.provider_profiles pp
  set
    nota_media = coalesce((select round(avg(r.nota), 2) from public.reviews r where r.alvo_id = new.alvo_id), 0),
    total_avaliacoes = (select count(*) from public.reviews r where r.alvo_id = new.alvo_id)
  where pp.user_id = new.alvo_id;
  return new;
end;
$$;

create trigger reviews_recalcular_nota
  after insert on public.reviews
  for each row execute procedure public.recalcular_nota_prestador();
