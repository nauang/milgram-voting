import { test, expect } from "@playwright/test";

test.describe("/judge — fluxo de votação", () => {
  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/judge");
    await page.waitForLoadState("networkidle");
  });

  test("a página carrega com título e grid de 10 prisioneiros", async ({ page }) => {
    await expect(page).toHaveTitle(/MILGRAM \| Votação/);
    await expect(page.getByRole("heading", { level: 1, name: /Julgamento/i })).toBeVisible();

    const cards = page.locator("article");
    await expect(cards).toHaveCount(10);

    const votingBadges = page.locator("article p").filter({ hasText: "Pode votar" });
    await expect(votingBadges).toHaveCount(10);
  });

  test("clicar em um card abre o modal com os dois losangos", async ({ page }) => {
    await page.locator("article").first().getByRole("button").click();

    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();

    await expect(page.getByRole("button", { name: /^Perdoar este prisioneiro$/ })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Não perdoar este prisioneiro$/ }),
    ).toBeVisible();
  });

  test("votar registra o voto e mostra feedback", async ({ page }) => {
    await page.locator("article").first().getByRole("button").click();

    await page.getByRole("button", { name: /^Perdoar este prisioneiro$/ }).click();

    // Seleciona a confirmação exata dentro do status do modal,
    // sem confundir o texto japonês ou os badges dos cartões.
    const modal = page.getByRole("dialog");
    await expect(
      modal.getByRole("status").getByText("Voto registrado", { exact: true }),
    ).toBeVisible({ timeout: 5000 });
  });

  test("Esc fecha o modal", async ({ page }) => {
    await page.locator("article").first().getByRole("button").click();
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(modal).not.toBeVisible();
  });

  test("voto persiste após reload da página", async ({ page }) => {
    await page.locator("article").first().getByRole("button").click();
    await page.getByRole("button", { name: /^Perdoar este prisioneiro$/ }).click();

    // Aguarda o modal fechar (1.5s de feedback + animação)
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });

    await page.reload();
    await page.waitForLoadState("networkidle");

    // O primeiro card deve estar "Voto registrado"
    const firstCard = page.locator("article").first();
    await expect(firstCard.locator("p").filter({ hasText: "Voto registrado" })).toBeVisible();
  });
});
