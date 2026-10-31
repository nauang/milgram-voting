import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { ADMIN_CSRF_HEADER, getAdminSessionBinding, verifyAdminCsrfToken } from "@/lib/admin-csrf";
import { prisma } from "@/lib/db";
import { MAX_IMAGE_SIZE, validateImageUpload } from "@/lib/image-upload";
import { processImageForStorage } from "@/lib/image-processing";
import { CHARACTERS_BUCKET, getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Margem para os campos e delimitadores do multipart/form-data.
const MAX_REQUEST_SIZE = MAX_IMAGE_SIZE + 128 * 1024;

class PayloadTooLargeError extends Error {
  constructor() {
    super("A requisição excedeu o tamanho permitido.");
  }
}

function jsonResponse(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Verifica se a requisição veio da mesma origem.
 *
 * Esta proteção complementa a autenticação
 * administrativa e a validação do token CSRF.
 */
function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");

  if (!origin) {
    return false;
  }

  try {
    const requestOrigin = new URL(request.url).origin;
    const suppliedOrigin = new URL(origin).origin;

    if (origin !== suppliedOrigin) {
      return false;
    }

    if (suppliedOrigin !== requestOrigin) {
      return false;
    }

    const fetchSite = request.headers.get("sec-fetch-site");

    if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Verifica o token CSRF administrativo.
 *
 * O token deve:
 * - Estar presente no cabeçalho x-milgram-csrf;
 * - Ter assinatura HMAC-SHA256 válida;
 * - Estar vinculado ao cookie de sessão atual;
 * - Utilizar o segredo configurado em AUTH_SECRET.
 *
 * A ausência de qualquer requisito provoca rejeição.
 */
function hasValidAdminCsrf(request: NextRequest): boolean {
  const token = request.headers.get(ADMIN_CSRF_HEADER);

  const sessionBinding = getAdminSessionBinding(request.cookies);

  return verifyAdminCsrfToken(token, sessionBinding, process.env.AUTH_SECRET);
}

/**
 * Lê multipart/form-data com limite de bytes.
 *
 * O limite é verificado durante a leitura,
 * antes da interpretação do formulário.
 */
async function readBoundedFormData(request: NextRequest): Promise<FormData> {
  const reader = request.body?.getReader();

  if (!reader) {
    throw new Error("Corpo da requisição ausente.");
  }

  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      totalBytes += value.byteLength;

      if (totalBytes > MAX_REQUEST_SIZE) {
        await reader.cancel();

        throw new PayloadTooLargeError();
      }

      chunks.push(Uint8Array.from(value));
    }
  } finally {
    reader.releaseLock();
  }

  const contentType = request.headers.get("content-type") ?? "";

  const boundedRequest = new Request(request.url, {
    method: "POST",
    headers: {
      "content-type": contentType,
    },
    body: new Blob(chunks),
  });

  return boundedRequest.formData();
}

/**
 * Identifica arquivos antigos pertencentes
 * ao bucket de imagens dos personagens.
 *
 * URLs externas e placeholders não são removidos.
 */
function getPreviousStoragePath(
  previousUrl: string | null,
  publicRoot: string,
  prisonerSlug: string,
  season: number,
): string | null {
  if (!previousUrl) {
    return null;
  }

  try {
    const previous = new URL(previousUrl);
    const root = new URL(publicRoot);

    if (previous.origin !== root.origin || !previous.pathname.startsWith(root.pathname)) {
      return null;
    }

    const path = previous.pathname.slice(root.pathname.length);

    const expectedPath = new RegExp(
      `^${prisonerSlug}/season-${season}` + `(?:-[0-9a-f-]{36})?\\.webp$`,
    );

    return expectedPath.test(path) ? path : null;
  } catch {
    return null;
  }
}

/**
 * POST /api/admin/images
 *
 * Campos multipart:
 * - file: File
 * - prisonerSlug: string
 * - season: "1" | "2" | "3"
 *
 * Cabeçalho obrigatório:
 * - x-milgram-csrf: token CSRF administrativo
 *
 * Requer autenticação administrativa.
 */
export async function POST(request: NextRequest) {
  // 1. Verificar autenticação administrativa.
  const session = await auth();

  if (!session?.user) {
    return jsonResponse(
      {
        success: false,
        error: "Autenticação administrativa necessária.",
      },
      401,
    );
  }

  // 2. Verificar a origem da requisição.
  if (!isSameOrigin(request)) {
    return jsonResponse(
      {
        success: false,
        code: "CSRF_INVALID",
        error: "Origem da requisição não autorizada.",
      },
      403,
    );
  }

  // 3. Validar o token CSRF vinculado à sessão.
  //
  // Esta verificação ocorre antes de:
  // - Ler o corpo da requisição;
  // - Processar imagens;
  // - Consultar o banco de dados;
  // - Acessar o Supabase Storage.
  if (!hasValidAdminCsrf(request)) {
    return jsonResponse(
      {
        success: false,
        code: "CSRF_INVALID",
        error: "Token CSRF administrativo ausente ou inválido.",
      },
      403,
    );
  }

  // 4. Aceitar somente multipart/form-data.
  const contentType = request.headers.get("content-type") ?? "";

  if (
    !/^multipart\/form-data\s*;/i.test(contentType) ||
    !/(?:^|;)\s*boundary=/i.test(contentType)
  ) {
    return jsonResponse(
      {
        success: false,
        error: "Envie os dados utilizando multipart/form-data.",
      },
      415,
    );
  }

  // 5. Rejeitar antecipadamente tamanhos excessivos.
  const contentLength = request.headers.get("content-length");

  if (contentLength !== null) {
    const declaredSize = Number(contentLength);

    if (!Number.isSafeInteger(declaredSize) || declaredSize < 0) {
      return jsonResponse(
        {
          success: false,
          error: "Tamanho da requisição inválido.",
        },
        400,
      );
    }

    if (declaredSize > MAX_REQUEST_SIZE) {
      return jsonResponse(
        {
          success: false,
          error: "A requisição excedeu o tamanho permitido.",
        },
        413,
      );
    }
  }

  // 6. Ler o formulário com limite de tamanho.
  let formData: FormData;

  try {
    formData = await readBoundedFormData(request);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return jsonResponse(
        {
          success: false,
          error: error.message,
        },
        413,
      );
    }

    return jsonResponse(
      {
        success: false,
        error: "Não foi possível interpretar o formulário.",
      },
      400,
    );
  }

  // 7. Validar os campos e o arquivo recebido.
  const validation = await validateImageUpload({
    file: formData.get("file"),
    prisonerSlug: formData.get("prisonerSlug"),
    season: formData.get("season"),
  });

  if (!validation.success) {
    return jsonResponse(
      {
        success: false,
        code: validation.code,
        error: validation.error,
      },
      validation.code === "FILE_TOO_LARGE" ? 413 : 400,
    );
  }

  // 8. Decodificar, redimensionar e converter.
  const processing = await processImageForStorage(validation.data);

  if (!processing.success) {
    return jsonResponse(
      {
        success: false,
        code: processing.code,
        error: processing.error,
      },
      processing.code === "IMAGE_TOO_LARGE" ? 413 : 422,
    );
  }

  const image = processing.data;

  // 9. Verificar a existência do prisioneiro.
  let prisoner: { id: number } | null;

  try {
    prisoner = await prisma.prisoner.findUnique({
      where: {
        slug: image.prisonerSlug,
      },
      select: {
        id: true,
      },
    });
  } catch (error) {
    console.error("Falha ao consultar prisioneiro:", error);

    return jsonResponse(
      {
        success: false,
        error: "Falha ao consultar o banco de dados.",
      },
      500,
    );
  }

  if (!prisoner) {
    return jsonResponse(
      {
        success: false,
        error: "Prisioneiro não encontrado.",
      },
      404,
    );
  }

  try {
    // 10. Consultar a imagem anterior.
    const previousImage = await prisma.image.findUnique({
      where: {
        prisonerId_season: {
          prisonerId: prisoner.id,
          season: image.season,
        },
      },
      select: {
        url: true,
      },
    });

    const supabase = getSupabaseAdmin();
    const storage = supabase.storage.from(CHARACTERS_BUCKET);

    // 11. Gerar nome único para evitar sobrescrita.
    const newStoragePath = image.storagePath.replace(/\.webp$/, `-${randomUUID()}.webp`);

    // 12. Enviar a nova imagem.
    const { error: uploadError } = await storage.upload(newStoragePath, image.data, {
      contentType: image.contentType,
      cacheControl: "31536000",
      upsert: false,
    });

    if (uploadError) {
      console.error("Falha no upload do Supabase:", uploadError.message);

      return jsonResponse(
        {
          success: false,
          error: "Não foi possível armazenar a imagem.",
        },
        502,
      );
    }

    // 13. Obter a URL pública.
    const { data: publicData } = storage.getPublicUrl(newStoragePath);

    const publicUrl = publicData.publicUrl;

    // 14. Atualizar o banco de dados.
    try {
      await prisma.image.upsert({
        where: {
          prisonerId_season: {
            prisonerId: prisoner.id,
            season: image.season,
          },
        },
        create: {
          prisonerId: prisoner.id,
          season: image.season,
          url: publicUrl,
        },
        update: {
          url: publicUrl,
        },
      });
    } catch (error) {
      console.error("Falha ao atualizar imagem no Prisma:", error);

      // O registro antigo permanece no banco.
      // Tentamos remover somente o arquivo novo.
      try {
        const { error: cleanupError } = await storage.remove([newStoragePath]);

        if (cleanupError) {
          console.error("Falha ao limpar upload não persistido:", cleanupError.message);
        }
      } catch (cleanupError) {
        console.error("Falha inesperada na limpeza:", cleanupError);
      }

      return jsonResponse(
        {
          success: false,
          error: "Não foi possível salvar a imagem no banco.",
        },
        500,
      );
    }

    // 15. Remover a imagem antiga após persistência.
    const publicRoot = storage.getPublicUrl("").data.publicUrl;

    const previousPath = getPreviousStoragePath(
      previousImage?.url ?? null,
      publicRoot,
      image.prisonerSlug,
      image.season,
    );

    if (previousPath && previousPath !== newStoragePath) {
      try {
        const { error: removalError } = await storage.remove([previousPath]);

        if (removalError) {
          console.error("Falha ao remover imagem antiga:", removalError.message);
        }
      } catch (error) {
        // A nova URL já está persistida.
        console.error("Erro ao limpar imagem antiga:", error);
      }
    }

    // 16. Responder após a persistência.
    return jsonResponse(
      {
        success: true,
        image: {
          prisonerSlug: image.prisonerSlug,
          season: image.season,
          url: publicUrl,
          width: image.width,
          height: image.height,
          size: image.size,
          contentType: image.contentType,
        },
      },
      201,
    );
  } catch (error) {
    console.error("Erro inesperado no upload:", error);

    return jsonResponse(
      {
        success: false,
        error: "Erro interno ao processar o upload.",
      },
      500,
    );
  }
}
