import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ADMIN_CSRF_HEADER, createAdminCsrfToken } from "@/lib/admin-csrf";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  validateImageUpload: vi.fn(),
  processImageForStorage: vi.fn(),
  findPrisoner: vi.fn(),
  findImage: vi.fn(),
  upsertImage: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  getPublicUrl: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    prisoner: {
      findUnique: mocks.findPrisoner,
    },
    image: {
      findUnique: mocks.findImage,
      upsert: mocks.upsertImage,
    },
  },
}));

vi.mock("@/lib/image-upload", () => ({
  MAX_IMAGE_SIZE: 2 * 1024 * 1024,
  validateImageUpload: mocks.validateImageUpload,
}));

vi.mock("@/lib/image-processing", () => ({
  processImageForStorage: mocks.processImageForStorage,
}));

vi.mock("@/lib/supabase", () => ({
  CHARACTERS_BUCKET: "characters",
  getSupabaseAdmin: () => ({
    storage: {
      from: () => ({
        upload: mocks.upload,
        remove: mocks.remove,
        getPublicUrl: mocks.getPublicUrl,
      }),
    },
  }),
}));

import { POST } from "@/app/api/admin/images/route";

const ORIGIN = "http://localhost:3000";
const ENDPOINT = `${ORIGIN}/api/admin/images`;

const TEST_SECRET = "milgram-test-auth-secret-32-characters";

const SESSION_COOKIE = "admin-session-cookie-test";
const OTHER_SESSION = "another-admin-session";

const PUBLIC_ROOT = "https://test-project.supabase.co/storage/v1/object/public/characters/";

const OLD_UUID = "11111111-1111-4111-8111-111111111111";
const OLD_PATH = `haruka/season-1-${OLD_UUID}.webp`;
const OLD_URL = `${PUBLIC_ROOT}${OLD_PATH}`;

const IMAGE_BYTES = Buffer.from([1, 2, 3, 4]);

interface ApiResponse {
  success: boolean;
  error?: string;
  code?: string;
  image?: {
    prisonerSlug: string;
    season: number;
    url: string;
    width: number;
    height: number;
    size: number;
    contentType: string;
  };
}

interface RequestOptions {
  origin?: string | null;
  fetchSite?: string | null;
  contentLength?: number;

  /**
   * undefined: gera token válido automaticamente.
   * null: não envia o cabeçalho.
   * string: envia exatamente o token informado.
   */
  csrfToken?: string | null;

  /**
   * undefined: usa o cookie padrão de teste.
   * null: não envia cookies.
   * string: envia exatamente o cabeçalho informado.
   */
  cookieHeader?: string | null;

  /**
   * Permite assinar o token com outra sessão,
   * simulando reutilização indevida.
   */
  tokenBinding?: string;
}

/**
 * Gera os cabeçalhos utilizados pelas requisições
 * autenticadas nos testes.
 *
 * Cada requisição legítima recebe um token CSRF
 * real, assinado pelo módulo de produção.
 */
function createHeaders(options: RequestOptions = {}): Headers {
  const headers = new Headers();

  if (options.origin !== null) {
    headers.set("origin", options.origin ?? ORIGIN);
  }

  if (options.fetchSite !== null) {
    headers.set("sec-fetch-site", options.fetchSite ?? "same-origin");
  }

  if (options.cookieHeader !== null) {
    headers.set("cookie", options.cookieHeader ?? `authjs.session-token=${SESSION_COOKIE}`);
  }

  const token =
    options.csrfToken === undefined
      ? createAdminCsrfToken(options.tokenBinding ?? SESSION_COOKIE, TEST_SECRET)
      : options.csrfToken;

  if (token !== null) {
    headers.set(ADMIN_CSRF_HEADER, token);
  }

  if (options.contentLength !== undefined) {
    headers.set("content-length", String(options.contentLength));
  }

  return headers;
}

/**
 * Cria uma requisição multipart real.
 *
 * O arquivo é pequeno porque a validação de
 * imagens possui testes próprios.
 */
function createRequest(options: RequestOptions = {}): NextRequest {
  const form = new FormData();

  form.set("prisonerSlug", "haruka");
  form.set("season", "1");

  form.set("file", new File([Uint8Array.from(IMAGE_BYTES)], "imagem.png", { type: "image/png" }));

  return new NextRequest(ENDPOINT, {
    method: "POST",
    headers: createHeaders(options),
    body: form,
  });
}

/**
 * Cria uma requisição com conteúdo arbitrário,
 * preservando a autenticação CSRF por padrão.
 */
function createRawRequest(
  contentType: string,
  body: string,
  options: RequestOptions = {},
): NextRequest {
  const headers = createHeaders(options);

  headers.set("content-type", contentType);

  return new NextRequest(ENDPOINT, {
    method: "POST",
    headers,
    body,
  });
}

async function readResponse(request: NextRequest): Promise<{
  status: number;
  body: ApiResponse;
  cacheControl: string | null;
}> {
  const response = await POST(request);

  return {
    status: response.status,
    body: (await response.json()) as ApiResponse,
    cacheControl: response.headers.get("cache-control"),
  };
}

/**
 * Confirma que a rejeição ocorreu antes de
 * qualquer operação de processamento ou escrita.
 */
function expectProtectedWorkSkipped(): void {
  expect(mocks.validateImageUpload).not.toHaveBeenCalled();

  expect(mocks.processImageForStorage).not.toHaveBeenCalled();

  expect(mocks.findPrisoner).not.toHaveBeenCalled();

  expect(mocks.upsertImage).not.toHaveBeenCalled();

  expect(mocks.upload).not.toHaveBeenCalled();

  expect(mocks.remove).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.resetAllMocks();

  vi.stubEnv("AUTH_SECRET", TEST_SECRET);

  // Simula uma sessão administrativa autenticada.
  mocks.auth.mockResolvedValue({
    user: {
      id: "admin",
      email: "admin@example.com",
    },
  });

  mocks.validateImageUpload.mockResolvedValue({
    success: true,
    data: {
      data: IMAGE_BYTES,
      contentType: "image/png",
      extension: "png",
      storagePath: "haruka/season-1.png",
      prisonerSlug: "haruka",
      season: 1,
      size: IMAGE_BYTES.length,
    },
  });

  mocks.processImageForStorage.mockResolvedValue({
    success: true,
    data: {
      data: IMAGE_BYTES,
      contentType: "image/webp",
      storagePath: "haruka/season-1.webp",
      prisonerSlug: "haruka",
      season: 1,
      size: IMAGE_BYTES.length,
      width: 600,
      height: 800,
    },
  });

  mocks.findPrisoner.mockResolvedValue({
    id: 1,
  });

  mocks.findImage.mockResolvedValue(null);

  mocks.upsertImage.mockResolvedValue({
    id: 1,
  });

  mocks.upload.mockResolvedValue({
    data: {
      path: "uploaded.webp",
    },
    error: null,
  });

  mocks.remove.mockResolvedValue({
    data: [],
    error: null,
  });

  mocks.getPublicUrl.mockImplementation((path: string) => ({
    data: {
      publicUrl: new URL(path, PUBLIC_ROOT).toString(),
    },
  }));

  // Evita imprimir os erros esperados dos testes
  // de falha simulada do banco e do Storage.
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("POST /api/admin/images", () => {
  describe("autenticação administrativa", () => {
    it("retorna 401 sem sessão", async () => {
      mocks.auth.mockResolvedValue(null);

      const response = await readResponse(createRequest());

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);

      expectProtectedWorkSkipped();
    });

    it("retorna 401 sem usuário na sessão", async () => {
      mocks.auth.mockResolvedValue({});

      const response = await readResponse(createRequest());

      expect(response.status).toBe(401);

      expectProtectedWorkSkipped();
    });
  });

  describe("proteção de origem", () => {
    it("rejeita requisição sem Origin", async () => {
      const response = await readResponse(
        createRequest({
          origin: null,
        }),
      );

      expect(response.status).toBe(403);
      expect(response.body.code).toBe("CSRF_INVALID");

      expectProtectedWorkSkipped();
    });

    it("rejeita origem externa", async () => {
      const response = await readResponse(
        createRequest({
          origin: "https://exemplo-malicioso.com",
        }),
      );

      expect(response.status).toBe(403);
      expect(response.body.code).toBe("CSRF_INVALID");

      expectProtectedWorkSkipped();
    });

    it("rejeita Sec-Fetch-Site cross-site", async () => {
      const response = await readResponse(
        createRequest({
          fetchSite: "cross-site",
        }),
      );

      expect(response.status).toBe(403);

      expectProtectedWorkSkipped();
    });
  });

  describe("proteção CSRF administrativa", () => {
    it("aceita token válido vinculado à sessão", async () => {
      const response = await readResponse(createRequest());

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);

      expect(mocks.upload).toHaveBeenCalledOnce();
      expect(mocks.upsertImage).toHaveBeenCalledOnce();
    });

    it("rejeita requisição sem token CSRF", async () => {
      const response = await readResponse(
        createRequest({
          csrfToken: null,
        }),
      );

      expect(response.status).toBe(403);
      expect(response.body.code).toBe("CSRF_INVALID");

      expectProtectedWorkSkipped();
    });

    it("rejeita token CSRF malformado", async () => {
      const response = await readResponse(
        createRequest({
          csrfToken: "token-invalido",
        }),
      );

      expect(response.status).toBe(403);
      expect(response.body.code).toBe("CSRF_INVALID");

      expectProtectedWorkSkipped();
    });

    it("rejeita token CSRF adulterado", async () => {
      const validToken = createAdminCsrfToken(SESSION_COOKIE, TEST_SECRET);

      const [version, nonce, signature] = validToken.split(".");

      const alteredSignature = (signature?.startsWith("A") ? "B" : "A") + signature?.slice(1);

      const forgedToken = `${version}.${nonce}.${alteredSignature}`;

      const response = await readResponse(
        createRequest({
          csrfToken: forgedToken,
        }),
      );

      expect(response.status).toBe(403);
      expect(response.body.code).toBe("CSRF_INVALID");

      expectProtectedWorkSkipped();
    });

    it("rejeita token de outra sessão", async () => {
      const response = await readResponse(
        createRequest({
          tokenBinding: OTHER_SESSION,
        }),
      );

      expect(response.status).toBe(403);
      expect(response.body.code).toBe("CSRF_INVALID");

      expectProtectedWorkSkipped();
    });

    it("rejeita requisição sem cookie de sessão", async () => {
      const response = await readResponse(
        createRequest({
          cookieHeader: null,
        }),
      );

      expect(response.status).toBe(403);
      expect(response.body.code).toBe("CSRF_INVALID");

      expectProtectedWorkSkipped();
    });

    it("rejeita token incompatível com o cookie", async () => {
      const response = await readResponse(
        createRequest({
          cookieHeader: `authjs.session-token=${OTHER_SESSION}`,
        }),
      );

      expect(response.status).toBe(403);
      expect(response.body.code).toBe("CSRF_INVALID");

      expectProtectedWorkSkipped();
    });

    it("rejeita token assinado com outro segredo", async () => {
      const token = createAdminCsrfToken(SESSION_COOKIE, "segredo-completamente-diferente");

      const response = await readResponse(
        createRequest({
          csrfToken: token,
        }),
      );

      expect(response.status).toBe(403);
      expect(response.body.code).toBe("CSRF_INVALID");

      expectProtectedWorkSkipped();
    });

    it("rejeita quando AUTH_SECRET está ausente", async () => {
      const request = createRequest();

      vi.stubEnv("AUTH_SECRET", "");

      const response = await readResponse(request);

      expect(response.status).toBe(403);
      expect(response.body.code).toBe("CSRF_INVALID");

      expectProtectedWorkSkipped();
    });

    it("aceita o cookie seguro do Auth.js", async () => {
      const response = await readResponse(
        createRequest({
          cookieHeader: `__Secure-authjs.session-token=${SESSION_COOKIE}`,
        }),
      );

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it("aceita cookie de sessão fragmentado", async () => {
      const first = "admin-session-";
      const second = "fragmented-cookie";

      const response = await readResponse(
        createRequest({
          cookieHeader: `authjs.session-token.0=${first}; ` + `authjs.session-token.1=${second}`,
          tokenBinding: first + second,
        }),
      );

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it("rejeita CSRF antes de analisar o formulário", async () => {
      const response = await readResponse(
        createRawRequest("application/json", '{"file":"imagem"}', {
          csrfToken: null,
        }),
      );

      // A verificação CSRF deve ocorrer antes
      // da validação do Content-Type.
      expect(response.status).toBe(403);
      expect(response.body.code).toBe("CSRF_INVALID");

      expectProtectedWorkSkipped();
    });
  });

  describe("validação HTTP", () => {
    it("rejeita Content-Type incorreto", async () => {
      const response = await readResponse(
        createRawRequest("application/json", '{"file":"imagem"}'),
      );

      expect(response.status).toBe(415);
      expect(mocks.upload).not.toHaveBeenCalled();
    });

    it("rejeita tamanho declarado excessivo", async () => {
      const response = await readResponse(
        createRequest({
          contentLength: 10 * 1024 * 1024,
        }),
      );

      expect(response.status).toBe(413);
      expect(mocks.upload).not.toHaveBeenCalled();
    });

    it("rejeita Content-Length inválido", async () => {
      const request = createRequest();

      request.headers.set("content-length", "valor-invalido");

      const response = await readResponse(request);

      expect(response.status).toBe(400);
      expect(mocks.upload).not.toHaveBeenCalled();
    });

    it("rejeita multipart malformado", async () => {
      const response = await readResponse(
        createRawRequest("multipart/form-data; boundary=broken", "dados-invalidos"),
      );

      expect(response.status).toBe(400);
      expect(mocks.upload).not.toHaveBeenCalled();
    });

    it("limita o tamanho real da requisição", async () => {
      const form = new FormData();

      form.set("prisonerSlug", "haruka");
      form.set("season", "1");

      form.set(
        "file",
        new File([new Uint8Array(3 * 1024 * 1024)], "grande.png", { type: "image/png" }),
      );

      const response = await readResponse(
        new NextRequest(ENDPOINT, {
          method: "POST",
          headers: createHeaders(),
          body: form,
        }),
      );

      expect(response.status).toBe(413);

      expect(mocks.validateImageUpload).not.toHaveBeenCalled();

      expect(mocks.upload).not.toHaveBeenCalled();
    });
  });

  describe("validação e processamento", () => {
    it("retorna 400 para arquivo inválido", async () => {
      mocks.validateImageUpload.mockResolvedValue({
        success: false,
        code: "INVALID_TYPE",
        error: "Formato não permitido.",
      });

      const response = await readResponse(createRequest());

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("INVALID_TYPE");

      expect(mocks.processImageForStorage).not.toHaveBeenCalled();

      expect(mocks.upload).not.toHaveBeenCalled();
    });

    it("retorna 413 para arquivo acima de 2 MB", async () => {
      mocks.validateImageUpload.mockResolvedValue({
        success: false,
        code: "FILE_TOO_LARGE",
        error: "Arquivo muito grande.",
      });

      const response = await readResponse(createRequest());

      expect(response.status).toBe(413);
      expect(mocks.upload).not.toHaveBeenCalled();
    });

    it("retorna 422 para imagem corrompida", async () => {
      mocks.processImageForStorage.mockResolvedValue({
        success: false,
        code: "PROCESSING_ERROR",
        error: "Imagem corrompida.",
      });

      const response = await readResponse(createRequest());

      expect(response.status).toBe(422);
      expect(mocks.upload).not.toHaveBeenCalled();
    });

    it("retorna 413 para resolução excessiva", async () => {
      mocks.processImageForStorage.mockResolvedValue({
        success: false,
        code: "IMAGE_TOO_LARGE",
        error: "Imagem muito grande.",
      });

      const response = await readResponse(createRequest());

      expect(response.status).toBe(413);
      expect(mocks.upload).not.toHaveBeenCalled();
    });
  });

  describe("integração com Prisma", () => {
    it("retorna 404 para prisioneiro inexistente", async () => {
      mocks.findPrisoner.mockResolvedValue(null);

      const response = await readResponse(createRequest());

      expect(response.status).toBe(404);
      expect(mocks.upload).not.toHaveBeenCalled();
    });

    it("retorna 500 quando a consulta falha", async () => {
      mocks.findPrisoner.mockRejectedValue(new Error("Falha simulada no banco"));

      const response = await readResponse(createRequest());

      expect(response.status).toBe(500);
      expect(mocks.upload).not.toHaveBeenCalled();
    });

    it("salva a URL para o prisioneiro e temporada", async () => {
      const response = await readResponse(createRequest());

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);

      expect(mocks.findPrisoner).toHaveBeenCalledWith({
        where: {
          slug: "haruka",
        },
        select: {
          id: true,
        },
      });

      expect(mocks.upsertImage).toHaveBeenCalledOnce();

      const argument = mocks.upsertImage.mock.calls[0][0] as {
        where: {
          prisonerId_season: {
            prisonerId: number;
            season: number;
          };
        };
        create: {
          prisonerId: number;
          season: number;
          url: string;
        };
        update: {
          url: string;
        };
      };

      expect(argument.where).toEqual({
        prisonerId_season: {
          prisonerId: 1,
          season: 1,
        },
      });

      expect(argument.create).toMatchObject({
        prisonerId: 1,
        season: 1,
      });

      expect(argument.create.url).toMatch(
        /^https:\/\/test-project\.supabase\.co\/storage\/v1\/object\/public\/characters\/haruka\/season-1-[0-9a-f-]{36}\.webp$/,
      );

      expect(argument.update.url).toBe(argument.create.url);
    });
  });

  describe("Supabase Storage", () => {
    it("envia WebP com caminho versionado", async () => {
      const response = await readResponse(createRequest());

      expect(response.status).toBe(201);
      expect(mocks.upload).toHaveBeenCalledOnce();

      const [path, data, options] = mocks.upload.mock.calls[0] as [
        string,
        Buffer,
        {
          contentType: string;
          cacheControl: string;
          upsert: boolean;
        },
      ];

      expect(path).toMatch(/^haruka\/season-1-[0-9a-f-]{36}\.webp$/);

      expect(data).toEqual(IMAGE_BYTES);

      expect(options).toEqual({
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: false,
      });

      expect(response.cacheControl).toBe("no-store");

      expect(response.body.image).toMatchObject({
        prisonerSlug: "haruka",
        season: 1,
        width: 600,
        height: 800,
        contentType: "image/webp",
      });
    });

    it("retorna 502 quando o upload falha", async () => {
      mocks.upload.mockResolvedValue({
        data: null,
        error: {
          message: "Falha simulada do Storage",
        },
      });

      const response = await readResponse(createRequest());

      expect(response.status).toBe(502);

      expect(mocks.upsertImage).not.toHaveBeenCalled();
    });

    it("remove arquivo novo quando o Prisma falha", async () => {
      mocks.upsertImage.mockRejectedValue(new Error("Falha simulada no Prisma"));

      const response = await readResponse(createRequest());

      expect(response.status).toBe(500);

      expect(mocks.upload).toHaveBeenCalledOnce();
      expect(mocks.remove).toHaveBeenCalledOnce();

      const uploadedPath = mocks.upload.mock.calls[0][0] as string;

      expect(mocks.remove).toHaveBeenCalledWith([uploadedPath]);
    });

    it("remove a imagem anterior após persistir", async () => {
      mocks.findImage.mockResolvedValue({
        url: OLD_URL,
      });

      const response = await readResponse(createRequest());

      expect(response.status).toBe(201);

      expect(mocks.upsertImage).toHaveBeenCalledOnce();

      expect(mocks.remove).toHaveBeenCalledWith([OLD_PATH]);
    });

    it("não remove imagens externas", async () => {
      mocks.findImage.mockResolvedValue({
        url: "https://placehold.co/600x800",
      });

      const response = await readResponse(createRequest());

      expect(response.status).toBe(201);
      expect(mocks.remove).not.toHaveBeenCalled();
    });

    it("não remove imagens de outro prisioneiro", async () => {
      mocks.findImage.mockResolvedValue({
        url: `${PUBLIC_ROOT}yuno/season-1-${OLD_UUID}.webp`,
      });

      const response = await readResponse(createRequest());

      expect(response.status).toBe(201);
      expect(mocks.remove).not.toHaveBeenCalled();
    });

    it("preserva sucesso quando a limpeza falha", async () => {
      mocks.findImage.mockResolvedValue({
        url: OLD_URL,
      });

      mocks.remove.mockResolvedValue({
        data: null,
        error: {
          message: "Falha simulada na exclusão",
        },
      });

      const response = await readResponse(createRequest());

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);

      expect(mocks.upsertImage).toHaveBeenCalledOnce();
      expect(mocks.remove).toHaveBeenCalledOnce();
    });
  });
});
