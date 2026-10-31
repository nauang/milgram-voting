import { expect, test } from "@playwright/test";

function randomTestIp(): string {
  const octet = () => Math.floor(Math.random() * 254) + 1;
  return `198.51.${octet()}.${octet()}`;
}

test("a 11ª tentativa por hora do mesmo IP recebe 429 com Retry-After", async ({ request }) => {
  const headers = { "x-forwarded-for": randomTestIp() };

  // IDs diferentes: não ativam o limite por prisioneiro (3 por 24h)
  for (let attempt = 1; attempt <= 10; attempt++) {
    const response = await request.post("/api/vote", {
      headers,
      data: { prisonerId: 900_000 + attempt, choice: "forgive" },
    });
    expect(response.status(), `tentativa ${attempt}`).not.toBe(429);
  }

  const blocked = await request.post("/api/vote", {
    headers,
    data: { prisonerId: 900_011, choice: "forgive" },
  });

  expect(blocked.status()).toBe(429);
  expect(Number(blocked.headers()["retry-after"])).toBeGreaterThan(0);
  expect((await blocked.json()).code).toBe("RATE_LIMITED");
});

test("a 4ª tentativa do mesmo IP no mesmo prisioneiro recebe 429 (anti cookie descartado)", async ({
  playwright,
}) => {
  const headers = { "x-forwarded-for": randomTestIp() };
  const statuses: number[] = [];

  // Um contexto NOVO por tentativa = sem cookie, simulando o atacante
  for (let attempt = 1; attempt <= 4; attempt++) {
    const context = await playwright.request.newContext({
      baseURL: test.info().project.use.baseURL,
    });
    const response = await context.post("/api/vote", {
      headers,
      data: { prisonerId: 900_500, choice: "not_forgive" },
    });
    statuses.push(response.status());
    await context.dispose();
  }

  expect(statuses.slice(0, 3)).not.toContain(429);
  expect(statuses[3]).toBe(429);
});
