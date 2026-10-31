import { TOTAL_SEASONS } from "@/lib/constants";

export interface SeasonSummary {
  number: number;
  status: string;
}

export interface SeasonControls {
  /** Temporada que pode ser iniciada agora (nenhuma em votação e a anterior encerrada). */
  startableSeason: number | null;
  /** Temporada em votação que pode ser encerrada; canStartNext = existe a próxima e está idle. */
  closableSeason: { number: number; canStartNext: boolean } | null;
  isFinished: boolean;
}

/**
 * O que o painel admin deve oferecer. Espelha as regras do servidor
 * (ANOTHER_SEASON_VOTING, PREVIOUS_NOT_CLOSED, NEXT_SEASON_UNAVAILABLE): nunca mostrar
 * um botão cujo clique o servidor vai recusar.
 */
export function getSeasonControls(
  seasons: readonly SeasonSummary[],
  totalSeasons: number = TOTAL_SEASONS,
): SeasonControls {
  const sorted = [...seasons].sort((a, b) => a.number - b.number);
  const byNumber = (number: number) => sorted.find((season) => season.number === number);

  const voting = sorted.find((season) => season.status === "voting");
  if (voting) {
    return {
      startableSeason: null,
      closableSeason: {
        number: voting.number,
        canStartNext:
          voting.number < totalSeasons && byNumber(voting.number + 1)?.status === "idle",
      },
      isFinished: false,
    };
  }

  if (byNumber(totalSeasons)?.status === "closed") {
    return { startableSeason: null, closableSeason: null, isFinished: true };
  }

  const nextIdle = sorted.find((season) => season.status === "idle");
  const isPreviousClosed =
    nextIdle !== undefined &&
    (nextIdle.number === 1 || byNumber(nextIdle.number - 1)?.status === "closed");

  return {
    startableSeason: nextIdle && isPreviousClosed ? nextIdle.number : null,
    closableSeason: null,
    isFinished: false,
  };
}
