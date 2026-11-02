import { describe, expect, it } from "vitest";
import { calculateVerdict } from "@/lib/verdict";

describe("calculateVerdict", () => {
  it.each([
    [5, 3, "not_guilty"],
    [1, 0, "not_guilty"],
    [3, 5, "guilty"],
    [0, 1, "guilty"],
    [4, 4, "not_guilty"],
    [1, 1, "not_guilty"],
    [0, 0, "not_guilty"],
  ] as const)("(%i perdoar, %i não perdoar) → %s", (forgive, notForgive, expected) => {
    expect(calculateVerdict(forgive, notForgive)).toBe(expected);
  });
});