import { test, expect } from "@playwright/test";

test.describe("/admin — proteção e login", () => {
  test("redireciona para login quando não autenticado", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/admin");

    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByRole("heading", { level: 1, name: /Admin/i })).toBeVisible();
  });

  test("login com credenciais corretas funciona", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/admin/login");

    await page.getByLabel(/Email/i).fill(process.env.ADMIN_EMAIL ?? "admin@milgram.local");
    await page.getByLabel(/Senha/i).fill(process.env.ADMIN_PASSWORD ?? "troque-esta-senha");
    await page.getByRole("button", { name: /Entrar/i }).click();

    await expect(page).toHaveURL(/\/admin$/, { timeout: 10_000 });
    await expect(page.getByRole("heading", { level: 1, name: /Admin/i })).toBeVisible();
  });

  test("login com credenciais erradas falha", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/admin/login");

    await page.getByLabel(/Email/i).fill("errado@example.com");
    await page.getByLabel(/Senha/i).fill("senhaerrada");
    await page.getByRole("button", { name: /Entrar/i }).click();

    await expect(page).toHaveURL(/\/admin\/login/);
  });
});
