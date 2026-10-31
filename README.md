# MILGRAM Voting

Aplicação web de fãs, não oficial e sem fins comerciais, inspirada no projeto **MILGRAM**. Visitantes participam de julgamentos de dez prisioneiros ao longo de três temporadas, escolhendo entre **perdoar** e **não perdoar**. A interface está em português e inclui resultados, histórico dos personagens e um painel administrativo.

> **Aviso:** este site não representa nem substitui a votação oficial do MILGRAM.

## Tecnologias

| Área                 | Tecnologia                                                                    |
| -------------------- | ----------------------------------------------------------------------------- |
| Interface e servidor | Next.js 16 (App Router), React 19, TypeScript                                 |
| Estilos              | Tailwind CSS 4 e fontes MILGRAM locais                                        |
| Banco de dados       | PostgreSQL, Prisma 7 e `@prisma/adapter-pg`                                   |
| Imagens              | Supabase Storage e processamento com Sharp                                    |
| Autenticação         | Auth.js / NextAuth 5, credenciais e sessão JWT                                |
| Segurança            | Validação com Zod, proteção CSRF, rate limiting com Upstash Redis em produção |
| Testes               | Vitest (unitários e integração), Playwright (E2E)                             |
| Qualidade            | ESLint, Prettier, GitHub Actions                                              |

## Funcionalidades

- Página inicial com status da temporada atual e destaques dos personagens.
- Votação por prisioneiro, com limitação de frequência e identificação pseudonimizada do visitante.
- Três temporadas, cada uma com imagens próprias dos dez prisioneiros.
- Apuração de votos e apresentação de vereditos por temporada.
- Perfil de cada personagem com histórico de julgamentos.
- Painel administrativo para iniciar temporadas, encerrar votações, iniciar a temporada seguinte ou aguardar.
- Upload administrativo de imagens PNG/JPEG/WebP com validações, processamento e armazenamento no Supabase.
- Redefinição administrativa de temporadas, votos e resultados, mediante frase de confirmação. **Imagens e informações dos prisioneiros são preservadas.**

## Pré-requisitos

- Node.js 20.9 ou superior (recomendado Node.js 22).
- npm e PostgreSQL acessível, localmente ou pelo Supabase.
- Para upload de imagens, um projeto Supabase configurado.
- Para produção, Upstash Redis configurado para o rate limiting distribuído.

## Instalação

```bash
git clone https://github.com/nauang/milgram-voting.git
cd milgram-voting
npm ci
```

Crie `.env.local` com as variáveis apropriadas para seu ambiente. Nunca inclua credenciais reais no Git ou em arquivos ZIP compartilhados.

### Variáveis de ambiente

| Variável                   | Finalidade                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`             | Conexão PostgreSQL utilizada pela aplicação                                                       |
| `DIRECT_URL`               | Conexão PostgreSQL direta utilizada pelo Prisma nas migrações                                     |
| `AUTH_SECRET`              | Segredo usado pelo Auth.js; gerar com `openssl rand -base64 32`                                   |
| `ADMIN_EMAIL`              | Endereço de e-mail do administrador                                                               |
| `ADMIN_PASSWORD_HASH`      | Hash scrypt da senha administrativa, gerado pelo script do projeto                                |
| `VOTER_SALT`               | Segredo para derivar identificadores de rate limiting e votação; gerar com `openssl rand -hex 32` |
| `SUPABASE_URL`             | URL do projeto Supabase                                                                           |
| `SUPABASE_SECRET_KEY`      | Chave de servidor do Supabase, utilizada apenas no backend                                        |
| `UPSTASH_REDIS_REST_URL`   | Endpoint REST do Upstash Redis, obrigatório em produção                                           |
| `UPSTASH_REDIS_REST_TOKEN` | Token REST do Upstash Redis, obrigatório em produção                                              |
| `NEXT_PUBLIC_SITE_URL`     | URL pública do site, usada nos metadados e no sitemap                                             |
| `DATABASE_SSL_CA_PEM`      | Opcional: certificado CA PEM da conexão PostgreSQL; alternativa ao parâmetro `sslrootcert` na URL |

**PostgreSQL e TLS:** use uma conexão com validação de certificados. O cliente da aplicação suporta CA via `sslrootcert` na `DATABASE_URL` ou via `DATABASE_SSL_CA_PEM`. Obtenha o certificado verdadeiro no painel do Supabase e disponibilize-o no ambiente de implantação. Evite `sslmode=no-verify` e `rejectUnauthorized: false`. Configure também a conexão de migrações (`DIRECT_URL`) com TLS adequado. O arquivo de certificado não precisa ser versionado.

**Senha administrativa:** o script lê a senha da entrada padrão. No Bash, utilize uma leitura sem eco na tela e sem registrar a senha no histórico:

```bash
read -rsp "Senha administrativa: " ADMIN_PLAIN_PASSWORD; echo
printf '%s' "$ADMIN_PLAIN_PASSWORD" | npx tsx scripts/hash-password.ts
unset ADMIN_PLAIN_PASSWORD
```

Copie o hash gerado para `ADMIN_PASSWORD_HASH`. Use uma senha com pelo menos 12 caracteres; não armazene a senha em texto simples no arquivo de ambiente.

**Segurança do Redis:** em desenvolvimento/testes, o rate limiting pode usar memória local; em produção, defina as duas variáveis Upstash. Quando a verificação distribuída estiver indisponível, as operações protegidas devem falhar em vez de serem liberadas automaticamente.

### Banco de dados

O projeto utiliza **PostgreSQL tanto em desenvolvimento quanto em produção**. Não utiliza SQLite como banco ativo.

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

Execute as migrações e o seed apenas no banco pretendido. Para produção, prefira o procedimento controlado de implantação de migrações, em vez de `migrate dev`.

### Servidor local

```bash
npm run dev
```

Abra `http://localhost:3000`. A rota `/` possui uma página inicial própria; ela **não** redireciona automaticamente para `/judge`.

Para entrar no painel, acesse `/admin` (visitantes sem sessão são direcionados para `/admin/login`).

## Rotas principais

| Rota                     | Função                          |
| ------------------------ | ------------------------------- |
| `/`                      | Página inicial                  |
| `/judge`                 | Grade de prisioneiros e votação |
| `/judge/result/[season]` | Resultado da temporada indicada |
| `/character`             | Lista de personagens            |
| `/character/[slug]`      | Perfil individual e histórico   |
| `/admin/login`           | Autenticação administrativa     |
| `/admin`                 | Painel administrativo protegido |

### API

| Método     | Rota                            | Função                                                                          |
| ---------- | ------------------------------- | ------------------------------------------------------------------------------- |
| `POST`     | `/api/vote`                     | Envio de voto                                                                   |
| `GET`      | `/api/admin/csrf`               | Obtenção de token CSRF para upload administrativo                               |
| `POST`     | `/api/admin/images`             | Upload administrativo protegido                                                 |
| `POST`     | `/api/admin/season/init`        | Iniciar temporada                                                               |
| `POST`     | `/api/admin/season/closeVoting` | Encerrar votação, apurar resultados e opcionalmente iniciar a próxima temporada |
| `POST`     | `/api/admin/season/reset`       | Redefinir temporadas e excluir votos/resultados, preservando imagens            |
| `GET/POST` | `/api/auth/[...nextauth]`       | Rotas do Auth.js                                                                |

As operações administrativas requerem autenticação e validações adicionais. Não utilize essas APIs diretamente para testar ações destrutivas em um banco com dados que precisam ser mantidos.

## Regras de julgamento

- A votação só é aceita quando a temporada estiver aberta (`voting`).
- O voto utiliza as escolhas `forgive` e `not_forgive`.
- O sistema verifica intervalo entre votos e aplica limites contra abuso.
- Ao encerrar uma votação, os votos são apurados e os resultados são armazenados.
- O administrador pode iniciar imediatamente a temporada seguinte ou deixar o julgamento aguardando.
- Após a terceira temporada, o ciclo é concluído.
- O reset administrativo exige a frase exata `RESETAR TEMPORADAS` e preserva os registros de imagens.

## Scripts

```bash
npm run dev              # Servidor de desenvolvimento
npm run build            # Prisma generate + build Next.js
npm run start            # Servidor de produção
npm run lint             # ESLint sem avisos
npm run typecheck        # Verificação TypeScript
npm test                 # Testes unitários com Vitest
npm run test:integration # Testes de integração com PostgreSQL isolado
npm run test:e2e        # Testes de ponta a ponta com Playwright
npm run db:generate      # Geração do Prisma Client
npm run db:migrate       # Migrações em desenvolvimento
npm run db:seed          # Seed inicial do banco
npm run db:reset         # Redefine o banco: operação destrutiva
```

## Testes e validação

Na validação local concluída em **31/10/2026**, foram aprovados **356 testes automatizados**, distribuídos em:

- **330 testes unitários**, em 24 arquivos (`npm test`).
- **13 testes de integração**, em 2 arquivos, usando um PostgreSQL isolado (`npm run test:integration`).
- **13 testes E2E**, em 5 arquivos, executados em conjunto com Playwright (`npm run test:e2e`).

Também passaram **ESLint**, **verificação de tipos TypeScript** e **build de produção**. Os totais representam as últimas execuções informadas durante o desenvolvimento; execute novamente as verificações depois de modificar o projeto.

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

Os testes de integração e E2E **não** fazem parte de `npm test` e precisam de banco PostgreSQL **dedicado e descartável**. Os testes de integração alteram e removem votos e resultados; nunca aponte suas variáveis para produção.

Para executar o Playwright em ambiente local, prepare previamente o PostgreSQL de testes, aplique as migrações e o seed **somente nesse banco**, e defina `TEST_DATABASE_URL`, `TEST_DIRECT_URL` e `CONFIRM_TEST_DB_WIPE=yes`. O Playwright usa essas variáveis para conectar o servidor de testes ao banco isolado. Para cobrir o login administrativo, configure também credenciais exclusivas de E2E (`E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, `E2E_ADMIN_PASSWORD_HASH`), diferentes das credenciais reais.

```bash
npx playwright install chromium
npm run test:e2e
```

Para a integração com banco, utilize `DATABASE_URL` e `DIRECT_URL` apontando **explicitamente** para o banco isolado; não utilize esses comandos em um banco com votos reais.

A suíte automatizada não substitui testes manuais de acessibilidade, responsividade e verificação da implantação publicada.

## Organização do repositório

```text
src/
  app/             Páginas, layout e endpoints Next.js
  components/      Componentes de interface e administração
  lib/             Regras de negócio, autenticação, banco e segurança
  types/           Tipos do domínio
  utils/           Utilitários
tests/
  unit/            Testes unitários
  integration/     Testes de integração com PostgreSQL
  e2e/             Testes Playwright
prisma/
  schema.prisma    Modelos Prisma para PostgreSQL
  migrations/      Histórico de migrações
  seed.ts          Dados iniciais
public/fonts/      Fontes locais MILGRAM
scripts/            Ferramentas auxiliares
```

## Acessibilidade e fontes

O site utiliza as fontes locais MILGRAM English e MILGRAM Rune para identidade visual, além de Inter e Noto Sans JP. No `next/font/google`, `subsets: ["latin"]` seleciona o subconjunto pré-carregado; isso **não impede** o carregamento dos glifos japoneses por meio dos arquivos Unicode correspondentes.

A interface inclui navegação por teclado e controles acessíveis; a validação de qualidade deve incluir testes manuais em navegadores e dispositivos reais, além da suíte automatizada.

## Licença e direitos autorais

O código-fonte está disponibilizado conforme o arquivo [LICENSE](LICENSE). A licença do código **não** concede direitos sobre personagens, ilustrações, músicas, logotipos ou outras obras associadas ao MILGRAM.

Este é um projeto pessoal de fã, sem fins comerciais, **não afiliado aos titulares oficiais de MILGRAM**.

As fontes **MILGRAM English** e **MILGRAM Rune** foram criadas por
[Mayim Kaijoshi](https://mayimkjs.itch.io/milgram-fonts) e são utilizadas
com autorização. Essas fontes não estão cobertas pela licença MIT do código.
