import { describe, expect, it } from "vitest";
import { DEFAULT_SCRYPT_PARAMS, hashPassword, verifyPassword } from "@/lib/password";

// Custo baixo para os testes rodarem em milissegundos; o padrão é testado à parte
const FAST = { log2N: 10, r: 8, p: 1 };

describe("hashPassword / verifyPassword", () => {
  it("aceita a senha correta e rejeita a errada", async () => {
    const hash = await hashPassword("senha-forte-123", FAST);

    expect(await verifyPassword("senha-forte-123", hash)).toBe(true);
    expect(await verifyPassword("senha-forte-124", hash)).toBe(false);
    expect(await verifyPassword("", hash)).toBe(false);
  });

  it("gera hashes diferentes para a mesma senha (salt aleatório)", async () => {
    const first = await hashPassword("senha-forte-123", FAST);
    const second = await hashPassword("senha-forte-123", FAST);

    expect(first).not.toBe(second);
    expect(await verifyPassword("senha-forte-123", second)).toBe(true);
  });

  it("não contém a senha e só usa caracteres seguros em .env (sem $)", async () => {
    const hash = await hashPassword("senha-forte-123", FAST);

    expect(hash).not.toContain("senha-forte-123");
    expect(hash).toMatch(/^scrypt\.10\.8\.1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  });

  it("devolve false (sem lançar) para hash ausente, vazio ou malformado", async () => {
    expect(await verifyPassword("x", undefined)).toBe(false);
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "texto-qualquer")).toBe(false);
    expect(await verifyPassword("x", "scrypt.10.8.1.curto.curto")).toBe(false);
  });

  it("recusa parâmetros de custo absurdos sem executá-los", async () => {
    expect(await verifyPassword("x", `scrypt.30.8.1.${"A".repeat(22)}.${"A".repeat(43)}`)).toBe(
      false,
    );
  });

  it("os parâmetros padrão seguem o mínimo recomendado (N >= 2^16)", async () => {
    expect(DEFAULT_SCRYPT_PARAMS.log2N).toBeGreaterThanOrEqual(16);
    const hash = await hashPassword("senha-forte-123");
    expect(hash.startsWith("scrypt.16.8.2.")).toBe(true);
    expect(await verifyPassword("senha-forte-123", hash)).toBe(true);
  }, 20_000);
});
