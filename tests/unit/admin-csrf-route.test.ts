import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ADMIN_CSRF_HEADER, verifyAdminCsrfToken } from "@/lib/admin-csrf";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}));

import { GET } from "@/app/api/admin/csrf/route";

const ORIGIN = "http://localhost:3000";
const ENDPOINT = `${ORIGIN}/api/admin/csrf`;

const TEST_SECRET = "milgram-test-auth-secret-32-characters";

const SESSION_A = "admin-session-cookie-A";
const SESSION_B = "admin-session-cookie-B";

interface ApiResponse {
  success: boolean;
  csrfToken?: string;
  headerName?: string;
  code?: string;
  error?: string;
}

interface RequestOptions {
  origin?: string | null;
  fetchSite?: string | null;
  cookieHeader?: string | null;
}

/**
 * Cria uma requisição GET autenticada por padrão.
 *
 * O cookie é fictício, mas utiliza o mesmo formato
 * esperado pelo módulo administrativo de CSRF.
 */
function createRequest(options: RequestOptions = {}): NextRequest {
  const headers = new Headers();

  if (options.origin !== null) {
    headers.set("origin", options.origin ?? ORIGIN);
  }

  if (options.fetchSite !== null) {
    headers.set("sec-fetch-site", options.fetchSite ?? "same-origin");
  }

  if (options.cookieHeader !== null) {
    headers.set("cookie", options.cookieHeader ?? `authjs.session-token=${SESSION_A}`);
  }

  return new NextRequest(ENDPOINT, {
    method: "GET",
    headers,
  });
}

/**
 * Executa o endpoint e interpreta sua resposta.
 */
async function readResponse(request: NextRequest): Promise<{
  status: number;
  body: ApiResponse;
  headers: Headers;
}> {
  const response = await GET(request);

  return {
    status: response.status,
    body: (await response.json()) as ApiResponse,
    headers: response.headers,
  };
}

/**
 * Garante que uma resposta de erro não exponha
 * material criptográfico ou o token CSRF.
 */
function expectFailureWithoutToken(body: ApiResponse): void {
  expect(body.success).toBe(false);
  expect(body.csrfToken).toBeUndefined();
  expect(body.headerName).toBeUndefined();
}

/**
 * Confirma que a resposta contém um token
 * criptograficamente válido para determinada sessão.
 */
function expectValidToken(body: ApiResponse, sessionBinding: string): string {
  expect(body.success).toBe(true);
  expect(body.headerName).toBe(ADMIN_CSRF_HEADER);

  expect(body.csrfToken).toMatch(/^v1\.[A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]{43}$/);

  const token = body.csrfToken;

  if (!token) {
    throw new Error("O endpoint não retornou um token CSRF.");
  }

  expect(verifyAdminCsrfToken(token, sessionBinding, TEST_SECRET)).toBe(true);

  return token;
}

beforeEach(() => {
  vi.resetAllMocks();

  vi.stubEnv("AUTH_SECRET", TEST_SECRET);

  mocks.auth.mockResolvedValue({
    user: {
      id: "admin",
      email: "admin@example.com",
    },
  });

  // Suprime somente os erros esperados nos testes
  // que simulam falhas de autenticação/configuração.
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("GET /api/admin/csrf", () => {
  describe("proteção de origem", () => {
    it.each([
      ["cross-site", "cross-site"],
      ["same-site", "same-site"],
      ["none", "none"],
    ])("rejeita Sec-Fetch-Site %s", async (_, fetchSite) => {
      const response = await readResponse(createRequest({ fetchSite }));

      expect(response.status).toBe(403);
      expect(response.body.code).toBe("CSRF_INVALID");

      expectFailureWithoutToken(response.body);

      // A origem é verificada antes da sessão.
      expect(mocks.auth).not.toHaveBeenCalled();
    });

    it("rejeita Origin de outro domínio", async () => {
      const response = await readResponse(
        createRequest({
          origin: "https://exemplo-malicioso.com",
        }),
      );

      expect(response.status).toBe(403);
      expect(response.body.code).toBe("CSRF_INVALID");

      expectFailureWithoutToken(response.body);
      expect(mocks.auth).not.toHaveBeenCalled();
    });

    it("rejeita Origin malformado", async () => {
      const response = await readResponse(
        createRequest({
          origin: "origem-invalida",
        }),
      );

      expect(response.status).toBe(403);

      expectFailureWithoutToken(response.body);
      expect(mocks.auth).not.toHaveBeenCalled();
    });

    it("aceita requisição sem Origin quando Fetch-Site é válido", async () => {
      const response = await readResponse(
        createRequest({
          origin: null,
          fetchSite: "same-origin",
        }),
      );

      expect(response.status).toBe(200);

      expectValidToken(response.body, SESSION_A);
    });

    it("aceita cliente sem cabeçalhos de origem", async () => {
      // Documenta a compatibilidade atual com
      // navegadores e clientes sem esses cabeçalhos.
      const response = await readResponse(
        createRequest({
          origin: null,
          fetchSite: null,
        }),
      );

      expect(response.status).toBe(200);

      expectValidToken(response.body, SESSION_A);
    });
  });

  describe("autenticação administrativa", () => {
    it("retorna 401 quando não existe sessão", async () => {
      mocks.auth.mockResolvedValue(null);

      const response = await readResponse(createRequest());

      expect(response.status).toBe(401);

      expectFailureWithoutToken(response.body);
      expect(mocks.auth).toHaveBeenCalledOnce();
    });

    it("retorna 401 quando a sessão não possui usuário", async () => {
      mocks.auth.mockResolvedValue({});

      const response = await readResponse(createRequest());

      expect(response.status).toBe(401);

      expectFailureWithoutToken(response.body);
    });

    it("retorna 500 quando Auth.js falha", async () => {
      mocks.auth.mockRejectedValue(new Error("Falha simulada do Auth.js"));

      const response = await readResponse(createRequest());

      expect(response.status).toBe(500);

      expectFailureWithoutToken(response.body);
      expect(console.error).toHaveBeenCalled();
    });

    it("não autentica requisições de origem rejeitada", async () => {
      const response = await readResponse(
        createRequest({
          origin: "https://outro-site.com",
        }),
      );

      expect(response.status).toBe(403);
      expect(mocks.auth).not.toHaveBeenCalled();

      expectFailureWithoutToken(response.body);
    });
  });

  describe("vinculação ao cookie de sessão", () => {
    it("retorna 403 quando o cookie está ausente", async () => {
      const response = await readResponse(
        createRequest({
          cookieHeader: null,
        }),
      );

      expect(response.status).toBe(403);

      expect(response.body.code).toBe("SESSION_BINDING_MISSING");

      expectFailureWithoutToken(response.body);
    });

    it("aceita cookie padrão do Auth.js", async () => {
      const response = await readResponse(
        createRequest({
          cookieHeader: `authjs.session-token=${SESSION_A}`,
        }),
      );

      expect(response.status).toBe(200);

      expectValidToken(response.body, SESSION_A);
    });

    it("aceita cookie seguro do Auth.js", async () => {
      const response = await readResponse(
        createRequest({
          cookieHeader: `__Secure-authjs.session-token=${SESSION_A}`,
        }),
      );

      expect(response.status).toBe(200);

      expectValidToken(response.body, SESSION_A);
    });

    it("reconstrói cookie de sessão fragmentado", async () => {
      const first = "admin-session-";
      const second = "fragmented-cookie";

      const response = await readResponse(
        createRequest({
          cookieHeader: `authjs.session-token.0=${first}; ` + `authjs.session-token.1=${second}`,
        }),
      );

      expect(response.status).toBe(200);

      expectValidToken(response.body, first + second);
    });

    it("prioriza o cookie seguro quando há dois formatos", async () => {
      const response = await readResponse(
        createRequest({
          cookieHeader:
            `__Secure-authjs.session-token=${SESSION_A}; ` + `authjs.session-token=${SESSION_B}`,
        }),
      );

      expect(response.status).toBe(200);

      const token = expectValidToken(response.body, SESSION_A);

      expect(verifyAdminCsrfToken(token, SESSION_B, TEST_SECRET)).toBe(false);
    });

    it("não aceita token antigo após mudança de sessão", async () => {
      const firstResponse = await readResponse(
        createRequest({
          cookieHeader: `authjs.session-token=${SESSION_A}`,
        }),
      );

      expect(firstResponse.status).toBe(200);

      const oldToken = expectValidToken(firstResponse.body, SESSION_A);

      const secondResponse = await readResponse(
        createRequest({
          cookieHeader: `authjs.session-token=${SESSION_B}`,
        }),
      );

      expect(secondResponse.status).toBe(200);

      const newToken = expectValidToken(secondResponse.body, SESSION_B);

      expect(verifyAdminCsrfToken(oldToken, SESSION_B, TEST_SECRET)).toBe(false);

      expect(verifyAdminCsrfToken(newToken, SESSION_A, TEST_SECRET)).toBe(false);
    });

    it("rejeita fragmentos sem a primeira parte", async () => {
      const response = await readResponse(
        createRequest({
          cookieHeader: "authjs.session-token.1=fragmento-incompleto",
        }),
      );

      expect(response.status).toBe(403);

      expect(response.body.code).toBe("SESSION_BINDING_MISSING");

      expectFailureWithoutToken(response.body);
    });
  });

  describe("configuração criptográfica", () => {
    it("retorna 503 quando AUTH_SECRET está vazio", async () => {
      vi.stubEnv("AUTH_SECRET", "");

      const response = await readResponse(createRequest());

      expect(response.status).toBe(503);
      expect(response.body.error).toBe("Proteção CSRF indisponível.");

      expectFailureWithoutToken(response.body);
    });

    it("retorna 503 quando AUTH_SECRET está ausente", async () => {
      vi.stubEnv("AUTH_SECRET", undefined);

      const response = await readResponse(createRequest());

      expect(response.status).toBe(503);

      expectFailureWithoutToken(response.body);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("emissão do token", () => {
    it("retorna 200 e um token HMAC-SHA256 válido", async () => {
      const response = await readResponse(createRequest());

      expect(response.status).toBe(200);

      expectValidToken(response.body, SESSION_A);

      expect(mocks.auth).toHaveBeenCalledOnce();
    });

    it("gera tokens diferentes em requisições consecutivas", async () => {
      const first = await readResponse(createRequest());

      const second = await readResponse(createRequest());

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);

      const firstToken = expectValidToken(first.body, SESSION_A);

      const secondToken = expectValidToken(second.body, SESSION_A);

      expect(firstToken).not.toBe(secondToken);
    });

    it("não expõe o cookie nem AUTH_SECRET na resposta", async () => {
      const response = await readResponse(createRequest());

      expect(response.status).toBe(200);

      const serialized = JSON.stringify(response.body);

      expect(serialized).not.toContain(SESSION_A);
      expect(serialized).not.toContain(TEST_SECRET);

      expect(response.headers.get("set-cookie")).toBeNull();
    });

    it("impede armazenamento em cache", async () => {
      const response = await readResponse(createRequest());

      expect(response.status).toBe(200);

      expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");

      expect(response.headers.get("pragma")).toBe("no-cache");

      expect(response.headers.get("vary")).toBe("Cookie");
    });

    it("define cabeçalhos adicionais de segurança", async () => {
      const response = await readResponse(createRequest());

      expect(response.status).toBe(200);

      expect(response.headers.get("x-content-type-options")).toBe("nosniff");

      expect(response.headers.get("referrer-policy")).toBe("no-referrer");

      expect(response.headers.get("access-control-allow-origin")).toBeNull();
    });

    it("retorna JSON com o nome correto do cabeçalho", async () => {
      const response = await readResponse(createRequest());

      expect(response.status).toBe(200);

      expect(response.headers.get("content-type")).toContain("application/json");

      expect(response.body.headerName).toBe("x-milgram-csrf");

      expect(response.body.success).toBe(true);
    });

    it("retorna token verificável pelo módulo usado no upload", async () => {
      const response = await readResponse(createRequest());

      expect(response.status).toBe(200);

      const token = expectValidToken(response.body, SESSION_A);

      // Mesmo verificador utilizado pelo endpoint
      // POST /api/admin/images.
      expect(verifyAdminCsrfToken(token, SESSION_A, process.env.AUTH_SECRET)).toBe(true);
    });
  });
});
