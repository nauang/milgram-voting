import { expect, test } from "@playwright/test";

const EVIL_ORIGIN = "https://site-malicioso.example";

test("POST /api/vote com Origin de outro site é bloqueado (403)", async ({ request }) => {
  const response = await request.post("/api/vote", {
    headers: { origin: EVIL_ORIGIN },
    data: { prisonerId: 1, choice: "forgive" },
  });

  expect(response.status()).toBe(403);
  expect((await response.json()).code).toBe("CSRF_INVALID");
});

test("POST do admin com Origin de outro site dá 403 (e não 401): a origem é checada antes da sessão", async ({
  request,
}) => {
  const response = await request.post("/api/admin/season/closeVoting", {
    headers: { origin: EVIL_ORIGIN },
    data: { confirm: true, number: 1 },
  });

  expect(response.status()).toBe(403);
});
