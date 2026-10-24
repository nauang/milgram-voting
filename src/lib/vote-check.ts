import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { getVisitorCookie } from "@/lib/voter";

/**
 * Verifica se o visitante atual votou neste prisioneiro nas últimas 24h.
 * Mantido fora de componentes React para não violar react-hooks/purity
 * (Date.now() é uma função impura).
 */
export async function hasVotedForPrisoner(prisonerId: number): Promise<boolean> {
  const cookieId = await getVisitorCookie();
  if (!cookieId) return false;

  const voterKey = createHash("sha256")
    .update(`${cookieId}:${process.env.VOTER_SALT ?? "dev-salt-change-me"}`)
    .digest("hex");

  const limit24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const vote = await prisma.vote.findFirst({
    where: {
      voterKey,
      prisonerId,
      createdAt: { gte: limit24h },
    },
    select: { id: true },
  });

  return vote !== null;
}
