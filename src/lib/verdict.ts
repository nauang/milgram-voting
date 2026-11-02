import type { Verdict } from "@/types/domain";

/**
 * Regra de veredito (PROMPT §2). Pura: sem banco e sem relógio, por isso testável.
 *
 * Não existe veredito de empate: se a maioria não condenou, o prisioneiro é inocente.
 * Isso cobre também empates e temporadas encerradas com zero votos (decisão D5
 * substituída: sem maioria contrária não há condenação).
 *
 * Em produção, todos votam 1× em todos os prisioneiros e o total de votantes é ímpar
 * por operação — empates por prisioneiro são impossíveis. Esta regra atua como
 * defesa em profundidade caso N par vaze por engano.
 */
export function calculateVerdict(forgiveCount: number, notForgiveCount: number): Verdict {
  if (notForgiveCount > forgiveCount) {
    return "guilty";
  }
  return "not_guilty";
}