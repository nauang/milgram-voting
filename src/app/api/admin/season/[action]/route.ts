import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { TOTAL_SEASONS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { calculateVerdict } from "@/lib/verdict";
import { crossOriginResponse, isSameOriginRequest } from "@/lib/csrf";

const EXPECTED_PRISONER_COUNT = 10;

const SEASON_TRANSITION_LOCK_KEY = 710_001;

const RESET_CONFIRMATION_PHRASE = "RESETAR TEMPORADAS";

const seasonActionSchema = z.enum(["init", "closeVoting", "reset"]);

const seasonBodySchema = z.object({
  confirm: z.literal(true),
  number: z.number().int().min(1).max(TOTAL_SEASONS),
  startNext: z.boolean().default(true),
});

const resetBodySchema = z.object({
  confirm: z.literal(true),
  confirmation: z.literal(RESET_CONFIRMATION_PHRASE),
});

type SeasonRuleCode =
  | "ANOTHER_SEASON_VOTING"
  | "PREVIOUS_NOT_CLOSED"
  | "SEASON_NOT_IDLE"
  | "SEASON_NOT_VOTING"
  | "NEXT_SEASON_UNAVAILABLE"
  | "DATA_INCONSISTENT"
  | "SEASONS_INCOMPLETE";

const RULE_RESPONSES: Record<
  SeasonRuleCode,
  {
    status: number;
    message: string;
  }
> = {
  ANOTHER_SEASON_VOTING: {
    status: 409,
    message: "Já existe uma temporada em votação",
  },
  PREVIOUS_NOT_CLOSED: {
    status: 409,
    message: "A temporada anterior ainda não foi encerrada",
  },
  SEASON_NOT_IDLE: {
    status: 409,
    message: "Temporada não está idle",
  },
  SEASON_NOT_VOTING: {
    status: 409,
    message: "Temporada não está em votação",
  },
  NEXT_SEASON_UNAVAILABLE: {
    status: 409,
    message: "A próxima temporada não está disponível para iniciar",
  },
  DATA_INCONSISTENT: {
    status: 500,
    message: "Dados inconsistentes: é esperado exatamente 10 prisioneiros",
  },
  SEASONS_INCOMPLETE: {
    status: 409,
    message: "Não foi possível resetar: as temporadas cadastradas estão incompletas",
  },
};

class SeasonRuleError extends Error {
  readonly code: SeasonRuleCode;

  constructor(code: SeasonRuleCode) {
    super(code);
    this.code = code;
  }
}

interface RouteContext {
  params: Promise<{
    action: string;
  }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  // 1. Validar a origem da requisição.
  if (!isSameOriginRequest(request)) {
    return crossOriginResponse();
  }

  // 2. Exigir uma sessão autenticada.
  const session = await auth();

  if (!session) {
    return NextResponse.json(
      {
        error: "Não autorizado",
      },
      {
        status: 401,
      },
    );
  }

  // 3. Validar a ação solicitada.
  const { action: rawAction } = await context.params;

  const action = seasonActionSchema.safeParse(rawAction);

  if (!action.success) {
    return NextResponse.json(
      {
        code: "UNKNOWN_ACTION",
        error: "Ação desconhecida",
      },
      {
        status: 400,
      },
    );
  }

  // 4. Ler o corpo da requisição.
  const rawBody: unknown = await request.json().catch(() => null);

  try {
    let payload;

    if (action.data === "reset") {
      const body = resetBodySchema.safeParse(rawBody);

      if (!body.success) {
        const paths = body.error.issues.map((issue) => issue.path[0]);

        /**
         * CORREÇÃO:
         *
         * Quando o JSON é null, um valor
         * primitivo ou um array, o Zod
         * retorna um erro na raiz (path: []).
         *
         * Nesses casos, a confirmação
         * obrigatória está ausente.
         *
         * Também retornamos esse erro quando
         * o campo confirm está ausente ou
         * possui um valor diferente de true.
         */
        const invalidBodyStructure =
          rawBody === null || typeof rawBody !== "object" || Array.isArray(rawBody);

        if (invalidBodyStructure || paths.includes("confirm")) {
          return NextResponse.json(
            {
              code: "CONFIRMATION_REQUIRED",
              error: "É necessário confirmar o reset das temporadas",
            },
            {
              status: 400,
            },
          );
        }

        // O corpo possui uma estrutura válida,
        // mas a frase de confirmação está
        // ausente ou incorreta.
        return NextResponse.json(
          {
            code: "INVALID_RESET_CONFIRMATION",
            error: "Digite RESETAR TEMPORADAS para confirmar a operação",
          },
          {
            status: 400,
          },
        );
      }

      payload = await resetAllSeasons();
    } else {
      // Preservar o comportamento original
      // das ações init e closeVoting.
      const body = seasonBodySchema.safeParse(rawBody);

      if (!body.success) {
        const paths = body.error.issues.map((issue) => issue.path[0]);

        if (paths.includes("confirm")) {
          return NextResponse.json(
            {
              code: "CONFIRMATION_REQUIRED",
              error: "Confirmação obrigatória",
            },
            {
              status: 400,
            },
          );
        }

        if (paths.includes("number")) {
          return NextResponse.json(
            {
              code: "INVALID_SEASON",
              error: "Temporada inválida",
            },
            {
              status: 400,
            },
          );
        }

        return NextResponse.json(
          {
            code: "INVALID_BODY",
            error: "Corpo inválido",
          },
          {
            status: 400,
          },
        );
      }

      payload =
        action.data === "init"
          ? await initSeason(body.data.number)
          : await closeVoting(body.data.number, body.data.startNext);
    }

    // Invalidar o cache após o commit.
    revalidatePath("/", "layout");

    return NextResponse.json({
      ok: true,
      ...payload,
    });
  } catch (error) {
    if (error instanceof SeasonRuleError) {
      const { status, message } = RULE_RESPONSES[error.code];

      return NextResponse.json(
        {
          code: error.code,
          error: message,
        },
        {
          status,
        },
      );
    }

    console.error(`Erro em /api/admin/season/${action.data}:`, error);

    return NextResponse.json(
      {
        code: "INTERNAL",
        error: "Erro interno",
      },
      {
        status: 500,
      },
    );
  }
}

/**
 * Iniciar uma temporada.
 */
async function initSeason(number: number) {
  const season = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(
          ${SEASON_TRANSITION_LOCK_KEY}::bigint
        )
      `;

      const voting = await tx.season.findFirst({
        where: {
          status: "voting",
        },
        select: {
          id: true,
        },
      });

      if (voting) {
        throw new SeasonRuleError("ANOTHER_SEASON_VOTING");
      }

      if (number > 1) {
        const previous = await tx.season.findUnique({
          where: {
            number: number - 1,
          },
          select: {
            status: true,
          },
        });

        if (previous?.status !== "closed") {
          throw new SeasonRuleError("PREVIOUS_NOT_CLOSED");
        }
      }

      const started = await tx.season.updateMany({
        where: {
          number,
          status: "idle",
        },
        data: {
          status: "voting",
          startsAt: new Date(),
        },
      });

      if (started.count === 0) {
        throw new SeasonRuleError("SEASON_NOT_IDLE");
      }

      return tx.season.findUniqueOrThrow({
        where: {
          number,
        },
      });
    },
    {
      maxWait: 5_000,
      timeout: 10_000,
    },
  );

  return {
    season,
  };
}

/**
 * Encerrar uma temporada e calcular resultados.
 */
async function closeVoting(number: number, startNext: boolean) {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(
          ${SEASON_TRANSITION_LOCK_KEY}::bigint
        )
      `;

      // 1. Encerrar somente uma temporada
      // que ainda está em votação.
      const closed = await tx.season.updateMany({
        where: {
          number,
          status: "voting",
        },
        data: {
          status: "closed",
          endsAt: new Date(),
        },
      });

      if (closed.count === 0) {
        throw new SeasonRuleError("SEASON_NOT_VOTING");
      }

      const season = await tx.season.findUniqueOrThrow({
        where: {
          number,
        },
      });

      // 2. Verificar os dez prisioneiros.
      const prisoners = await tx.prisoner.findMany({
        select: {
          id: true,
        },
      });

      if (prisoners.length !== EXPECTED_PRISONER_COUNT) {
        throw new SeasonRuleError("DATA_INCONSISTENT");
      }

      // 3. Agrupar os votos.
      const grouped = await tx.vote.groupBy({
        by: ["prisonerId", "choice"],
        where: {
          seasonId: season.id,
        },
        _count: true,
      });

      const counts = new Map<
        number,
        {
          forgive: number;
          notForgive: number;
        }
      >();

      for (const row of grouped) {
        const current = counts.get(row.prisonerId) ?? {
          forgive: 0,
          notForgive: 0,
        };

        if (row.choice === "forgive") {
          current.forgive = row._count;
        } else if (row.choice === "not_forgive") {
          current.notForgive = row._count;
        }

        counts.set(row.prisonerId, current);
      }

      // 4. Registrar os resultados dos
      // dez prisioneiros.
      const results = prisoners.map((prisoner) => {
        const current = counts.get(prisoner.id) ?? {
          forgive: 0,
          notForgive: 0,
        };

        return {
          prisonerId: prisoner.id,
          seasonId: season.id,
          forgiveCount: current.forgive,
          notForgiveCount: current.notForgive,
          verdict: calculateVerdict(current.forgive, current.notForgive),
        };
      });

      await tx.result.createMany({
        data: results,
      });

      // 5. Iniciar a temporada seguinte
      // na mesma transação, se solicitado.
      let next: number | null = null;

      if (startNext && season.number < TOTAL_SEASONS) {
        const started = await tx.season.updateMany({
          where: {
            number: season.number + 1,
            status: "idle",
          },
          data: {
            status: "voting",
            startsAt: new Date(),
          },
        });

        if (started.count === 0) {
          throw new SeasonRuleError("NEXT_SEASON_UNAVAILABLE");
        }

        next = season.number + 1;
      }

      return {
        closed: season.number,
        next,
        results,
      };
    },
    {
      maxWait: 5_000,
      timeout: 10_000,
    },
  );
}

/**
 * Reset completo de todas as temporadas.
 *
 * As operações acontecem dentro de uma
 * única transação do PostgreSQL.
 *
 * Preserva integralmente:
 * - Prisoner;
 * - Image;
 * - Arquivos do Supabase Storage.
 */
async function resetAllSeasons() {
  return prisma.$transaction(
    async (tx) => {
      // 1. Serializar com outras
      // transições administrativas.
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(
          ${SEASON_TRANSITION_LOCK_KEY}::bigint
        )
      `;

      // 2. Conferir as temporadas.
      const seasons = await tx.season.findMany({
        select: {
          number: true,
        },
        orderBy: {
          number: "asc",
        },
      });

      const hasAllSeasons =
        seasons.length === TOTAL_SEASONS &&
        seasons.every((season, index) => season.number === index + 1);

      if (!hasAllSeasons) {
        throw new SeasonRuleError("SEASONS_INCOMPLETE");
      }

      // 3. Bloquear as linhas de temporada
      // e restaurar o estado inicial.
      const updatedSeasons = await tx.season.updateMany({
        data: {
          status: "idle",
          startsAt: null,
          endsAt: null,
        },
      });

      // 4. Excluir todos os resultados.
      const deletedResults = await tx.result.deleteMany({});

      // 5. Excluir todos os votos.
      const deletedVotes = await tx.vote.deleteMany({});

      return {
        reset: true,
        currentSeason: 1,
        seasonsReset: updatedSeasons.count,
        votesDeleted: deletedVotes.count,
        resultsDeleted: deletedResults.count,
      };
    },
    {
      maxWait: 5_000,
      timeout: 15_000,
    },
  );
}
