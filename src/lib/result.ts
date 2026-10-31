import type { Verdict } from "@/types/domain";

export interface ResultInput {
  forgiveCount: number;
  notForgiveCount: number;
  verdict: Verdict;
}

export interface ResultStats extends ResultInput {
  total: number;
  forgivePercent: number;
  notForgivePercent: number;
}

/** Calcula totais e porcentagens. Nunca divide por zero. */
export function calculateResultStats(input: ResultInput): ResultStats {
  const total = input.forgiveCount + input.notForgiveCount;
  if (total === 0) {
    return {
      ...input,
      total: 0,
      forgivePercent: 0,
      notForgivePercent: 0,
    };
  }
  const forgivePercent = Math.round((input.forgiveCount / total) * 100);
  return {
    ...input,
    total,
    forgivePercent,
    // Complemento, e não um segundo Math.round: arredondar os dois lados separadamente
    // soma 101% quando a fração termina em ,5 (ex.: 1 voto contra 7 = 12,5% / 87,5%)
    notForgivePercent: 100 - forgivePercent,
  };
}
