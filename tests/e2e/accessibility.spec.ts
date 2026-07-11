import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("primary surfaces have no serious automated WCAG violations", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "The desktop audit covers the same semantic surfaces.");
  await page.emulateMedia({ reducedMotion: "reduce" });

  for (const route of ["/", "/lab", "/compare", "/code", "/docs"]) {
    await page.goto(route);
    if (route === "/lab") {
      await expect(
        page.getByRole("slider", { name: "Trace position" }),
      ).toBeEnabled();
    }
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    const serious = results.violations.filter(
      (violation) =>
        violation.impact === "serious" || violation.impact === "critical",
    );
    expect(
      serious,
      `${route}: ${serious.map((item) => item.id).join(", ")}`,
    ).toEqual([]);
  }
});
