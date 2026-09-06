-- Buckets de armazenamento para fotos/documentos.
insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('prestador-documentos', 'prestador-documentos', false),
  ('pedidos-fotos', 'pedidos-fotos', false),
  ('conclusao-fotos', 'conclusao-fotos', false)
on conflict (id) do nothing;

-- avatars: qualquer um lê, dono escreve na própria pasta (uid/arquivo)
create policy "avatars_select_all" on storage.objects
  for select using (bucket_id = 'avatars');
create policy "avatars_insert_own" on storage.objects
  for insert with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars_update_own" on storage.objects
  for update using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- documentos do prestador: só o dono e admin leem/escrevem
create policy "prestador_documentos_owner_select" on storage.objects
  for select using (
    bucket_id = 'prestador-documentos'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );
create policy "prestador_documentos_owner_insert" on storage.objects
  for insert with check (
    bucket_id = 'prestador-documentos' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- fotos do pedido (anexadas pelo cliente): participantes do pedido leem; cliente escreve
create policy "pedidos_fotos_select_participants" on storage.objects
  for select using (
    bucket_id = 'pedidos-fotos'
    and (
      public.is_admin()
      or exists (
        select 1 from public.orders o
        where o.id::text = (storage.foldername(name))[1]
          and (o.cliente_id = auth.uid() or o.prestador_id = auth.uid())
      )
    )
  );
create policy "pedidos_fotos_insert_cliente" on storage.objects
  for insert with check (
    bucket_id = 'pedidos-fotos'
    and exists (
      select 1 from public.orders o
      where o.id::text = (storage.foldername(name))[1] and o.cliente_id = auth.uid()
    )
  );

-- fotos de conclusão (anexadas pelo prestador): participantes leem; prestador escreve
create policy "conclusao_fotos_select_participants" on storage.objects
  for select using (
    bucket_id = 'conclusao-fotos'
    and (
      public.is_admin()
      or exists (
        select 1 from public.orders o
        where o.id::text = (storage.foldername(name))[1]
          and (o.cliente_id = auth.uid() or o.prestador_id = auth.uid())
      )
    )
  );
create policy "conclusao_fotos_insert_prestador" on storage.objects
  for insert with check (
    bucket_id = 'conclusao-fotos'
    and exists (
      select 1 from public.orders o
      where o.id::text = (storage.foldername(name))[1] and o.prestador_id = auth.uid()
    )
  );
