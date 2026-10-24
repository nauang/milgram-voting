import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mesmo alias do tsconfig ("@/*" -> "./src/*"), para os testes importarem como o app
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // "node" basta para funções de regra (veredito, contagem, janela de 24h).
    // Testes de componente (Etapa 8) usarão jsdom, definido por arquivo.
    environment: "node",
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    // E2E é do Playwright, nunca do Vitest
    exclude: ["node_modules", ".next", "tests/e2e/**"],
  },
});
