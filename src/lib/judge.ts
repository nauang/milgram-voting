import { cache } from "react";
import { prisma } from "@/lib/db";
import { getPrisonerImage } from "@/lib/prisoner-image";
import { calculatePrisonerState } from "@/lib/prisoner-state";
import { getCurrentSeason } from "@/lib/season";
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
 * Prisioneiros em que ESTE visitante já votou nas últimas 24h (decisão D4: o servidor é a
 * fonte da verdade). Sem a API de voto ainda não existe voterKey, então a lista é vazia.
 * A versão real (cookie + IP + janela de 24h) entra junto com o POST /api/vote.
 */
async function getVotedPrisonerIds(): Promise<ReadonlySet<number>> {
  return new Set<number>();
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
