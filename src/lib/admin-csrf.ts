import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const ADMIN_CSRF_HEADER = "x-milgram-csrf";

const TOKEN_VERSION = "v1";
const TOKEN_CONTEXT = "milgram-admin-csrf";
const NONCE_BYTES = 32;

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const SESSION_COOKIE_NAMES = ["__Secure-authjs.session-token", "authjs.session-token"] as const;

interface CookieReader {
  get(name: string): { value: string } | undefined;
}

/**
 * Obtém o cookie de sessão do Auth.js.
 *
 * Também suporta cookies divididos em partes,
 * utilizados quando o token excede o tamanho
 * permitido para um único cookie.
 *
 * Nunca enviar esse valor ao cliente.
 */
export function getAdminSessionBinding(cookies: CookieReader): string | null {
  for (const name of SESSION_COOKIE_NAMES) {
    const direct = cookies.get(name)?.value;

    if (direct) {
      return direct;
    }

    const firstChunk = cookies.get(`${name}.0`)?.value;

    if (!firstChunk) {
      continue;
    }

    let combined = firstChunk;

    for (let index = 1; index < 16; index++) {
      const chunk = cookies.get(`${name}.${index}`)?.value;

      if (!chunk) {
        break;
      }

      combined += chunk;
    }

    return combined;
  }

  return null;
}

/**
 * Calcula a assinatura vinculada à sessão.
 *
 * Utiliza separação de domínio para impedir
 * reutilização da assinatura em outras operações.
 */
function signToken(nonce: string, sessionBinding: string, secret: string): Buffer {
  return createHmac("sha256", secret)
    .update(TOKEN_CONTEXT)
    .update("\0")
    .update(sessionBinding)
    .update("\0")
    .update(nonce)
    .digest();
}

/**
 * Gera um token CSRF administrativo.
 *
 * O token contém:
 * - Versão do formato;
 * - Nonce criptograficamente aleatório;
 * - Assinatura HMAC-SHA256 vinculada à sessão.
 *
 * O cookie de sessão e o segredo não são
 * incluídos no token retornado.
 */
export function createAdminCsrfToken(sessionBinding: string, secret: string): string {
  if (!sessionBinding || !secret) {
    throw new Error("Não foi possível gerar o token CSRF administrativo.");
  }

  const nonce = randomBytes(NONCE_BYTES).toString("base64url");

  const signature = signToken(nonce, sessionBinding, secret).toString("base64url");

  return `${TOKEN_VERSION}.${nonce}.${signature}`;
}

/**
 * Verifica o token CSRF administrativo.
 *
 * A validação falha quando:
 * - O token está ausente ou malformado;
 * - O segredo não está configurado;
 * - A sessão está ausente;
 * - A assinatura é inválida;
 * - O token pertence a outra sessão.
 *
 * A comparação usa timingSafeEqual.
 */
export function verifyAdminCsrfToken(
  token: unknown,
  sessionBinding: string | null,
  secret: string | undefined,
): boolean {
  if (typeof token !== "string" || !sessionBinding || !secret) {
    return false;
  }

  const parts = token.split(".");

  if (parts.length !== 3) {
    return false;
  }

  const [version, nonce, signature] = parts;

  if (
    version !== TOKEN_VERSION ||
    !nonce ||
    !signature ||
    !BASE64URL_PATTERN.test(nonce) ||
    !BASE64URL_PATTERN.test(signature)
  ) {
    return false;
  }

  const expected = signToken(nonce, sessionBinding, secret);

  const provided = Buffer.from(signature, "base64url");

  if (provided.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(provided, expected);
}
