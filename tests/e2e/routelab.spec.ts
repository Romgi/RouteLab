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

  const graphFrames = page.getByTestId("compare-graph-frame");
  await expect(graphFrames).toHaveCount(2);
  for (const frame of await graphFrames.all()) {
    const geometry = await frame.evaluate((element) => {
      const frameRect = element.getBoundingClientRect();
      const visualRect = element
        .querySelector(".graph-visual")!
        .getBoundingClientRect();
      const svgRect = element.querySelector("svg")!.getBoundingClientRect();
      return {
        visualContained:
          visualRect.top >= frameRect.top - 1 &&
          visualRect.bottom <= frameRect.bottom + 1,
        svgContained:
          svgRect.top >= frameRect.top - 1 &&
          svgRect.bottom <= frameRect.bottom + 1,
      };
    });
    expect(geometry.visualContained).toBe(true);
    expect(geometry.svgContained).toBe(true);
  }
});

test("Compare Mode supports 100x and measured real-time playback", async ({
  page,
}) => {
  await page.goto("/compare");
  const timeline = page
    .getByRole("region", { name: "Synchronized playback controls" })
    .getByRole("slider");
  const speed = page.getByRole("combobox", { name: "Playback speed" });
  const computeTimes = page.getByTestId("compare-compute-time");

  await expect(computeTimes.first()).not.toHaveText("—");
  await expect(speed.locator("option")).toHaveText([
    "0.5×",
    "1×",
    "2×",
    "4×",
    "10×",
    "25×",
    "50×",
    "100×",
    "Real time",
  ]);

  const finalStep = await timeline.getAttribute("max");
  expect(finalStep).not.toBeNull();
  await speed.selectOption("100");
  await page.getByRole("button", { name: "Play comparison" }).click();
  await expect(timeline).toHaveValue(finalStep!, { timeout: 6_000 });

  await speed.selectOption("realtime");
  await expect(speed).toHaveValue("realtime");
  await page.getByRole("button", { name: "Play comparison" }).click();
  await expect(timeline).toHaveValue(finalStep!, { timeout: 2_000 });
  await expect(page.getByText(/measured$/)).toBeVisible();

  await page.goto("/compare?scenario=all-pairs-matrix&algorithms=bfs,dijkstra");
  await page.waitForLoadState("networkidle");
  const unavailableSpeed = page.getByRole("combobox", {
    name: "Playback speed",
  });
  await unavailableSpeed.selectOption("realtime");
  await expect(unavailableSpeed).toHaveValue("realtime");
  await expect(
    page.getByText("No compatible runs", { exact: true }),
  ).toBeVisible();
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
