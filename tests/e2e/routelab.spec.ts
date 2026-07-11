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

test("landing demo geometry stays contained and connected", async ({
  page,
}) => {
  await page.goto("/");

  const morphSlider = page.getByRole("slider", {
    name: "Transform map into graph",
  });
  await expect(morphSlider).toBeEnabled();
  await morphSlider.press("Home");
  await expect(morphSlider).toHaveValue("0");
  await expect
    .poll(() =>
      page
        .locator(".concept-map-layer")
        .evaluate((layer) => Number(getComputedStyle(layer).opacity)),
    )
    .toBeGreaterThan(0.99);
  await expect
    .poll(() =>
      page
        .locator(".concept-graph-layer")
        .evaluate((layer) => Number(getComputedStyle(layer).opacity)),
    )
    .toBeLessThan(0.01);

  await morphSlider.press("End");
  await expect(morphSlider).toHaveValue("100");
  await expect
    .poll(() =>
      page
        .locator(".concept-map-layer")
        .evaluate((layer) => Number(getComputedStyle(layer).opacity)),
    )
    .toBeLessThan(0.01);
  await expect
    .poll(() =>
      page
        .locator(".concept-graph-layer")
        .evaluate((layer) => Number(getComputedStyle(layer).opacity)),
    )
    .toBeGreaterThan(0.99);

  for (const objective of ["Distance", "Time", "Turns", "Cycling"]) {
    await page.getByRole("button", { name: objective, exact: true }).click();
    const geometry = await page.evaluate(() => {
      const map = document.querySelector<HTMLElement>(".objective-map");
      const path = document.querySelector<SVGPathElement>(".objective-route");
      const startPin = document.querySelector<HTMLElement>(".pin-start");
      const endPin = document.querySelector<HTMLElement>(".pin-end");
      const matrix = path?.getScreenCTM();
      if (!map || !path || !startPin || !endPin || !matrix) {
        throw new Error("Objective route geometry is unavailable");
      }

      const toScreen = (point: DOMPoint) => ({
        x: matrix.a * point.x + matrix.c * point.y + matrix.e,
        y: matrix.b * point.x + matrix.d * point.y + matrix.f,
      });
      const first = toScreen(path.getPointAtLength(0));
      const last = toScreen(path.getPointAtLength(path.getTotalLength()));
      const startRect = startPin.getBoundingClientRect();
      const endRect = endPin.getBoundingClientRect();
      const routeRect = path.getBoundingClientRect();
      const mapRect = map.getBoundingClientRect();

      return {
        startDelta: Math.hypot(
          first.x - (startRect.left + startRect.width / 2),
          first.y - (startRect.top + startRect.height / 2),
        ),
        endDelta: Math.hypot(
          last.x - (endRect.left + endRect.width / 2),
          last.y - (endRect.top + endRect.height / 2),
        ),
        contained:
          routeRect.left >= mapRect.left - 1 &&
          routeRect.top >= mapRect.top - 1 &&
          routeRect.right <= mapRect.right + 1 &&
          routeRect.bottom <= mapRect.bottom + 1,
      };
    });

    expect(geometry.startDelta).toBeLessThan(1.5);
    expect(geometry.endDelta).toBeLessThan(1.5);
    expect(geometry.contained).toBe(true);
  }
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
