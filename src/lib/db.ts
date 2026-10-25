import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Em dev, o hot reload recria os módulos a cada alteração. Sem este cache em globalThis,
// cada reload abriria uma nova conexão com o Postgres.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL não definida. Copie .env.example para .env.local.");
  }

  // Prisma 7 + @prisma/adapter-pg: o `pg` trata `sslmode=require` como `verify-full`
  // e rejeita o certificado do Supabase. Usamos `sslmode=no-verify` na URL (que o pg
  // respeita, sem o problema acima). Aqui só garantimos que `require` não escape para prod.
  let connectionString = url;
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.get("sslmode") === "require") {
      parsed.searchParams.set("sslmode", "no-verify");
      connectionString = parsed.toString();
    }
  } catch {
    // URL malformada: deixa o pg reclamar
  }

  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
