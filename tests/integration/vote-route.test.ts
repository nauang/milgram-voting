import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { VISITOR_COOKIE_NAME } from "@/lib/voter";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
// Este arquivo escreve no banco: exige confirmação explícita, igual ao season-route.test.ts
const CAN_RUN = Boolean(TEST_DATABASE_URL) && process.env.CONFIRM_TEST_DB_WIPE === "yes";

let requestCounter = 0;

/** Cada requisição usa um IP diferente, para os limites de IP não mascararem o teste. */
function voteRequest(rawBody: string, cookie?: string): NextRequest {
  requestCounter += 1;
  const ip = `10.0.${Math.floor(requestCounter / 250)}.${(requestCounter % 250) + 1}`;
  return new NextRequest("http://localhost/api/vote", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
      ...(cookie ? { cookie } : {}),
    },
    body: rawBody,
  });
}

/** Extrai o cookie do visitante de um Set-Cookie, sem depender de ele ser o primeiro. */
function visitorCookieOf(response: Response): string {
  const raw = response.headers.get("set-cookie") ?? "";
  return (
    raw
      .split(",")
      .map((part) => part.split(";")[0]?.trim() ?? "")
      .find((pair) => pair.startsWith(`${VISITOR_COOKIE_NAME}=`)) ?? ""
  );
}

describe.skipIf(!CAN_RUN)("POST /api/vote (integração, Postgres real)", () => {
  let POST: typeof import("@/app/api/vote/route").POST;
  let prisma: typeof import("@/lib/db").prisma;
  let firstPrisonerId = 0;
  let secondPrisonerId = 0;
  let lastVoteIdBeforeTests = 0;

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DATABASE_URL;
    process.env.VOTER_SALT = "salt-de-teste";
    ({ POST } = await import("@/app/api/vote/route"));
    ({ prisma } = await import("@/lib/db"));

    const votingSeason = await prisma.season.findFirst({ where: { status: "voting" } });
    if (!votingSeason) {
      throw new Error("O banco de teste precisa de uma temporada em 'voting' (rode o seed).");
    }
    const prisoners = await prisma.prisoner.findMany({
      orderBy: { number: "asc" },
      take: 2,
      select: { id: true },
    });
    firstPrisonerId = prisoners[0]?.id ?? 0;
    secondPrisonerId = prisoners[1]?.id ?? 0;

    const lastVote = await prisma.vote.aggregate({ _max: { id: true } });
    lastVoteIdBeforeTests = lastVote._max.id ?? 0;
  });

  afterAll(async () => {
    // Remove somente os votos criados por este arquivo
    await prisma.vote.deleteMany({ where: { id: { gt: lastVoteIdBeforeTests } } });
    await prisma.$disconnect();
  });

  it("responde 400 (e não 500) para JSON malformado", async () => {
    const response = await POST(voteRequest("{"));
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("INVALID_BODY");
  });

  it("responde 404 para prisioneiro inexistente e não grava voto", async () => {
    const before = await prisma.vote.count();
    const response = await POST(
      voteRequest(JSON.stringify({ prisonerId: 2_000_000_000, choice: "forgive" })),
    );

    expect(response.status).toBe(404);
    expect((await response.json()).code).toBe("PRISONER_NOT_FOUND");
    expect(await prisma.vote.count()).toBe(before);
  });

  it("devolve 409 com retryAt quando o mesmo visitante vota de novo", async () => {
    const body = JSON.stringify({ prisonerId: firstPrisonerId, choice: "forgive" });
    const first = await POST(voteRequest(body));
    expect(first.status).toBe(201);
    const cookie = visitorCookieOf(first);
    expect(cookie).not.toBe("");

    const second = await POST(voteRequest(body, cookie));
    const secondBody = await second.json();

    expect(second.status).toBe(409);
    expect(secondBody.code).toBe("ALREADY_VOTED");
    expect(new Date(secondBody.retryAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("8 votos PARALELOS do mesmo visitante no mesmo prisioneiro gravam exatamente 1", async () => {
    // 8 paralelos: abaixo do pool de conexões (o mesmo racional de season-route.test.ts).
    // O pooler do Supabase (free tier) rejeita acima disso com P2028 e o teste passaria a
    // exercitar o pool em vez do lock. 8 já é suficiente para provar a invariante.
    const CONCURRENT_VOTES = 8;

    // Obtém um cookie válido votando em OUTRO prisioneiro (não depende do nome do cookie)
    const mint = await POST(
      voteRequest(JSON.stringify({ prisonerId: firstPrisonerId, choice: "forgive" })),
    );
    const cookie = visitorCookieOf(mint);
    expect(cookie).not.toBe("");

    const raceBody = JSON.stringify({ prisonerId: secondPrisonerId, choice: "not_forgive" });
    const responses = await Promise.all(
      Array.from({ length: CONCURRENT_VOTES }, () => POST(voteRequest(raceBody, cookie))),
    );
    const statuses = responses.map((response) => response.status);

    expect(statuses.filter((status) => status === 201)).toHaveLength(1);
    expect(statuses.filter((status) => status === 409)).toHaveLength(CONCURRENT_VOTES - 1);

    const stored = await prisma.vote.count({
      where: { prisonerId: secondPrisonerId, id: { gt: lastVoteIdBeforeTests } },
    });
    expect(stored).toBe(1);
  });
});