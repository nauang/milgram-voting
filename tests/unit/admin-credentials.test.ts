import { beforeAll, describe, expect, it, vi } from "vitest";
import { verifyAdminCredentials } from "@/lib/admin-credentials";
import { hashPassword } from "@/lib/password";

const EMAIL = "admin@milgram.example";
const PASSWORD = "senha-forte-123";
let passwordHash = "";

beforeAll(async () => {
  passwordHash = await hashPassword(PASSWORD, { log2N: 10, r: 8, p: 1 });
});

const check = (email: unknown, password: unknown) =>
  verifyAdminCredentials({ email, password }, { email: EMAIL, passwordHash });

describe("verifyAdminCredentials", () => {
  it("aceita e-mail e senha corretos (e-mail sem diferenciar caixa)", async () => {
    expect(await check(EMAIL, PASSWORD)).toBe(true);
    expect(await check("  ADMIN@Milgram.example ", PASSWORD)).toBe(true);
  });

  it("rejeita senha errada, e-mail errado e os dois errados", async () => {
    expect(await check(EMAIL, "outra-senha-123")).toBe(false);
    expect(await check("outro@milgram.example", PASSWORD)).toBe(false);
    expect(await check("outro@milgram.example", "outra-senha-123")).toBe(false);
  });

  it("rejeita entradas que não são texto, vazias ou gigantes", async () => {
    expect(await check(undefined, PASSWORD)).toBe(false);
    expect(await check(EMAIL, undefined)).toBe(false);
    expect(await check(EMAIL, 123456)).toBe(false);
    expect(await check(EMAIL, "")).toBe(false);
    expect(await check(EMAIL, "a".repeat(1025))).toBe(false);
  });

  it("falha fechada quando a configuração do servidor está incompleta", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(
      await verifyAdminCredentials(
        { email: EMAIL, password: PASSWORD },
        { email: undefined, passwordHash },
      ),
    ).toBe(false);
    expect(
      await verifyAdminCredentials(
        { email: EMAIL, password: PASSWORD },
        { email: EMAIL, passwordHash: undefined },
      ),
    ).toBe(false);
  });
});
