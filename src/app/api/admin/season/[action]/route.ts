import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { TOTAL_SEASONS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { calculateVerdict } from "@/lib/verdict";

const EXPECTED_PRISONER_COUNT = 10;

/** Chave do lock que serializa TODA transição de temporada (init e encerramento). */
const SEASON_TRANSITION_LOCK_KEY = 710_001;

const seasonActionSchema = z.enum(["init", "closeVoting"]);

const seasonBodySchema = z.object({
  // Dupla confirmação também no servidor: o modal "tem certeza?" sozinho não basta
  confirm: z.literal(true),
  number: z.number().int().min(1).max(TOTAL_SEASONS),
  // false = "Encerrar e aguardar" (decisão E2). Padrão true: o painel atual segue igual.
  startNext: z.boolean().default(true),
});

type SeasonRuleCode =
  | "ANOTHER_SEASON_VOTING"
  | "PREVIOUS_NOT_CLOSED"
  | "SEASON_NOT_IDLE"
  | "SEASON_NOT_VOTING"
  | "NEXT_SEASON_UNAVAILABLE"
  | "DATA_INCONSISTENT";

const RULE_RESPONSES: Record<SeasonRuleCode, { status: number; message: string }> = {
  ANOTHER_SEASON_VOTING: { status: 409, message: "Já existe uma temporada em votação" },
  PREVIOUS_NOT_CLOSED: { status: 409, message: "A temporada anterior ainda não foi encerrada" },
  SEASON_NOT_IDLE: { status: 409, message: "Temporada não está idle" },
  SEASON_NOT_VOTING: { status: 409, message: "Temporada não está em votação" },
  NEXT_SEASON_UNAVAILABLE: {
    status: 409,
    message: "A próxima temporada não está disponível para iniciar",
  },
  DATA_INCONSISTENT: {
    status: 500,
    message: "Dados inconsistentes: é esperado exatamente 10 prisioneiros",
  },
};

/** Lançada DENTRO da transação: provoca o rollback e vira uma resposta HTTP tipada. */
class SeasonRuleError extends Error {
  readonly code: SeasonRuleCode;

  constructor(code: SeasonRuleCode) {
    super(code);
    this.code = code;
  }
}

interface RouteContext {
  params: Promise<{ action: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  // (ITEM 3) A verificação de Origin entra aqui, antes de qualquer leitura do corpo.

  const { action: rawAction } = await context.params;
  const action = seasonActionSchema.safeParse(rawAction);
  if (!action.success) {
    return NextResponse.json(
      { code: "UNKNOWN_ACTION", error: "Ação desconhecida" },
      { status: 400 },
    );
  }

  const rawBody: unknown = await request.json().catch(() => null);
  const body = seasonBodySchema.safeParse(rawBody);
  if (!body.success) {
    const paths = body.error.issues.map((issue) => issue.path[0]);
    if (paths.includes("confirm")) {
      return NextResponse.json(
        { code: "CONFIRMATION_REQUIRED", error: "Confirmação obrigatória" },
        { status: 400 },
      );
    }
    if (paths.includes("number")) {
      return NextResponse.json(
        { code: "INVALID_SEASON", error: "Temporada inválida" },
        { status: 400 },
      );
    }
    return NextResponse.json({ code: "INVALID_BODY", error: "Corpo inválido" }, { status: 400 });
  }

  try {
    const payload =
      action.data === "init"
        ? await initSeason(body.data.number)
        : await closeVoting(body.data.number, body.data.startNext);

    // Só DEPOIS do commit: invalida o cache de todas as páginas, para a troca de imagens
    // aparecer em /character, /character/[slug] e /judge/result/[n] também (PROMPT §10).
    revalidatePath("/", "layout");

    return NextResponse.json({ ok: true, ...payload });
  } catch (error) {
    if (error instanceof SeasonRuleError) {
      const { status, message } = RULE_RESPONSES[error.code];
      return NextResponse.json({ code: error.code, error: message }, { status });
    }
    console.error(`Erro em /api/admin/season/${action.data}:`, error);
    return NextResponse.json({ code: "INTERNAL", error: "Erro interno" }, { status: 500 });
  }
}

async function initSeason(number: number) {
  const season = await prisma.$transaction(
    async (tx) => {
      // Serializa as transições: sem isso, dois init simultâneos passariam juntos
      // pela checagem "nenhuma temporada em votação".
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SEASON_TRANSITION_LOCK_KEY}::bigint)`;

      const voting = await tx.season.findFirst({
        where: { status: "voting" },
        select: { id: true },
      });
      if (voting) {
        throw new SeasonRuleError("ANOTHER_SEASON_VOTING");
      }

      // Não pula etapa: a anterior precisa estar encerrada
      if (number > 1) {
        const previous = await tx.season.findUnique({
          where: { number: number - 1 },
          select: { status: true },
        });
        if (previous?.status !== "closed") {
          throw new SeasonRuleError("PREVIOUS_NOT_CLOSED");
        }
      }

      // Compare-and-set: só inicia se AINDA estiver idle
      const started = await tx.season.updateMany({
        where: { number, status: "idle" },
        data: { status: "voting", startsAt: new Date() },
      });
      if (started.count === 0) {
        throw new SeasonRuleError("SEASON_NOT_IDLE");
      }

      return tx.season.findUniqueOrThrow({ where: { number } });
    },
    { maxWait: 5_000, timeout: 10_000 },
  );

  return { season };
}

async function closeVoting(number: number, startNext: boolean) {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SEASON_TRANSITION_LOCK_KEY}::bigint)`;

      // 1. Fecha a temporada SE E SOMENTE SE ainda estiver em votação. O UPDATE trava a linha
      //    até o commit: é isso que sincroniza com o FOR SHARE da rota de voto
      //    (ver encerramento-temporada.md §5). Dois cliques: só um passa.
      const closed = await tx.season.updateMany({
        where: { number, status: "voting" },
        data: { status: "closed", endsAt: new Date() },
      });
      if (closed.count === 0) {
        throw new SeasonRuleError("SEASON_NOT_VOTING");
      }
      const season = await tx.season.findUniqueOrThrow({ where: { number } });

      // 2. Falhar alto (E5): resultado incompleto é pior que nenhum resultado
      const prisoners = await tx.prisoner.findMany({ select: { id: true } });
      if (prisoners.length !== EXPECTED_PRISONER_COUNT) {
        throw new SeasonRuleError("DATA_INCONSISTENT");
      }

      // 3. Contagem: UMA consulta agrupada
      const grouped = await tx.vote.groupBy({
        by: ["prisonerId", "choice"],
        where: { seasonId: season.id },
        _count: true,
      });
      const counts = new Map<number, { forgive: number; notForgive: number }>();
      for (const row of grouped) {
        const current = counts.get(row.prisonerId) ?? { forgive: 0, notForgive: 0 };
        if (row.choice === "forgive") {
          current.forgive = row._count;
        } else if (row.choice === "not_forgive") {
          current.notForgive = row._count;
        }
        counts.set(row.prisonerId, current);
      }

      // 4. Resultado dos 10, inclusive de quem teve zero votos
      const results = prisoners.map((prisoner) => {
        const current = counts.get(prisoner.id) ?? { forgive: 0, notForgive: 0 };
        return {
          prisonerId: prisoner.id,
          seasonId: season.id,
          forgiveCount: current.forgive,
          notForgiveCount: current.notForgive,
          verdict: calculateVerdict(current.forgive, current.notForgive),
        };
      });
      await tx.result.createMany({ data: results });

      // 5. Próxima temporada, na MESMA transação (troca atômica, PROMPT §5)
      let next: number | null = null;
      if (startNext && season.number < TOTAL_SEASONS) {
        const started = await tx.season.updateMany({
          where: { number: season.number + 1, status: "idle" },
          data: { status: "voting", startsAt: new Date() },
        });
        if (started.count === 0) {
          throw new SeasonRuleError("NEXT_SEASON_UNAVAILABLE"); // rollback de tudo acima
        }
        next = season.number + 1;
      }

      return { closed: season.number, next, results };
    },
    { maxWait: 5_000, timeout: 10_000 },
  );
}
