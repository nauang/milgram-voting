export interface SeasonImage {
  season: number;
  url: string;
}

/**
 * Imagem do prisioneiro para a temporada atual (PROMPT §5).
 * Fallback: se faltar a da temporada, usa a mais recente que não passe dela;
 * se ainda assim não houver, a de maior número disponível.
 */
export function getPrisonerImage<T extends SeasonImage>(
  images: readonly T[],
  seasonNumber: number,
): T | undefined {
  const exact = images.find((image) => image.season === seasonNumber);
  if (exact) {
    return exact;
  }
  const newestFirst = [...images].sort((a, b) => b.season - a.season);
  return newestFirst.find((image) => image.season <= seasonNumber) ?? newestFirst[0];
}
