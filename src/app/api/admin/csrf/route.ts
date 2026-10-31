import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { ADMIN_CSRF_HEADER, createAdminCsrfToken, getAdminSessionBinding } from "@/lib/admin-csrf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESPONSE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  Vary: "Cookie",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

function jsonResponse(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: RESPONSE_HEADERS,
  });
}

/**
 * Impede que navegadores de outras origens
 * solicitem o token CSRF administrativo.
 *
 * O cabeçalho Sec-Fetch-Site é definido pelo
 * navegador e não pode ser alterado por
 * JavaScript executado em uma página.
 *
 * A ausência desse cabeçalho é tolerada para
 * compatibilidade com clientes antigos.
 */
function isAllowedOrigin(request: NextRequest): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");

  if (fetchSite && fetchSite !== "same-origin") {
    return false;
  }

  const origin = request.headers.get("origin");

  if (origin !== null) {
    try {
      const expectedOrigin = new URL(request.url).origin;

      if (origin !== expectedOrigin) {
        return false;
      }
    } catch {
      return false;
    }
  }

  return true;
}

/**
 * GET /api/admin/csrf
 *
 * Retorna um token CSRF vinculado à sessão
 * administrativa autenticada.
 *
 * O endpoint:
 * - Não modifica dados;
 * - Não acessa o Supabase Storage;
 * - Não retorna o cookie de sessão;
 * - Não retorna AUTH_SECRET;
 * - Desabilita cache da resposta;
 * - Não habilita CORS entre origens diferentes.
 *
 * O cliente deve enviar o token recebido
 * no cabeçalho x-milgram-csrf durante uploads.
 */
export async function GET(request: NextRequest) {
  // 1. Verificar a origem antes de qualquer operação.
  if (!isAllowedOrigin(request)) {
    return jsonResponse(
      {
        success: false,
        code: "CSRF_INVALID",
        error: "Origem da requisição não permitida.",
      },
      403,
    );
  }

  // 2. Exigir uma sessão autenticada.
  let session;

  try {
    session = await auth();
  } catch (error) {
    console.error("Falha ao verificar sessão administrativa:", error);

    return jsonResponse(
      {
        success: false,
        error: "Não foi possível verificar a sessão.",
      },
      500,
    );
  }

  if (!session?.user) {
    return jsonResponse(
      {
        success: false,
        error: "Autenticação administrativa necessária.",
      },
      401,
    );
  }

  // 3. Obter o vínculo da sessão atual.
  //
  // O cookie nunca é incluído na resposta.
  const sessionBinding = getAdminSessionBinding(request.cookies);

  if (!sessionBinding) {
    return jsonResponse(
      {
        success: false,
        code: "SESSION_BINDING_MISSING",
        error: "Não foi possível identificar o cookie de sessão.",
      },
      403,
    );
  }

  // 4. Verificar a configuração criptográfica.
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    console.error("AUTH_SECRET não configurado para CSRF administrativo.");

    return jsonResponse(
      {
        success: false,
        error: "Proteção CSRF indisponível.",
      },
      503,
    );
  }

  // 5. Gerar o token vinculado à sessão.
  try {
    const csrfToken = createAdminCsrfToken(sessionBinding, secret);

    return jsonResponse(
      {
        success: true,
        csrfToken,
        headerName: ADMIN_CSRF_HEADER,
      },
      200,
    );
  } catch (error) {
    console.error("Falha ao gerar token CSRF administrativo:", error);

    return jsonResponse(
      {
        success: false,
        error: "Não foi possível gerar o token CSRF.",
      },
      500,
    );
  }
}
