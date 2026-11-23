# METADAY — PRD MESTRE PARA CLAUDE CODE

**Versão:** 1.0 | **Data:** 23/11/2026 | **Idioma:** Português (Brasil)

> **Instrução ao agente:** construir um aplicativo independente do Lovable, fiel ao METADAY BETA 0.1 apresentado nas capturas de referência, incorporando a última decisão de produto: a tela inicial prioriza exclusivamente o objetivo principal; o plano Grátis admite até três objetivos ativos e o Premium admite objetivos ativos ilimitados. Não confundir um protótipo demonstrativo com recursos realmente implementados. Não declarar concluído o que não foi testado.

## 1. Objetivo e posicionamento

METADAY é um aplicativo mobile-first para pessoas definirem objetivos com data-alvo, acompanharem uma contagem regressiva, executarem hábitos e registrarem progresso com check-ins. O valor central é **abrir o aplicativo e ver imediatamente o objetivo principal, quantos dias faltam e qual ação pode ser realizada hoje**. O produto deve ser claro, não punitivo, acessível, privativo e preparado para comercialização Freemium.

**Referência de fidelidade:** telas do protótipo Lovable compartilhadas na conversa: Dashboard, Metas, Check-in, Hábitos, menu Mais, Contagem regressiva, Calendário, Relatórios e Configurações. Não há acesso ao código-fonte original nem a todas as telas internas; paridade exata de código, animações e comportamento não é comprovável apenas com imagens. Usar as capturas como referência visual e este PRD como referência funcional. Se o repositório original estiver disponível, auditar e comparar componentes antes de implementar.

## 2. Regras mandatórias de escopo e fases

- **FASE 1:** inclui **todas** as decisões aprovadas até a enquete **52Q**, mais a decisão posterior sobre 3 objetivos gratuitos, objetivo principal e Premium ilimitado. Nada aprovado será removido da Fase 1 ou transferido unilateralmente para outra fase.
- **BETA 0.1:** é uma entrega incremental dentro da Fase 1. Implementar primeiro um núcleo realmente navegável e funcional, e sinalizar módulos restantes como não implementados ou demonstrativos. A versão beta não redefine o escopo final.
- **FASE 2:** exclusivamente novas questões ainda não aprovadas, começando pela 52R (perfis de configuração por contexto) e 52S (automações de alternância de perfis). Não implementar como decisão fechada.
- **FASE 3+:** expansões futuras ainda não especificadas. Não presumir aprovação.
- As decisões existentes são requisitos de produto; integrações com terceiros, cobrança, anúncios, IA, notificações nativas e sincronização exigem credenciais, infraestrutura e validação antes de serem consideradas funcionais.

## 3. Design system e reprodução visual

### Paleta obrigatória

| Token | Cor | Uso |
|---|---|---|
| `--background` | `#14232B` | Grafite oficial; fundo principal |
| `--accent` | `#E9AE12` | Amarelo oficial; CTA, contadores, seleção |
| `--foreground` | `#FFFFFF` | Texto primário |
| `--muted` | `#B8CCD0` | Texto secundário |

O protótipo utiliza variações de grafite muito escuro em cabeçalho/rodapé e cartões levemente mais claros; definir tokens auxiliares consistentes sem alterar a identidade. Cartões com bordas sutis, raios arredondados, boa hierarquia tipográfica, ícones lineares, contraste adequado e botões grandes para toque. Evitar efeitos de brilho exagerados. Tipografia sans moderna, números grandes e tabulares na contagem. Suportar 320px–desktop, áreas seguras Android, teclado virtual e rolagem vertical sem overflow horizontal.

### Navegação principal

Barra inferior fixa no mobile: **Início | Metas | Check-in | Hábitos | Mais**. Ícone/aba ativa em amarelo; inativas em cinza. Desktop: sidebar correspondente. Menu **Mais** em painel/modal inferior com **Contagem regressiva | Calendário | Relatórios | Configurações**, preservando a navegação anterior. A tela inicial, porém, deve ficar mais simples que a captura antiga.

### Tela inicial revisada — regra prioritária

1. Cabeçalho METADAY, acesso discreto a perfil/configurações.
2. **Um único cartão dominante** para o objetivo principal: nome, categoria opcional, data-alvo, **dias restantes em destaque**, opção de contador expandido dias/horas/minutos/segundos, status, progresso real da meta e tempo decorrido em indicadores separados.
3. CTA primário: **Registrar atividade de hoje**, encaminhando ao check-in contextualizado no objetivo principal.
4. Acesso secundário: **Meus objetivos** (segunda tela). Evitar lista extensa de cartões, métricas concorrentes e gráficos densos na primeira dobra.
5. Estado vazio: convite para criar o primeiro objetivo. Estado concluído: celebração e ação de arquivar/continuar, sem apresentar a contagem como se a meta ainda estivesse pendente.
6. Usuário escolhe/troca objetivo principal; garantir no máximo um principal por conta.

## 4. Monetização — decisão aprovada

| Recurso | FREE | PREMIUM |
|---|---|---|
| Objetivos ativos | **Máximo 3** | **Ilimitados** |
| Objetivo principal | 1 | 1 |
| Check-in, hábitos, contagem | Sim, conforme limites de plano a detalhar | Sim |
| Objetivos concluídos/arquivados | Não ocupam vagas ativas | Não ocupam vagas ativas |
| Anúncios comuns | Permitidos com limites e consentimentos | Não |
| Patrocinador permanente no rodapé | Sim | Sim |
| Relatórios/IA avançados | Limites a definir | Benefícios Premium |

Regras de negócio: limite validado no backend, não apenas na UI; impedir quarta meta ativa no FREE; oferecer upgrade não coercitivo; arquivar/concluir libera vaga; preservar histórico. Em downgrade com mais de três metas, **não excluir dados**: solicitar seleção de até três metas ativas e suspender as demais de maneira reversível. Pagamentos e benefícios só podem ser declarados ativos quando a cobrança estiver integrada. O banner de patrocinador deve respeitar acessibilidade e não encobrir navegação. Não usar dados de saúde, hábitos ou metas para segmentação de publicidade; proteger menores.

## 5. Telas e critérios de aceite do BETA 0.1

### 5.1 Início
- Renderizar objetivo principal acima da dobra na maioria dos celulares; contador dinâmico, CTA de check-in, acesso a outros objetivos.
- Refletir imediatamente alterações de nome, data, progresso, check-in e escolha do principal.
- Se o usuário não tiver objetivos, exibir criação guiada.

### 5.2 Metas
- Lista de objetivos com filtros: Todas, No ritmo, Em risco, Concluídas, e categorias/arquivadas quando aplicável.
- Criar, editar, excluir com confirmação, concluir, pausar, arquivar, restaurar, selecionar principal.
- Campos: id, título, descrição opcional, categoria, data de início, data-alvo, unidade (km, horas, livros, R$, personalizado), valor-alvo opcional, valor realizado, frequência, status, prioridade, timestamps.
- Cálculo de progresso limitado visualmente a 0–100%, sem descartar valor realizado superior à meta.
- Indicadores de risco devem ter regra explícita, compreensível e não punitiva; evitar classificar como risco por inferência arbitrária.

### 5.3 Check-in
- Selecionar objetivo, quantidade/unidade opcional, data, humor opcional, anotação opcional.
- Confirmar registro, prevenir envio duplo, permitir correção/exclusão, atualizar metas, calendário, relatórios e dashboard de modo consistente.
- Evitar avaliações morais de peso, medidas ou falhas.

### 5.4 Hábitos
- Criar, editar, arquivar e excluir hábitos; título, ícone, recorrência configurável e associação a uma ou várias metas.
- Grade semanal com dias selecionáveis, sequência de constância calculada corretamente e registro por data.
- Não penalizar automaticamente pausas ou dias sem programação.

### 5.5 Contagem regressiva
- Cards por objetivo com dias/horas/minutos/segundos, prazo, status, progresso e tempo decorrido separados.
- Cálculo pelo fuso do usuário; data-alvo sem horário deve ter semântica clara (por padrão, até o início do dia-alvo ou incluir o dia-alvo, documentar e aplicar consistentemente).
- Testar virada do dia, mudança de fuso, prazo passado, data atual e meta concluída.
- **Correção visual necessária:** meta concluída pode ter prazo futuro, mas a informação principal é 'Meta alcançada'; prazo fica secundário.

### 5.6 Calendário
- Navegação por mês, dias com marcadores distintos de check-in, hábito e prazo; legenda; detalhe ao tocar um dia.
- Respeitar início da semana configurável e dados reais do estado local/backend.

### 5.7 Relatórios
- Check-ins totais, constância, metas no ritmo/em risco, gráfico de atividade dos últimos 14 dias, progresso por meta.
- Gráficos devem representar dados reais; nunca usar barras uniformes falsas. Estados vazios e explicações de cálculos.
- PDF/exportação: se não estiver implementado, mostrar 'Em desenvolvimento' e não oferecer botão que sugira download funcional.

### 5.8 Configurações
- Perfil, preferências de lembretes, horário, início da semana, status de integrações, restauração dos dados de demonstração.
- Não apresentar um toggle de notificação como operacional sem permissão e serviço implementados.
- Na versão final, conta obrigatória; beta pode ser local com aviso explícito e sem falsa autenticação.

### 5.9 Administração / Estado do beta
- Tela ou seção interna com checklist: **Funcional | Demonstrativo | Pendente | Falhou**, com evidência de testes e data.
- Mostrar 'dados demonstrativos armazenados neste dispositivo' quando localStorage/IndexedDB forem usados.

## 6. Inventário consolidado de decisões aprovadas — Fase 1

O inventário abaixo preserva os temas das decisões aprovadas, inclusive recursos ainda não visíveis no BETA. É uma especificação funcional consolidada, não uma alegação de implementação.

### Decisões 01–26
01 contagem por dias/data; 02 frequência de atividades customizável; 03 check-in inteligente; 04 recuperação não punitiva de faltas; 05 peso/medidas opcionais e privados; 06 notificações personalizáveis; 07 dashboard customizável; 08 armazenamento híbrido offline/nuvem; 09 múltiplas metas com uma principal (**agora limitado a 3 ativas no FREE**); 10 relatórios personalizáveis; 11 conclusão no dia zero e arquivamento; 12 login flexível (**modo convidado revogado por cadastro obrigatório**); 13 PWA Android primeiro/Play Store depois; 14 tema dark (**verde revogado; usar amarelo oficial**); 15 personalização de metas; 16 calendário interativo; 17 hábitos customizáveis; 18 conquistas opcionais não punitivas; 19 compartilhamento privado de cartões e relatórios; 20 backup/sincronização/exportação; 21 PT-BR/EN/ES e acessibilidade; 22 assistente IA com confirmação; 23 integrações externas opcionais; 24 navegação híbrida; 25 onboarding inteligente; 26 central de privacidade.

### Decisões 27–49
27 protótipo navegável completo antes da integração funcional; 28 Lovable/GitHub/Supabase como stack original (a réplica Claude Code pode usar stack equivalente); 29 módulos aprovados progressivamente; 30 protótipo alta fidelidade com dados fictícios; 31 dashboard; 32 contadores alternáveis; 33 check-in central; 34 gestão de objetivos; 35 editor com prévia; 36 hábitos vinculados a metas; 37 dimensões de progresso separadas; 38 marcos intermediários; 39 timeline enriquecida com IA; 40 histórico de alterações; 41 calendário com status/filtros; 42 reagendamento; 43 recorrência e edição de séries; 44 biblioteca de hábitos; 45 consistência não punitiva; 46 gráficos customizáveis; 47 central de relatórios; 48 agendamento de relatórios; 49 biblioteca pesquisável de relatórios e exportações PDF/XLSX/CSV/PNG/JPG, inclusive 1080x1080, 1080x1350 e 1080x1920.

### Decisões 50 e 51 — contas, negócio e plataforma
- Cadastro obrigatório com nome completo, data de nascimento, e-mail, telefone, país, estado, cidade, idioma, preferências e aceite de termos; considerar minimização de dados e requisitos legais.
- Autenticação Google, e-mail/senha, código temporário, biometria quando suportada, recuperação segura e sessões/dispositivos.
- Planos FREE/PREMIUM, patrocínio persistente em ambos, anúncios comuns apenas no FREE e intersticiais limitados em transições naturais; 15 dias grátis não é uma decisão confirmada para METADAY e não deve ser inventada.
- Plataforma de anunciantes: campanhas, segmentação não sensível, estúdio de anúncios com IA, métricas, cobrança, cupons, suporte, conformidade, pacotes de patrocinador e governança.
- Centros empresariais: suporte multicanal com IA e transferência humana; evolução do produto e priorização; DevOps/GitHub/pipelines/rollback; monitoramento e incidentes; backup/recuperação; segurança MFA/criptografia/auditoria; governança LGPD, consentimentos e menores; infraestrutura e custos; centro de controle de modelos/IA; agentes supervisionados; QA de IA; memória de IA controlada; produtividade e voz; experiência offline; sincronização multidispositivo e conflitos; segurança e recuperação de conta; comunicações de segurança; notificações inteligentes e acessíveis; acessibilidade ampla.
- Todos os centros de IA e automações devem ter permissões, trilhas de auditoria, controle de custos, confirmação humana para ações importantes e opção de desligamento.

### Decisões 52A–52Q
- 52A personalização visual (tema oficial por padrão, claro/escuro, layouts); 52B widgets internos; 52C widgets Android na tela inicial (**exigem implementação nativa compatível; PWA não garante paridade**); 52D notificações Android com permissões; 52E atalhos Android; 52F instalação e atualizações Android integradas; 52G programa beta inteligente; 52H apresentação inteligente de novidades; 52I aprendizado interativo e tutoriais; 52J pesquisa inteligente integrada; 52K favoritos, recentes e acesso rápido; 52L menus e navegação personalizáveis; 52M espaços de trabalho inteligentes/personalizáveis; 52N biblioteca inteligente de modelos; 52O compartilhamento seguro de modelos, sem dados pessoais; 52P portabilidade segura de preferências; 52Q histórico e restauração seletiva de personalizações.

**Decisão posterior obrigatória:** FREE até 3 objetivos ativos, PREMIUM ilimitado, 1 objetivo principal na abertura, demais objetivos em tela secundária. Em caso de conflito com layouts antigos, prevalece esta decisão mais recente.

## 7. Arquitetura recomendada para Claude Code

- **Frontend:** React + TypeScript + Vite, Tailwind CSS, shadcn/ui, Lucide, React Router, TanStack Query, Zod, React Hook Form; gráficos com biblioteca acessível.
- **PWA:** manifest, ícones, service worker e estratégia de cache versionada; não prometer offline integral sem teste real.
- **Persistência beta:** IndexedDB (preferível) ou localStorage encapsulado por repositório, com seed de demonstração, versionamento de schema e reset explícito. Não misturar demo com dados reais.
- **Backend produção:** Supabase Auth, Postgres, Storage, Edge Functions, RLS por usuário/tenant; chaves sensíveis somente no servidor; webhooks idempotentes para cobrança.
- **Separação:** `domain/` (regras de metas, contagem, planos), `features/` (telas), `data/` (interfaces de repositório), `integrations/`, `components/ui/`, `tests/`.
- **Migração:** construir interfaces `GoalRepository`, `HabitRepository`, `CheckInRepository`, `SubscriptionRepository` para trocar armazenamento local por Supabase sem refazer telas.
- **Acessibilidade:** foco visível, teclado, labels, leitor de tela, movimento reduzido, contraste e áreas de toque.
- **Segurança:** LGPD, consentimento granular, exportação/exclusão, RLS, logs sem dados sensíveis, proteção de menores e retenção definida.

## 8. Modelo de dados mínimo

```text
users(id, full_name, email, locale, timezone, created_at)
profiles(user_id, birth_date?, phone?, country?, state?, city?, preferences_json)
subscriptions(id, user_id, plan: free|premium, status, provider_ref?, valid_until?)
goals(id, user_id, title, description?, category?, start_date, target_date,
      target_value?, current_value, unit?, status: active|paused|completed|archived,
      is_primary, created_at, updated_at, completed_at?)
habits(id, user_id, title, icon?, recurrence_json, status, created_at)
goal_habits(goal_id, habit_id)
habit_entries(id, habit_id, local_date, completed, notes?, created_at)
checkins(id, user_id, goal_id, local_date, quantity?, mood?, notes?, created_at)
milestones(id, goal_id, title, target_date?, target_value?, status)
notification_preferences(user_id, timezone, quiet_hours?, reminders_json)
report_exports(id, user_id, type, format, status, storage_path?, created_at)
settings_versions(id, user_id, snapshot_json, created_at)
```

Índices por `user_id`, datas e status; constraint de único principal por usuário quando aplicável; limite FREE validado transacionalmente no servidor; políticas RLS completas. Não armazenar dados de saúde em logs de anúncios. Definir comportamento de timezone em check-ins e datas-alvo antes de migração.

## 9. Regras matemáticas e estados

- **Dias restantes:** calcular a diferença entre datas civis no timezone configurado, não por divisão ingênua de milissegundos por 86.400.000. Definir claramente se o dia-alvo conta como zero.
- **Contador detalhado:** se a meta tem horário explícito, usar timestamp com timezone; se só data, usar convenção documentada e uniforme.
- **Progresso da meta:** `target_value > 0 ? clamp(current_value / target_value * 100, 0, 100) : estado_indeterminado`; não confundir com constância.
- **Tempo decorrido:** `clamp((hoje - início)/(alvo - início) * 100, 0, 100)` em datas civis.
- **Constância:** registros cumpridos / oportunidades programadas, excluindo dias não programados; faltas não geram mensagens punitivas.
- **Concluída:** conclusão explícita ou regra configurada de alcance; mostrar status principal 'Meta alcançada' mesmo se houver prazo futuro.
- **Risco:** calcular somente com dados suficientes e critério explicável; não presumir avaliação de saúde ou valor pessoal.

## 10. Testes de aceitação obrigatórios

1. Primeiro acesso sem metas -> criar objetivo -> aparece na Home como principal.
2. FREE cria três metas ativas -> quarta é bloqueada com explicação e oferta Premium; não perder dados.
3. Premium demo permite quarta meta sem fingir que pagamento foi processado.
4. Trocar objetivo principal atualiza Home e mantém apenas um principal.
5. Arquivar/concluir libera vaga no FREE; restaurar respeita limite.
6. Registrar check-in atualiza objetivo, calendário e relatórios; recarregar mantém dados.
7. Hábitos recorrentes marcam apenas dias corretos; streak respeita dias não programados.
8. Contagem regressiva correta hoje, amanhã, data passada, ano bissexto, mudança de mês e timezone.
9. Meta concluída com data futura não aparece como 'pendente' na Home.
10. Gráfico de 14 dias reflete registros reais; zero registros produz estado vazio.
11. Todas as abas e menus funcionam com navegação de volta e barra fixa.
12. Sem overflow em 320, 360, 390, 412px e desktop; sem botões sob a barra inferior.
13. Reset da demonstração solicita confirmação e restaura somente dados demo.
14. Funcionalidades pendentes exibem estado correto; não existem CTAs falsos de PDF, Google ou notificações.
15. Se backend estiver integrado: testar autenticação, RLS entre usuários, sessões, recuperação e sincronização sem vazamento.

## 11. Ordem de execução recomendada para o agente

**Entrega A — Réplica visual beta:** inicializar repositório, design system, navegação, telas, dados demo e layout responsivo. Publicar preview de teste.

**Entrega B — Núcleo funcional:** CRUD de metas, objetivo principal, regra 3/ilimitado, hábitos, check-ins, contadores, calendário, relatórios locais e persistência.

**Entrega C — Robustez:** testes automatizados, acessibilidade, PWA, estados vazios, erros, confirmação, checklist de status, deploy beta.

**Entrega D — Continuação da Fase 1 aprovada:** autenticação real/Supabase, sincronização, notificações, relatórios exportáveis, IA, Premium/cobrança, publicidade responsável, Android nativo e centros empresariais, em lotes verificáveis. Não mover esses itens para a Fase 2.

**Entrega E — Fase 2 e posteriores:** somente após novas aprovações, iniciando 52R e 52S.

## 12. Entregáveis exigidos do Claude Code

- Código-fonte organizado e executável; `README.md` com comandos de instalação, execução, teste e deploy.
- `.env.example` sem segredos; esquema e migrations de banco quando houver backend.
- `docs/PRD-FASE-1.md` (este escopo completo), `docs/PRD-FASE-2.md` (pendências 52R+), `docs/PRD-FASE-3.md` (reservado), `docs/STATUS-BETA.md` com status real por recurso.
- Testes unitários de contagem, regras de plano e status, testes de integração de CRUD e smoke tests de navegação.
- Evidência do que foi implementado e do que continua pendente; URL de preview somente se deploy realmente realizado.

## 13. Prompt inicial para Claude Code

> Você é o engenheiro principal do projeto METADAY. Leia integralmente `METADAY_PRD_CLAUDE_CODE.md`. Construa um novo aplicativo React/TypeScript/PWA mobile-first com design fiel às capturas do METADAY BETA 0.1 e à paleta oficial. Aplique prioritariamente a decisão mais recente: Home mostra um objetivo principal, FREE tem até 3 metas ativas, Premium ilimitado, demais metas na segunda tela. Implemente a Entrega A e B com persistência local robusta, testes reais e documentação. Preserve no PRD da Fase 1 todas as decisões aprovadas, mesmo quando ainda não operacionais no beta. Não invente credenciais, assinaturas pagas ou integrações funcionando. Ao concluir cada entrega, reporte arquivos modificados, testes executados, resultado, limitações e próximo passo. Não altere o escopo aprovado sem autorização.

## 14. Lacunas a validar sem bloquear a réplica beta

- Capturas não cobrem formulários completos de criação/edição, onboarding, tela de pagamento, login real, administração e animações.
- Preço do Premium, limites específicos de IA/relatórios, fornecedor de pagamento, horários de corte e semântica exata do dia-alvo ainda exigem definição.
- A Fase 1 tem amplo escopo; concluir todo o conjunto não deve ser confundido com publicar o beta inicial.
- A fidelidade visual final deve ser aferida por comparação lado a lado com as capturas e, se possível, com o código original do Lovable.

**Fim do PRD.**
