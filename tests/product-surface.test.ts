import { access, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { runAlgorithm } from "@/lib/algorithms";
import {
  BUILT_IN_SCENARIOS,
  SCENARIO_LIMITS,
  exportScenarioJson,
  parseScenarioJson,
} from "@/lib/scenarios";

describe("RouteLab product surface", () => {
  it("ships every primary route", async () => {
    await Promise.all(
      [
        "app/page.tsx",
        "app/lab/page.tsx",
        "app/compare/page.tsx",
        "app/code/page.tsx",
        "app/docs/page.tsx",
      ].map((path) => access(new URL(`../${path}`, import.meta.url))),
    );
  });

  it("exposes twelve valid round-trippable scenarios", () => {
    expect(BUILT_IN_SCENARIOS).toHaveLength(12);
    for (const scenario of BUILT_IN_SCENARIOS) {
      expect(
        parseScenarioJson(exportScenarioJson(scenario, { pretty: false })),
      ).toEqual(scenario);
    }
  });

  it("runs a deterministic capped trace on the default scenario", () => {
    const scenario = BUILT_IN_SCENARIOS[0];
    const first = runAlgorithm(scenario.graph, {
      algorithmId: "dijkstra",
      startId: scenario.startId,
      goalId: scenario.goalId,
      scenarioId: scenario.id,
      travelModel: scenario.defaultCostMetric,
      heuristicId: scenario.defaultHeuristic,
      maxTraceEvents: SCENARIO_LIMITS.maxTraceEvents,
    });
    const second = runAlgorithm(scenario.graph, {
      algorithmId: "dijkstra",
      startId: scenario.startId,
      goalId: scenario.goalId,
      scenarioId: scenario.id,
      travelModel: scenario.defaultCostMetric,
      heuristicId: scenario.defaultHeuristic,
      maxTraceEvents: SCENARIO_LIMITS.maxTraceEvents,
    });
    expect(first.pathCost).toBe(second.pathCost);
    expect(first.pathNodeIds).toEqual(second.pathNodeIds);
    expect(first.trace).toEqual(second.trace);
  });

  it("contains no dynamic code execution or unsafe HTML sinks", async () => {
    const files = [
      "components/AlgorithmLab.tsx",
      "components/CustomScenarioBuilder.tsx",
      "components/CodeExplorer.tsx",
      "lib/scenarios/serialization.ts",
    ];
    const source = (
      await Promise.all(
        files.map((path) =>
          readFile(new URL(`../${path}`, import.meta.url), "utf8"),
        ),
      )
    ).join("\n");
    expect(source).not.toMatch(/\beval\s*\(/);
    expect(source).not.toMatch(/new\s+Function\s*\(/);
    expect(source).not.toContain("dangerouslySetInnerHTML");
    expect(source).not.toMatch(/import\s*\(\s*[a-zA-Z_$]/);
  });
});
