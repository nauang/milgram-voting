import { describe, expect, it } from "vitest";
import { calculateResultStats } from "@/lib/result";

const stats = (forgiveCount: number, notForgiveCount: number) =>
  calculateResultStats({ forgiveCount, notForgiveCount, verdict: "lost" });

describe("calculateResultStats", () => {
  it("zero votos: tudo zero, sem NaN nem divisão por zero", () => {
    expect(stats(0, 0)).toEqual({
      forgiveCount: 0,
      notForgiveCount: 0,
      verdict: "lost",
      total: 0,
      forgivePercent: 0,
      notForgivePercent: 0,
    });
  });

  it.each([
    [1, 1, 50, 50],
    [3, 1, 75, 25],
    [5, 0, 100, 0],
    [0, 5, 0, 100],
    [2, 1, 67, 33],
  ])("(%i x %i) → %i%% / %i%%", (forgive, notForgive, forgivePercent, notForgivePercent) => {
    const result = stats(forgive, notForgive);
    expect(result.forgivePercent).toBe(forgivePercent);
    expect(result.notForgivePercent).toBe(notForgivePercent);
  });

  it("1 x 7 (12,5%) NÃO soma 101%: 13% / 87%", () => {
    const result = stats(1, 7);
    expect(result.forgivePercent).toBe(13);
    expect(result.notForgivePercent).toBe(87);
  });

  it("as porcentagens somam exatamente 100 para qualquer combinação de 1 a 200 votos", () => {
    for (let total = 1; total <= 200; total++) {
      for (let forgive = 0; forgive <= total; forgive++) {
        const result = stats(forgive, total - forgive);
        expect(
          result.forgivePercent + result.notForgivePercent,
          `${forgive} x ${total - forgive}`,
        ).toBe(100);
      }
    }
  });

  it("preserva as contagens e o veredito recebidos e informa o total", () => {
    const result = calculateResultStats({ forgiveCount: 4, notForgiveCount: 6, verdict: "guilty" });
    expect(result).toMatchObject({
      forgiveCount: 4,
      notForgiveCount: 6,
      verdict: "guilty",
      total: 10,
    });
  });

  it("nunca devolve NaN, Infinity ou valor negativo", () => {
    for (const [forgive, notForgive] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [7, 9],
    ] as const) {
      const { forgivePercent, notForgivePercent } = stats(forgive, notForgive);
      for (const value of [forgivePercent, notForgivePercent]) {
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
