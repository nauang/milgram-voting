import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { voteBodySchema } from "@/types/domain";

// Simulando um Rate Limit em memória para desenvolvimento
const rateLimitMap = new Map<string, { count: number; lastReset: number }>();
const RATE_LIMIT = 10;
const WINDOW_MS = 60 * 60 * 1000; // 1 hora

export async function POST(req: Request) {
  try {
    // 1. Identificação do Visitante (IP fictício para dev, usar headers em prod)
    const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
    const voterKey = `dev-${ip}`; // Simplificado para dev

    // 2. Rate Limit
    const now = Date.now();
    const rateData = rateLimitMap.get(ip) || { count: 0, lastReset: now };
    if (now - rateData.lastReset > WINDOW_MS) {
      rateData.count = 0;
      rateData.lastReset = now;
    }
    if (rateData.count >= RATE_LIMIT) {
      return NextResponse.json({ error: "Muitas tentativas. Tente mais tarde." }, { status: 429 });
    }
    rateData.count++;
    rateLimitMap.set(ip, rateData);

    // 3. Validação
    const body = await req.json();
    const parsed = voteBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }
    const { prisonerId, choice } = parsed.data;

    // 4. Temporada Ativa
    const season = await prisma.season.findFirst({ where: { status: "voting" } });
    if (!season) {
      return NextResponse.json({ error: "A votação está encerrada." }, { status: 403 });
    }

    // 5. Regra de 24h
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

    // 6. Gravar Voto
    await prisma.vote.create({
      data: {
        prisonerId,
        seasonId: season.id,
        choice,
        voterKey,
      },
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}
