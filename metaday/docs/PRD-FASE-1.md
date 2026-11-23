# PRD — FASE 1 (escopo completo preservado)

> Extraído integralmente de `PRD-MESTRE.md` (seções 2–6 e 9). **Nada aprovado foi removido ou movido para outra fase.**
> O BETA 0.1 é uma entrega incremental *dentro* da Fase 1; o status real de cada item está em `STATUS-BETA.md`.
> Decisão mais recente (prevalece sobre layouts antigos): Home mostra **um objetivo principal**; **FREE até 3 objetivos ativos**; **PREMIUM ilimitado**; demais objetivos em tela secundária.

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

## 9. Regras matemáticas e estados

- **Dias restantes:** calcular a diferença entre datas civis no timezone configurado, não por divisão ingênua de milissegundos por 86.400.000. Definir claramente se o dia-alvo conta como zero.
- **Contador detalhado:** se a meta tem horário explícito, usar timestamp com timezone; se só data, usar convenção documentada e uniforme.
- **Progresso da meta:** `target_value > 0 ? clamp(current_value / target_value * 100, 0, 100) : estado_indeterminado`; não confundir com constância.
- **Tempo decorrido:** `clamp((hoje - início)/(alvo - início) * 100, 0, 100)` em datas civis.
- **Constância:** registros cumpridos / oportunidades programadas, excluindo dias não programados; faltas não geram mensagens punitivas.
- **Concluída:** conclusão explícita ou regra configurada de alcance; mostrar status principal 'Meta alcançada' mesmo se houver prazo futuro.
- **Risco:** calcular somente com dados suficientes e critério explicável; não presumir avaliação de saúde ou valor pessoal.

## Decisões de implementação do BETA 0.1 (a validar pelo dono do produto)

O PRD deixa lacunas (seção 14). Foram adotadas as seguintes convenções, todas cobertas por testes e fáceis de alterar:

| Tema | Decisão adotada | Onde |
|---|---|---|
| Semântica da data-alvo | **Inclusiva**: o prazo termina às 23:59:59.999 do dia-alvo no fuso do usuário. No dia-alvo, dias restantes = 0 (estado "Hoje é o dia-alvo"). Após isso: "Prazo encerrado". | `src/domain/countdown.ts` |
| Dias restantes | Diferença entre datas civis (nunca ms ÷ 86,4 M); imune a horário de verão. | `src/domain/dates.ts` |
| Quem ocupa vaga no FREE | Só `status = active`. Concluídas, arquivadas e pausadas (inclusive suspensas por downgrade) não ocupam; reativar exige vaga. | `src/domain/plan.ts` |
| Principal | No máx. 1, ativo ou recém-concluído (celebração). Ao arquivar/pausar/excluir o principal, promove o ativo de prazo mais próximo. | `createIdbDataLayer.ts` |
| Ritmo / risco | Só com valor-alvo; avalia após 7 dias ou 25% do prazo; "no ritmo" se progresso ≥ tempo decorrido − 15 pontos; "em risco" inclui prazo encerrado sem atingir o alvo. | `src/domain/progress.ts` |
| Constância | Cumpridos ÷ programados em 30 dias; dias fora da recorrência, pausas e o dia de hoje pendente não contam. | `src/domain/habits.ts` |
| Valor realizado | Check-ins com quantidade somam ao valor da meta (editar/excluir ajusta); pode passar de 100%. | `createIdbDataLayer.ts` |
| Premium | Simulação local explícita (`providerRef: demo-local`), sem cobrança. | `SettingsPage.tsx` |
| Modo local × demonstração | Dois bancos IndexedDB (`metaday-local`, `metaday-demo`); nunca se misturam. | `src/data/idb/db.ts` |
| Início da semana | Padrão domingo (pt-BR), configurável. | `seed.ts` |

## Rastreabilidade das decisões (Fase 1)

Legenda: ✅ funcional no BETA 0.1 · 🟡 parcial/demonstrativo · ⏳ pendente (Entrega D — permanece na Fase 1).

| Decisão | Tema | Status |
|---|---|---|
| 01 | Contagem por dias/data | ✅ |
| 02 | Frequência customizável | 🟡 campo de frequência e recorrência de hábitos; sem motor de lembretes |
| 03 | Check-in inteligente | 🟡 check-in manual completo; sem sugestões |
| 04 | Recuperação não punitiva | ✅ (constância/streak sem punição; pausas) |
| 05 | Peso/medidas opcionais e privados | ⏳ |
| 06 | Notificações personalizáveis | ⏳ (controle desabilitado, sinalizado) |
| 07 | Dashboard customizável | ⏳ |
| 08 | Híbrido offline/nuvem | 🟡 offline local verificado; sem nuvem |
| 09 | Múltiplas metas, uma principal (3 no FREE) | ✅ |
| 10 | Relatórios personalizáveis | 🟡 relatórios fixos |
| 11 | Conclusão no dia zero e arquivamento | ✅ |
| 12 | Login flexível (convidado revogado) | ⏳ |
| 13 | PWA Android primeiro | 🟡 PWA instalável/offline; Android real não testado |
| 14 | Tema dark (amarelo oficial) | ✅ |
| 15 | Personalização de metas | 🟡 |
| 16 | Calendário interativo | ✅ |
| 17 | Hábitos customizáveis | ✅ |
| 18 | Conquistas | ⏳ |
| 19 | Compartilhamento privado | ⏳ |
| 20 | Backup/sincronização/exportação | 🟡 exportação JSON local |
| 21 | PT/EN/ES e acessibilidade | 🟡 só PT-BR; auditoria pendente |
| 22 | Assistente IA | ⏳ |
| 23 | Integrações externas | ⏳ |
| 24 | Navegação híbrida | ✅ |
| 25 | Onboarding inteligente | 🟡 estado vazio guiado |
| 26 | Central de privacidade | 🟡 exportar/apagar dados locais |
| 27–30 | Protótipo navegável / stack / aprovação progressiva | ✅ |
| 31–34 | Dashboard, contadores, check-in central, gestão de objetivos | ✅ |
| 35 | Editor com prévia | ✅ |
| 36–37 | Hábitos vinculados; dimensões separadas | ✅ |
| 38–40 | Marcos, timeline com IA, histórico de alterações | ⏳ |
| 41 | Calendário com status/filtros | 🟡 marcadores e detalhe; sem filtros |
| 42–44 | Reagendamento, séries, biblioteca de hábitos | ⏳ |
| 45 | Consistência não punitiva | ✅ |
| 46–49 | Gráficos customizáveis, central/agenda/biblioteca de relatórios, exportações | ⏳ (gráfico fixo de 14 dias ✅) |
| 50–51 | Contas, negócio, anúncios, centros empresariais | ⏳ |
| 52A | Personalização visual | 🟡 só tema oficial escuro |
| 52B–52Q | Widgets, Android, beta/novidades, tutoriais, busca, favoritos, menus, espaços, modelos, portabilidade, histórico | ⏳ |
| Posterior | FREE 3 ativas / Premium ilimitado / 1 principal | ✅ (Premium simulado) |
