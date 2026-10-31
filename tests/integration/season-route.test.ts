import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// A rota de admin importa o NextAuth e o cache do Next; fora do servidor, os dois precisam de dublê
vi.mock("@/auth", () => ({ auth: async () => ({ user: { name: "admin-de-teste" } }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
// Este arquivo APAGA votos e resultados: exige confirmação explícita
const CAN_RUN = Boolean(TEST_DATABASE_URL) && process.env.CONFIRM_TEST_DB_WIPE === "yes";

let requestCounter = 0;

function voteRequest(rawBody: string): NextRequest {
  requestCounter += 1;
  const ip = `10.1.${Math.floor(requestCounter / 250)}.${(requestCounter % 250) + 1}`;
  return new NextRequest("http://localhost/api/vote", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: rawBody,
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe.skipIf(!CAN_RUN)("rotas de temporada (integração, Postgres real)", () => {
  let seasonPost: typeof import("@/app/api/admin/season/[action]/route").POST;
  let votePost: typeof import("@/app/api/vote/route").POST;
  let prisma: typeof import("@/lib/db").prisma;
  let prisonerIds: number[] = [];

  async function callSeasonRoute(action: string, body: unknown) {
    const request = new NextRequest(`http://localhost/api/admin/season/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return seasonPost(request, { params: Promise.resolve({ action }) });
  }

  /** Estado inicial do seed: T1 em votação, T2 e T3 idle, sem votos nem resultados. */
  async function resetDatabaseState() {
    await prisma.vote.deleteMany();
    await prisma.result.deleteMany();
    await prisma.season.updateMany({ data: { status: "idle", startsAt: null, endsAt: null } });
    await prisma.season.update({
      where: { number: 1 },
      data: { status: "voting", startsAt: new Date() },
    });
  }

  async function statusOf(number: number): Promise<string | undefined> {
    const season = await prisma.season.findUnique({ where: { number } });
    return season?.status;
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DATABASE_URL;
    process.env.VOTER_SALT = "salt-de-teste";
    ({ POST: seasonPost } = await import("@/app/api/admin/season/[action]/route"));
    ({ POST: votePost } = await import("@/app/api/vote/route"));
    ({ prisma } = await import("@/lib/db"));

    const prisoners = await prisma.prisoner.findMany({
      orderBy: { number: "asc" },
      select: { id: true },
    });
    prisonerIds = prisoners.map((prisoner) => prisoner.id);
    expect(prisonerIds).toHaveLength(10);
  });

  beforeEach(async () => {
    await resetDatabaseState();
  });

  afterAll(async () => {
    await resetDatabaseState(); // deixa o banco como o seed, para os outros arquivos
    await prisma.$disconnect();
  });

  it("exige confirmação e rejeita número decimal", async () => {
    const withoutConfirm = await callSeasonRoute("closeVoting", { number: 1 });
    expect(withoutConfirm.status).toBe(400);
    expect((await withoutConfirm.json()).code).toBe("CONFIRMATION_REQUIRED");

    const decimal = await callSeasonRoute("closeVoting", { confirm: true, number: 1.5 });
    expect(decimal.status).toBe(400);
    expect((await decimal.json()).code).toBe("INVALID_SEASON");
  });

  it("encerra com ZERO votos: 10 resultados 'lost' e a T2 começa", async () => {
    const response = await callSeasonRoute("closeVoting", { confirm: true, number: 1 });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.next).toBe(2);
    const results = await prisma.result.findMany();
    expect(results).toHaveLength(10);
    expect(results.every((result) => result.verdict === "lost")).toBe(true);
    expect(await statusOf(1)).toBe("closed");
    expect(await statusOf(2)).toBe("voting");
  });

  it("aplica o veredito: maioria, empate e maioria contrária", async () => {
    const season = await prisma.season.findUniqueOrThrow({ where: { number: 1 } });
    const [perdoado, empatado, condenado] = prisonerIds;
    const vote = (prisonerId: number, choice: string, index: number) => ({
      prisonerId,
      seasonId: season.id,
      choice,
      voterKey: `chave-${prisonerId}-${index}`,
    });
    await prisma.vote.createMany({
      data: [
        vote(perdoado ?? 0, "forgive", 1),
        vote(perdoado ?? 0, "forgive", 2),
        vote(perdoado ?? 0, "not_forgive", 3),
        vote(empatado ?? 0, "forgive", 1),
        vote(empatado ?? 0, "not_forgive", 2),
        vote(condenado ?? 0, "not_forgive", 1),
        vote(condenado ?? 0, "not_forgive", 2),
      ],
    });

    await callSeasonRoute("closeVoting", { confirm: true, number: 1, startNext: false });

    const byPrisoner = async (prisonerId: number) =>
      prisma.result.findFirstOrThrow({ where: { prisonerId } });
    expect((await byPrisoner(perdoado ?? 0)).verdict).toBe("not_guilty");
    expect((await byPrisoner(empatado ?? 0)).verdict).toBe("lost");
    const guilty = await byPrisoner(condenado ?? 0);
    expect(guilty.verdict).toBe("guilty");
    expect(guilty.notForgiveCount).toBe(2);
  });

  it("encerrar duas vezes: a 2ª devolve 409 SEASON_NOT_VOTING e não duplica resultados", async () => {
    const first = await callSeasonRoute("closeVoting", {
      confirm: true,
      number: 1,
      startNext: false,
    });
    expect(first.status).toBe(200);

    const second = await callSeasonRoute("closeVoting", {
      confirm: true,
      number: 1,
      startNext: false,
    });
    expect(second.status).toBe(409);
    expect((await second.json()).code).toBe("SEASON_NOT_VOTING");
    expect(await prisma.result.count()).toBe(10);
  });

  it("'Encerrar e aguardar' (startNext false) deixa a T2 em idle", async () => {
    await callSeasonRoute("closeVoting", { confirm: true, number: 1, startNext: false });
    expect(await statusOf(2)).toBe("idle");
  });

  it("init com outra temporada em votação devolve 409 ANOTHER_SEASON_VOTING", async () => {
    const response = await callSeasonRoute("init", { confirm: true, number: 2 });
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("ANOTHER_SEASON_VOTING");
  });

  it("init não pula etapa: T3 só depois de T2 encerrada", async () => {
    await callSeasonRoute("closeVoting", { confirm: true, number: 1, startNext: false });

    const skipping = await callSeasonRoute("init", { confirm: true, number: 3 });
    expect(skipping.status).toBe(409);
    expect((await skipping.json()).code).toBe("PREVIOUS_NOT_CLOSED");

    const next = await callSeasonRoute("init", { confirm: true, number: 2 });
    expect(next.status).toBe(200);
    expect(await statusOf(2)).toBe("voting");
  });

  it("dois init simultâneos: exatamente uma temporada fica em votação", async () => {
    await callSeasonRoute("closeVoting", { confirm: true, number: 1, startNext: false });
    await prisma.season.update({ where: { number: 2 }, data: { status: "closed" } });

    const [first, second] = await Promise.all([
      callSeasonRoute("init", { confirm: true, number: 3 }),
      callSeasonRoute("init", { confirm: true, number: 3 }),
    ]);

    expect([first.status, second.status].sort()).toEqual([200, 409]);
    expect(await prisma.season.count({ where: { status: "voting" } })).toBe(1);
  });

  it("nenhum voto aceito (201) fica fora do resultado quando voto e encerramento correm juntos", async () => {
    const ROUNDS = 5;
    const VOTES_PER_ROUND = 8; // abaixo do pool de conexões, para não testar o pool
    const targetPrisonerId = prisonerIds[0] ?? 0;
    const voteBody = JSON.stringify({ prisonerId: targetPrisonerId, choice: "forgive" });

    for (let round = 1; round <= ROUNDS; round++) {
      await resetDatabaseState();

      // O encerramento sai com um pequeno atraso aleatório, para cair NO MEIO dos votos
      const closePromise = (async () => {
        await sleep(Math.floor(Math.random() * 15));
        return callSeasonRoute("closeVoting", { confirm: true, number: 1, startNext: false });
      })();
      const votePromises = Array.from({ length: VOTES_PER_ROUND }, () =>
        votePost(voteRequest(voteBody)),
      );

      const [closeResponse, ...voteResponses] = await Promise.all([closePromise, ...votePromises]);
      const statuses = voteResponses.map((response) => response.status);

      expect(closeResponse.status, `rodada ${round}: encerramento`).toBe(200);
      expect(
        statuses.every((status) => status === 201 || status === 403),
        `rodada ${round}: status inesperado ${statuses.join(",")}`,
      ).toBe(true);

      const accepted = statuses.filter((status) => status === 201).length;
      const season = await prisma.season.findUniqueOrThrow({ where: { number: 1 } });
      const stored = await prisma.vote.count({ where: { seasonId: season.id } });
      const result = await prisma.result.findFirstOrThrow({
        where: { prisonerId: targetPrisonerId, seasonId: season.id },
      });

      expect(stored, `rodada ${round}: votos gravados`).toBe(accepted);
      expect(
        result.forgiveCount + result.notForgiveCount,
        `rodada ${round}: votos contados no Result`,
      ).toBe(accepted);
    }
  });
});
