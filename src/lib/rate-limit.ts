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
  // Anti-fraude: o cookie sozinho não segura quem simplesmente o descarta.
  // 3 (e não 1) porque IPs compartilhados (CGNAT, faculdade) são comuns no Brasil.
  votePerPrisoner: { name: "vote-per-prisoner", max: 3, windowSeconds: 24 * 60 * 60 },
} as const satisfies Record<string, LimiterConfig>;

export type RateLimitScope = keyof typeof RATE_LIMITS;

// Se o Redis não responder nesse tempo, o Upstash libera a requisição (fail-open).
const UPSTASH_TIMEOUT_MS = 1500;
const MEMORY_LIMITER_MAX_KEYS = 10_000;

function createUpstashLimiter(redis: Redis, config: LimiterConfig): RateLimiter {
  const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(config.max, `${config.windowSeconds} s`),
    prefix: `milgram:rl:${config.name}`,
    timeout: UPSTASH_TIMEOUT_MS,
  });

  return {
    async limit(identifier) {
      const { success, reset } = await ratelimit.limit(identifier);
      // `reset` vem em milissegundos; o header Retry-After é em segundos.
      return {
        allowed: success,
        retryAfterSeconds: success ? 0 : Math.max(1, Math.ceil((reset - Date.now()) / 1000)),
      };
    },
  };
}

/**
 * Fallback SOMENTE para dev, testes e preview. Em produção ele não funciona
 * (cada instância teria o seu contador), por isso getLimiter() o recusa lá.
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
        hitsByIdentifier.clear(); // evita crescimento sem limite em dev
      }
      recentHits.push(currentTime);
      hitsByIdentifier.set(identifier, recentHits);
      return { allowed: true, retryAfterSeconds: 0 };
    },
  };
}

function hasUpstashEnv(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
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
  } else if (process.env.VERCEL_ENV === "production") {
    // Falhar ALTO: um limite que parece existir mas não funciona é pior que nenhum.
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
 * Executa o limiter com fail-open: se o Redis cair, a votação continua e a regra
 * de 24h do banco segue valendo. O erro fica no log para investigação.
 */
export async function runLimiter(
  limiter: RateLimiter,
  identifier: string,
): Promise<RateLimitResult> {
  try {
    return await limiter.limit(identifier);
  } catch (error) {
    console.error("Rate limit indisponível; requisição liberada (fail-open).", error);
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

export async function checkRateLimit(
  scope: RateLimitScope,
  identifier: string,
): Promise<RateLimitResult> {
  // getLimiter fica FORA do try de propósito: configuração errada em produção
  // precisa estourar (500), não ser silenciada pelo fail-open.
  return runLimiter(getLimiter(RATE_LIMITS[scope]), identifier);
}

/** IP do visitante. Na Vercel, x-real-ip e x-forwarded-for são definidos pela plataforma. */
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
