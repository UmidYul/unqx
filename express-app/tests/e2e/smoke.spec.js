const { expect, test } = require("@playwright/test");

const runE2E = process.env.E2E_RUN === "1";

test.describe("smoke", () => {
  test.skip(!runE2E, "Set E2E_RUN=1 and configure test database before running e2e smoke tests.");

  test("public home and admin login open", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("UNQ+", { exact: false })).toBeVisible();

    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Вход в админ-панель" })).toBeVisible();
  });
});