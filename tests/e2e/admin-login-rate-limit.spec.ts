import { expect, test } from "@playwright/test";

function randomTestIp(): string {
  const octet = () => Math.floor(Math.random() * 254) + 1;
  return `198.51.${octet()}.${octet()}`;
}

test("o 6º login do mesmo IP em 15 min é barrado com code=rate_limited", async ({ request }) => {
  const headers = { "x-forwarded-for": randomTestIp() };
  const csrf = await request.get("/api/auth/csrf", { headers });
  const { csrfToken } = (await csrf.json()) as { csrfToken: string };

  const locations: string[] = [];
  for (let attempt = 1; attempt <= 6; attempt++) {
    const response = await request.post("/api/auth/callback/credentials", {
      headers,
      form: { csrfToken, email: "ninguem@example.com", password: "senha-errada-123" },
      maxRedirects: 0,
    });
    locations.push(response.headers()["location"] ?? `(sem redirect, status ${response.status()})`);
  }

  // As 5 primeiras são recusadas como credencial inválida; a 6ª, como limite de tentativas
  for (const location of locations.slice(0, 5)) {
    expect(location).not.toContain("rate_limited");
  }
  expect(locations[5]).toContain("rate_limited");
});
