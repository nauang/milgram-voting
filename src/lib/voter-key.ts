import { createHash } from "node:crypto";

// UUID v4 em formato canônico. O cookie é emitido pelo servidor com randomUUID(),
// então qualquer outro formato é lixo (ou tentativa de forjar identidade) e é descartado.
const VISITOR_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidVisitorId(value: string | null | undefined): value is string {
  return typeof value === "string" && VISITOR_ID_PATTERN.test(value);
}

/**
 * Identidade anônima do visitante: sha256(cookie + salt).
 *
 * O IP NÃO entra na chave de propósito: IPs móveis mudam o tempo todo, e o visitante
 * perderia o selo "votado" ao trocar de rede (podendo votar de novo). A defesa por IP
 * fica no rate limit (src/lib/rate-limit.ts).
 *
 * A fórmula NÃO pode mudar sem necessidade: alterá-la invalida o estado "votado" de todos.
 * Usada pela rota de voto E pela página /judge, para nunca divergirem.
 */
export function buildVoterKey(cookieId: string): string {
  const salt = process.env.VOTER_SALT;
  if (!salt) {
    // Sem fallback: um salt padrão público (repositório aberto) é o mesmo que não ter salt.
    throw new Error("VOTER_SALT não definida. Gere com: openssl rand -hex 32");
  }
  return createHash("sha256").update(`${cookieId}:${salt}`).digest("hex");
}
