import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createMemoryLimiter,
  getClientIp,
  hashIdentifier,
  runLimiter,
  type RateLimiter,
} from "@/lib/rate-limit";

const CONFIG = { name: "test", max: 3, windowSeconds: 60 };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock("@upstash/ratelimit");
  vi.doUnmock("@upstash/redis");
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("createMemoryLimiter", () => {
  it("bloqueia a tentativa seguinte ao limite e informa o Retry-After", async () => {
    let now = 1_000_000;
    const limiter = createMemoryLimiter(CONFIG, () => now);

    for (let attempt = 0; attempt < 3; attempt++) {
      expect((await limiter.limit("ip-a")).allowed).toBe(true);
      now += 1_000;
    }

    const blocked = await limiter.limit("ip-a");
    expect(blocked.allowed).toBe(false);
    // A tentativa mais antiga expira em t=1_060_000; agora é t=1_003_000.
    expect(blocked.retryAfterSeconds).toBe(57);
  });

  it("libera uma tentativa quando a mais antiga sai da janela", async () => {
    let now = 1_000_000;
    const limiter = createMemoryLimiter(CONFIG, () => now);

    for (let attempt = 0; attempt < 3; attempt++) {
      await limiter.limit("ip-a");
      now += 1_000;
    }

    expect((await limiter.limit("ip-a")).allowed).toBe(false);

    now += 57_000;
    expect((await limiter.limit("ip-a")).allowed).toBe(true);
    expect((await limiter.limit("ip-a")).allowed).toBe(false);
  });

  it("mantém contadores independentes por identificador", async () => {
    const limiter = createMemoryLimiter(CONFIG, () => 1_000_000);

    for (let attempt = 0; attempt < 3; attempt++) {
      await limiter.limit("ip-a");
    }

    expect((await limiter.limit("ip-a")).allowed).toBe(false);
    expect((await limiter.limit("ip-b")).allowed).toBe(true);
  });
});

describe("runLimiter: políticas explícitas de falha", () => {
  it("mantém o modo permissivo apenas quando ele é selecionado", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const brokenLimiter: RateLimiter = {
      limit: () => Promise.reject(new Error("redis fora do ar")),
    };

    const result = await runLimiter(brokenLimiter, "ip-a", "allow");
    expect(result).toEqual({ allowed: true, retryAfterSeconds: 0 });
  });

  it("propaga uma falha no modo seguro utilizado pela aplicação", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const brokenLimiter: RateLimiter = {
      limit: () => Promise.reject(new Error("redis fora do ar")),
    };

    await expect(runLimiter(brokenLimiter, "ip-a", "throw")).rejects.toThrow(
      "Limitador de requisições temporariamente indisponível.",
    );
  });
});

describe("hashIdentifier", () => {
  it("é determinístico e não contém o IP puro", () => {
    vi.stubEnv("VOTER_SALT", "sal-de-teste");
    const first = hashIdentifier("203.0.113.9");
    const second = hashIdentifier("203.0.113.9");

    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(first).not.toContain("203.0.113.9");
  });

  it("muda quando o salt muda", () => {
    vi.stubEnv("VOTER_SALT", "sal-a");
    const hashA = hashIdentifier("203.0.113.9");
    vi.stubEnv("VOTER_SALT", "sal-b");
    expect(hashIdentifier("203.0.113.9")).not.toBe(hashA);
  });

  it("falha sem VOTER_SALT", () => {
    vi.stubEnv("VOTER_SALT", "");
    expect(() => hashIdentifier("203.0.113.9")).toThrow(/VOTER_SALT/);
  });
});

describe("getClientIp", () => {
  it("prefere x-real-ip", () => {
    const headers = new Headers({
      "x-real-ip": "198.51.100.1",
      "x-forwarded-for": "10.0.0.1",
    });
    expect(getClientIp(headers)).toBe("198.51.100.1");
  });

  it("usa o primeiro valor de x-forwarded-for", () => {
    const headers = new Headers({
      "x-forwarded-for": "198.51.100.2, 10.0.0.1",
    });
    expect(getClientIp(headers)).toBe("198.51.100.2");
  });

  it("devolve 'unknown' sem cabeçalhos", () => {
    expect(getClientIp(new Headers())).toBe("unknown");
  });
});

describe("checkRateLimit: configuração", () => {
  it("recusa produção na Vercel sem Upstash configurado", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.resetModules();

    const { checkRateLimit } = await import("@/lib/rate-limit");
    await expect(checkRateLimit("voteAttempts", "x")).rejects.toThrow(/Upstash/);
  });

  it("recusa produção fora da Vercel sem Upstash configurado", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.resetModules();

    const { checkRateLimit } = await import("@/lib/rate-limit");
    await expect(checkRateLimit("adminLogin", "x")).rejects.toThrow(/Upstash/);
  });

  it("usa o limitador em memória fora de produção", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.resetModules();

    const { checkRateLimit } = await import("@/lib/rate-limit");
    expect((await checkRateLimit("voteAttempts", "x")).allowed).toBe(true);
  });
});

type UpstashResponse = {
  success: boolean;
  reset: number;
  reason?: string;
};

/**
 * Simula respostas do Upstash sem realizar chamadas externas.
 * Um novo módulo é carregado para que o cache do limiter não interfira nos testes.
 */
async function createMockedUpstashLimit(outcome: UpstashResponse | Error) {
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token-falso-para-testes");

  vi.doMock("@upstash/redis", () => ({
    Redis: {
      fromEnv: vi.fn(() => ({})),
    },
  }));

  vi.doMock("@upstash/ratelimit", () => ({
    Ratelimit: class {
      static slidingWindow() {
        return {};
      }

      async limit() {
        if (outcome instanceof Error) {
          throw outcome;
        }
        return outcome;
      }
    },
  }));

  vi.resetModules();
  const { checkRateLimit } = await import("@/lib/rate-limit");
  return checkRateLimit;
}

describe("checkRateLimit: indisponibilidade do Upstash", () => {
  it("bloqueia quando o Upstash retorna success=true com reason=timeout", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const checkRateLimit = await createMockedUpstashLimit({
      success: true,
      reset: Date.now() + 60_000,
      reason: "timeout",
    });

    await expect(checkRateLimit("voteAttempts", "ip-a")).rejects.toThrow(
      "Limitador de requisições temporariamente indisponível.",
    );
  });

  it("bloqueia quando a consulta ao Redis lança um erro de rede", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const checkRateLimit = await createMockedUpstashLimit(new Error("Falha de rede simulada"));

    await expect(checkRateLimit("adminLogin", "ip-a")).rejects.toThrow(
      "Limitador de requisições temporariamente indisponível.",
    );
  });

  it("continua permitindo requisições quando o Redis confirma success=true", async () => {
    const checkRateLimit = await createMockedUpstashLimit({
      success: true,
      reset: Date.now() + 60_000,
    });

    await expect(checkRateLimit("voteAttempts", "ip-a")).resolves.toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });
  });

  it("continua recusando requisições quando o Redis confirma o limite", async () => {
    const checkRateLimit = await createMockedUpstashLimit({
      success: false,
      reset: Date.now() + 60_000,
    });

    const result = await checkRateLimit("adminLogin", "ip-a");
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });
});
