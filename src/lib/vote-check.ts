import { VOTE_WINDOW_MS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { getVisitorCookie } from "@/lib/voter";
import { buildVoterKey } from "@/lib/voter-key";

/**
 * Verifica se o visitante atual votou neste prisioneiro nas últimas 24h.
 * Mantido fora de componentes React para não violar react-hooks/purity
 * (Date.now() é uma função impura).
 */
export async function hasVotedForPrisoner(prisonerId: number): Promise<boolean> {
  const cookieId = await getVisitorCookie();
  if (!cookieId) {
    return false;
  }

  const vote = await prisma.vote.findFirst({
    where: {
      voterKey: buildVoterKey(cookieId),
      prisonerId,
      createdAt: { gte: new Date(Date.now() - VOTE_WINDOW_MS) },
    },
    select: { id: true },
  });

  return vote !== null;
}
