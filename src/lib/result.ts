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
  return {
    ...input,
    total,
    forgivePercent: Math.round((input.forgiveCount / total) * 100),
    notForgivePercent: Math.round((input.notForgiveCount / total) * 100),
  };
}
