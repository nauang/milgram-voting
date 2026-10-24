# PROMPT — Página de votação estilo MILGRAM

> **⚠️ ANTES DE TUDO — LEIA A SEÇÃO 0.** Ela define como usar os arquivos de
> referência em `/reference/` (capturas do site oficial milgram.jp).

---

## 0. Diretrizes de uso das referências

Os arquivos em `/reference/*.html` são capturas estáticas do site oficial. Use-os
**apenas** como referência de:

- estrutura semântica (tags, hierarquia, classes descritivas)
- markup dos modais de voto (SVG com rects rotacionados 45°)
- padrão de URLs de imagens por temporada
- paleta de cores, tipografia e efeitos visuais (glitch, partículas)
- estados visuais por prisioneiro (`lost`, `not_guilty`, `guilty`)

**NÃO copie de `/reference/`:**

- scripts de GTM, Google Analytics, reCAPTCHA, YouTube iframe API
- meta tags OG / SEO do site oficial
- URLs absolutas do CDN oficial (`/cdn.milgram.jp/...`) — serão quebradas em
  produção; use placeholders locais até que eu suba imagens reais
- CSS vendorizado do Bootstrap
- os `<svg>` gigantes do `index.html` que não sejam o modal de voto
- qualquer chamada a `judgesystem/api` — você vai criar a sua própria API

O arquivo `reference/NOTES.md` contém os trechos extraídos e curados. **Priorize
o `NOTES.md` antes de abrir os HTMLs completos** — ele já aponta o que importa.

Se houver conflito entre este prompt e o `/reference/`, **este prompt vence**.

---

## 1. Stack técnica

### Runtime & framework

- **Next.js 14+** (App Router) com React Server Components
- **TypeScript** em modo `strict: true` (zero `any`)
- **Node.js 20 LTS**

### Front-end

- **TailwindCSS** (mobile-first, breakpoints customizados)
- **Framer Motion** (modal, glitch, transições)
- **@tsparticles/react** (fundo do hero/landing)

### Back-end & dados

- **Prisma ORM** (schema tipado, migrations)
- **SQLite** (dev) / **Postgres Neon/Supabase** (prod)
- **Zod** (schemas compartilhados entre API e front)
- **NextAuth / Auth.js** (sessão via cookie httpOnly)

### Segurança & infra

- **@upstash/ratelimit** (rate-limit serverless-friendly)
- **DOMPurify** (sanitização, se precisar injetar HTML)
- **CSP** via headers em `next.config.js`

### Testes

- **Vitest** (unit — funções de regra: contagem, veredito, rate-limit)
- **Playwright** (E2E — fluxo completo de voto)
- **@testing-library/react** (componentes)

### Qualidade de código

- **ESLint** + `eslint-config-next` + `@typescript-eslint`
- **Prettier** + `prettier-plugin-tailwindcss` (ordena classes)
- **Husky** + `lint-staged` (pre-commit hooks)
- **TypeScript `tsc --noEmit`** (typecheck no CI)

### CI/CD & Deploy

- **GitHub Actions** (lint, typecheck, test, build em PRs)
- **Vercel** (deploy automático após CI verde)

### Observabilidade (opcional mas recomendado)

- **@sentry/nextjs** (captura de erros em prod)
- **@vercel/analytics** (tráfego privacy-first)
- **@vercel/speed-insights** (Core Web Vitals)

> **Nota:** `create-next-app` já vem com ESLint e Prettier configurados por
> padrão. As demais ferramentas devem ser adicionadas manualmente conforme §13.

---

## 2. Regras de negócio

- 10 prisioneiros fixos (No.01 a No.10) com: `id, number, fullName, nickname, slug`
- 3 temporadas (TRIAL 1, 2, 3)
- Cada temporada tem: `status: "idle" | "voting" | "closed"`, `startsAt`, `endsAt`
- Voto por prisioneiro, por temporada, por visitante anônimo
- **1 voto por prisioneiro a cada 24h por visitante**
- Opções: `forgive` (赦す) ou `not_forgive` (赦さない)
- Ao encerrar votação:
  - Maioria `forgive` → `not_guilty`
  - Maioria `not_forgive` → `guilty`
  - Empate → `lost`
  - Zero votos → `lost`
- Ao iniciar próxima temporada → imagens dos prisioneiros trocam
- Ao encerrar 3ª temporada → app entra em estado `finished`

---

## 3. Modelo de dados (Prisma)

```prisma
model Prisoner {
  id       Int      @id @default(autoincrement())
  number   Int
  fullName String
  nickname String
  slug     String   @unique
  images   Image[]
  votes    Vote[]
  results  Result[]
}

model Image {
  id         Int      @id @default(autoincrement())
  prisonerId Int
  season     Int
  url        String
  prisoner   Prisoner @relation(fields: [prisonerId], references: [id])
  @@unique([prisonerId, season])
}

model Season {
  id       Int      @id @default(autoincrement())
  number   Int      @unique
  status   String   @default("idle")
  startsAt DateTime?
  endsAt   DateTime?
  results  Result[]
}

model Vote {
  id         Int      @id @default(autoincrement())
  prisonerId Int
  seasonId   Int
  choice     String
  voterKey   String
  createdAt  DateTime @default(now())
  prisoner   Prisoner @relation(fields: [prisonerId], references: [id])
  @@index([prisonerId, seasonId])
  @@index([voterKey, prisonerId, createdAt])
}

model Result {
  id              Int      @id @default(autoincrement())
  prisonerId      Int
  seasonId        Int
  forgiveCount    Int
  notForgiveCount Int
  verdict         String
  prisoner        Prisoner @relation(fields: [prisonerId], references: [id])
  season          Season   @relation(fields: [seasonId], references: [id])
  @@unique([prisonerId, seasonId])
}
```

---

## 4. Rotas

| Rota                              | Descrição                                                        |
| --------------------------------- | ---------------------------------------------------------------- |
| `/`                               | Landing com hero + grid dos 10                                   |
| `/judge`                          | Página principal de votação (cards + modal)                      |
| `/judge/result/[season]`          | Resultado com % e veredito                                       |
| `/character`                      | Lista dos 10 (imagens da temporada ativa)                        |
| `/character/[slug]`               | Página individual                                                |
| `/admin`                          | Painel protegido (iniciar/encerrar temporada, upload de imagens) |
| `POST /api/vote`                  | Registra voto                                                    |
| `POST /api/admin/season/[action]` | `init` / `closeVoting` / `close`                                 |

---

## 5. Troca de imagens por temporada

- Cada prisioneiro tem 3 imagens (uma por temporada)
- UI sempre usa: `prisoner.images.find(i => i.season === currentSeason.number)`
- Fallback: se faltar imagem da temporada ativa, usa a da última disponível
- Ao encerrar/encerrar-iniciar temporada, `currentSeason` muda **atomicamente**

---

## 6. Estilo visual

### Paleta

```
--bg:      #000000
--fg:      #FFFFFF
--accent:  #E4007F  (magenta MILGRAM)
--accent2: #FF003C
--card:    #1a1a1a
--forgive:      #FFFFFF  (Perdoar — borda ciano)
--not-forgive:  #E4007F  (Não perdoar — magenta)
```

### Tipografia

- Noto Sans JP (400, 700) para japonês
- Inter / Helvetica Neue para latim
- Títulos em maiúsculas com `letter-spacing: 0.15em`

### Efeitos obrigatórios

- **Glitch RGB** nos botões e títulos (replicar `mgGlitch` do site oficial — ver
  `NOTES.md §4`)
- **Partículas de fundo** sutis (tsparticles, configuração leve)
- **Botões com cantos cortados** diagonalmente (`clip-path: polygon(...)`)
- **Noise texture** sobre imagens (`::after` com SVG noise)
- **Framer Motion:** fade + slide (0.6s ease-out) na entrada, hover em cards:
  `scale(1.03)` + brilho magenta, modal: `scale(0.9 → 1)`

### Estrutura

- Header fixo preto translúcido com nav
- Grid responsivo 10 prisioneiros: **5 col desktop → 3 tablet → 2 mobile**
- Rodapé com copyright `©ミルグラム管理委員会`

### Componentes-chave

```
<GlitchText />
<VoteDiamond choice="forgive" | "not_forgive" onVote={...} />
<PrisonerCard prisoner={...} season={...} />
<SeasonBadge current={3} total={3} />
<ParticlesBackground />
<Modal />  ← custom, não usar lib
```

---

## 6.1 SEO e semântica HTML (obrigatório em TODAS as páginas)

Toda página DEVE ter:

- `<html lang="pt-br">`
- `<title>` único e descritivo (max 60 caracteres)
  - Ex: `MILGRAM | Votação — Temporada 3`, `MILGRAM | Haruka — No.01`
- `<meta name="description">` única (max 160 caracteres)
- **Exatamente um `<h1>` por página**
- Hierarquia de headings `h1 → h2 → h3` sem pular níveis
- HTML5 semântico: `<header>`, `<nav>`, `<main>`, `<article>`, `<section>`, `<footer>`
- `alt` descritivo em TODA imagem (`alt=""` só se decorativa)
- `<figure> + <figcaption>` para imagens com legenda contextual
- `<time datetime="2026-10-24">` para datas de votação
- `<address>` no rodapé com contato
- `<strong>`/`<em>` (semânticos) em vez de `<b>`/`<i>` (visuais)
- **Zero `<br>`** para espaçamento (usar CSS)
- **Zero `<table>`** para layout (só dados tabulares)

Aplicar em: `/`, `/judge`, `/judge/result/[season]`, `/character`, `/character/[slug]`.

Validação: rodar em [validator.w3.org](https://validator.w3.org) sem erros críticos.

---

## 6.2 Responsividade — mobile-first (NÃO desktop-first)

- Estilo base = **mobile** (sem media query)
- `@media (min-width: 960px)` para desktop (breakpoint de referência)
- Breakpoints sugeridos: `560px`, `960px`, `1280px`
- **Nunca** `width` fixo em px para containers
- Imagens: `max-width: 100%; height: auto; display: block`
- Tabela de histórico de votos: `overflow-x: auto` **no wrapper**
- Grid de prisioneiros: `repeat(auto-fit, minmax(220px, 1fr))`
- **Zero overflow lateral** em mobile

---

## 7. Fluxo de voto (UX)

1. `/judge` → grid dos 10 prisioneiros (imagem da temporada ativa)
2. Clique → modal com imagem do prisioneiro + 2 losangos SVG (ver `NOTES.md §1`)
3. Hover → glitch RGB na cor correspondente
4. Escolha → `POST /api/vote`
5. Feedback animado `投票済み / Voto registrado`, modal fecha em 1.5s
6. Card mostra selo `voted`
7. Nova tentativa no mesmo dia → modal `#voted_modal` (ver `NOTES.md §2`)

---

## 8. Segurança

- Rate-limit por IP + cookie anônimo (1 voto por prisioneiro / 24h)
- `sha256(ip + salt)` — nunca armazenar IP puro
- CSRF token em todos os POSTs
- `/admin` protegido por NextAuth
- Ações admin com confirmação dupla (modal "tem certeza?")
- Encerrar votação em `prisma.$transaction`
- Após encerrar, API recusa novos votos para aquela temporada

### 8.1 Rate limiting — implementação

- **Lib:** `@upstash/ratelimit` (serverless-friendly, funciona no Vercel Edge)
- **Alternativa self-hosted:** `rate-limiter-flexible` + Redis/Postgres
- **Configurações obrigatórias:**
  ```typescript
  // src/lib/rate-limit.ts
  import { Ratelimit } from "@upstash/ratelimit";
  import { Redis } from "@upstash/redis";

  const redis = Redis.fromEnv();

  // Voto: 10 tentativas por IP por hora (anti-bot)
  export const voteLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "1 h"),
    analytics: true,
    prefix: "ratelimit:vote",
  });

  // Login admin: 5 tentativas por 15 min
  export const loginLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "15 m"),
    prefix: "ratelimit:login",
  });
  ```
- **Comportamento:** retornar `429 Too Many Requests` com header `Retry-After`
- **Mensagem de UX:** "Muitas tentativas. Tente novamente em X minutos."
- **Além do rate-limit global**, aplicar a regra de negócio: 1 voto por
  prisioneiro / 24h por `voterKey` (cookie + IP hash)
- **Nunca** confiar só no client — validar 24h no servidor via query na tabela `Vote`

---

## 8.2 Acessibilidade — checklist obrigatório

### Foco visível

```css
:focus-visible {
  outline: 3px solid rgba(228, 0, 127, 0.4);
  outline-offset: 2px;
}
```

- **Nunca** `outline: none` sem substituto

### Contraste

- Texto sobre fundo preto: ≥ 4.5:1 (WCAG AA)
- Botões de voto: `#FFFFFF` e `#E4007F` sobre `#000` — verificar com axe DevTools
- Não depender **só** de cor para status:
  - `voting` → texto "Pode votar"
  - `voted` → texto "Voto registrado"
  - `lost` → texto "Empate"
  - `not_guilty` → texto "Perdoado"
  - `guilty` → texto "Não perdoado"

### Formulários e modal

- Todo input associado a `<label for="...">`
- Modal de voto: `role="dialog"`, `aria-labelledby`, `aria-modal="true"`
- Erros de validação com `aria-invalid="true"` no campo
- Mensagens com `aria-live="polite"` (ou `"assertive"` se crítico)
- `aria-describedby` ligando campo → mensagem de erro

### Navegação por teclado

- Todo botão/rect SVG de voto acessível via `Tab`
- `Esc` fecha o modal
- `Focus trap` dentro do modal aberto
- Ordem lógica de tabulação
- Ao fechar o modal, foco volta ao card que o abriu

### Imagens

- `alt` descritivo: `alt="Haruka, prisioneira No.01, temporada 3"`
- Imagens decorativas: `alt=""`

Validação: rodar [axe DevTools](https://www.deque.com/axe/devtools/) sem violations
críticas + Lighthouse Accessibility ≥ 90.

---

## 8.3 Formulários (modal de voto e admin)

- `<form>` sempre com `novalidate` se a validação for custom
- Agrupar campos relacionados com `<fieldset> + <legend>`
- Validação HTML5 em paralelo: `required`, `minlength`, `pattern`, `min`, `max`
- Placeholder **NÃO substitui** label
- `preventDefault()` **obrigatório** no `submit`
- `{ once: true }` em submits críticos (evitar duplo clique no voto)
- Regex de e-mail realista: `/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/`
- Feedback de erro **próximo ao campo**, não em `alert()`
- Botão desabilitado enquanto inválido (`disabled` + `aria-disabled="true"`)

### Nunca usar

- `alert()` como feedback principal
- Eventos inline (`onclick="..."` no HTML)
- `innerHTML` para inserir input do usuário (risco de XSS)

---

## 8.4 Segurança frontend

- **`textContent` sempre que possível** — nunca `innerHTML` com dados do usuário
- Se precisar injetar HTML: sanitizar com `DOMPurify`
- **`addEventListener` sempre** — nunca `onclick="..."` no HTML
- **`preventDefault()`** em todo `submit` custom
- **`{ once: true }`** em handlers de submit crítico
- **Delegação de eventos** em listas dinâmicas
- Sem `eval()`, sem `new Function()`
- Sem armazenar senha/token em `localStorage`
- **CSP via headers** em `next.config.js`:
  ```typescript
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com;
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: blob: https://placehold.co;
    font-src 'self' https://fonts.gstatic.com;
    connect-src 'self' https://vitals.vercel-insights.com https://*.sentry.io;
  `
    .replace(/\s{2,}/g, " ")
    .trim();
  ```

---

## 9. Seed

10 prisioneiros (dados extraídos do `judge.html` — ver `NOTES.md §3`):

| #   | Apelido | Nome completo | Slug   |
| --- | ------- | ------------- | ------ |
| 1   | ハルカ  | 櫻井 遥       | haruka |
| 2   | ユノ    | 樫木 優乃     | yuno   |
| 3   | フータ  | 梶山 風汰     | futa   |
| 4   | ムウ    | 楠 夢羽       | mu     |
| 5   | シドウ  | 桐崎 獅童     | shidou |
| 6   | マヒル  | 椎奈 真昼     | mahiru |
| 7   | カズイ  | 椋原 一威     | kazui  |
| 8   | アマネ  | 桃瀬 遍       | amane  |
| 9   | ミコト  | 榧野 尊       | mikoto |
| 10  | コトコ  | 杠 琴子       | kotoko |

3 temporadas em `idle`, exceto a 1ª em `voting`.

Imagens: placeholders `https://placehold.co/600x800/000000/E4007F?text={slug}+S{n}`
até upload real via `/admin`.

---

## 10. Critérios de aceite (REVISADO)

### Funcional

- [ ] `npm install && npx prisma migrate dev && npm run dev` sobe a app
- [ ] Voto funciona 1×/dia por prisioneiro; 2ª tentativa é bloqueada
- [ ] `/admin` autentica, encerra votação → `/judge/result/1` mostra % + veredito
- [ ] Iniciar temporada 2 → imagens dos prisioneiros trocam em **todas** as páginas
- [ ] Empate e zero votos → `lost` corretamente
- [ ] Rate-limit retorna `429` após 10 votos/hora do mesmo IP

### Semântica / SEO

- [ ] Todo `<title>` é único
- [ ] Um `<h1>` por página (validator.w3.org)
- [ ] `alt` em todas as imagens
- [ ] `lang="pt-br"` no `<html>`
- [ ] HTML5 semântico (`<header>`, `<nav>`, `<main>`, `<footer>`)

### Acessibilidade

- [ ] Navegação por teclado (Tab) no modal de voto
- [ ] `Esc` fecha o modal
- [ ] Foco visível em todos os botões
- [ ] `aria-invalid` e `aria-live` no formulário
- [ ] axe DevTools sem violations críticas
- [ ] Contraste ≥ 4.5:1

### Responsividade

- [ ] Mobile-first com `@media (min-width: 960px)`
- [ ] Zero overflow lateral em mobile
- [ ] Imagens responsivas (`max-width: 100%`)

### Código

- [ ] Zero `innerHTML` com dados do usuário
- [ ] Zero `onclick="..."` inline
- [ ] `preventDefault()` em todo submit
- [ ] `{ once: true }` no submit de voto
- [ ] `strict: true` no `tsconfig.json`
- [ ] Zero `any`
- [ ] Variáveis/funções em `camelCase`, constantes em `UPPER_SNAKE_CASE`
- [ ] Comentários em português nos pontos críticos de regra

### Lint & formatação

- [ ] `npm run lint` passa **sem warnings**
- [ ] `npm run typecheck` (`tsc --noEmit`) passa sem erros
- [ ] `npm run format` (Prettier) roda em todo `/src`
- [ ] `prettier-plugin-tailwindcss` instalado (ordena classes)

### Pre-commit hooks

- [ ] `husky` instalado (`npx husky init`)
- [ ] Hook `pre-commit` roda `lint-staged`
- [ ] `lint-staged` configurado para `*.{ts,tsx}` → ESLint + Prettier
- [ ] Hook `pre-push` roda `npm run test` (Vitest)
- [ ] Tentativa de commit com erro de lint é bloqueada

### CI/CD

- [ ] `.github/workflows/ci.yml` existe e roda em PRs + `main`
- [ ] Pipeline executa: `npm ci` → `lint` → `typecheck` → `test` → `build`
- [ ] Badge de status do CI no README
- [ ] Vercel faz deploy automático após CI verde

### Testes

- [ ] Vitest cobre funções de regra (contagem de votos, veredito, rate-limit)
- [ ] Playwright cobre fluxo completo: `/judge` → clicar → votar → ver "voted"
- [ ] `npm run test` verde
- [ ] `npm run test:e2e` verde

### Observabilidade (se implementado)

- [ ] Sentry captura erros em prod
- [ ] Vercel Analytics ativo
- [ ] Vercel Speed Insights ativo

### Git

- [ ] Commits semânticos (`feat:`, `fix:`, `docs:`)
- [ ] Branches por feature
- [ ] README completo com todas as seções do §13.1

### Entrega

- [ ] Prints de evidência desktop + mobile + admin (ver §17)
- [ ] Figma ou wireframe em `/docs/prototipo/`
- [ ] Diagrama ER em `/docs/diagramas/`

---

## 11. Entregáveis

1. Repositório Next.js completo
2. Schema Prisma + seed
3. README completo (ver §13.1)
4. `.env.example`
5. Comentários em português nos pontos de regra de negócio
6. Prints de evidência (ver §17)
7. Wireframes em `/docs/prototipo/`
8. Diagrama ER em `/docs/diagramas/`
9. **CI/CD verde** em GitHub Actions
10. **Pre-commit hooks** funcionando (Husky + lint-staged)
11. **Testes Vitest + Playwright** passando

---

## 12. Ordem de execução sugerida

**Não gere tudo de uma vez.** Siga esta ordem:

1. **Etapa 0 — Planejamento (sem código):** wireframes, pseudocódigo do fluxo
   de voto, diagrama ER. Salvar em `/docs/`.
2. **Etapa 1 — Setup + CI/CD:** scaffold Next.js, configurar ESLint + Prettier +
   Husky + lint-staged + GitHub Actions. **Antes de escrever features.**
3. **Etapa 2:** Prisma + seed + `/judge` funcional com placeholders.
4. **Etapa 3:** `/admin` (iniciar/encerrar temporada, upload).
5. **Etapa 4:** `/judge/result/[season]` com gráficos de %.
6. **Etapa 5 (agora abra `/reference/`):** refine o visual fiel ao site oficial,
   priorizando: modal de voto → glitch → partículas → tipografia.
7. **Etapa 6:** `/character` e `/character/[slug]` com troca de imagem por temporada.
8. **Etapa 7:** acessibilidade (axe), SEO (validator.w3.org), responsividade.
9. **Etapa 8:** testes Vitest + Playwright.
10. **Etapa 9:** Sentry + Vercel Analytics (se implementar).
11. **Etapa 10:** evidências, README final, revisão de Git.

A cada etapa, me mostre o que foi feito antes de prosseguir.

---

## 13. Estrutura do repositório + Git

```
meu-projeto/
├── PROMPT.md
├── README.md              ← obrigatório, ver §13.1
├── .gitignore             ← node_modules, .env*, .next/
├── .env.example
├── LICENSE                ← MIT
├── .github/
│   └── workflows/
│       └── ci.yml         ← ver §13.4
├── .husky/
│   ├── pre-commit         ← ver §13.3
│   └── pre-push           ← ver §13.3
├── docs/
│   ├── prototipo/         ← print do Figma ou link
│   ├── diagramas/         ← ER do banco, fluxo de voto
│   ├── evidencias/        ← prints (ver §17)
│   └── api.md             ← endpoints documentados
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── public/
│   └── images/
│       └── characters/
│           └── {slug}/
│               ├── season-1.webp
│               ├── season-2.webp
│               └── season-3.webp
├── src/
│   ├── app/               ← Next.js App Router
│   ├── components/
│   ├── lib/
│   ├── styles/
│   ├── types/
│   └── utils/
├── tests/
│   ├── unit/              ← Vitest
│   └── e2e/               ← Playwright
├── .eslintrc.json
├── .prettierrc
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── vitest.config.ts
```

### 13.1 README.md — seções obrigatórias

- **Nome do projeto** + descrição de 1 parágrafo
- **Badges:** CI status (GitHub Actions), Vercel deploy, License
- **Problema e público-alvo**
- **Tecnologias** (Next.js, Prisma, Tailwind, etc.)
- **Estrutura de pastas** (breve explicação)
- **Protótipo** — link do Figma ou print em `/docs/prototipo/`
- **Como rodar** — `npm install`, `npx prisma migrate dev`, `npm run dev`
- **Variáveis de ambiente** — aponta pro `.env.example`
- **Endpoints da API** — tabela `Método | Rota | Descrição`
- **Integrantes** (nome + função)
- **Status** — "Em desenvolvimento — MVP previsto para [data]"
- **Licença**

### 13.2 Git — convenções

**Branches:**

- `main` (estável)
- `feature/{nome}` — ex: `feature/modal-voto`
- `fix/{nome}` — ex: `fix/rate-limit-24h`
- `docs/{nome}`

**Commits (Conventional Commits):**

```
feat: implementa modal de voto com glitch
fix: corrige rate-limit de 24h no voto
docs: adiciona diagrama ER em docs/diagramas/
refactor: extrai VoteDiamond para componente próprio
test: adiciona teste de contagem de votos
style: ajusta espaçamento do grid de prisioneiros
chore: configura husky e lint-staged
ci: adiciona workflow do github actions
```

**Pull Request:**

- Título = mesmo formato do commit
- Descrição com "O que foi feito" + "Como testar"
- Pelo menos 1 review antes de merge

### 13.3 Pre-commit hooks (Husky + lint-staged)

**Instalação:**

```bash
npm install -D husky lint-staged
npx husky init
```

**`package.json` (trecho relevante):**

```json
{
  "scripts": {
    "prepare": "husky",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "format": "prettier --write \"src/**/*.{ts,tsx,css,md}\"",
    "test": "vitest run",
    "test:e2e": "playwright test"
  },
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{css,md,json}": ["prettier --write"]
  }
}
```

**`.husky/pre-commit`:**

```bash
npx lint-staged
```

**`.husky/pre-push`:**

```bash
npm run test
```

**Comportamento esperado:**

- Tentativa de commit com erro de lint é **bloqueada**
- Prettier formata automaticamente antes de commitar
- Push com teste quebrado é **bloqueado**

### 13.4 GitHub Actions CI/CD

**`.github/workflows/ci.yml`:**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install
        run: npm ci

      - name: Prisma generate
        run: npx prisma generate

      - name: Lint
        run: npm run lint

      - name: Typecheck
        run: npm run typecheck

      - name: Unit tests
        run: npm run test

      - name: Build
        run: npm run build
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          NEXTAUTH_SECRET: ${{ secrets.NEXTAUTH_SECRET }}
```

**Observações:**

- Badge no README:
  `![CI](https://github.com/{user}/{repo}/actions/workflows/ci.yml/badge.svg)`
- Playwright pode rodar em job separado (mais lento) ou só em `main`
- Vercel faz deploy automático quando CI verde na `main`

---

## 14. Planejamento antes do código

Antes de implementar cada tela, produzir:

1. **Wireframe** (papel, Excalidraw ou Figma) em `/docs/prototipo/`
   - `/judge` — grid + modal de voto
   - `/judge/result/[season]` — gráficos de %
   - `/admin` — painel de controle
2. **Pseudocódigo** da lógica complexa em `/docs/diagramas/`:
   - Fluxo de voto (validar → registrar → feedback)
   - Encerramento de temporada (contagem → veredito → próxima temporada)
3. **Diagrama ER** do Prisma em `/docs/diagramas/er.png`
4. **Lista de decisões de UX** (ex: "por que empate vira `lost`?")

---

## 15. Convenções de código

### 15.1 Nomenclatura

- `camelCase` para variáveis e funções: `currentSeason`, `getPrisonerImage`
- `PascalCase` para componentes React: `PrisonerCard`, `VoteDiamond`
- `UPPER_SNAKE_CASE` para constantes globais: `MAX_VOTES_PER_DAY`, `TOTAL_PRISONERS`
- Nomes descritivos — evitar `x`, `y`, `data1`, `temp`
- Booleanos com prefixo `is/has/can/should`: `isVotingOpen`, `hasVotedToday`
- Handlers com prefixo `handle` + evento: `handleVoteSubmit`, `handleSeasonClose`

### 15.2 Comentários

- `//` para linha única
- `/* */` para bloco (só quando realmente necessário)
- Comentar **por quê**, não **o quê**
- TSDoc (`/** */`) em funções exportadas de `/lib` e `/utils`
- Comentários em **português** nos pontos de decisão de regra de negócio
- Nunca deixar `// TODO` sem issue ou data

### 15.3 TypeScript

- `strict: true` no `tsconfig.json`
- Zero `any` — usar `unknown` + type guard
- Tipos compartilhados em `src/types/`
- Zod para validar dados externos (API, formulários)

### 15.4 Linting & formatação

**`.eslintrc.json`:**

```json
{
  "extends": ["next/core-web-vitals", "plugin:@typescript-eslint/recommended"],
  "rules": {
    "no-console": ["warn", { "allow": ["warn", "error"] }],
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": ["error"],
    "prefer-const": "error",
    "@typescript-eslint/no-explicit-any": "error"
  }
}
```

**`.prettierrc`:**

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

**Regras:**

- `npm run lint` deve passar **sem warnings** antes de commit
- `npm run typecheck` (`tsc --noEmit`) deve passar
- `prettier-plugin-tailwindcss` ordena classes Tailwind automaticamente
- Adicionar `.eslintignore` e `.prettierignore` com `node_modules`, `.next`, `dist`

---

## 16. Persistência no cliente (opcional)

Se usar `localStorage`:

- Sempre `JSON.stringify` ao gravar, `JSON.parse` ao ler
- Sempre `try/catch` no parse
- Chaves namespaced: `milgram:theme`, `milgram:lastSeason`
- **NUNCA** armazenar: senha, token de admin, dados pessoais
- Verificar suporte: `if (typeof Storage !== "undefined")`
- `localStorage` para persistente; `sessionStorage` para temporário por aba

**Não usar JWT simulado no frontend.** NextAuth já cuida de sessão via cookie
httpOnly. Se o professor exigir JWT simulado como requisito acadêmico, criar
tela separada `/demo-jwt` documentada como "demonstração didática".

---

## 17. Evidências (para entrega acadêmica)

Capturar e salvar em `/docs/evidencias/`:

### Desktop (≥ 960px)

- `desktop-home.png`, `desktop-judge.png`, `desktop-modal.png`,
  `desktop-voted.png`, `desktop-result.png`, `desktop-admin.png`,
  `desktop-close-season.png`

### Mobile (≤ 560px)

- `mobile-home.png`, `mobile-judge.png`, `mobile-modal.png`, `mobile-navbar.png`

### Console / DevTools

- `console-clean.png` — zero erros JavaScript
- `network-clean.png` — Network tab sem 404s

### Acessibilidade

- `axe-zero-violations.png`
- `lighthouse.png` — Accessibility ≥ 90

### SEO

- `validator-w3.png` — sem erros críticos
- `titles-unique.png` — DevTools mostrando `<title>` de 2 páginas

### CI/CD

- `github-actions-green.png` — pipeline verde
- `husky-precommit.png` — terminal mostrando hook rodando
- `vercel-deploy.png` — deploy concluído

### Testes

- `vitest-run.png` — output do Vitest
- `playwright-run.png` — output do Playwright

### 17.5 Monitoramento & analytics (se implementado)

**Sentry:**

```bash
npx @sentry/wizard@latest -i nextjs
```

- Configurar `SENTRY_DSN` no `.env`
- Captura automática de exceções em prod
- Só ativar quando `NODE_ENV === "production"`

**Vercel Analytics + Speed Insights:**

```bash
npm install @vercel/analytics @vercel/speed-insights
```

```typescript
// src/app/layout.tsx
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

export default function RootLayout({ children }) {
  return (
    <html lang="pt-br">
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
```

- Privacy-first, sem cookies
- Ativar só em prod (`process.env.NODE_ENV === "production"`)
- Free tier suficiente para o projeto

---

## 18. O que NÃO adicionar (fora de escopo)

Estes temas aparecem nos materiais da disciplina mas **não se aplicam** ao
projeto MILGRAM. Não invente justificativas forçadas:

- **ODS (Objetivos de Desenvolvimento Sustentável)** — MILGRAM é entretenimento.
  Se quiser justificar no README: "ODS 9 — Indústria, Inovação e Infraestrutura"
  é o único remotamente aplicável.
- **Setores da sociedade (público/privado/terceiro setor)** — mesmo motivo.
- **Scrum/Kanban formal** — as 11 etapas do §12 já cobrem a organização.
- **JWT simulado no fluxo principal** — NextAuth já resolve; ver §16.
- **`var`/`let`/`const` explícito** — TypeScript resolve.
