# 📱 Plano do Aplicativo — "Contador do Livramento" (nome provisório)

> **Fase atual:** alinhamento 100% do FRONT-END. Backend fica para a fase 2 (mas já deixamos os "ganchos" prontos).
> **Formato:** Web App responsivo (PWA) que abre em qualquer aparelho — celular, tablet, desktop.
> Se depois quisermos publicar nas lojas iOS/Android, empacotamos o mesmo código com Capacitor.

---

## 1. Conceito

Um app de humor/sátira política com contagem regressiva até o **2º turno das eleições presidenciais de 2026 (25/10/2026)**, mostrando em tempo real:

> **Faltam X dias, X horas, X minutos e X segundos para livrarmos o Brasil para sempre.**

Em volta do contador, uma "urna de brincadeira" diária, frases satíricas que variam sempre, cupons de desconto de empresas anunciantes e conteúdo compartilhável — tudo com tom **sério-divertido**: visual caprichado e "oficial", conteúdo de deboche.

### Nomes candidatos (para decidirmos)
| Nome | Vibe |
|---|---|
| **Livrômetro** | Curto, memorável, vira verbo ("já olhou o Livrômetro hoje?") |
| **Faltam X Dias** | Direto, bom para SEO/busca |
| **Contagem do Livramento** | Épico, tom de "missão" |
| **Urna do Povo** | Foca na brincadeira da urna diária |

---

## 2. Regras de ouro (blindagem jurídica que NÃO mata a graça)

Estas 4 regras entram no design desde o dia 1:

1. **Zero CPF, zero dados sensíveis.** O app "lembra" do usuário via armazenamento local do aparelho (localStorage/IndexedDB). O efeito "vejo que você não mudou seu voto desde a última vez" funciona exatamente igual — sem guardar CPF + opinião política de ninguém (LGPD trata opinião política como dado sensível).
2. **Cupom por participação, nunca por voto.** O token de desconto do anunciante é liberado por **participar da brincadeira do dia** (qualquer interação conta, inclusive votar 13). Recompensa condicionada a intenção de voto esbarra na Lei 9.504/97 (captação ilícita de sufrágio) e em regras do TSE. A pressão cômica anti-13 continua — só o benefício que não é condicionado.
3. **Sátira declarada + gafes reais.** Rodapé permanente: *"Conteúdo de humor e sátira política. Isto não é uma urna oficial."* O repertório de frases usa as **atrapalhadas reais e documentadas** dos últimos 20+ anos (são MUITAS), sempre em tom de deboche — nunca inventando fatos apresentados como verdade.
4. **Visual inspirado, não idêntico.** A urna do app é claramente uma paródia carismática (cores próprias, mascotes), não uma réplica da urna do TSE — evita confusão com ato oficial e problema de uso de identidade visual pública.

---

## 3. Stack técnica (front-end)

| Camada | Escolha | Por quê |
|---|---|---|
| Framework | **React 18 + Vite** | Rápido, leve, gigante ecossistema |
| Estilo | **Tailwind CSS** | Responsividade mobile-first sem dor |
| Animações | **Framer Motion + canvas-confetti + Lottie** | Cards flutuantes, confete, mascotes animados |
| Áudio | Howler.js | Beeps da urna, sons de comemoração |
| Estado | Zustand + localStorage | Simples, persiste streak/voto/preferências no aparelho |
| PWA | vite-plugin-pwa | Instalável ("Adicionar à tela inicial"), funciona offline, notificações push |
| Compartilhar | html-to-image + Web Share API | Gera card-imagem do resultado na hora |
| i18n de conteúdo | Arquivos **JSON de frases** versionados | O "cérebro do humor" é dado, não código — fácil de atualizar |
| Futuro app nativo | Capacitor | Mesmo código empacotado para App Store / Play Store |

**Sem backend na v1.** Tudo estático + local. Os pontos que futuramente falarão com servidor já ficam isolados atrás de uma camada `services/` (ver seção 9).

---

## 4. Mapa de telas

```
[Splash] → [Home: Contador] ─┬→ [Urna do Dia] → [Card Anti-13 (se 13)] → [Resultado + Cupom]
                             ├→ [Atrapalhada do Dia]
                             ├→ [Minhas Conquistas / Streak]
                             ├→ [Compartilhar]
                             └→ [Configurações]
```

### 4.1 Splash (2s)
Logo + mascote + frase aleatória de abertura ("Segura firme, patriota, já estamos carregando a contagem…").

### 4.2 Home — O Contador (tela principal)
- Contador gigante **DIAS : HORAS : MIN : SEG**, com flip animado dos dígitos (estilo placar de aeroporto).
- Cálculo sempre em runtime: `alvo (25/10/2026 17:00 BRT) − agora()`. Nunca precisa de servidor.
- **Seletor de modo do contador** (a parte divertida — desliza para alternar):
  - Modo clássico: dias/horas/min/seg
  - Modo churrasco: "faltam **X fins de semana de churrasco** para o livramento"
  - Modo cervejinha: "dá tempo de tomar **X cervejas geladas** até lá (com moderação, patriota)"
  - Modo novela: "faltam X capítulos de novela"
- **Termômetro do Livramento**: barra de progresso do mandato inteiro → quanto já passou, quanto falta (ex.: "Você já sobreviveu a 91%. Aguenta mais um pouco.")
- Botão principal: **"VOTAR AGORA NA URNA DO POVO"** (pulsando).
- Selo do **patrocinador do dia** ("Hoje quem paga a conta é a Havan 🇧🇷") — clicável.
- Toggle secreto nas configurações: contar até o 2º turno (25/10/2026) **ou** até a posse (01/01/2027) — "para os pessimistas de plantão".

### 4.3 Urna do Povo (o coração do app)
Layout da urna satírica:

```
┌─────────────────────────────────────────────┐
│           🗳️  URNA DO POVO — dia 05/07       │
├────────────────┬────────────────────────────┤
│  ESQUERDA      │  DIREITA                   │
│                │                            │
│  🚩 [13]       │  [22] Flávio Bolsonaro 🇧🇷  │
│  Bandeira PT   │  [77] Cachorro Caramelo 🐕 │
│  (sozinha)     │  [51] Capivara Patriota 🦫 │
│                │  [88] Picanha Liberal 🥩   │
├────────────────┴────────────────────────────┤
│  "Não importa em quem da direita você vai   │
│   votar — o que importa é o PT sair!"       │
│         [ CORRIGE ]  [ CONFIRMA ]           │
└─────────────────────────────────────────────┘
```

**Os 4 candidatos da direita** (1 sério + 3 mascotes):
1. **Flávio Bolsonaro — 22** · camisa da seleção, foto "oficial de campanha". O único humano/sério.
2. **Cachorro Caramelo — 77** · camisa do Brasil, óculos escuros. Slogan: *"Fiel, leal e nunca roubou nem um osso."*
3. **Capivara Patriota — 51** *(sugestão nova)* · capivara de faixa presidencial tomando tereré. Slogan: *"Calma, ordem e progresso. Roeu a esquerda."*
4. **Picanha Liberal — 88** *(sugestão nova)* · a lendária picanha prometida que nunca chegou na mesa do brasileiro, agora candidata. Slogan: *"A única promessa que você mesmo pode cumprir na churrasqueira."* — ironia dupla: é a promessa do próprio Lula virando candidata contra ele.

*(Alternativas na manga se quisermos trocar: Trator do Agro 🚜, Miojo Empreendedor 🍜 "o único que fica pronto em 3 minutos, diferente das obras do PAC".)*

**Fluxo de voto:**
1. Usuário toca num candidato → foto amplia + som de tecla da urna (beep).
2. **Se tocar no 13:** antes do CONFIRMA, sobe o **Card Flutuante Anti-13** (ver 4.4).
3. CONFIRMA → som de confirmação + tela de resultado.
4. O voto do dia fica salvo **no aparelho**. Na próxima visita: *"Vejo que desde a última vez você não mudou seu voto. Coerência é tudo, patriota. 🫡"* — ou, se mudou: reação específica à mudança (ver 4.5).

### 4.4 Card Flutuante Anti-13 (a ideia de ouro do app)
Quando o usuário aperta 13, ANTES do confirma, aparece um card flutuante sobre a urna com uma **atrapalhada aleatória do repertório** + botões:

> ⚠️ **CALMA! Ainda dá tempo de voltar atrás.**
> *"[frase do repertório — ex.: 'Perdeu o celular, mané? Agora que estou com ele, vou ali tomar uma cervejinha.']"*
>
> **[ 🙏 Voltar e salvar o Brasil ]** **[ 🤡 Confirmar mesmo assim ]**

- A frase **nunca repete** até esgotar o banco (algoritmo de sorteio sem reposição, ver seção 5).
- Se insistir e confirmar 13: tela especial cômica — chuva de mortadelas 🍖 caindo, e o app emite um **"Certificado Oficial de Amnésia Eleitoral"** compartilhável (isso é genial para viralizar: até eleitor do 13 vai compartilhar rindo).
- Se voltar atrás: aplausos + confete verde-amarelo + *"UFA! O Brasil agradece. Agora escolha qualquer um do lado de lá."*

### 4.5 Tela de Resultado + Cupom
- Votou na direita (qualquer um): fogos, hino em 8-bit, frase de parabéns variável (*"Você é realmente um brasileiro de verdade. A pátria te observa com orgulho. 🇧🇷"* — banco com dezenas de variações).
- **Cupom do patrocinador do dia** aparece para TODO participante (regra de ouro nº 2): *"A Havan liberou seu código: BRASIL-XY7K. Válido até 23h59."*
- Botão **Compartilhar**: gera imagem-card com o candidato escolhido, a contagem do dia e o link do app.
- Estatística local divertida: *"Você já votou 14 dias seguidos. Streak de patriota! 🔥"*

### 4.6 Atrapalhada do Dia
- Um card diário com uma gafe/tirada real documentada (com ano e contexto curtinho) + botão de compartilhar.
- Com PWA + permissão, vira **notificação push diária**: *"☕ Bom dia! Faltam 477 dias. A atrapalhada de hoje é de 2009…"* — é o que traz o usuário de volta todo dia (e o que valoriza o espaço do anunciante).

### 4.7 Conquistas / Gamificação (retenção)
| Medalha | Como ganha |
|---|---|
| 🥇 Patriota de Primeira Viagem | Primeiro voto |
| 🔥 Eleitor Fiel | 7 dias seguidos votando |
| 🛡️ Inabalável | 30 dias sem apertar o 13 nem por curiosidade |
| 📣 Corneteiro Oficial | Compartilhou 10 cards |
| 🤡 Sobrevivente da Mortadela | Apertou 13, viu o card e voltou atrás |
| 🦫 Amigo da Capivara | Votou na Capivara 5 vezes |

### 4.8 Easter eggs (a "diversão" escondida)
- Digitar 13 três vezes seguidas no teclado da urna → alarme de emergência + luzes vermelhas piscando + *"EVACUAR! EVACUAR!"*
- Chacoalhar o celular na Home → o contador "acelera" por 3 segundos e volta: *"Calma, apressadinho. Infelizmente ainda faltam X dias mesmo."*
- No dia 25/10/2026 00:00 → o app inteiro muda: contagem final ao vivo estilo réveillon.

---

## 5. O "cérebro do humor" — sistema de frases

**Arquitetura de conteúdo (tudo JSON local na v1):**

```
/src/content/
  ├─ gafes.json           → repertório de atrapalhadas reais (alvo: 150+ na v1)
  ├─ parabens.json        → variações de "parabéns por votar" (50+)
  ├─ fidelidade.json      → variações de "não mudou seu voto" (30+)
  ├─ mudou-voto.json      → reações a mudança de voto (por direção da mudança)
  ├─ anti13.json          → frases do card flutuante (usa gafes + provocações)
  ├─ abertura.json        → frases do splash
  └─ candidatos.json      → dados, slogans e falas de cada candidato
```

- **Sorteio sem reposição:** o app guarda no aparelho quais frases o usuário já viu e só repete depois de esgotar o banco → nunca fica monótono.
- **Frases com "slots":** templates tipo `"Faltam {dias} dias e você continua firme, {apelido}"` — o mesmo texto parece novo.
- **IA (fase 2):** quando houver backend, um job gera lotes novos de frases por IA (com revisão humana antes de publicar — humor político não pode sair do forno sem filtro) e o app baixa o JSON atualizado. **Não** chamamos IA em tempo real na v1: custo, latência e risco de sair frase problemática sem revisão.

---

## 6. Responsividade (requisito central)

Mobile-first com 3 layouts:

| Breakpoint | Layout |
|---|---|
| `< 768px` (celular) | Uma coluna; contador no topo, urna em tela cheia, navegação por abas no rodapé |
| `768–1279px` (tablet) | Duas colunas: contador fixo à esquerda, conteúdo à direita |
| `≥ 1280px` (desktop) | "Sala de Situação": contador gigante central estilo telão, urna e cards ao redor, atalhos de teclado (1-9 + Enter = votar) |

- Tipografia fluida (`clamp()`), imagens responsivas, dark mode automático.
- PWA instalável: no celular vira "app" com ícone; no desktop instala pelo Chrome/Edge.

---

## 7. Monetização (desenhada na v1, ativada na v2)

- **Patrocinador do Dia:** 1 marca por dia, presença em 4 pontos (selo na Home, urna, tela de cupom, notificação diária). Exclusividade diária = inventário escasso = valor.
- **Cupom-token:** na v1 (sem backend) o código é estático por campanha. Na v2, o backend gera tokens únicos por aparelho e dá ao anunciante um painel com métricas de resgate (é isso que ele paga para ver).
- Espaços extras futuros: card patrocinado no compartilhamento ("oferecido por…"), conquista patrocinada.

---

## 8. Estrutura do projeto (front)

```
livramento-app/
├─ src/
│  ├─ components/    → Countdown, Urna, CandidateCard, FloatingCard, CouponCard, ShareCard…
│  ├─ screens/       → Home, Voting, Result, DailyGaffe, Achievements, Settings
│  ├─ content/       → os JSONs do humor (seção 5)
│  ├─ engine/        → countdown.ts, phraseEngine.ts (sorteio sem reposição), streak.ts
│  ├─ services/      → coupon.ts, sponsor.ts, phrases.ts  ← na v1 leem JSON local;
│  │                    na v2 trocamos a implementação por chamadas HTTP SEM mexer nas telas
│  ├─ store/         → estado global (Zustand) + persistência local
│  └─ assets/        → mascotes, sons, Lotties
└─ public/           → manifest PWA, ícones, service worker
```

## 9. Ganchos para o backend (fase 2 — só anotar por enquanto)

| Necessidade | Solução futura |
|---|---|
| Tokens de cupom únicos + painel do anunciante | API + dashboard (Supabase/Firebase resolve rápido) |
| Frases novas geradas por IA | Job com API Claude + revisão humana + publicação de JSON versionado |
| Estatísticas agregadas ("87% já se livraram mentalmente") | Endpoint de contagem anônima (sem identificar ninguém) |
| Ranking de cidades | Geolocalização aproximada opt-in, agregada |
| Push segmentado | Serviço de push (OneSignal/FCM) |

## 10. Roadmap proposto

1. **M1 — Esqueleto navegável:** contador funcionando + layout responsivo das telas (sem conteúdo final).
2. **M2 — Urna completa:** fluxo de voto, card anti-13, resultado, persistência local, sons.
3. **M3 — Conteúdo:** bancos de frases v1, mascotes/artes dos candidatos, animações.
4. **M4 — Retenção:** PWA + notificação diária, conquistas, compartilhamento com imagem.
5. **M5 — Beta:** publicar na web (Vercel/Netlify, custo zero), testar com grupo fechado.
6. **Fase 2:** backend de cupons + painel de anunciante + frases por IA.

---

## 11. Decisões em aberto (para alinharmos)

- [ ] Nome do app (seção 1)
- [ ] Aprovar os 2 candidatos novos (Capivara Patriota e Picanha Liberal) ou trocar
- [ ] Data-alvo padrão: 2º turno (25/10/2026) — ok?
- [ ] Tom das frases: nível "deboche leve" ou "pancada"? (sugestão: 80% deboche leve compartilhável / 20% pancada)
- [ ] Identidade visual: verde-amarelo "oficial de campanha" ou algo mais moderno/neon?
