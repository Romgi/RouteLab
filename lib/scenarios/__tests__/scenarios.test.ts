import { describe, expect, it } from "vitest";

import {
  BUILT_IN_SCENARIO_IDS,
  BUILT_IN_SCENARIOS,
  SCENARIO_SCHEMA_VERSION,
  calculateShortestPathCost,
  cloneScenario,
  decodeShareState,
  encodeShareState,
  exportScenarioJson,
  generateGridScenario,
  generateRandomScenario,
  importScenarioJson,
  parseScenarioJson,
  validateScenarioData,
} from "@/lib/scenarios";

const EXPECTED_SCENARIOS = [
  ["uniform-city-grid", 8],
  ["highway-vs-local", 6],
  ["weighted-terrain", 10],
  ["maze", 44],
  ["one-way-downtown", 7],
  ["road-closures", 8],
  ["dense-urban", 14],
  ["sparse-rural", 26],
  ["misleading-heuristic", 6],
  ["no-path", null],
  ["negative-edge-demo", 5],
  ["all-pairs-matrix", 9],
] as const;

describe("built-in RouteLab scenarios", () => {
  it("ships exactly the deterministic twelve-scenario curriculum", () => {
    expect(BUILT_IN_SCENARIOS).toHaveLength(12);
    expect(BUILT_IN_SCENARIO_IDS).toEqual(EXPECTED_SCENARIOS.map(([id]) => id));
    expect(new Set(BUILT_IN_SCENARIO_IDS).size).toBe(12);

    BUILT_IN_SCENARIOS.forEach((scenario) => {
      expect(scenario.schemaVersion).toBe(SCENARIO_SCHEMA_VERSION);
      expect(validateScenarioData(scenario)).toEqual({
        success: true,
        data: scenario,
      });
    });
  });

  it("matches every declared start-to-goal optimum", () => {
    for (const [id, expectedCost] of EXPECTED_SCENARIOS) {
      const scenario = BUILT_IN_SCENARIOS.find(
        (candidate) => candidate.id === id,
      );
      expect(scenario).toBeDefined();
      expect(scenario?.expectedOptimalCost).toBe(expectedCost);
      expect(
        calculateShortestPathCost(
          scenario!.graph,
          scenario!.startId,
          scenario!.goalId,
        ),
      ).toBe(expectedCost);
    }
  });

  it("keeps the negative-cycle variant closed until explicitly enabled", () => {
    const scenario = cloneScenario(
      BUILT_IN_SCENARIOS.find(({ id }) => id === "negative-edge-demo"),
    );
    const cycleEdge = scenario.graph.edges.find(({ id }) => id === "c-b-cycle");
    expect(cycleEdge?.closed).toBe(true);
    const graphWithCycle = {
      ...scenario.graph,
      edges: scenario.graph.edges.map((edge) =>
        edge.id === "c-b-cycle" ? { ...edge, closed: false } : edge,
      ),
    };
    expect(() =>
      calculateShortestPathCost(
        graphWithCycle,
        scenario.startId,
        scenario.goalId,
      ),
    ).toThrow(/negative cycle/u);
  });
});

describe("scenario import and export", () => {
  it("round-trips canonical JSON deterministically", () => {
    for (const scenario of BUILT_IN_SCENARIOS) {
      const json = exportScenarioJson(scenario, { pretty: false });
      const restored = parseScenarioJson(json);
      expect(restored).toEqual(scenario);
      expect(exportScenarioJson(restored, { pretty: false })).toBe(json);
    }
  });

  it("rejects duplicate ids, missing references, unknown keys, and nonfinite costs", () => {
    const original = BUILT_IN_SCENARIOS[0];

    const duplicate = cloneScenario(original);
    const duplicateInput = {
      ...duplicate,
      graph: {
        ...duplicate.graph,
        nodes: [...duplicate.graph.nodes, { ...duplicate.graph.nodes[0] }],
      },
      maxGraphSize: { ...duplicate.maxGraphSize, nodes: 30 },
    };
    expect(validateScenarioData(duplicateInput).success).toBe(false);

    const missingReference = cloneScenario(original);
    const missingInput = {
      ...missingReference,
      graph: {
        ...missingReference.graph,
        edges: missingReference.graph.edges.map((edge, index) =>
          index === 0 ? { ...edge, toId: "missing-node" } : edge,
        ),
      },
    };
    expect(validateScenarioData(missingInput).success).toBe(false);

    expect(
      validateScenarioData({ ...cloneScenario(original), unexpected: true })
        .success,
    ).toBe(false);

    const nonfinite = cloneScenario(original);
    const nonfiniteInput = {
      ...nonfinite,
      graph: {
        ...nonfinite.graph,
        edges: nonfinite.graph.edges.map((edge, index) =>
          index === 0 ? { ...edge, weight: Number.POSITIVE_INFINITY } : edge,
        ),
      },
    };
    expect(validateScenarioData(nonfiniteInput).success).toBe(false);
  });

  it("fails malformed, mistyped, and oversized imports without throwing", () => {
    expect(importScenarioJson("{not-json").success).toBe(false);
    expect(
      importScenarioJson(exportScenarioJson(BUILT_IN_SCENARIOS[0]), {
        fileName: "scenario.txt",
      }).success,
    ).toBe(false);
    expect(
      importScenarioJson(" ".repeat(1_024), { maxBytes: 100 }).success,
    ).toBe(false);
  });
});

describe("seeded scenario generation and compact shares", () => {
  it("reproduces grid and random scenarios exactly from the same seed", () => {
    const gridOptions = {
      rows: 4,
      columns: 6,
      seed: 42,
      oneWayProbability: 0.2,
      closedEdgeProbability: 0.1,
    } as const;
    const randomOptions = {
      nodeCount: 30,
      edgeDensity: 0.2,
      seed: 42,
      directed: true,
    } as const;

    expect(generateGridScenario(gridOptions)).toEqual(
      generateGridScenario(gridOptions),
    );
    expect(generateRandomScenario(randomOptions)).toEqual(
      generateRandomScenario(randomOptions),
    );
    expect(generateGridScenario({ ...gridOptions, seed: 43 })).not.toEqual(
      generateGridScenario(gridOptions),
    );
  });

  it("round-trips a compact built-in share and rejects corruption", () => {
    const encoded = encodeShareState({
      schemaVersion: SCENARIO_SCHEMA_VERSION,
      scenarioId: "road-closures",
      algorithm: "dijkstra",
      heuristic: "euclidean",
      costMetric: "weight",
      closedEdgeIds: ["a-b-closure"],
    });
    const decoded = decodeShareState(encoded);
    expect(decoded.success).toBe(true);
    if (decoded.success) {
      expect(decoded.data.scenarioId).toBe("road-closures");
      expect(decoded.data.closedEdgeIds).toEqual(["a-b-closure"]);
    }
    expect(decodeShareState(`${encoded}!`).success).toBe(false);
    expect(
      decodeShareState(
        encodeShareState({
          schemaVersion: SCENARIO_SCHEMA_VERSION,
          scenarioId: "uniform-city-grid",
        }),
      ).success,
    ).toBe(true);
  });
});
