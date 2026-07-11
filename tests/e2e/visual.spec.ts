import { expect, test } from "@playwright/test";

test("Story hero visual baseline", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /See how algorithms find their way/i }),
  ).toBeVisible();
  await expect(page).toHaveScreenshot("story-hero.png", {
    animations: "disabled",
    caret: "hide",
    maxDiffPixelRatio: 0.005,
  });
});

test("Lab initial state visual baseline", async ({ page }) => {
  await page.goto("/lab");
  await expect(
    page.getByRole("slider", { name: "Trace position" }),
  ).toBeEnabled();
  await expect(page).toHaveScreenshot("lab-initial.png", {
    animations: "disabled",
    caret: "hide",
    maxDiffPixelRatio: 0.005,
  });
});

test("Compare Mode visual baseline", async ({ page }) => {
  await page.goto("/compare");
  await expect(
    page.getByRole("heading", { name: /Same graph. Different decisions./i }),
  ).toBeVisible();
  await expect(page).toHaveScreenshot("compare-initial.png", {
    animations: "disabled",
    caret: "hide",
    maxDiffPixelRatio: 0.005,
  });
});
