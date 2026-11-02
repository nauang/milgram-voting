import type { PrisonerState, SeasonStatus, Verdict } from "@/types/domain";

interface PrisonerStateInput {
  seasonStatus: SeasonStatus;
  /** Veredito gravado em Result; só existe depois que a temporada fecha. */
  verdict?: Verdict;
  /** Calculado no servidor (cookie + IP + 24h). O cliente nunca decide isso. */
  hasVoted: boolean;
}

/**
 * Estado visual do card. Precedência: temporada encerrada > voted > voting > idle.
 */
export function calculatePrisonerState({
  seasonStatus,
  verdict,
  hasVoted,
}: PrisonerStateInput): PrisonerState {
  if (seasonStatus === "closed") {
    // Temporada encerrada sempre tem Result para os 10. Se faltar, "not_guilty" mantém
    // a UI de pé (o encerramento falha alto com DATA_INCONSISTENT antes de chegar aqui,
    // decisão E5).
    return verdict ?? "not_guilty";
  }
  if (seasonStatus === "idle") {
    return "idle";
  }
  return hasVoted ? "voted" : "voting";
}