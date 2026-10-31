import { readFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Evita criar um novo pool de conexões a cada hot reload em desenvolvimento.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const ACCEPTED_SSL_MODES = new Set(["require", "verify-ca", "verify-full"]);

function createPrismaClient(): PrismaClient {
  const rawUrl = process.env.DATABASE_URL;

  if (!rawUrl) {
    throw new Error("DATABASE_URL não definida. Configure a conexão PostgreSQL.");
  }

  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("DATABASE_URL inválida. Verifique o formato da URL PostgreSQL.");
  }

  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("DATABASE_URL deve usar o protocolo postgres:// ou postgresql://.");
  }

  const sslMode = url.searchParams.get("sslmode");

  // O pg 8 trata "require" como verificação completa em algumas configurações,
  // mas seu significado pode variar entre drivers/versões. Não dependemos disso:
  // configuramos explicitamente o TLS verificado abaixo.
  if (sslMode !== null && !ACCEPTED_SSL_MODES.has(sslMode)) {
    throw new Error(
      "SSL inseguro na DATABASE_URL. Use sslmode=verify-full (sem no-verify ou disable).",
    );
  }

  // Estes parâmetros fariam o pg substituir a configuração TLS segura.
  if (
    url.searchParams.has("ssl") ||
    url.searchParams.has("sslcert") ||
    url.searchParams.has("sslkey")
  ) {
    throw new Error(
      "Remova ssl, sslcert e sslkey da DATABASE_URL; configure apenas sslmode e sslrootcert.",
    );
  }

  const certPath = url.searchParams.get("sslrootcert");
  const envCa = process.env.DATABASE_SSL_CA_PEM?.trim();

  if (certPath && envCa) {
    throw new Error(
      "Configure o certificado por sslrootcert OU DATABASE_SSL_CA_PEM, não pelos dois.",
    );
  }

  let ca: string | undefined;

  if (envCa) {
    // Suporta valores com quebras de linha reais ou codificadas como \n.
    ca = envCa.replace(/\\n/g, "\n");
  } else if (certPath) {
    try {
      ca = readFileSync(certPath, "utf8");
    } catch {
      throw new Error(
        "Não foi possível ler sslrootcert. Confira o caminho do certificado Supabase.",
      );
    }
  }

  if (
    ca &&
    (!ca.trimStart().startsWith("-----BEGIN CERTIFICATE-----") ||
      !ca.includes("-----END CERTIFICATE-----"))
  ) {
    throw new Error(
      "Certificado CA inválido: esperado um arquivo PEM. Baixe o certificado no painel Supabase.",
    );
  }

  // O host pode ser substituído pelo parâmetro ?host=... da conexão pg.
  const host = url.searchParams.get("host") ?? url.hostname;
  const useTls = !LOCAL_HOSTS.has(host) || sslMode !== null || Boolean(ca);

  // A presença de sslmode/sslrootcert na URL sobrescreveria a opção `ssl`
  // passada ao driver pg. Removemos esses parâmetros antes de configurar TLS.
  url.searchParams.delete("sslmode");
  url.searchParams.delete("sslrootcert");
  url.searchParams.delete("uselibpqcompat");

  const adapter = new PrismaPg({
    connectionString: url.toString(),
    ...(useTls
      ? {
          ssl: {
            rejectUnauthorized: true,
            ...(ca ? { ca } : {}),
          },
        }
      : {}),
  });

  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
