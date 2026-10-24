# Wireframe — `/judge`

> Descrição textual da tela de votação. Fonte: PROMPT.md §6, §6.1, §6.2, §7, §8.2.
> Estratégia: **mobile-first**. O layout base é o mobile; `min-width` só amplia.

---

## 1. Objetivo da tela

Permitir que o visitante anônimo julgue os 10 prisioneiros da **temporada ativa**:
escolher entre `forgive` (赦す / Perdoar) e `not_forgive` (赦さない / Não perdoar).

---

## 2. Estrutura geral (mobile, base)

```
┌─────────────────────────────┐
│ MILGRAM        [≡ menu]     │ ← <header> fixo, preto translúcido
├─────────────────────────────┤
│                             │
│  JULGAMENTO                 │ ← <h1> (GlitchText)
│  [ TRIAL 3 / 3 ]            │ ← SeasonBadge
│  Votação até 24/10/2026     │ ← <time datetime="...">
│                             │
│  Prisioneiros               │ ← <h2> (pode ser sr-only)
│ ┌───────────┐ ┌───────────┐ │
│ │  imagem   │ │  imagem   │ │ ← grid 2 colunas
│ │  No.01    │ │  No.02    │ │
│ │  ハルカ    │ │  ユノ      │ │
│ │  櫻井 遥   │ │  樫木 優乃  │ │
│ │ [Pode vot]│ │ [Pode vot]│ │
│ └───────────┘ └───────────┘ │
│ ┌───────────┐ ┌───────────┐ │
│ │    ...    │ │    ...    │ │
│ └───────────┘ └───────────┘ │
│                             │
├─────────────────────────────┤
│ ©ミルグラム管理委員会         │ ← <footer> + <address>
└─────────────────────────────┘
```

Fundo: preto, com `<ParticlesBackground />` sutil atrás de tudo (decorativo,
`aria-hidden="true"`, `pointer-events: none`).

## 3. Estrutura desktop (≥ 960px)

```
┌──────────────────────────────────────────────────────────────────┐
│ MILGRAM     Início  Julgamento  Personagens        [Admin?]      │
├──────────────────────────────────────────────────────────────────┤
│                      JULGAMENTO                                  │
│                   [ TRIAL 3 / 3 ]                                │
│                Votação até 24/10/2026                            │
│                                                                  │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                     │
│ │ 01   │ │ 02   │ │ 03   │ │ 04   │ │ 05   │  ← 5 colunas        │
│ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘                     │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                     │
│ │ 06   │ │ 07   │ │ 08   │ │ 09   │ │ 10   │                     │
│ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘                     │
├──────────────────────────────────────────────────────────────────┤
│ ©ミルグラム管理委員会            <address>contato</address>        │
└──────────────────────────────────────────────────────────────────┘
```

---

## 4. Grid responsivo

| Viewport | Colunas | Observação |
|---|---|---|
| base (< 560px) | **2** | mobile, sem media query |
| ≥ 560px | **3** | tablet |
| ≥ 960px | **5** | desktop (breakpoint de referência) |
| ≥ 1280px | 5 | só aumenta `max-width` e `gap` do container |

Regras:
- Sem `width` fixo em px nos containers (usar `max-width` + `%`/`fr`).
- Imagens: `max-width: 100%; height: auto; display: block`.
- Zero overflow lateral em 320px de largura.
- Proporção do card: retrato (≈ 3:4, igual ao placeholder 600×800).

> ⚠️ Ver decisão D1 (§12): o §6.2 sugere `auto-fit/minmax(220px, 1fr)`, o que
> **conflita** com "2 colunas no mobile".

---

## 5. Anatomia do card (`<PrisonerCard />`)

```
┌─────────────────────┐
│ ┌─────────────────┐ │
│ │                 │ │
│ │  <img> (S atual)│ │ ← imagem da temporada ativa + noise (::after)
│ │                 │ │
│ │ ┌─────────────┐ │ │
│ │ │ Pode votar  │ │ │ ← selo de estado (texto + cor + ícone)
│ │ └─────────────┘ │ │
│ └─────────────────┘ │
│ No.01               │ ← número
│ ハルカ               │ ← nickname (h3, Noto Sans JP)
│ 櫻井 遥              │ ← nome completo
└─────────────────────┘
```

- Elemento raiz: `<article>`. A área clicável é um `<button>` (não `<div onClick>`).
- Imagem em `<figure>`; `alt="Haruka, prisioneira No.01, temporada 3"`.
- `<h3>` = nickname. Hierarquia: `h1` (página) → `h2` (Prisioneiros) → `h3` (card).
- Hover (desktop): `scale(1.03)` + brilho magenta (`box-shadow`) + glitch leve no h3.
- Foco por teclado: mesmo destaque do hover + `:focus-visible` (outline magenta 3px).

---

## 6. Estados visuais do card

Regra de acessibilidade (§8.2): **nunca depender só de cor**. Todo estado tem
**texto visível** + cor + ícone/borda.

| Estado | Quando aparece | Texto | Visual | Clicável? |
|---|---|---|---|---|
| `voting` | Temporada em `voting` e o visitante ainda pode votar | **Pode votar** | Borda branca fina; selo neutro | Sim → abre modal de voto |
| `voted` | Visitante já votou neste prisioneiro nas últimas 24h | **Voto registrado** | Selo magenta com ✓; imagem levemente escurecida | Sim → abre modal "já votou hoje" |
| `lost` | Temporada encerrada com empate ou zero votos | **Empate** | Imagem em escala de cinza + glitch estático; selo cinza | Não (link p/ resultado) |
| `not_guilty` | Maioria `forgive` | **Perdoado** | Borda branca/ciano; selo claro | Não (link p/ resultado) |
| `guilty` | Maioria `not_forgive` | **Não perdoado** | Borda magenta `#E4007F`; selo magenta | Não (link p/ resultado) |

Estado extra, fora da lista do PROMPT, mas necessário (ver D3):

| Estado | Quando aparece | Texto | Visual | Clicável? |
|---|---|---|---|---|
| `idle` | Temporada ainda não iniciou | **Votação em breve** | Card opaco 60% | Não |

Precedência (do mais forte para o mais fraco):
`lost | not_guilty | guilty` (temporada encerrada) > `voted` > `voting` > `idle`.

---

## 7. Modal de voto (`<Modal />` + `<VoteDiamond />`)

### 7.1 Layout desktop (≥ 960px) — imagem à esquerda

```
┌──────────────────────────────────────────────────────────┐
│                                                  [ ✕ ]   │
│  ┌──────────────────┐   No.01                            │
│  │                  │   ハルカ  (櫻井 遥)                  │
│  │   imagem grande  │                                    │
│  │   (temporada     │   Qual é o seu veredito?           │
│  │    ativa)        │                                    │
│  │                  │        ◇                ◇          │
│  │                  │     赦す            赦さない         │
│  │                  │    Perdoar        Não perdoar      │
│  └──────────────────┘                                    │
│                         (área aria-live: feedback/erro)  │
└──────────────────────────────────────────────────────────┘
```

### 7.2 Layout mobile — empilhado

```
┌───────────────────────┐
│                [ ✕ ]  │
│  ┌─────────────────┐  │
│  │  imagem         │  │
│  └─────────────────┘  │
│  No.01 · ハルカ         │
│       ◇        ◇      │
│    Perdoar  Não perdoar│
│  (aria-live)          │
└───────────────────────┘
```

### 7.3 Losangos (`<VoteDiamond />`)

- SVG com `rect` rotacionado 45° (markup de referência fica para a **Etapa 5**).
- Cada losango é focável (`tabindex="0"`, `role="button"`) e responde a
  `Enter` / `Space`.
- Dois losangos:
  - `forgive` — rótulo **赦す / Perdoar** — cor `--forgive` (ver D2)
  - `not_forgive` — rótulo **赦さない / Não perdoar** — cor `#E4007F`
- O rótulo é **texto real** (não só imagem) e tem `aria-label` completo, ex.:
  `"Perdoar Haruka"`.

### 7.4 Comportamento

- Abre com Framer Motion: `scale(0.9 → 1)` + fade, 0.3s.
- Overlay escuro clicável (clicar fora fecha).
- Estados internos do modal:

| Estado | Visual | Interação |
|---|---|---|
| `idle` | Dois losangos ativos | Escolher uma opção |
| `submitting` | Losangos desabilitados (`aria-disabled="true"`) + "Enviando…" | Nenhuma (evita duplo clique) |
| `success` | Texto **投票済み / Voto registrado** | Fecha sozinho em 1,5s |
| `error` | Mensagem perto dos losangos (`aria-live="assertive"`) | Pode tentar de novo |

### 7.5 Acessibilidade do modal

- `role="dialog"`, `aria-modal="true"`, `aria-labelledby` → título do modal.
- Foco inicial: primeiro losango (ou botão fechar).
- **Focus trap:** `Tab` / `Shift+Tab` circulam só dentro do modal.
- `Esc` fecha o modal.
- Ao fechar, **o foco volta ao card que o abriu**.
- Fundo atrás do modal: `inert` / `aria-hidden="true"`; sem scroll do `body`.

---

## 8. Efeito glitch

Aplicado em: título `h1`, `h3` do card (hover/foco), losangos (hover/foco), botões.

- Técnica: duas cópias do texto com `clip-path` + deslocamento nos canais
  **vermelho/ciano** (`text-shadow` + keyframes `mgGlitch`).
- Duração curta (≈ 300–500ms), repetição só enquanto houver hover/foco.
- **Cor no hover do losango:** `forgive` → tom `--forgive`; `not_forgive` → magenta.
- `@media (prefers-reduced-motion: reduce)`: glitch **desligado**
  (sem animação; mantém só a mudança de cor).
- A animação nunca pode esconder o texto nem reduzir o contraste abaixo de 4.5:1.

> Implementação fiel (keyframes reais) → **Etapa 5**, via `NOTES.md §4`.

---

## 9. Modal "já votou hoje" (`#voted_modal`)

Aparece quando o visitante tenta votar num prisioneiro que já votou nas últimas 24h
(clicando no card `voted`, **ou** quando o servidor devolve `409`).

```
┌───────────────────────────────┐
│                       [ ✕ ]   │
│   投票済み                     │  ← título (h2)
│   Você já votou em Haruka.    │
│   Você poderá votar de novo   │
│   em <time datetime="...">    │
│   hoje às 18:42</time>.       │
│                               │
│          [ Entendi ]          │
└───────────────────────────────┘
```

- Mesmo componente `<Modal />`; só muda o conteúdo.
- Mostra **quando** o voto libera de novo (vem de `retryAfter` do `409`).
- Mesmas regras de foco/`Esc`/retorno de foco do modal de voto.
- Não mostra qual opção foi escolhida antes (não guardamos esse dado no cliente).

---

## 10. Mensagens de erro (perto do campo, sem `alert()`)

| Situação | Mensagem (pt-BR) |
|---|---|
| Rate-limit (`429`) | "Muitas tentativas. Tente novamente em X minutos." |
| Votação encerrada | "A votação desta temporada já foi encerrada." |
| Temporada não iniciada | "A votação ainda não começou." |
| Falha de rede / `5xx` | "Não foi possível registrar o voto. Tente novamente." |
| Dados inválidos (`400`) | "Escolha uma opção válida." |

Todas dentro da região `aria-live`; o botão volta a ficar habilitado para nova tentativa
(exceto no `429` com contagem regressiva).

---

## 11. Semântica HTML da página

```
<html lang="pt-br">
<title>MILGRAM | Votação — Temporada 3</title>      (≤ 60 caracteres)
<meta name="description" ...>                        (≤ 160 caracteres)

<header> <nav> ... </nav> </header>
<main>
  <h1>Julgamento</h1>
  <p>Temporada <strong>3</strong> · votação até <time datetime="2026-10-24">24/10/2026</time></p>
  <section aria-labelledby="titulo-prisioneiros">
    <h2 id="titulo-prisioneiros">Prisioneiros</h2>
    <ul>  → <li> → <article> (card) → <figure><img><figcaption> + <h3>
  </section>
</main>
<footer> <address>…</address> <small>©ミルグラム管理委員会</small> </footer>
```

- Exatamente **um** `<h1>`; sem pular níveis.
- Zero `<br>` para espaçamento; zero `<table>` neste layout.
- `<time datetime>` em todas as datas.

---

## 12. Decisões e pontos em aberto

| # | Ponto | Proposta |
|---|---|---|
| D1 | §6.2 diz `auto-fit/minmax(220px,1fr)`, §6 diz 5→3→2 colunas. Com `minmax(220px)`, um celular de 360px cai em **1 coluna**. | Usar colunas **explícitas** (2 / 3 / 5) nos breakpoints 560 e 960. É o que atende "2 no mobile" e "zero overflow". |
| D2 | §6 define `--forgive: #FFFFFF` mas o comentário diz "borda **ciano**". | Texto/preenchimento `#FFFFFF`; **ciano só na borda/glow**. Confirmar o tom exato na Etapa 5. |
| D3 | Os 5 estados do PROMPT não cobrem "temporada ainda `idle`". | Acrescentar o estado `idle` ("Votação em breve"). |
| D4 | O `voted` depende do visitante, não só do banco global. | O servidor calcula `votedPrisonerIds` (cookie + últimas 24h) e passa à página. O cliente **não** é fonte da verdade. |
| D5 | Empate → `lost`: por quê? | Sem maioria não há veredito; "perdido" preserva a ambiguidade, como na obra. Documentar na lista de decisões de UX. |
