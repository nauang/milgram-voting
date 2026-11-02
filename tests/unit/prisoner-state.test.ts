import { describe, expect, it } from "vitest";
import { calculatePrisonerState } from "@/lib/prisoner-state";

describe("calculatePrisonerState", () => {
  it("retorna idle quando temporada está idle", () => {
    expect(calculatePrisonerState({ seasonStatus: "idle", hasVoted: false })).toBe("idle");
  });

  it("retorna verdict quando temporada está closed", () => {
    expect(
      calculatePrisonerState({
        seasonStatus: "closed",
        verdict: "guilty",
        hasVoted: false,
      }),
    ).toBe("guilty");
  });

  it("retorna not_guilty se closed sem verdict", () => {
    expect(calculatePrisonerState({ seasonStatus: "closed", hasVoted: false })).toBe(
      "not_guilty",
    );
  });

  it("retorna voted quando já votou", () => {
    expect(calculatePrisonerState({ seasonStatus: "voting", hasVoted: true })).toBe("voted");
  });

  it("retorna voting quando pode votar", () => {
    expect(calculatePrisonerState({ seasonStatus: "voting", hasVoted: false })).toBe("voting");
  });
});