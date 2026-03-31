import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("should show login page", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("h1")).toContainText("住宅営業育成");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("should redirect to login when not authenticated", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/.*login/);
  });

  test("should login with valid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "learner1@demo.com");
    await page.fill('input[type="password"]', "password123");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test("should show error with invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "wrong@email.com");
    await page.fill('input[type="password"]', "wrongpassword");
    await page.click('button[type="submit"]');
    await expect(page.locator("text=正しくありません")).toBeVisible();
  });
});
