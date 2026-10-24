import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // ⚠️ Use DIRECT_URL aqui para as migrações funcionarem no Supabase
    url: env("DIRECT_URL"),
  },
});
