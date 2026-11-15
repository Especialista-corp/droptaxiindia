-- CPF do montador: primeiro dado do cadastro, único por pessoa.
alter table public.provider_profiles add column cpf text;
alter table public.provider_profiles
  add constraint provider_profiles_cpf_formato check (cpf is null or cpf ~ '^[0-9]{11}$');
create unique index provider_profiles_cpf_unico on public.provider_profiles (cpf) where cpf is not null;

-- Segurança: esta política deixava qualquer usuário logado ler a linha inteira
-- de um montador aprovado (endereço, links de documentos, dados bancários e,
-- agora, CPF). A vitrine pública já é servida pela view provider_public_profiles,
-- que expõe só colunas não sensíveis, então a política não é necessária.
drop policy "provider_profiles_select_approved" on public.provider_profiles;
