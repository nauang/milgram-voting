import { expect, test } from "@playwright/test";

const LOGIN_PATH = "/admin/login";
const ADMIN_PATH = "/admin";

// Utiliza apenas credenciais exclusivas do ambiente E2E.
// Nunca reutiliza ADMIN_PASSWORD ou credenciais reais.
const TEST_ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL?.trim() ?? "";

const TEST_ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "";

test.describe("/admin — proteção e login", () => {
  test("redireciona visitantes sem sessão para o login", async ({ page, context }) => {
    await context.clearCookies();

    await page.goto(ADMIN_PATH);

    await expect(page).toHaveURL(/\/admin\/login(?:\?.*)?$/);

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "ADMIN LOGIN",
      }),
    ).toBeVisible();

    await expect(page.getByLabel(/email/i)).toBeVisible();

    await expect(page.getByLabel(/senha/i)).toBeVisible();
  });

  test("autentica com credenciais exclusivas do ambiente E2E", async ({ page, context }) => {
    test.skip(
      !TEST_ADMIN_EMAIL || !TEST_ADMIN_PASSWORD,
      "Configure E2E_ADMIN_EMAIL e E2E_ADMIN_PASSWORD com credenciais exclusivas de teste.",
    );

    await context.clearCookies();

    await page.goto(LOGIN_PATH);

    await page.getByLabel(/email/i).fill(TEST_ADMIN_EMAIL);

    await page.getByLabel(/senha/i).fill(TEST_ADMIN_PASSWORD);

    await page
      .getByRole("button", {
        name: "ACESSAR PAINEL",
      })
      .click();

    await expect(page).toHaveURL(/\/admin\/?$/, { timeout: 15_000 });

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "ADMIN PANEL",
      }),
    ).toBeVisible();
  });

  test("rejeita credenciais inválidas sem permitir acesso ao painel", async ({ page, context }) => {
    await context.clearCookies();

    await page.goto(LOGIN_PATH);

    await page.getByLabel(/email/i).fill("invalido@example.invalid");

    await page.getByLabel(/senha/i).fill("senha-incorreta-para-teste");

    await page
      .getByRole("button", {
        name: "ACESSAR PAINEL",
      })
      .click();

    await expect(page).toHaveURL(/\/admin\/login(?:\?.*)?$/, { timeout: 15_000 });

    // Seleciona especificamente a mensagem
    // da aplicação, evitando o route announcer
    // gerado automaticamente pelo Next.js.
    await expect(page.locator("#login-error")).toBeVisible();

    await expect(page.locator("#login-error")).toContainText("Email ou senha incorretos.");
  });
});
