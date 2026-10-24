import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { TOTAL_SEASONS } from "@/lib/constants";

interface RouteContext {
  params: Promise<{ action: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { action } = await context.params;
  const body = await request.json().catch(() => ({}));

  if (body.confirm !== true) {
    return NextResponse.json({ error: "Confirmação obrigatória" }, { status: 400 });
  }

  try {
    if (action === "init") {
      return await handleInit(body);
    }
    if (action === "closeVoting") {
      return await handleCloseVoting(body);
    }
    return NextResponse.json({ error: "Ação desconhecida" }, { status: 400 });
  } catch (error) {
    console.error(`Erro em /api/admin/season/${action}:`, error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

async function handleInit(body: { number?: unknown }): Promise<NextResponse> {
  const number = typeof body.number === "number" ? body.number : null;
  if (!number || number < 1 || number > TOTAL_SEASONS) {
    return NextResponse.json({ error: "Temporada inválida" }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const voting = await tx.season.findFirst({ where: { status: "voting" } });
    if (voting) throw new Error("Já existe uma temporada em votação");

    const target = await tx.season.findUnique({ where: { number } });
    if (!target || target.status !== "idle") throw new Error("Temporada não está idle");

    return tx.season.update({
      where: { number },
      data: { status: "voting", startsAt: new Date() },
    });
  });

  return NextResponse.json({ ok: true, season: result });
}

async function handleCloseVoting(body: { number?: unknown }): Promise<NextResponse> {
  const number = typeof body.number === "number" ? body.number : null;
  if (!number || number < 1 || number > TOTAL_SEASONS) {
    return NextResponse.json({ error: "Temporada inválida" }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1. Fechar temporada
    const closed = await tx.season.updateMany({
      where: { number, status: "voting" },
      data: { status: "closed", endsAt: new Date() },
    });
    if (closed.count === 0) throw new Error("Temporada não está em votação");

    const season = await tx.season.findUniqueOrThrow({ where: { number } });

    // 2. Contar votos
    const grouped = await tx.vote.groupBy({
      by: ["prisonerId", "choice"],
      where: { seasonId: season.id },
      _count: true,
    });

    // 3. Contar por prisioneiro
    const counts = new Map<number, { forgive: number; notForgive: number }>();
    for (const row of grouped) {
      const c = counts.get(row.prisonerId) ?? { forgive: 0, notForgive: 0 };
      if (row.choice === "forgive") c.forgive = row._count;
      else if (row.choice === "not_forgive") c.notForgive = row._count;
      counts.set(row.prisonerId, c);
    }

    // 4. Gravar resultados (todos os 10 prisioneiros, mesmo sem votos)
    const prisoners = await tx.prisoner.findMany({ select: { id: true } });
    const results = prisoners.map((p) => {
      const c = counts.get(p.id) ?? { forgive: 0, notForgive: 0 };
      let verdict: "lost" | "not_guilty" | "guilty";
      if (c.forgive + c.notForgive === 0) verdict = "lost";
      else if (c.forgive > c.notForgive) verdict = "not_guilty";
      else if (c.notForgive > c.forgive) verdict = "guilty";
      else verdict = "lost";

      return {
        prisonerId: p.id,
        seasonId: season.id,
        forgiveCount: c.forgive,
        notForgiveCount: c.notForgive,
        verdict,
      };
    });

    await tx.result.createMany({ data: results });

    // 5. Iniciar próxima temporada (se houver)
    let nextNumber: number | null = null;
    if (season.number < TOTAL_SEASONS) {
      const next = await tx.season.findUnique({ where: { number: season.number + 1 } });
      if (next && next.status === "idle") {
        await tx.season.update({
          where: { number: season.number + 1 },
          data: { status: "voting", startsAt: new Date() },
        });
        nextNumber = season.number + 1;
      }
    }

    return { closed: season.number, next: nextNumber, results };
  });

  return NextResponse.json({ ok: true, ...result });
}
