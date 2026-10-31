import { describe, expect, it } from "vitest";
import { voteBodySchema } from "@/types/domain";

describe("voteBodySchema", () => {
  it("aceita um voto válido", () => {
    expect(voteBodySchema.safeParse({ prisonerId: 3, choice: "forgive" }).success).toBe(true);
    expect(voteBodySchema.safeParse({ prisonerId: 10, choice: "not_forgive" }).success).toBe(true);
  });

  it.each([
    ["choice inválida", { prisonerId: 1, choice: "talvez" }],
    ["prisonerId zero", { prisonerId: 0, choice: "forgive" }],
    ["prisonerId negativo", { prisonerId: -1, choice: "forgive" }],
    ["prisonerId decimal", { prisonerId: 1.5, choice: "forgive" }],
    ["prisonerId como texto", { prisonerId: "1", choice: "forgive" }],
    ["prisonerId acima do INT do Postgres", { prisonerId: 2_147_483_648, choice: "forgive" }],
    ["sem choice", { prisonerId: 1 }],
    ["corpo nulo", null],
  ])("rejeita %s", (_label, body) => {
    expect(voteBodySchema.safeParse(body).success).toBe(false);
  });
});
