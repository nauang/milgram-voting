import { createHash } from "node:crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export interface RateLimitResult {
  allowed: boolean;
  /** Segundos até uma nova tentativa ser aceita (0 quando allowed). */
  retryAfterSeconds: number;
}

export interface RateLimiter {
  limit(identifier: string): Promise<RateLimitResult>;
}

export interface LimiterConfig {
  /** Vira parte da chave no Redis: milgram:rl:<name>:<identificador>. */
  name: string;
  max: number;
  windowSeconds: number;
}

export const RATE_LIMITS = {
  // Anti-bot (PROMPT §8.1): 10 tentativas por IP por hora.
  voteAttempts: { name: "vote-attempts", max: 10, windowSeconds: 60 * 60 },
  // IPs compartilhados (CGNAT, faculdades) são comuns: 3 tentativas por IP + prisioneiro.
  votePerPrisoner: { name: "vote-per-prisoner", max: 3, windowSeconds: 24 * 60 * 60 },
  // Login do admin (PROMPT §8.1): 5 tentativas por IP a cada 15 minutos.
  adminLogin: { name: "admin-login", max: 5, windowSeconds: 15 * 60 },
} as const satisfies Record<string, LimiterConfig>;

export type RateLimitScope = keyof typeof RATE_LIMITS;

const UPSTASH_TIMEOUT_MS = 1500;
const MEMORY_LIMITER_MAX_KEYS = 10_000;

function isProductionRuntime(): boolean {
  // NODE_ENV cobre produção fora da Vercel (VPS, Docker, outras plataformas).
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

function createUpstashLimiter(redis: Redis, config: LimiterConfig): RateLimiter {
  const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(config.max, `${config.windowSeconds} s`),
    prefix: `milgram:rl:${config.name}`,
    timeout: UPSTASH_TIMEOUT_MS,
  });

  return {
    async limit(identifier) {
      const { success, reset, reason } = await ratelimit.limit(identifier);

      // O Upstash pode retornar success=true quando o Redis estoura o timeout.
      // Nesse caso NÃO houve validação do limite e não podemos liberar a ação.
      if (reason === "timeout") {
        throw new Error("Upstash Redis não respondeu antes do tempo limite.");
      }

      // `reset` vem em milissegundos; Retry-After usa segundos.
      return {
        allowed: success,
        retryAfterSeconds: success ? 0 : Math.max(1, Math.ceil((reset - Date.now()) / 1000)),
      };
    },
  };
}

/**
 * Limitador em memória APENAS para desenvolvimento e testes.
 * Em produção, instâncias distintas não compartilhariam os contadores.
 */
export function createMemoryLimiter(
  config: LimiterConfig,
  now: () => number = Date.now,
): RateLimiter {
  const hitsByIdentifier = new Map<string, number[]>();
  const windowMs = config.windowSeconds * 1000;

  return {
    async limit(identifier) {
      const currentTime = now();
      const recentHits = (hitsByIdentifier.get(identifier) ?? []).filter(
        (hitTime) => currentTime - hitTime < windowMs,
      );

      if (recentHits.length >= config.max) {
        hitsByIdentifier.set(identifier, recentHits);
        const oldestHit = recentHits[0] ?? currentTime;
        return {
          allowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil((oldestHit + windowMs - currentTime) / 1000)),
        };
      }

      if (hitsByIdentifier.size >= MEMORY_LIMITER_MAX_KEYS) {
        hitsByIdentifier.clear(); // evita crescimento ilimitado em desenvolvimento
      }

      recentHits.push(currentTime);
      hitsByIdentifier.set(identifier, recentHits);
      return { allowed: true, retryAfterSeconds: 0 };
    },
  };
}

function hasUpstashEnv(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() && process.env.UPSTASH_REDIS_REST_TOKEN?.trim(),
  );
}

const limiterCache = new Map<string, RateLimiter>();

function getLimiter(config: LimiterConfig): RateLimiter {
  const cached = limiterCache.get(config.name);
  if (cached) {
    return cached;
  }

  let limiter: RateLimiter;

  if (hasUpstashEnv()) {
    limiter = createUpstashLimiter(Redis.fromEnv(), config);
  } else if (isProductionRuntime()) {
    // Em produção, nunca substituímos um limitador distribuído por memória local.
    throw new Error(
      "Rate limit mal configurado: defina Upstash (UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN).",
    );
  } else {
    limiter = createMemoryLimiter(config);
  }

  limiterCache.set(config.name, limiter);
  return limiter;
}

/**
 * Executa um limitador com uma política explícita para indisponibilidade.
 *
 * O padrão `allow` é mantido para compatibilidade com usos/testes anteriores.
 * As rotas reais usam `checkRateLimit`, que sempre seleciona `throw`.
 */
export async function runLimiter(
  limiter: RateLimiter,
  identifier: string,
  onFailure: "allow" | "throw" = "allow",
): Promise<RateLimitResult> {
  try {
    return await limiter.limit(identifier);
  } catch (error) {
    console.error("Falha na consulta ao rate limit.", error);

    if (onFailure === "throw") {
      throw new Error("Limitador de requisições temporariamente indisponível.", {
        cause: error,
      });
    }

    return { allowed: true, retryAfterSeconds: 0 };
  }
}

/**
 * Ponto de entrada das rotas de login e votação.
 *
 * Fail-closed: se o Redis estiver indisponível ou retornar timeout,
 * a requisição falha; nunca se faz hash de senha nem grava voto sem
 * confirmar o limite. As rotas convertem o erro em resposta genérica.
 */
export async function checkRateLimit(
  scope: RateLimitScope,
  identifier: string,
): Promise<RateLimitResult> {
  // Falhas de configuração também devem se propagar em produção.
  return runLimiter(getLimiter(RATE_LIMITS[scope]), identifier, "throw");
}

/** IP do visitante. Em proxies confiáveis, os cabeçalhos são definidos pela plataforma. */
export function getClientIp(headers: Headers): string {
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }
  const forwardedFor = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || "unknown";
}

/** sha256(valor + salt): nunca guardar IP puro (PROMPT §8). */
export function hashIdentifier(value: string): string {
  const salt = process.env.VOTER_SALT;
  if (!salt) {
    throw new Error("VOTER_SALT não definida.");
  }
  return createHash("sha256").update(`ip:${value}:${salt}`).digest("hex");
}

export function rateLimitedResponse(retryAfterSeconds: number): Response {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return Response.json(
    {
      code: "RATE_LIMITED",
      error: `Muitas tentativas. Tente novamente em ${minutes} ${minutes === 1 ? "minuto" : "minutos"}.`,
      retryAfterSeconds,
    },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}
