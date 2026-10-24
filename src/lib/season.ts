import { prisma } from "@/lib/db";

export interface SeasonRow {
  id: number;
  number: number;
  status: string;
  startsAt: Date | null;
  endsAt: Date | null;
}

/**
 * Temporada "atual": define qual imagem cada prisioneiro mostra (PROMPT §5).
 * 1) a que está em votação; 2) senão a última encerrada (pausa ou fim); 3) senão a 1ª.
 */
export async function getCurrentSeason(): Promise<SeasonRow> {
  const voting = await prisma.season.findFirst({ where: { status: "voting" } });
  if (voting) {
    return voting;
  }

  const lastClosed = await prisma.season.findFirst({
    where: { status: "closed" },
    orderBy: { number: "desc" },
  });
  if (lastClosed) {
    return lastClosed;
  }

  return prisma.season.findUniqueOrThrow({ where: { number: 1 } });
}
