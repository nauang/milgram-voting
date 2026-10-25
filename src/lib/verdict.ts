import type { Verdict } from "@/types/domain";

/**
 * Regra de veredito (PROMPT §2). Pura: sem banco e sem relógio, por isso testável.
 * Zero votos e empate viram "lost": sem maioria não há veredito (decisão D5).
 */
export function calculateVerdict(forgiveCount: number, notForgiveCount: number): Verdict {
  if (forgiveCount + notForgiveCount === 0) {
    return "lost";
  }
  if (forgiveCount > notForgiveCount) {
    return "not_guilty";
  }
  if (notForgiveCount > forgiveCount) {
    return "guilty";
  }
  return "lost";
}
