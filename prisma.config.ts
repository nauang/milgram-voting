import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

// O CLI do Prisma não lê .env.local (só o Next faz isso). Carregamos os dois arquivos,
// .env.local primeiro: o dotenv nunca sobrescreve uma variável que já foi definida.
config({ path: ".env.local", quiet: true });
config({ quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // Roda com: npx prisma db seed
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
