import { describe, expect, it } from "vitest";
import { RATE_LIMITS } from "@/lib/rate-limit";

describe("limites do PROMPT §8.1", () => {
  it("voto: 10 tentativas por IP por hora", () => {
    expect(RATE_LIMITS.voteAttempts).toMatchObject({ max: 10, windowSeconds: 60 * 60 });
  });

  it("login do admin: 5 tentativas por IP a cada 15 minutos", () => {
    expect(RATE_LIMITS.adminLogin).toMatchObject({ max: 5, windowSeconds: 15 * 60 });
  });
});
