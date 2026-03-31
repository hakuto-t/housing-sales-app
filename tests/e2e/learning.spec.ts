import { test, expect } from "@playwright/test";

async function login(page: any) {
  await page.goto("/login");
  await page.fill('input[type="email"]', "learner1@demo.com");
  await page.fill('input[type="password"]', "password123");
  await page.click('button[type="submit"]');
  await page.waitForURL(/.*dashboard/);
}

test.describe("Learning Mode", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("should navigate to learning mode", async ({ page }) => {
    await page.click('text=学習モード');
    await expect(page).toHaveURL(/.*learn/);
  });

  test("should start a learning session", async ({ page }) => {
    await page.goto("/learn");
    await page.click('text=学習を開始');
    // Should show a question
    await expect(page.locator('[data-testid="question-text"]')).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Test Mode", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("should navigate to test mode", async ({ page }) => {
    await page.click('text=テストモード');
    await expect(page).toHaveURL(/.*test/);
  });
});

test.describe("Graduation Exam", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("should show exam page", async ({ page }) => {
    await page.goto("/exam");
    await expect(page.locator("text=卒業検定")).toBeVisible();
  });
});
