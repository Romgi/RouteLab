import type { AlgorithmId, HeuristicId } from "@/lib/algorithms";

import { SCENARIO_SCHEMA_VERSION } from "./constants";
import {
  calculateCameraBounds,
  calculateShortestPathCost,
  createSeededRandom,
  generateGridScenario,
} from "./generators";
import type {
  CostMetric,
  Scenario,
  ScenarioCategory,
  ScenarioEdge,
  ScenarioGraph,
  ScenarioNode,
} from "./types";
import { assertValidScenario } from "./validation";

const UNIT_SEARCH_ALGORITHMS: AlgorithmId[] = [
  "bfs",
  "dijkstra",
  "astar",
  "greedy-best-first",
  "bidirectional-dijkstra",
  "bellman-ford",
];
const WEIGHTED_SEARCH_ALGORITHMS: AlgorithmId[] = [
  "dijkstra",
  "astar",
  "greedy-best-first",
  "bidirectional-dijkstra",
  "bellman-ford",
];
const SPATIAL_HEURISTICS: HeuristicId[] = ["zero", "manhattan", "euclidean"];

interface ScenarioDefinition {
  id: string;
  name: string;
  description: string;
  category: ScenarioCategory;
  graph: ScenarioGraph;
  startId: string;
  goalId: string;
  defaultAlgorithms: readonly AlgorithmId[];
  supportedAlgorithms: readonly AlgorithmId[];
  allowedHeuristics: readonly HeuristicId[];
  defaultHeuristic: HeuristicId;
  learningObjectives: readonly string[];
  seed: number;
  maxGraphSize: { nodes: number; edges: number };
  availableCostMetrics?: readonly CostMetric[];
  defaultCostMetric?: CostMetric;
  expectedOptimalCost?: number | null;
  expectedCosts?: Partial<Record<CostMetric, number | null>>;
  editableEdgeIds?: readonly string[];
}

function defineScenario(definition: ScenarioDefinition): Scenario {
  return assertValidScenario({
    schemaVersion: SCENARIO_SCHEMA_VERSION,
    availableCostMetrics: ["weight"],
    defaultCostMetric: "weight",
    cameraBounds: calculateCameraBounds(definition.graph.nodes),
    ...definition,
  });
}

function roadEdge(
  id: string,
  fromId: string,
  toId: string,
  weight: number,
  options: Partial<ScenarioEdge> = {},
): ScenarioEdge {
  return {
    id,
    fromId,
    toId,
    weight,
    directed: false,
    distance: weight,
    travelTime: weight,
    roadType: "street",
    ...options,
  };
}

function uniformCityGrid(): Scenario {
  const generated = generateGridScenario({
    rows: 5,
    columns: 5,
    seed: 1_101,
    id: "uniform-city-grid",
    name: "Uniform city grid",
    spacing: 1,
    minWeight: 1,
    maxWeight: 1,
  });
  return defineScenario({
    id: "uniform-city-grid",
    name: "Uniform city grid",
    description:
      "Twenty-five intersections and equal-cost streets create many equally short routes across a calm, regular city block pattern.",
    category: "grid",
    graph: generated.graph,
    startId: "n-0-0",
    goalId: "n-4-4",
    defaultAlgorithms: ["bfs", "dijkstra", "astar"],
    supportedAlgorithms: UNIT_SEARCH_ALGORITHMS,
    allowedHeuristics: SPATIAL_HEURISTICS,
    defaultHeuristic: "manhattan",
    learningObjectives: [
      "See BFS discover the destination layer by layer on equal-cost roads.",
      "Compare deterministic tie-breaking when several optimal routes cost the same.",
      "Observe how an admissible Manhattan heuristic narrows A* exploration.",
    ],
    seed: 1_101,
    expectedOptimalCost: 8,
    expectedCosts: { weight: 8, distance: 8, travelTime: 8 },
    availableCostMetrics: ["weight", "distance", "travelTime"],
    maxGraphSize: { nodes: 25, edges: 40 },
  });
}

function highwayVersusLocal(): Scenario {
  const nodes: ScenarioNode[] = [
    { id: "start", label: "Home", x: 0, y: 2, nodeType: "landmark" },
    { id: "local-1", label: "Oak", x: 1.33, y: 2, nodeType: "intersection" },
    { id: "local-2", label: "Market", x: 2.67, y: 2, nodeType: "intersection" },
    { id: "goal", label: "Campus", x: 4, y: 2, nodeType: "landmark" },
    {
      id: "ramp-west",
      label: "West ramp",
      x: 1,
      y: 3.5,
      nodeType: "intersection",
    },
    {
      id: "ramp-east",
      label: "East ramp",
      x: 3,
      y: 3.5,
      nodeType: "intersection",
    },
  ];
  const graph: ScenarioGraph = {
    nodes,
    edges: [
      roadEdge("local-01", "start", "local-1", 4, {
        distance: 2,
        travelTime: 4,
        roadType: "local",
        speed: 30,
        label: "Oak Street",
      }),
      roadEdge("local-12", "local-1", "local-2", 4, {
        distance: 2,
        travelTime: 4,
        roadType: "local",
        speed: 30,
        label: "Market Street",
      }),
      roadEdge("local-2g", "local-2", "goal", 4, {
        distance: 2,
        travelTime: 4,
        roadType: "local",
        speed: 30,
        label: "College Street",
      }),
      roadEdge("ramp-west", "start", "ramp-west", 2, {
        distance: 2,
        travelTime: 2,
        roadType: "highway",
        speed: 60,
        label: "West on-ramp",
      }),
      roadEdge("highway", "ramp-west", "ramp-east", 2, {
        distance: 6,
        travelTime: 2,
        roadType: "highway",
        speed: 110,
        label: "Route 8 express",
      }),
      roadEdge("ramp-east", "ramp-east", "goal", 2, {
        distance: 2,
        travelTime: 2,
        roadType: "highway",
        speed: 60,
        label: "East off-ramp",
      }),
    ],
  };
  return defineScenario({
    id: "highway-vs-local",
    name: "Highway versus local roads",
    description:
      "The local streets cover less distance, while a longer expressway route wins when the cost model changes to travel time.",
    category: "roads",
    graph,
    startId: "start",
    goalId: "goal",
    defaultAlgorithms: ["dijkstra", "astar"],
    supportedAlgorithms: WEIGHTED_SEARCH_ALGORITHMS,
    allowedHeuristics: ["zero", "euclidean"],
    defaultHeuristic: "euclidean",
    learningObjectives: [
      "Distinguish shortest distance from fastest estimated travel time.",
      "Watch one topology produce different optimal paths under different edge costs.",
      "Explain why BFS is inappropriate when road costs are unequal.",
    ],
    seed: 2_202,
    expectedOptimalCost: 6,
    expectedCosts: { weight: 6, distance: 6, travelTime: 6 },
    availableCostMetrics: ["weight", "distance", "travelTime"],
    defaultCostMetric: "travelTime",
    maxGraphSize: { nodes: 12, edges: 24 },
  });
}

function weightedTerrain(): Scenario {
  const base = generateGridScenario({
    rows: 5,
    columns: 7,
    seed: 3_303,
    id: "weighted-terrain-base",
    name: "Weighted terrain base",
  }).graph;
  const obstacles = new Set(["n-1-2", "n-1-3", "n-1-4"]);
  const veryExpensive = new Set(["n-2-3"]);
  const slow = new Set(["n-2-2", "n-2-4", "n-3-2", "n-3-3", "n-3-4"]);
  const multiplier = (id: string) =>
    veryExpensive.has(id) ? 9 : slow.has(id) ? 3 : 1;
  const nodes: ScenarioNode[] = base.nodes.map((node) => {
    if (obstacles.has(node.id)) {
      return {
        ...node,
        nodeType: "obstacle",
        label: "Rock",
        metadata: { terrain: "impassable" },
      };
    }
    if (veryExpensive.has(node.id)) {
      return {
        ...node,
        nodeType: "terrain",
        metadata: { terrain: "very-expensive" },
      };
    }
    if (slow.has(node.id)) {
      return { ...node, nodeType: "terrain", metadata: { terrain: "slow" } };
    }
    return { ...node, nodeType: "terrain", metadata: { terrain: "normal" } };
  });
  const edges: ScenarioEdge[] = base.edges
    .filter((edge) => !obstacles.has(edge.fromId) && !obstacles.has(edge.toId))
    .map((edge) => {
      const terrainMultiplier = Math.max(
        multiplier(edge.fromId),
        multiplier(edge.toId),
      );
      return {
        ...edge,
        weight: terrainMultiplier,
        travelTime: terrainMultiplier,
        roadType: "trail",
        terrainMultiplier,
      };
    });
  const graph: ScenarioGraph = { nodes, edges };
  const expectedOptimalCost = calculateShortestPathCost(
    graph,
    "n-2-0",
    "n-2-6",
  );
  return defineScenario({
    id: "weighted-terrain",
    name: "Weighted terrain",
    description:
      "A direct trail crosses slow ground and a costly bog; rocks block the upper passage while a longer southern route stays cheap.",
    category: "terrain",
    graph,
    startId: "n-2-0",
    goalId: "n-2-6",
    defaultAlgorithms: ["dijkstra", "astar", "greedy-best-first"],
    supportedAlgorithms: WEIGHTED_SEARCH_ALGORITHMS,
    allowedHeuristics: SPATIAL_HEURISTICS,
    defaultHeuristic: "manhattan",
    learningObjectives: [
      "Separate geometric closeness from accumulated terrain cost.",
      "Compare Dijkstra's broad cost search with A*'s directional guidance.",
      "Identify why Greedy Best-First can commit to expensive-looking progress.",
    ],
    seed: 3_303,
    expectedOptimalCost,
    expectedCosts: { weight: expectedOptimalCost },
    maxGraphSize: { nodes: 40, edges: 80 },
  });
}

function mazeGraph(seed: number): ScenarioGraph {
  const rows = 7;
  const columns = 9;
  const random = createSeededRandom(seed);
  const nodes: ScenarioNode[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      nodes.push({
        id: `m-${row}-${column}`,
        label: `${String.fromCharCode(65 + column)}${row + 1}`,
        x: column,
        y: row,
        nodeType: "intersection",
      });
    }
  }
  const key = (row: number, column: number) => `m-${row}-${column}`;
  const visited = new Set<string>([key(0, 0)]);
  const stack: [number, number][] = [[0, 0]];
  const edges: ScenarioEdge[] = [];
  while (stack.length > 0) {
    const [row, column] = stack[stack.length - 1];
    const candidates = [
      [row - 1, column],
      [row, column + 1],
      [row + 1, column],
      [row, column - 1],
    ].filter(
      ([candidateRow, candidateColumn]) =>
        candidateRow >= 0 &&
        candidateRow < rows &&
        candidateColumn >= 0 &&
        candidateColumn < columns &&
        !visited.has(key(candidateRow, candidateColumn)),
    );
    if (candidates.length === 0) {
      stack.pop();
      continue;
    }
    const next = candidates[Math.floor(random() * candidates.length)];
    const nextId = key(next[0], next[1]);
    edges.push(
      roadEdge(`maze-${edges.length}`, key(row, column), nextId, 1, {
        roadType: "corridor",
      }),
    );
    visited.add(nextId);
    stack.push([next[0], next[1]]);
  }
  return { nodes, edges };
}

function deterministicMaze(): Scenario {
  const seed = 4_404;
  const graph = mazeGraph(seed);
  const expectedOptimalCost = calculateShortestPathCost(
    graph,
    "m-0-0",
    "m-6-8",
  );
  return defineScenario({
    id: "maze",
    name: "Deterministic maze",
    description:
      "A seeded corridor maze winds through barriers, branches, and convincing dead ends without changing between runs.",
    category: "maze",
    graph,
    startId: "m-0-0",
    goalId: "m-6-8",
    defaultAlgorithms: ["bfs", "astar", "greedy-best-first"],
    supportedAlgorithms: UNIT_SEARCH_ALGORITHMS,
    allowedHeuristics: SPATIAL_HEURISTICS,
    defaultHeuristic: "manhattan",
    learningObjectives: [
      "Observe dead-end backtracking in a graph with exactly one route between cells.",
      "Compare guaranteed shortest-path search with heuristic urgency.",
      "Relate visible maze walls to absent graph edges.",
    ],
    seed,
    expectedOptimalCost,
    expectedCosts: { weight: expectedOptimalCost },
    maxGraphSize: { nodes: 70, edges: 100 },
  });
}

function oneWayDowntown(): Scenario {
  const size = 4;
  const nodes: ScenarioNode[] = [];
  const edges: ScenarioEdge[] = [];
  const id = (row: number, column: number) => `d-${row}-${column}`;
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      nodes.push({
        id: id(row, column),
        label: `${column + 1}${String.fromCharCode(65 + row)}`,
        x: column,
        y: row,
        nodeType: "intersection",
      });
    }
  }
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column + 1 < size; column += 1) {
      const eastbound = row % 2 === 0;
      edges.push(
        roadEdge(
          `h-${row}-${column}`,
          id(row, eastbound ? column : column + 1),
          id(row, eastbound ? column + 1 : column),
          1,
          { directed: true, roadType: "street" },
        ),
      );
    }
  }
  for (let column = 0; column < size; column += 1) {
    for (let row = 0; row + 1 < size; row += 1) {
      const southbound = column % 2 === 1;
      edges.push(
        roadEdge(
          `v-${column}-${row}`,
          id(southbound ? row : row + 1, column),
          id(southbound ? row + 1 : row, column),
          1,
          { directed: true, roadType: "street" },
        ),
      );
    }
  }
  const graph: ScenarioGraph = { nodes, edges };
  const expectedOptimalCost = calculateShortestPathCost(
    graph,
    "d-0-2",
    "d-0-1",
  );
  return defineScenario({
    id: "one-way-downtown",
    name: "One-way downtown",
    description:
      "The destination is one block away but faces the wrong direction; alternating one-way streets force a seven-block downtown loop.",
    category: "directed",
    graph,
    startId: "d-0-2",
    goalId: "d-0-1",
    defaultAlgorithms: ["bfs", "dijkstra", "bidirectional-dijkstra"],
    supportedAlgorithms: UNIT_SEARCH_ALGORITHMS,
    allowedHeuristics: SPATIAL_HEURISTICS,
    defaultHeuristic: "manhattan",
    learningObjectives: [
      "Follow edge direction even when two intersections appear visually adjacent.",
      "See why reverse search must traverse incoming edges on a directed graph.",
      "Compare the seven-block trip with the one-block route in the opposite direction.",
    ],
    seed: 5_505,
    expectedOptimalCost,
    expectedCosts: { weight: expectedOptimalCost },
    maxGraphSize: { nodes: 20, edges: 32 },
  });
}

function roadClosures(): Scenario {
  const nodes: ScenarioNode[] = [
    { id: "s", label: "Station", x: 0, y: 1, nodeType: "landmark" },
    { id: "a", label: "Ash", x: 1, y: 0.5, nodeType: "intersection" },
    { id: "b", label: "Bay", x: 2, y: 0.5, nodeType: "intersection" },
    { id: "c", label: "Canal", x: 0.75, y: 2, nodeType: "intersection" },
    { id: "d", label: "Depot", x: 1.5, y: 2.3, nodeType: "intersection" },
    { id: "e", label: "Elm", x: 2.4, y: 2, nodeType: "intersection" },
    { id: "g", label: "Hospital", x: 3, y: 1, nodeType: "landmark" },
  ];
  const edges: ScenarioEdge[] = [
    roadEdge("s-a", "s", "a", 2, { roadType: "local" }),
    roadEdge("a-b-closure", "a", "b", 2, {
      roadType: "bridge",
      closed: true,
      mutable: true,
      label: "Harbour overpass",
    }),
    roadEdge("b-g", "b", "g", 2, { roadType: "local" }),
    roadEdge("s-c", "s", "c", 2, { roadType: "local" }),
    roadEdge("c-d", "c", "d", 2, { roadType: "local", mutable: true }),
    roadEdge("d-e", "d", "e", 2, { roadType: "local", mutable: true }),
    roadEdge("e-g", "e", "g", 2, { roadType: "local" }),
    roadEdge("a-c", "a", "c", 3, { roadType: "local" }),
    roadEdge("b-e", "b", "e", 3, { roadType: "local" }),
  ];
  const graph: ScenarioGraph = { nodes, edges };
  const expectedOptimalCost = calculateShortestPathCost(graph, "s", "g");
  return defineScenario({
    id: "road-closures",
    name: "Dynamic road closures",
    description:
      "A closed harbour overpass diverts the active route through Canal and Elm; toggle marked roads to recalculate safely.",
    category: "dynamic",
    graph,
    startId: "s",
    goalId: "g",
    defaultAlgorithms: ["dijkstra", "astar"],
    supportedAlgorithms: WEIGHTED_SEARCH_ALGORITHMS,
    allowedHeuristics: ["zero", "euclidean"],
    defaultHeuristic: "euclidean",
    learningObjectives: [
      "Compare route cost before and after a local topology change.",
      "Confirm that closed edges are never inspected as traversable roads.",
      "Identify when a previously settled route must be computed again.",
    ],
    seed: 6_606,
    expectedOptimalCost,
    expectedCosts: { weight: expectedOptimalCost },
    editableEdgeIds: ["a-b-closure", "c-d", "d-e"],
    maxGraphSize: { nodes: 12, edges: 24 },
  });
}

function denseUrbanGraph(seed: number): ScenarioGraph {
  const size = 8;
  const random = createSeededRandom(seed);
  const nodes: ScenarioNode[] = [];
  const edges: ScenarioEdge[] = [];
  const id = (row: number, column: number) => `u-${row}-${column}`;
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      nodes.push({
        id: id(row, column),
        label: `${String.fromCharCode(65 + column)}${row + 1}`,
        x: column,
        y: row,
        nodeType: "intersection",
      });
    }
  }
  const add = (
    fromId: string,
    toId: string,
    weight: number,
    roadType: "street" | "local",
  ) =>
    edges.push(
      roadEdge(`urban-${edges.length}`, fromId, toId, weight, {
        roadType,
        distance: roadType === "local" ? Math.SQRT2 : 1,
      }),
    );
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      if (column + 1 < size)
        add(
          id(row, column),
          id(row, column + 1),
          1 + Math.floor(random() * 3),
          "street",
        );
      if (row + 1 < size)
        add(
          id(row, column),
          id(row + 1, column),
          1 + Math.floor(random() * 3),
          "street",
        );
      if (row + 1 < size && column + 1 < size) {
        add(id(row, column), id(row + 1, column + 1), 2, "local");
        add(id(row, column + 1), id(row + 1, column), 2, "local");
      }
    }
  }
  return { nodes, edges };
}

function denseUrban(): Scenario {
  const seed = 7_707;
  const graph = denseUrbanGraph(seed);
  const expectedOptimalCost = calculateShortestPathCost(
    graph,
    "u-0-0",
    "u-7-7",
  );
  return defineScenario({
    id: "dense-urban",
    name: "Dense urban network",
    description:
      "Short blocks, diagonal connectors, and frequent intersections create a high-branching network with many competitive frontiers.",
    category: "urban",
    graph,
    startId: "u-0-0",
    goalId: "u-7-7",
    defaultAlgorithms: ["dijkstra", "astar", "bidirectional-dijkstra"],
    supportedAlgorithms: WEIGHTED_SEARCH_ALGORITHMS,
    allowedHeuristics: SPATIAL_HEURISTICS,
    defaultHeuristic: "euclidean",
    learningObjectives: [
      "Compare expanded-node counts in a graph with a high branching factor.",
      "Measure the maximum frontier rather than judging only the final route.",
      "Observe how bidirectional search reduces the radius explored from each endpoint.",
    ],
    seed,
    expectedOptimalCost,
    expectedCosts: { weight: expectedOptimalCost },
    maxGraphSize: { nodes: 80, edges: 260 },
  });
}

function sparseRural(): Scenario {
  const nodes: ScenarioNode[] = [
    { id: "farm", label: "West farm", x: 0, y: 4, nodeType: "landmark" },
    { id: "willow", label: "Willow", x: 2, y: 2.5, nodeType: "waypoint" },
    { id: "mill", label: "Old mill", x: 2.5, y: 6, nodeType: "waypoint" },
    { id: "bridge-west", label: "West bank", x: 5, y: 4, nodeType: "waypoint" },
    { id: "bridge-east", label: "East bank", x: 8, y: 4, nodeType: "waypoint" },
    { id: "pine", label: "Pine", x: 10, y: 2, nodeType: "waypoint" },
    { id: "marsh", label: "Marsh", x: 10.5, y: 6, nodeType: "waypoint" },
    { id: "lake", label: "Lake", x: 14, y: 4, nodeType: "landmark" },
    { id: "village", label: "Village", x: 3.5, y: 1, nodeType: "landmark" },
    { id: "lookout", label: "Lookout", x: 4, y: 7.5, nodeType: "landmark" },
    { id: "orchard", label: "Orchard", x: 11.5, y: 0.5, nodeType: "landmark" },
    { id: "wetland", label: "Wetland", x: 12, y: 7.5, nodeType: "landmark" },
  ];
  const edges: ScenarioEdge[] = [
    roadEdge("farm-willow", "farm", "willow", 4, { roadType: "local" }),
    roadEdge("farm-mill", "farm", "mill", 5, { roadType: "local" }),
    roadEdge("willow-bank", "willow", "bridge-west", 5, { roadType: "local" }),
    roadEdge("mill-bank", "mill", "bridge-west", 4, { roadType: "local" }),
    roadEdge("willow-village", "willow", "village", 3, { roadType: "local" }),
    roadEdge("village-bank", "village", "bridge-west", 7, {
      roadType: "local",
    }),
    roadEdge("mill-lookout", "mill", "lookout", 4, { roadType: "trail" }),
    roadEdge("critical-bridge", "bridge-west", "bridge-east", 8, {
      roadType: "bridge",
      mutable: true,
      label: "Single-lane river bridge",
    }),
    roadEdge("bank-pine", "bridge-east", "pine", 4, { roadType: "local" }),
    roadEdge("bank-marsh", "bridge-east", "marsh", 4, { roadType: "local" }),
    roadEdge("pine-lake", "pine", "lake", 6, { roadType: "local" }),
    roadEdge("marsh-lake", "marsh", "lake", 5, { roadType: "local" }),
    roadEdge("pine-orchard", "pine", "orchard", 3, { roadType: "trail" }),
    roadEdge("marsh-wetland", "marsh", "wetland", 4, { roadType: "trail" }),
  ];
  const graph: ScenarioGraph = { nodes, edges };
  const expectedOptimalCost = calculateShortestPathCost(graph, "farm", "lake");
  return defineScenario({
    id: "sparse-rural",
    name: "Sparse rural network",
    description:
      "Long roads connect small clusters through a single river bridge; closing that critical link separates the entire region.",
    category: "rural",
    graph,
    startId: "farm",
    goalId: "lake",
    defaultAlgorithms: ["dijkstra", "astar", "bidirectional-dijkstra"],
    supportedAlgorithms: WEIGHTED_SEARCH_ALGORITHMS,
    allowedHeuristics: ["zero", "euclidean"],
    defaultHeuristic: "euclidean",
    learningObjectives: [
      "Recognize a bridge edge whose removal disconnects two graph components.",
      "Contrast sparse-network frontier behavior with the dense urban scenario.",
      "Understand why long geometric edges do not imply many algorithm steps.",
    ],
    seed: 8_808,
    expectedOptimalCost,
    expectedCosts: { weight: expectedOptimalCost },
    editableEdgeIds: ["critical-bridge"],
    maxGraphSize: { nodes: 20, edges: 30 },
  });
}

function misleadingHeuristic(): Scenario {
  const nodes: ScenarioNode[] = [
    { id: "s", label: "Start", x: 0, y: 0, nodeType: "landmark" },
    {
      id: "temptation",
      label: "Near goal",
      x: 3.8,
      y: 0,
      nodeType: "waypoint",
    },
    { id: "detour-1", label: "South fork", x: 1, y: 1, nodeType: "waypoint" },
    { id: "detour-2", label: "Creek bend", x: 2.5, y: 1, nodeType: "waypoint" },
    { id: "g", label: "Goal", x: 4, y: 0, nodeType: "landmark" },
  ];
  const graph: ScenarioGraph = {
    nodes,
    edges: [
      roadEdge("expensive-first", "s", "temptation", 20, { roadType: "local" }),
      roadEdge("expensive-finish", "temptation", "g", 1, { roadType: "local" }),
      roadEdge("good-1", "s", "detour-1", 2, { roadType: "local" }),
      roadEdge("good-2", "detour-1", "detour-2", 2, { roadType: "local" }),
      roadEdge("good-3", "detour-2", "g", 2, { roadType: "local" }),
    ],
  };
  return defineScenario({
    id: "misleading-heuristic",
    name: "Misleading heuristic",
    description:
      "A waypoint almost touches the goal on screen but costs twenty to enter; the modest southern arc is optimal by a wide margin.",
    category: "heuristic",
    graph,
    startId: "s",
    goalId: "g",
    defaultAlgorithms: ["greedy-best-first", "astar", "dijkstra"],
    supportedAlgorithms: WEIGHTED_SEARCH_ALGORITHMS,
    allowedHeuristics: ["zero", "euclidean"],
    defaultHeuristic: "euclidean",
    learningObjectives: [
      "See Greedy Best-First return a cost-21 path while A* and Dijkstra find cost 6.",
      "Distinguish h(n) from A*'s combined g(n) plus h(n) priority.",
      "Explain why apparent proximity cannot replace accumulated path cost.",
    ],
    seed: 9_909,
    expectedOptimalCost: 6,
    expectedCosts: { weight: 6 },
    maxGraphSize: { nodes: 8, edges: 12 },
  });
}

function noAvailablePath(): Scenario {
  const nodes: ScenarioNode[] = [
    { id: "a", label: "Start", x: 0, y: 1, nodeType: "landmark" },
    { id: "b", label: "West 1", x: 1.5, y: 0, nodeType: "intersection" },
    { id: "c", label: "West 2", x: 1.5, y: 2, nodeType: "intersection" },
    { id: "d", label: "West edge", x: 3, y: 1, nodeType: "intersection" },
    { id: "e", label: "East edge", x: 5, y: 1, nodeType: "intersection" },
    { id: "f", label: "East 1", x: 6.5, y: 0, nodeType: "intersection" },
    { id: "h", label: "East 2", x: 6.5, y: 2, nodeType: "intersection" },
    { id: "g", label: "Goal", x: 8, y: 1, nodeType: "landmark" },
  ];
  const graph: ScenarioGraph = {
    nodes,
    edges: [
      roadEdge("a-b", "a", "b", 2),
      roadEdge("a-c", "a", "c", 2),
      roadEdge("b-d", "b", "d", 2),
      roadEdge("c-d", "c", "d", 2),
      roadEdge("blocked-bridge", "d", "e", 2, {
        roadType: "bridge",
        closed: true,
        mutable: true,
        label: "Closed bridge",
      }),
      roadEdge("e-f", "e", "f", 2),
      roadEdge("e-h", "e", "h", 2),
      roadEdge("f-g", "f", "g", 2),
      roadEdge("h-g", "h", "g", 2),
    ],
  };
  return defineScenario({
    id: "no-path",
    name: "No available path",
    description:
      "Two healthy road clusters face each other across a closed bridge, so every supported algorithm must exhaust its work and report no route.",
    category: "disconnected",
    graph,
    startId: "a",
    goalId: "g",
    defaultAlgorithms: ["bfs", "dijkstra", "astar"],
    supportedAlgorithms: [...UNIT_SEARCH_ALGORITHMS, "floyd-warshall"],
    allowedHeuristics: ["zero", "euclidean"],
    defaultHeuristic: "euclidean",
    learningObjectives: [
      "Recognize frontier exhaustion as a valid result rather than an error.",
      "Verify that every returned path avoids closed roads.",
      "Compare how quickly different searches establish that no route exists.",
    ],
    seed: 10_010,
    expectedOptimalCost: null,
    expectedCosts: { weight: null },
    editableEdgeIds: ["blocked-bridge"],
    maxGraphSize: { nodes: 12, edges: 20 },
  });
}

function negativeEdgeDemo(): Scenario {
  const nodes: ScenarioNode[] = [
    { id: "a", label: "A", x: 0, y: 1, nodeType: "abstract" },
    { id: "b", label: "B", x: 2, y: 0, nodeType: "abstract" },
    { id: "c", label: "C", x: 3, y: 2, nodeType: "abstract" },
    { id: "d", label: "D", x: 5, y: 1, nodeType: "abstract" },
  ];
  const graph: ScenarioGraph = {
    nodes,
    edges: [
      roadEdge("a-b", "a", "b", 4, { directed: true, roadType: "abstract" }),
      roadEdge("a-c", "a", "c", 5, { directed: true, roadType: "abstract" }),
      roadEdge("b-c-negative", "b", "c", -2, {
        directed: true,
        roadType: "abstract",
        distance: 1,
        travelTime: 1,
        label: "Negative edge",
      }),
      roadEdge("c-d", "c", "d", 3, { directed: true, roadType: "abstract" }),
      roadEdge("b-d", "b", "d", 6, { directed: true, roadType: "abstract" }),
      roadEdge("c-b-cycle", "c", "b", 1, {
        directed: true,
        roadType: "abstract",
        closed: true,
        mutable: true,
        label: "Open to create a negative cycle",
      }),
    ],
  };
  return defineScenario({
    id: "negative-edge-demo",
    name: "Negative edge demonstration",
    description:
      "A small abstract graph gives Bellman-Ford a legitimate negative edge; opening the return edge creates a reachable negative cycle.",
    category: "graph-theory",
    graph,
    startId: "a",
    goalId: "d",
    defaultAlgorithms: ["bellman-ford"],
    supportedAlgorithms: ["bellman-ford", "floyd-warshall"],
    allowedHeuristics: ["zero"],
    defaultHeuristic: "zero",
    learningObjectives: [
      "Explain why Dijkstra is disabled when an open edge has negative weight.",
      "Trace repeated relaxation across the graph's edges.",
      "Open the optional return edge to create and detect a negative cycle.",
    ],
    seed: 11_011,
    expectedOptimalCost: 5,
    expectedCosts: { weight: 5 },
    editableEdgeIds: ["c-b-cycle"],
    maxGraphSize: { nodes: 8, edges: 16 },
  });
}

function allPairsMatrix(): Scenario {
  const nodes: ScenarioNode[] = [
    { id: "a", label: "A", x: 0, y: 1.5, nodeType: "abstract" },
    { id: "b", label: "B", x: 2, y: 0, nodeType: "abstract" },
    { id: "c", label: "C", x: 4, y: 0.5, nodeType: "abstract" },
    { id: "d", label: "D", x: 4, y: 3, nodeType: "abstract" },
    { id: "e", label: "E", x: 1.5, y: 3.5, nodeType: "abstract" },
  ];
  const directed = (id: string, fromId: string, toId: string, weight: number) =>
    roadEdge(id, fromId, toId, weight, {
      directed: true,
      roadType: "abstract",
    });
  const graph: ScenarioGraph = {
    nodes,
    edges: [
      directed("a-b", "a", "b", 4),
      directed("a-c", "a", "c", 9),
      directed("b-c", "b", "c", 2),
      directed("b-d", "b", "d", 6),
      directed("c-d", "c", "d", 3),
      directed("c-e", "c", "e", 7),
      directed("d-e", "d", "e", 1),
      directed("e-a", "e", "a", 8),
      directed("e-b", "e", "b", 5),
    ],
  };
  return defineScenario({
    id: "all-pairs-matrix",
    name: "All-pairs distance matrix",
    description:
      "Five directed vertices keep every matrix update visible as Floyd-Warshall admits one intermediate vertex at a time.",
    category: "all-pairs",
    graph,
    startId: "a",
    goalId: "d",
    defaultAlgorithms: ["floyd-warshall"],
    supportedAlgorithms: ["floyd-warshall"],
    allowedHeuristics: ["zero"],
    defaultHeuristic: "zero",
    learningObjectives: [
      "Read infinity, direct-edge, and improved entries in an all-pairs matrix.",
      "Connect each matrix update to the current intermediate vertex.",
      "Explain Floyd-Warshall's cubic running time and small-graph limit.",
    ],
    seed: 12_012,
    expectedOptimalCost: 9,
    expectedCosts: { weight: 9 },
    maxGraphSize: { nodes: 12, edges: 48 },
  });
}

const scenarios = [
  uniformCityGrid(),
  highwayVersusLocal(),
  weightedTerrain(),
  deterministicMaze(),
  oneWayDowntown(),
  roadClosures(),
  denseUrban(),
  sparseRural(),
  misleadingHeuristic(),
  noAvailablePath(),
  negativeEdgeDemo(),
  allPairsMatrix(),
];

if (
  scenarios.length !== 12 ||
  new Set(scenarios.map((scenario) => scenario.id)).size !== 12
) {
  throw new Error(
    "RouteLab must ship exactly 12 uniquely identified built-in scenarios.",
  );
}

export const BUILT_IN_SCENARIOS: readonly Scenario[] = Object.freeze(scenarios);
export const BUILT_IN_SCENARIO_IDS = Object.freeze(
  BUILT_IN_SCENARIOS.map((scenario) => scenario.id),
);

const SCENARIO_BY_ID = new Map(
  BUILT_IN_SCENARIOS.map((scenario) => [scenario.id, scenario] as const),
);

export function getScenario(id: string): Scenario | undefined {
  return SCENARIO_BY_ID.get(id);
}

export function isBuiltInScenarioId(id: string): boolean {
  return SCENARIO_BY_ID.has(id);
}
