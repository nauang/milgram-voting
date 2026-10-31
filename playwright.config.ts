import { config as loadEnv } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

// Carregadas somente para validar e comparar as configurações.
// Variáveis já definidas no terminal não são sobrescritas pelo dotenv.
loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

const PORT = 3100;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL?.trim();
const TEST_DIRECT_URL = process.env.TEST_DIRECT_URL?.trim() || TEST_DATABASE_URL;

interface DatabaseTarget {
  host: string;
  port: string;
  database: string;
  schema: string;
  supabaseProject: string | null;
  local: boolean;
}

function parseDatabaseTarget(connectionString: string, label: string): DatabaseTarget {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error(`E2E bloqueado: ${label} não é uma URL válida.`);
  }

  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error(`E2E bloqueado: ${label} deve ser uma URL PostgreSQL.`);
  }

  // Estes parâmetros podem alterar o destino real da conexão, dificultando
  // a comparação segura entre bancos de teste e produção.
  for (const parameter of ["host", "port", "dbname", "service"]) {
    if (url.searchParams.has(parameter)) {
      throw new Error(`E2E bloqueado: remova o parâmetro ${parameter} de ${label}.`);
    }
  }

  const host = url.hostname.toLowerCase();
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(host);
  const database = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  if (!database) {
    throw new Error(`E2E bloqueado: ${label} precisa informar o nome do banco.`);
  }

  // Supabase: conexão direta (db.<ref>.supabase.co) ou pooler,
  // cujo usuário costuma ser postgres.<ref>.
  const directProject = /^db\.([a-z0-9-]+)\.supabase\.co$/.exec(host)?.[1];
  const poolerProject = /\.pooler\.supabase\.com$/.test(host)
    ? /^postgres\.([a-z0-9-]+)$/.exec(decodeURIComponent(url.username))?.[1]
    : undefined;

  return {
    host: local ? "local" : host,
    port: url.port || "5432",
    database,
    schema: url.searchParams.get("schema") || "public",
    supabaseProject: directProject ?? poolerProject ?? null,
    local,
  };
}

function sameDatabase(a: DatabaseTarget, b: DatabaseTarget): boolean {
  // Projetos Supabase iguais compartilham o mesmo banco, mesmo que
  // as URLs usem hosts/portas diferentes (pooler versus conexão direta).
  if (a.supabaseProject && b.supabaseProject) {
    return a.supabaseProject === b.supabaseProject;
  }

  return (
    a.host === b.host && a.port === b.port && a.database === b.database && a.schema === b.schema
  );
}

if (!TEST_DATABASE_URL || !TEST_DIRECT_URL) {
  throw new Error("E2E bloqueado: configure TEST_DATABASE_URL com um PostgreSQL descartável.");
}
if (process.env.CONFIRM_TEST_DB_WIPE !== "yes") {
  throw new Error('E2E bloqueado: configure CONFIRM_TEST_DB_WIPE="yes" após verificar o banco.');
}

const testDatabase = parseDatabaseTarget(TEST_DATABASE_URL, "TEST_DATABASE_URL");
const testDirect = parseDatabaseTarget(TEST_DIRECT_URL, "TEST_DIRECT_URL");

if (!sameDatabase(testDatabase, testDirect)) {
  throw new Error("E2E bloqueado: TEST_DIRECT_URL deve apontar para o mesmo banco de testes.");
}

for (const variable of ["DATABASE_URL", "DIRECT_URL"] as const) {
  const connection = process.env[variable]?.trim();
  if (!connection) continue;
  const activeDatabase = parseDatabaseTarget(connection, variable);
  if (sameDatabase(testDatabase, activeDatabase) || sameDatabase(testDirect, activeDatabase)) {
    throw new Error(`E2E bloqueado: banco de testes coincide com ${variable}.`);
  }
}

if ((!testDatabase.local || !testDirect.local) && process.env.E2E_ALLOW_REMOTE_TEST_DB !== "yes") {
  throw new Error(
    'E2E bloqueado: banco remoto requer E2E_ALLOW_REMOTE_TEST_DB="yes" e projeto isolado.',
  );
}

const adminEmail = process.env.E2E_ADMIN_EMAIL?.trim() ?? "";
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? "";
const adminPasswordHash = process.env.E2E_ADMIN_PASSWORD_HASH?.trim() ?? "";
const configuredFields = [adminEmail, adminPassword, adminPasswordHash].filter(Boolean).length;

if (configuredFields !== 0 && configuredFields !== 3) {
  throw new Error(
    "E2E bloqueado: defina E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD e E2E_ADMIN_PASSWORD_HASH juntos.",
  );
}

if (
  configuredFields === 3 &&
  (adminEmail.toLowerCase() === process.env.ADMIN_EMAIL?.trim().toLowerCase() ||
    adminPasswordHash === process.env.ADMIN_PASSWORD_HASH?.trim())
) {
  throw new Error(
    "E2E bloqueado: as credenciais E2E precisam ser diferentes das credenciais reais.",
  );
}

const e2eAuthSecret =
  process.env.E2E_AUTH_SECRET?.trim() || "milgram-e2e-local-only-secret-do-not-deploy";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npm run dev -- --hostname 127.0.0.1 --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      DIRECT_URL: TEST_DIRECT_URL,
      // Não herdar certificado de um banco remoto normal para um banco local.
      DATABASE_SSL_CA_PEM: process.env.E2E_DATABASE_SSL_CA_PEM?.trim() || "",
      NEXT_PUBLIC_SITE_URL: BASE_URL,
      AUTH_URL: BASE_URL,
      NEXTAUTH_URL: BASE_URL,
      AUTH_SECRET: e2eAuthSecret,
      NEXTAUTH_SECRET: e2eAuthSecret,
      VOTER_SALT: process.env.E2E_VOTER_SALT?.trim() || "milgram-e2e-local-only-voter-salt",
      // Ausentes por padrão: o login positivo só funciona com uma conta E2E dedicada.
      ADMIN_EMAIL: adminEmail,
      ADMIN_PASSWORD_HASH: adminPasswordHash,
      // A senha em texto puro pertence apenas ao processo Playwright, não ao servidor.
      E2E_ADMIN_PASSWORD: "",
      UPSTASH_REDIS_REST_URL: "",
      UPSTASH_REDIS_REST_TOKEN: "",
      VERCEL_ENV: "",
      // Testes não recebem acesso administrativo ao Storage real.
      SUPABASE_URL: "",
      SUPABASE_SECRET_KEY: "",
    },
  },
});
