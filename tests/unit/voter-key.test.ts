import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildVoterKey, isValidVisitorId } from "@/lib/voter-key";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("buildVoterKey", () => {
  it("é determinístico e devolve sha256 em hexadecimal", () => {
    vi.stubEnv("VOTER_SALT", "sal-de-teste");
    const first = buildVoterKey("cookie-1");

    expect(buildVoterKey("cookie-1")).toBe(first);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
  });

  it("não expõe o cookie no hash e muda com o cookie e com o salt", () => {
    vi.stubEnv("VOTER_SALT", "sal-a");
    const key = buildVoterKey("cookie-1");

    expect(key).not.toContain("cookie-1");
    expect(buildVoterKey("cookie-2")).not.toBe(key);
    vi.stubEnv("VOTER_SALT", "sal-b");
    expect(buildVoterKey("cookie-1")).not.toBe(key);
  });

  it("falha sem VOTER_SALT, inclusive quando ela é string vazia", () => {
    vi.stubEnv("VOTER_SALT", "");
    expect(() => buildVoterKey("cookie-1")).toThrow(/VOTER_SALT/);
  });
});

describe("isValidVisitorId", () => {
  it("aceita o que o servidor emite (randomUUID)", () => {
    expect(isValidVisitorId(randomUUID())).toBe(true);
  });

  it.each([
    ["vazio", ""],
    ["lixo curto", "abc"],
    ["UUID com sufixo", `${randomUUID()}x`],
    ["valor enorme", "a".repeat(5000)],
    ["null", null],
    ["undefined", undefined],
  ])("rejeita %s", (_label, value) => {
    expect(isValidVisitorId(value)).toBe(false);
  });
});
