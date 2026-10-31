import { describe, expect, it } from "vitest";

import {
  ADMIN_CSRF_HEADER,
  createAdminCsrfToken,
  getAdminSessionBinding,
  verifyAdminCsrfToken,
} from "@/lib/admin-csrf";

const SESSION_A = "sessao-administrativa-A";
const SESSION_B = "sessao-administrativa-B";

const SECRET_A = "segredo-de-teste-A-com-32-caracteres";
const SECRET_B = "segredo-de-teste-B-com-32-caracteres";

/**
 * Simula o leitor de cookies usado pelo Auth.js.
 *
 * Não utiliza cookies reais nem depende do navegador.
 */
function createCookies(values: Record<string, string>) {
  return {
    get(name: string): { value: string } | undefined {
      const value = values[name];

      return value === undefined ? undefined : { value };
    },
  };
}

/**
 * Gera um token válido para reutilização nos testes
 * que verificam entradas adulteradas.
 */
function validToken(): string {
  return createAdminCsrfToken(SESSION_A, SECRET_A);
}

describe("admin-csrf", () => {
  describe("configuração", () => {
    it("define o cabeçalho CSRF administrativo", () => {
      expect(ADMIN_CSRF_HEADER).toBe("x-milgram-csrf");
    });
  });

  describe("createAdminCsrfToken", () => {
    it("gera um token no formato esperado", () => {
      const token = validToken();

      expect(token).toMatch(/^v1\.[A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]{43}$/);
    });

    it("gera tokens diferentes para a mesma sessão", () => {
      const first = validToken();
      const second = validToken();

      expect(first).not.toBe(second);

      expect(verifyAdminCsrfToken(first, SESSION_A, SECRET_A)).toBe(true);

      expect(verifyAdminCsrfToken(second, SESSION_A, SECRET_A)).toBe(true);
    });

    it("gera nonces diferentes em chamadas consecutivas", () => {
      const tokens = Array.from({ length: 20 }, () => validToken());

      const nonces = tokens.map((token) => token.split(".")[1]);

      expect(new Set(nonces).size).toBe(20);
    });

    it("não inclui o segredo nem a sessão em texto puro", () => {
      const token = validToken();

      expect(token).not.toContain(SECRET_A);
      expect(token).not.toContain(SESSION_A);
    });

    it("rejeita geração sem sessão", () => {
      expect(() => createAdminCsrfToken("", SECRET_A)).toThrow();
    });

    it("rejeita geração sem segredo", () => {
      expect(() => createAdminCsrfToken(SESSION_A, "")).toThrow();
    });
  });

  describe("verifyAdminCsrfToken", () => {
    it("aceita um token válido", () => {
      const token = validToken();

      expect(verifyAdminCsrfToken(token, SESSION_A, SECRET_A)).toBe(true);
    });

    it("rejeita token pertencente a outra sessão", () => {
      const token = validToken();

      expect(verifyAdminCsrfToken(token, SESSION_B, SECRET_A)).toBe(false);
    });

    it("rejeita token assinado com outro segredo", () => {
      const token = validToken();

      expect(verifyAdminCsrfToken(token, SESSION_A, SECRET_B)).toBe(false);
    });

    it("rejeita token quando a sessão está ausente", () => {
      const token = validToken();

      expect(verifyAdminCsrfToken(token, null, SECRET_A)).toBe(false);
    });

    it("rejeita token quando o segredo está ausente", () => {
      const token = validToken();

      expect(verifyAdminCsrfToken(token, SESSION_A, undefined)).toBe(false);
    });

    it("rejeita nonce adulterado", () => {
      const token = validToken();

      const [version, nonce, signature] = token.split(".");

      const alteredNonce = (nonce?.startsWith("A") ? "B" : "A") + nonce?.slice(1);

      const forged = `${version}.${alteredNonce}.${signature}`;

      expect(verifyAdminCsrfToken(forged, SESSION_A, SECRET_A)).toBe(false);
    });

    it("rejeita assinatura adulterada", () => {
      const token = validToken();

      const [version, nonce, signature] = token.split(".");

      const alteredSignature = (signature?.startsWith("A") ? "B" : "A") + signature?.slice(1);

      const forged = `${version}.${nonce}.${alteredSignature}`;

      expect(verifyAdminCsrfToken(forged, SESSION_A, SECRET_A)).toBe(false);
    });

    it("rejeita assinatura com tamanho incorreto", () => {
      const token = validToken();

      const [version, nonce] = token.split(".");

      const malformed = `${version}.${nonce}.${"A".repeat(43)}`;

      // A assinatura possui tamanho sintático válido,
      // mas não corresponde ao HMAC esperado.
      expect(verifyAdminCsrfToken(malformed, SESSION_A, SECRET_A)).toBe(false);
    });

    it.each([
      "",
      "token",
      "v1",
      "v1.",
      "v1.a",
      "v1.a.b",
      "v2.a.b",
      "v1.a.b.c",
      "v1..",
      "v1.invalid!.invalid!",
      "v1." + "A".repeat(42) + "." + "B".repeat(43),
      "v1." + "A".repeat(43) + "." + "B".repeat(42),
    ])("rejeita token malformado: %s", (token) => {
      expect(verifyAdminCsrfToken(token, SESSION_A, SECRET_A)).toBe(false);
    });

    it.each([undefined, null, 123, true, {}, []])("rejeita token que não é string: %s", (token) => {
      expect(verifyAdminCsrfToken(token, SESSION_A, SECRET_A)).toBe(false);
    });

    it("rejeita tokens com versão modificada", () => {
      const token = validToken();

      const modified = token.replace(/^v1\./, "v2.");

      expect(verifyAdminCsrfToken(modified, SESSION_A, SECRET_A)).toBe(false);
    });

    it("não aceita token válido após troca de sessão", () => {
      const oldToken = createAdminCsrfToken(SESSION_A, SECRET_A);

      const newToken = createAdminCsrfToken(SESSION_B, SECRET_A);

      expect(verifyAdminCsrfToken(oldToken, SESSION_B, SECRET_A)).toBe(false);

      expect(verifyAdminCsrfToken(newToken, SESSION_B, SECRET_A)).toBe(true);
    });

    it("não aceita token após rotação do segredo", () => {
      const token = validToken();

      expect(verifyAdminCsrfToken(token, SESSION_A, SECRET_B)).toBe(false);
    });

    it("permite reutilização dentro da mesma sessão", () => {
      const token = validToken();

      for (let attempt = 0; attempt < 5; attempt++) {
        expect(verifyAdminCsrfToken(token, SESSION_A, SECRET_A)).toBe(true);
      }
    });
  });

  describe("getAdminSessionBinding", () => {
    it("retorna null quando não há cookies", () => {
      const cookies = createCookies({});

      expect(getAdminSessionBinding(cookies)).toBeNull();
    });

    it("encontra o cookie padrão do Auth.js", () => {
      const cookies = createCookies({
        "authjs.session-token": SESSION_A,
      });

      expect(getAdminSessionBinding(cookies)).toBe(SESSION_A);
    });

    it("encontra o cookie seguro do Auth.js", () => {
      const cookies = createCookies({
        "__Secure-authjs.session-token": SESSION_A,
      });

      expect(getAdminSessionBinding(cookies)).toBe(SESSION_A);
    });

    it("prioriza o cookie seguro", () => {
      const cookies = createCookies({
        "__Secure-authjs.session-token": SESSION_A,
        "authjs.session-token": SESSION_B,
      });

      expect(getAdminSessionBinding(cookies)).toBe(SESSION_A);
    });

    it("reconstrói o cookie padrão fragmentado", () => {
      const cookies = createCookies({
        "authjs.session-token.0": "parte-1-",
        "authjs.session-token.1": "parte-2-",
        "authjs.session-token.2": "parte-3",
      });

      expect(getAdminSessionBinding(cookies)).toBe("parte-1-parte-2-parte-3");
    });

    it("reconstrói o cookie seguro fragmentado", () => {
      const cookies = createCookies({
        "__Secure-authjs.session-token.0": "abc",
        "__Secure-authjs.session-token.1": "def",
        "__Secure-authjs.session-token.2": "ghi",
      });

      expect(getAdminSessionBinding(cookies)).toBe("abcdefghi");
    });

    it("prioriza cookie direto sobre fragmentos", () => {
      const cookies = createCookies({
        "authjs.session-token": "cookie-completo",
        "authjs.session-token.0": "fragmento-1",
        "authjs.session-token.1": "fragmento-2",
      });

      expect(getAdminSessionBinding(cookies)).toBe("cookie-completo");
    });

    it("não reconstrói fragmentos sem a primeira parte", () => {
      const cookies = createCookies({
        "authjs.session-token.1": "parte-2",
        "authjs.session-token.2": "parte-3",
      });

      expect(getAdminSessionBinding(cookies)).toBeNull();
    });

    it("interrompe a reconstrução ao encontrar uma lacuna", () => {
      const cookies = createCookies({
        "authjs.session-token.0": "parte-1",
        "authjs.session-token.2": "parte-3",
      });

      expect(getAdminSessionBinding(cookies)).toBe("parte-1");
    });

    it("limita a reconstrução aos primeiros 16 fragmentos", () => {
      const values: Record<string, string> = {};

      for (let index = 0; index < 20; index++) {
        values[`authjs.session-token.${index}`] = String(index).padStart(2, "0");
      }

      const cookies = createCookies(values);

      const result = getAdminSessionBinding(cookies);

      const expected = Array.from({ length: 16 }, (_, index) =>
        String(index).padStart(2, "0"),
      ).join("");

      expect(result).toBe(expected);
    });

    it("usa o cookie para vincular o token à sessão", () => {
      const cookies = createCookies({
        "authjs.session-token.0": "sessao-",
        "authjs.session-token.1": "fragmentada",
      });

      const binding = getAdminSessionBinding(cookies);

      expect(binding).not.toBeNull();

      if (!binding) {
        throw new Error("Sessão não encontrada.");
      }

      const token = createAdminCsrfToken(binding, SECRET_A);

      expect(verifyAdminCsrfToken(token, binding, SECRET_A)).toBe(true);

      expect(verifyAdminCsrfToken(token, SESSION_B, SECRET_A)).toBe(false);
    });
  });
});
