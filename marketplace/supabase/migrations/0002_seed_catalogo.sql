-- Seed do catálogo de Montagem de Móveis (Fase 1 / MVP), com preços de
-- referência do mercado 2025/2026 descritos na especificação.

insert into public.service_categories (nome, slug, tipo_precificacao, icone)
values ('Montagem de Móveis', 'montagem-moveis', 'tabela', 'wrench')
on conflict (slug) do nothing;

do $$
declare
  v_category_id uuid;
begin
  select id into v_category_id from public.service_categories where slug = 'montagem-moveis';

  insert into public.service_items
    (category_id, nome, tipo_item, unidade, preco_base, faixa_min, faixa_max, tempo_estimado_min, ordem)
  values
    (v_category_id, 'Guarda-roupa solteiro 2-4 portas', 'padrao', 'serviço', 150, 120, 180, 90, 10),
    (v_category_id, 'Guarda-roupa casal 4-6 portas', 'padrao', 'serviço', 200, 180, 250, 120, 20),
    (v_category_id, 'Guarda-roupa portas de correr', 'padrao', 'serviço', 250, 220, 300, 150, 30),
    (v_category_id, 'Cama box casal/solteiro', 'padrao', 'serviço', 85, 85, 85, 45, 40),
    (v_category_id, 'Beliche', 'padrao', 'serviço', 150, 150, 150, 90, 50),
    (v_category_id, 'Berço', 'padrao', 'serviço', 100, 100, 100, 60, 60),
    (v_category_id, 'Cômoda / gaveteiro', 'padrao', 'serviço', 100, 100, 100, 45, 70),
    (v_category_id, 'Rack de TV', 'padrao', 'serviço', 120, 120, 120, 60, 80),
    (v_category_id, 'Estante / painel grande', 'padrao', 'serviço', 180, 180, 180, 90, 90),
    (v_category_id, 'Mesa de jantar', 'padrao', 'serviço', 130, 130, 130, 60, 100),
    (v_category_id, 'Cadeira (unidade)', 'padrao', 'unidade', 35, 35, 35, 15, 110),
    (v_category_id, 'Escrivaninha', 'padrao', 'serviço', 107, 107, 107, 60, 120),
    (v_category_id, 'Home office completo', 'padrao', 'serviço', 280, 280, 280, 180, 130),
    (v_category_id, 'Taxa de visita', 'adicional', 'visita', 40, 30, 50, 0, 200),
    (v_category_id, 'Hora extra (pós-18h / domingo)', 'adicional', 'hora', 45, 30, 60, 60, 210),
    (v_category_id, 'Desmontagem', 'adicional', '% do item', 70, 60, 80, 45, 220),
    (v_category_id, 'Fixação na parede', 'adicional', 'ponto', 55, 30, 80, 20, 230)
  on conflict do nothing;
end $$;
