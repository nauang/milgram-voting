import { z } from "zod";

// Domínios dos campos String do Prisma (er.md §4). O banco não impede valor inválido,
// então toda leitura/escrita passa por estes schemas.
export const SEASON_STATUSES = ["idle", "voting", "closed"] as const;
export const VOTE_CHOICES = ["forgive", "not_forgive"] as const;
export const VERDICTS = ["not_guilty", "guilty"] as const;

export const seasonStatusSchema = z.enum(SEASON_STATUSES);
export const voteChoiceSchema = z.enum(VOTE_CHOICES);
export const verdictSchema = z.enum(VERDICTS);

/** Corpo do POST /api/vote. O seasonId é decidido no servidor (decisão F2). */
export const voteBodySchema = z.object({
  // max = limite do INT do Postgres; acima disso o banco lança erro (500 em vez de 404)
  prisonerId: z.number().int().positive().max(2_147_483_647),
  choice: voteChoiceSchema,
});

export type SeasonStatus = z.infer<typeof seasonStatusSchema>;
export type VoteChoice = z.infer<typeof voteChoiceSchema>;
export type Verdict = z.infer<typeof verdictSchema>;
export type VoteBody = z.infer<typeof voteBodySchema>;

/** Estado visual de um card (wireframe-judge.md §6). */
export type PrisonerState = "idle" | "voting" | "voted" | Verdict;

export interface JudgeSeason {
  number: number;
  status: SeasonStatus;
  startsAt: Date | null;
  endsAt: Date | null;
}

/** Dados que o card precisa; já com imagem e estado resolvidos no servidor. */
export interface JudgePrisoner {
  id: number;
  number: number;
  slug: string;
  nickname: string;
  fullName: string;
  imageUrl: string | null;
  state: PrisonerState;
}