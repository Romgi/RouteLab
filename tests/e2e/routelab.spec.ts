import { expect, test } from "@playwright/test";

test("Story Mode leads into the working Algorithm Lab", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /See how algorithms find their way/i }),
  ).toBeVisible();
  await page.getByRole("link", { name: /Open the Algorithm Lab/i }).click();
  await expect(page).toHaveURL(/\/lab$/);
  await expect(
    page.getByRole("region", { name: "Algorithm visualization" }),
  ).toBeVisible();
  await expect(
    page.getByRole("slider", { name: "Trace position" }),
  ).toBeEnabled();
});

test("Lab playback can pause, step, scrub, and switch source language", async ({
  page,
}) => {
  await page.goto("/lab");
  const timeline = page.getByRole("slider", { name: "Trace position" });
  await expect(timeline).toBeEnabled();
  await page.getByRole("button", { name: "Next event" }).click();
  await expect(timeline).toHaveValue("1");
  await page.keyboard.press("ArrowRight");
  await expect(timeline).toHaveValue("2");
  await page.getByLabel("Language").selectOption("Python");
  await page.getByRole("tab", { name: "code" }).click();
  await expect(page.getByLabel("Python synchronized code")).toBeVisible();
  await page.getByRole("button", { name: "Play trace" }).click();
  await expect(page.getByRole("button", { name: "Pause trace" })).toBeVisible();
  await page.getByRole("button", { name: "Pause trace" }).click();
});

test("Compare Mode runs real synchronized traces", async ({ page }) => {
  await page.goto("/compare");
  await expect(
    page.getByRole("heading", { name: /Same graph. Different decisions./i }),
  ).toBeVisible();
  await expect(page.getByText("Dijkstra's Algorithm").first()).toBeVisible();
  await expect(page.getByLabel("Algorithm in lane 2")).toHaveValue("astar");
  const sliders = page.getByRole("slider");
  await expect(sliders.first()).toBeEnabled();
});

test("malformed imports fail as data without executing labels", async ({
  page,
}) => {
  await page.goto("/lab");
  await expect(
    page.getByRole("slider", { name: "Trace position" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: /Open custom builder/i }).click();
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles({
    name: "malicious.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      '{"schemaVersion":1,"name":"<img src=x onerror=alert(1)>"}',
    ),
  });
  await expect(
    page.getByText(/Import|Cannot apply|invalid|required/i).last(),
  ).toBeVisible();
  await expect(page.locator("img[src='x']")).toHaveCount(0);
});

test("reduced motion and mobile controls retain core access", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "Mobile project only");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/lab");
  await expect(
    page.getByRole("slider", { name: "Trace position" }),
  ).toBeEnabled();
  await expect(page.getByRole("button", { name: "Play trace" })).toBeVisible();
  await page.keyboard.press("?");
  await expect(
    page.getByRole("dialog", { name: /Navigate the trace/i }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: /Navigate the trace/i }),
  ).toHaveCount(0);
});
