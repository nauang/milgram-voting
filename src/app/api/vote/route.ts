import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { voteBodySchema } from "@/types/domain";
import { ensureVisitorCookie } from "@/lib/voter";

// Rate limit em memória (dev). Em produção, usar Upstash (§8.1)
const rateLimitMap = new Map<string, { count: number; lastReset: number }>();
const RATE_LIMIT = 10;
const WINDOW_MS = 60 * 60 * 1000; // 1 hora

export async function POST(request: NextRequest) {
  try {
    // Preparar a resposta (para poder setar o cookie)
    const response = NextResponse.json({ success: true }, { status: 201 });

    // 1. Garantir cookie do visitante
    const cookieId = ensureVisitorCookie(request, response);

    // 2. IP (para rate-limit)
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "127.0.0.1";

    // 3. Rate limit em memória
    const now = Date.now();
    const rateData = rateLimitMap.get(ip) ?? { count: 0, lastReset: now };
    if (now - rateData.lastReset > WINDOW_MS) {
      rateData.count = 0;
      rateData.lastReset = now;
    }
    if (rateData.count >= RATE_LIMIT) {
      return NextResponse.json({ error: "Muitas tentativas. Tente mais tarde." }, { status: 429 });
    }
    rateData.count++;
    rateLimitMap.set(ip, rateData);

    // 4. Validar body
    const body = await request.json();
    const parsed = voteBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }
    const { prisonerId, choice } = parsed.data;

    // 5. Temporada ativa
    const season = await prisma.season.findFirst({ where: { status: "voting" } });
    if (!season) {
      return NextResponse.json({ error: "A votação está encerrada." }, { status: 403 });
    }

    // 6. Calcular voterKey (deve ser IGUAL ao de judge.ts)
    const voterKey = createHash("sha256")
      .update(`${cookieId}:${process.env.VOTER_SALT ?? "dev-salt-change-me"}`)
      .digest("hex");

    // 7. Regra de 24h
    const limit24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentVote = await prisma.vote.findFirst({
      where: {
        voterKey,
        prisonerId,
        createdAt: { gte: limit24h },
      },
    });

    if (recentVote) {
      return NextResponse.json({ error: "Você já votou neste prisioneiro hoje." }, { status: 409 });
    }

    // 8. Gravar voto
    await prisma.vote.create({
      data: {
        prisonerId,
        seasonId: season.id,
        choice,
        voterKey,
      },
    });

    return response;
  } catch (error) {
    console.error("Erro no POST /api/vote:", error);
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}
