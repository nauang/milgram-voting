# MILGRAM Voting

Página de votação inspirada no projeto MILGRAM (milgram.jp). Visitantes anônimos julgam 10 prisioneiros, temporada por temporada. Ao final de cada temporada, os votos são apurados e o resultado determina o destino dos personagens.

## 📋 Sumário

- [Problema e público-alvo](#-problema-e-público-alvo)
- [Tecnologias](#-tecnologias)
- [Estrutura de pastas](#-estrutura-de-pastas)
- [Como rodar](#-como-rodar)
- [Variáveis de ambiente](#-variáveis-de-ambiente)
- [Rotas e endpoints](#-rotas-e-endpoints)
- [Scripts disponíveis](#-scripts-disponíveis)
- [Testes](#-testes)
- [Acessibilidade e SEO](#-acessibilidade-e-seo)
- [Integrantes](#-integrantes)
- [Status](#-status)
- [Licença](#-licença)

---

## 🎯 Problema e público-alvo

Fãs do projeto MILGRAM precisam de uma forma simples de participar da votação oficial (perdoar / não perdoar) sem depender do app mobile. O público são os fãs brasileiros que acompanham a obra e querem uma experiência web acessível e em português.

A página replica o fluxo oficial:

1. **Votação** — o visitante vota `forgive` (赦す) ou `not_forgive` (赦さない) em cada prisioneiro, 1× a cada 24h.
2. **Apuração** — o admin encerra a temporada e o sistema conta os votos, define o veredito (`not_guilty` / `guilty` / `lost`) e inicia a próxima temporada.
3. **Imagens por temporada** — cada prisioneiro tem 3 imagens (uma por temporada); a troca é atômica junto com a mudança de temporada.

---

## 🛠️ Tecnologias

| Camada          | Stack                                                   |
| --------------- | ------------------------------------------------------- |
| **Framework**   | Next.js 16 (App Router, React Server Components)        |
| **Linguagem**   | TypeScript (strict)                                     |
| **Estilização** | TailwindCSS v4 (mobile-first, breakpoints customizados) |
| **Animação**    | Framer Motion                                           |
| **Banco**       | Prisma 7 + SQLite (dev) / Postgres (prod)               |
| **Auth**        | NextAuth (credenciais, sessão via cookie httpOnly)      |
| **Validação**   | Zod (schemas compartilhados entre API e front)          |
| **Testes unit** | Vitest                                                  |
| **Testes E2E**  | Playwright                                              |
| **Qualidade**   | ESLint, Prettier, Husky, lint-staged                    |
| **CI/CD**       | GitHub Actions + Vercel                                 |

---

## 📁 Estrutura de pastas

```
.
├── docs/
│   ├── diagramas/          # ER, fluxo de voto, encerramento
│   ├── evidencias/         # Relatórios Lighthouse, prints
│   └── prototipo/          # Wireframes
├── prisma/
│   ├── migrations/         # Histórico de migrations
│   ├── schema.prisma       # Schema do banco
│   └── seed.ts             # Popula 10 prisioneiros + 3 temporadas
├── public/                 # Assets estáticos
├── reference/              # Capturas do site oficial (NÃO versionado)
├── src/
│   ├── app/                # Rotas (App Router)
│   │   ├── admin/          # Painel admin (protegido)
│   │   ├── api/            # API Routes (vote, admin, auth)
│   │   ├── character/      # Lista + individual de personagens
│   │   ├── judge/          # Votação + resultados
│   │   ├── globals.css
│   │   └── layout.tsx
│   ├── components/         # Componentes React
│   ├── lib/                # Lógica de negócio
│   │   ├── db.ts
│   │   ├── judge.ts
│   │   ├── prisoner-image.ts
│   │   ├── prisoner-state.ts
│   │   ├── result.ts
│   │   ├── season.ts
│   │   ├── vote-check.ts
│   │   └── voter.ts
│   ├── types/              # Tipos + schemas Zod
│   └── utils/              # Helpers (formatação)
├── tests/
│   ├── unit/               # Vitest
│   └── e2e/                # Playwright
├── prisma.config.ts
├── next.config.ts
├── playwright.config.ts
├── tsconfig.json
├── eslint.config.mjs
├── .prettierrc
└── package.json
```

---

## 🚀 Como rodar

### Pré-requisitos

- **Node.js 20.9+** (recomendado 22 LTS)
- **npm 10+**

### Passo a passo

```bash
# 1. Clone o repositório
git clone https://github.com/{SEU_USUARIO}/milgram-voting.git
cd milgram-voting

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente
cp .env.example .env.local
# Edite .env.local com suas credenciais (veja seção abaixo)

# 4. Prepare o banco
npx prisma migrate dev
npx prisma db seed

# 5. Suba o servidor de desenvolvimento
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) no navegador.

O app vai redirecionar automaticamente para `/judge`.

### Login do admin

Acesse [http://localhost:3000/admin](http://localhost:3000/admin) — será redirecionado para `/admin/login`. Use as credenciais definidas em `ADMIN_EMAIL` e `ADMIN_PASSWORD` no `.env.local`.

---

## 🔐 Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha:

| Variável                   | Descrição                                | Como gerar                         |
| -------------------------- | ---------------------------------------- | ---------------------------------- |
| `DATABASE_URL`             | URL do SQLite (dev) ou Postgres (prod)   | Dev: `file:./dev.db`               |
| `ADMIN_EMAIL`              | Email do painel `/admin`                 | Você define                        |
| `ADMIN_PASSWORD`           | Senha do painel `/admin`                 | Você define (forte!)               |
| `AUTH_SECRET`              | Secret do NextAuth                       | `openssl rand -base64 32`          |
| `VOTER_SALT`               | Salt do `voterKey` (hash de IP + cookie) | `openssl rand -hex 32`             |
| `NEXTAUTH_URL`             | URL base da app                          | `http://localhost:3000`            |
| `UPSTASH_REDIS_REST_URL`   | URL do Redis (opcional, rate-limit)      | [upstash.com](https://upstash.com) |
| `UPSTASH_REDIS_REST_TOKEN` | Token do Redis (opcional)                | [upstash.com](https://upstash.com) |

**⚠️ Atenção:** o `.env.local` **nunca** deve ser commitado. Já está no `.gitignore`.

---

## 🌐 Rotas e endpoints

### Páginas

| Rota                     | Descrição                                   |
| ------------------------ | ------------------------------------------- |
| `/`                      | Redireciona para `/judge`                   |
| `/judge`                 | Página principal de votação (grid + modal)  |
| `/judge/result/[season]` | Resultado de uma temporada encerrada        |
| `/character`             | Lista dos 10 prisioneiros                   |
| `/character/[slug]`      | Página individual de um prisioneiro         |
| `/admin`                 | Painel de controle (protegido por NextAuth) |
| `/admin/login`           | Tela de login                               |

### API

| Método     | Rota                            | Descrição                                    |
| ---------- | ------------------------------- | -------------------------------------------- |
| `POST`     | `/api/vote`                     | Registra um voto (`forgive` / `not_forgive`) |
| `POST`     | `/api/admin/season/init`        | Inicia uma temporada (admin)                 |
| `POST`     | `/api/admin/season/closeVoting` | Encerra, apura e inicia a próxima            |
| `GET/POST` | `/api/auth/[...nextauth]`       | Login/logout NextAuth                        |

### Regras de negócio

- **1 voto por prisioneiro a cada 24h** por visitante (identificado por cookie + IP hash).
- Voto é registrado apenas se a temporada estiver em `status = "voting"`.
- **Veredito**: maioria `forgive` → `not_guilty`; maioria `not_forgive` → `guilty`; empate ou zero votos → `lost`.
- Ao encerrar a T3, o app entra em estado `finished`.

---

## 📜 Scripts disponíveis

```bash
# Desenvolvimento
npm run dev           # Servidor de dev (localhost:3000)
npm run build         # Build de produção
npm run start         # Servidor de produção

# Qualidade
npm run lint          # ESLint (zero warnings)
npm run typecheck     # tsc --noEmit
npm run format        # Prettier em todo o src/

# Testes
npm run test          # Vitest (unit)
npm run test:e2e      # Playwright (E2E)

# Banco de dados
npm run db:generate   # Prisma generate
npm run db:migrate    # Prisma migrate dev
npm run db:seed       # Popula com 10 prisioneiros + 3 temporadas
npm run db:reset      # Reseta o banco (⚠️ apaga dados)
```

---

## 🧪 Testes

### Vitest (unit)

```bash
npm run test
```

Cobre:

- `calculatePrisonerState` — todos os estados (`idle`/`voting`/`voted`/`lost`/`not_guilty`/`guilty`)
- `getPrisonerImage` — fallback de imagem por temporada

### Playwright (E2E)

```bash
# Instalar o Chromium do Playwright (primeira vez)
npx playwright install chromium

# Rodar (sobe o servidor automaticamente)
npm run test:e2e
```

Cobre 8 cenários:

1. `/admin` redireciona para login quando não autenticado
2. Login com credenciais corretas funciona
3. Login com credenciais erradas falha
4. `/judge` carrega grid com 10 prisioneiros
5. Clicar num card abre modal com dois losangos
6. Votar registra e mostra feedback
7. `Esc` fecha o modal
8. Voto persiste após reload

---

## ♿ Acessibilidade e SEO

Todas as páginas principais foram auditadas com **Lighthouse**:

| Página              | Accessibility | Best Practices | SEO     |
| ------------------- | ------------- | -------------- | ------- |
| `/judge`            | **100**       | **100**        | **100** |
| `/character`        | **100**       | **100**        | **100** |
| `/character/haruka` | **100**       | **100**        | **100** |

Relatórios HTML completos em `docs/evidencias/lighthouse-*.html`.

### Checklist de acessibilidade

- ✅ Um `<h1>` por página, headings em ordem
- ✅ `alt` descritivo em todas as imagens
- ✅ `lang="pt-br"` no `<html>`
- ✅ Navegação por teclado (`Tab`, `Esc`)
- ✅ Focus visível em todos os botões
- ✅ Modal com `role="dialog"`, `aria-modal`, focus trap
- ✅ `aria-invalid` e `aria-live` no formulário de voto
- ✅ Contraste ≥ 4.5:1 (WCAG AA)
- ✅ `prefers-reduced-motion` respeitado (glitch + partículas)

---

## 👥 Integrantes

- **Nauan Gomes de Lima** — Desenvolvimento full-stack, design, documentação

---

## 📊 Status

MVP completo. Todas as etapas de 0 a 8 concluídas:

- ✅ **Etapa 0** — Planejamento (ER, fluxos, wireframes)
- ✅ **Etapa 1** — Setup + CI/CD (ESLint, Prettier, Husky, Vitest, Actions)
- ✅ **Etapa 2** — `/judge` (grid + modal + voto + persistência)
- ✅ **Etapa 3** — `/admin` (auth + controle de temporada)
- ✅ **Etapa 4** — `/judge/result/[season]` (gráficos + veredito)
- ✅ **Etapa 5** — Refinamento visual (tipografia, glitch, partículas, losangos)
- ✅ **Etapa 6** — `/character` + `/character/[slug]`
- ✅ **Etapa 7** — Acessibilidade + SEO (100/100 em todas as páginas)
- ✅ **Etapa 8** — Testes E2E com Playwright (8/8)

**Pronto para deploy.**

---

## 📄 Licença

MIT. Veja [LICENSE](LICENSE) para detalhes.

---

_Projeto pessoal de fã. Não é um site oficial do MILGRAM._
