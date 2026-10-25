import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { checkRateLimit, getClientIp, hashIdentifier, rateLimitedResponse } from "@/lib/rate-limit";
import { ensureVisitorCookie } from "@/lib/voter";
import { buildVoterKey } from "@/lib/voter-key";
import { voteBodySchema } from "@/types/domain";

const VOTE_WINDOW_MS = 24 * 60 * 60 * 1000;

type VoteRejectionCode = "SEASON_CLOSED" | "PRISONER_NOT_FOUND" | "ALREADY_VOTED";

const REJECTIONS: Record<VoteRejectionCode, { status: number; message: string }> = {
  SEASON_CLOSED: { status: 403, message: "A votação está encerrada." },
  PRISONER_NOT_FOUND: { status: 404, message: "Prisioneiro não encontrado." },
  ALREADY_VOTED: { status: 409, message: "Você já votou neste prisioneiro hoje." },
};

/** Lançada DENTRO da transação: provoca o rollback e vira uma resposta HTTP tipada. */
class VoteRejection extends Error {
  readonly code: VoteRejectionCode;
  readonly retryAt?: Date;

  constructor(code: VoteRejectionCode, retryAt?: Date) {
    super(code);
    this.code = code;
    this.retryAt = retryAt;
  }
}

interface VotingSeasonRow {
  id: number;
  endsAt: Date | null;
}

export async function POST(request: NextRequest) {
  try {
    // 0. (ITEM 3) A verificação de Origin/CSRF entra aqui, antes de tudo.

    // 1. Corpo: JSON malformado é erro do cliente (400), nunca 500.
    const rawBody: unknown = await request.json().catch(() => null);
    const parsed = voteBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { code: "INVALID_BODY", error: "Dados inválidos." },
        { status: 400 },
      );
    }
    const { prisonerId, choice } = parsed.data;

    // 2. Rate limit, antes de qualquer consulta ao banco. Dois limites:
    //    - tentativas por IP/hora (anti-bot, PROMPT §8.1);
    //    - tentativas por IP+prisioneiro/24h (impede burlar a regra de 24h descartando o cookie).
    const ipHash = hashIdentifier(getClientIp(request.headers));

    const attempts = await checkRateLimit("voteAttempts", ipHash);
    if (!attempts.allowed) {
      return rateLimitedResponse(attempts.retryAfterSeconds);
    }
    const perPrisoner = await checkRateLimit("votePerPrisoner", `${ipHash}:${prisonerId}`);
    if (!perPrisoner.allowed) {
      return rateLimitedResponse(perPrisoner.retryAfterSeconds);
    }

    // 3. Identidade anônima (o cookie só é gravado na resposta de sucesso)
    const response = NextResponse.json({ success: true, prisonerId, choice }, { status: 201 });
    const cookieId = ensureVisitorCookie(request, response);
    const voterKey = buildVoterKey(cookieId);

    // 4. Tudo ou nada, com trava de linha (ver encerramento-temporada.md §5)
    await prisma.$transaction(async (tx) => {
      // 4.1 Trava COMPARTILHADA na temporada em votação (FOR SHARE).
      //     - Se o admin está fechando agora, o UPDATE dele segura a linha: esta consulta ESPERA
      //       o commit, reavalia o WHERE, vê "closed" e devolve 0 linhas -> SEASON_CLOSED.
      //     - Se este voto chegou primeiro, o UPDATE do admin espera o commit do voto, e a
      //       contagem seguinte INCLUI o voto. Nenhum voto fica gravado fora do resultado.
      const seasons = await tx.$queryRaw<VotingSeasonRow[]>`
        SELECT "id", "endsAt" FROM "Season" WHERE "status" = 'voting' FOR SHARE
      `;
      const season = seasons[0];
      // endsAt nulo = sem prazo (encerramento manual, decisão E3)
      const isExpired = season?.endsAt != null && new Date(season.endsAt).getTime() <= Date.now();
      if (!season || isExpired) {
        throw new VoteRejection("SEASON_CLOSED");
      }

      // 4.2 O prisioneiro existe? (sem isso, a FK estoura e vira 500)
      const prisoner = await tx.prisoner.findUnique({
        where: { id: prisonerId },
        select: { id: true },
      });
      if (!prisoner) {
        throw new VoteRejection("PRISONER_NOT_FOUND");
      }

      // 4.3 Serializa pedidos do MESMO visitante para o MESMO prisioneiro. A janela de 24h é
      //     móvel, então um índice único não resolve; o lock é liberado sozinho no fim da
      //     transação. Ordem fixa dos locks (temporada, depois visitante) evita deadlock.
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${voterKey}::text), ${prisonerId}::int)
      `;

      // 4.4 Regra de negócio: 1 voto por prisioneiro a cada 24h
      const recentVote = await tx.vote.findFirst({
        where: {
          voterKey,
          prisonerId,
          createdAt: { gte: new Date(Date.now() - VOTE_WINDOW_MS) },
        },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
      if (recentVote) {
        throw new VoteRejection(
          "ALREADY_VOTED",
          new Date(recentVote.createdAt.getTime() + VOTE_WINDOW_MS),
        );
      }

      // 4.5 Gravação
      await tx.vote.create({
        data: { prisonerId, seasonId: season.id, choice, voterKey },
      });
    });

    return response;
  } catch (error) {
    if (error instanceof VoteRejection) {
      const { status, message } = REJECTIONS[error.code];
      return NextResponse.json(
        { code: error.code, error: message, retryAt: error.retryAt?.toISOString() },
        { status },
      );
    }
    console.error("Erro no POST /api/vote:", error);
    return NextResponse.json(
      { code: "INTERNAL", error: "Erro interno do servidor." },
      { status: 500 },
    );
  }
}
