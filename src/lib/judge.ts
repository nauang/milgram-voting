import { createHash } from "node:crypto";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { getPrisonerImage } from "@/lib/prisoner-image";
import { calculatePrisonerState } from "@/lib/prisoner-state";
import { getCurrentSeason } from "@/lib/season";
import { getVisitorCookie } from "@/lib/voter";
import {
  seasonStatusSchema,
  verdictSchema,
  type JudgePrisoner,
  type JudgeSeason,
} from "@/types/domain";

export interface JudgeData {
  season: JudgeSeason;
  prisoners: JudgePrisoner[];
}

/**
 * Prisioneiros em que ESTE visitante já votou nas últimas 24h.
 * Lê o cookie do visitante, calcula o voterKey e consulta o banco.
 */
async function getVotedPrisonerIds(): Promise<ReadonlySet<number>> {
  const cookieId = await getVisitorCookie();
  if (!cookieId) {
    return new Set<number>();
  }

  const voterKey = createHash("sha256")
    .update(`${cookieId}:${process.env.VOTER_SALT ?? "dev-salt-change-me"}`)
    .digest("hex");

  const limit24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentVotes = await prisma.vote.findMany({
    where: {
      voterKey,
      createdAt: { gte: limit24h },
    },
    select: { prisonerId: true },
  });

  return new Set(recentVotes.map((v) => v.prisonerId));
}

/**
 * Tudo que /judge precisa. O `cache` do React evita consultar o banco duas vezes
 * na mesma requisição (generateMetadata + página).
 */
export const getJudgeData = cache(async (): Promise<JudgeData> => {
  const currentSeason = await getCurrentSeason();
  const seasonStatus = seasonStatusSchema.parse(currentSeason.status);
  const votedPrisonerIds = await getVotedPrisonerIds();

  const rows = await prisma.prisoner.findMany({
    orderBy: { number: "asc" },
    include: {
      images: true,
      // Só o veredito da temporada exibida (existe apenas se ela já foi encerrada)
      results: { where: { seasonId: currentSeason.id } },
    },
  });

  const prisoners = rows.map((row): JudgePrisoner => {
    const parsedVerdict = verdictSchema.safeParse(row.results[0]?.verdict);
    const image = getPrisonerImage(row.images, currentSeason.number);

    return {
      id: row.id,
      number: row.number,
      slug: row.slug,
      nickname: row.nickname,
      fullName: row.fullName,
      imageUrl: image?.url ?? null,
      state: calculatePrisonerState({
        seasonStatus,
        verdict: parsedVerdict.success ? parsedVerdict.data : undefined,
        hasVoted: votedPrisonerIds.has(row.id),
      }),
    };
  });

  return {
    season: {
      number: currentSeason.number,
      status: seasonStatus,
      startsAt: currentSeason.startsAt,
      endsAt: currentSeason.endsAt,
    },
    prisoners,
  };
});
