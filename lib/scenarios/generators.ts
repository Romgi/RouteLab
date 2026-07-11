import type { AlgorithmId, HeuristicId } from "@/lib/algorithms";
import { z } from "zod";

import { SCENARIO_LIMITS, SCENARIO_SCHEMA_VERSION } from "./constants";
import type {
  CameraBounds,
  GridScenarioOptions,
  RandomScenarioOptions,
  Scenario,
  ScenarioEdge,
  ScenarioGraph,
  ScenarioNode,
} from "./types";
import { assertValidScenario } from "./validation";

const GENERATOR_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u;

const optionalText = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .refine((value) => !/[\u0000-\u001f\u007f]/u.test(value), {
      message: "Text contains a disallowed control character.",
    })
    .optional();

const gridOptionsSchema = z
  .object({
    rows: z
      .number()
      .int()
      .min(2)
      .max(SCENARIO_LIMITS.maxGeneratorDimension)
      .default(8),
    columns: z
      .number()
      .int()
      .min(2)
      .max(SCENARIO_LIMITS.maxGeneratorDimension)
      .default(8),
    seed: z.number().int().min(0).max(0xffff_ffff).default(20_260_710),
    id: z
      .string()
      .min(1)
      .max(SCENARIO_LIMITS.maxIdLength)
      .regex(GENERATOR_ID)
      .optional(),
    name: optionalText(SCENARIO_LIMITS.maxNameLength),
    description: optionalText(SCENARIO_LIMITS.maxDescriptionLength),
    spacing: z.number().finite().positive().max(10_000).default(1),
    jitter: z.number().finite().min(0).max(0.45).default(0),
    minWeight: z
      .number()
      .int()
      .min(1)
      .max(SCENARIO_LIMITS.maxAbsoluteWeight)
      .default(1),
    maxWeight: z
      .number()
      .int()
      .min(1)
      .max(SCENARIO_LIMITS.maxAbsoluteWeight)
      .default(1),
    oneWayProbability: z.number().finite().min(0).max(1).default(0),
    closedEdgeProbability: z.number().finite().min(0).max(1).default(0),
    startRow: z.number().int().min(0).optional(),
    startColumn: z.number().int().min(0).optional(),
    goalRow: z.number().int().min(0).optional(),
    goalColumn: z.number().int().min(0).optional(),
  })
  .strict()
  .superRefine((options, context) => {
    if (options.rows * options.columns > SCENARIO_LIMITS.maxNodes) {
      context.addIssue({
        code: "custom",
        message: `Generated grids cannot exceed ${SCENARIO_LIMITS.maxNodes} nodes.`,
        path: ["rows"],
      });
    }
    if (options.minWeight > options.maxWeight) {
      context.addIssue({
        code: "custom",
        message: "minWeight cannot exceed maxWeight.",
        path: ["minWeight"],
      });
    }
    const positions = [
      ["startRow", options.startRow, options.rows],
      ["goalRow", options.goalRow, options.rows],
      ["startColumn", options.startColumn, options.columns],
      ["goalColumn", options.goalColumn, options.columns],
    ] as const;
    positions.forEach(([name, value, limit]) => {
      if (value !== undefined && value >= limit) {
        context.addIssue({
          code: "custom",
          message: `${name} must be within the grid.`,
          path: [name],
        });
      }
    });
  });

const randomOptionsSchema = z
  .object({
    nodeCount: z
      .number()
      .int()
      .min(2)
      .max(SCENARIO_LIMITS.maxNodes)
      .default(24),
    edgeDensity: z.number().finite().min(0).max(1).default(0.16),
    seed: z.number().int().min(0).max(0xffff_ffff).default(20_260_710),
    id: z
      .string()
      .min(1)
      .max(SCENARIO_LIMITS.maxIdLength)
      .regex(GENERATOR_ID)
      .optional(),
    name: optionalText(SCENARIO_LIMITS.maxNameLength),
    description: optionalText(SCENARIO_LIMITS.maxDescriptionLength),
    directed: z.boolean().default(false),
    ensureConnected: z.boolean().default(true),
    minWeight: z
      .number()
      .int()
      .min(1)
      .max(SCENARIO_LIMITS.maxAbsoluteWeight)
      .default(1),
    maxWeight: z
      .number()
      .int()
      .min(1)
      .max(SCENARIO_LIMITS.maxAbsoluteWeight)
      .default(9),
    width: z.number().finite().positive().max(10_000).default(12),
    height: z.number().finite().positive().max(10_000).default(8),
  })
  .strict()
  .superRefine((options, context) => {
    if (options.minWeight > options.maxWeight) {
      context.addIssue({
        code: "custom",
        message: "minWeight cannot exceed maxWeight.",
        path: ["minWeight"],
      });
    }
  });

function parseGeneratorOptions<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const message =
      result.error.issues[0]?.message ?? "Invalid generator options.";
    throw new RangeError(message);
  }
  return result.data;
}

/** Mulberry32 with an explicit unsigned 32-bit state. */
export function createSeededRandom(seed: number): () => number {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffff_ffff) {
    throw new RangeError("Seed must be an integer between 0 and 4294967295.");
  }
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function randomInteger(
  random: () => number,
  minimum: number,
  maximum: number,
): number {
  return minimum + Math.floor(random() * (maximum - minimum + 1));
}

function round(value: number, places = 6): number {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

export function calculateCameraBounds(
  nodes: readonly Pick<ScenarioNode, "x" | "y">[],
  padding = 0.75,
): CameraBounds {
  if (nodes.length === 0) {
    throw new RangeError("Camera bounds require at least one node.");
  }
  let minX = Math.min(...nodes.map((node) => node.x));
  let maxX = Math.max(...nodes.map((node) => node.x));
  let minY = Math.min(...nodes.map((node) => node.y));
  let maxY = Math.max(...nodes.map((node) => node.y));
  if (minX === maxX) {
    minX -= 0.5;
    maxX += 0.5;
  }
  if (minY === maxY) {
    minY -= 0.5;
    maxY += 0.5;
  }
  return { minX, minY, maxX, maxY, padding };
}

export function calculateShortestPathCost(
  graph: ScenarioGraph,
  startId: string,
  goalId: string,
): number | null {
  if (startId === goalId) return 0;
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  if (!nodeIds.has(startId) || !nodeIds.has(goalId)) return null;

  const arcs: { fromId: string; toId: string; weight: number }[] = [];
  graph.edges.forEach((edge) => {
    if (edge.closed) return;
    arcs.push({ fromId: edge.fromId, toId: edge.toId, weight: edge.weight });
    if (!edge.directed) {
      arcs.push({ fromId: edge.toId, toId: edge.fromId, weight: edge.weight });
    }
  });

  if (arcs.some((edge) => edge.weight < 0)) {
    const distances = new Map<string, number>([[startId, 0]]);
    for (let pass = 1; pass < graph.nodes.length; pass += 1) {
      let changed = false;
      for (const edge of arcs) {
        const fromDistance = distances.get(edge.fromId);
        if (fromDistance === undefined) continue;
        const candidate = fromDistance + edge.weight;
        if (
          candidate < (distances.get(edge.toId) ?? Number.POSITIVE_INFINITY)
        ) {
          distances.set(edge.toId, candidate);
          changed = true;
        }
      }
      if (!changed) break;
    }
    if (
      arcs.some((edge) => {
        const fromDistance = distances.get(edge.fromId);
        return (
          fromDistance !== undefined &&
          fromDistance + edge.weight <
            (distances.get(edge.toId) ?? Number.POSITIVE_INFINITY)
        );
      })
    ) {
      throw new RangeError(
        "Shortest cost is undefined because a reachable negative cycle exists.",
      );
    }
    return distances.get(goalId) ?? null;
  }

  const adjacency = new Map<string, { toId: string; weight: number }[]>();
  graph.nodes.forEach((node) => adjacency.set(node.id, []));
  arcs.forEach((edge) => {
    adjacency.get(edge.fromId)?.push({ toId: edge.toId, weight: edge.weight });
  });

  const distances = new Map<string, number>([[startId, 0]]);
  const frontier: { nodeId: string; distance: number }[] = [
    { nodeId: startId, distance: 0 },
  ];
  while (frontier.length > 0) {
    frontier.sort(
      (left, right) =>
        right.distance - left.distance ||
        right.nodeId.localeCompare(left.nodeId, "en"),
    );
    const current = frontier.pop();
    if (!current || current.distance !== distances.get(current.nodeId))
      continue;
    if (current.nodeId === goalId) return current.distance;
    for (const edge of adjacency.get(current.nodeId) ?? []) {
      const candidate = current.distance + edge.weight;
      if (candidate < (distances.get(edge.toId) ?? Number.POSITIVE_INFINITY)) {
        distances.set(edge.toId, candidate);
        frontier.push({ nodeId: edge.toId, distance: candidate });
      }
    }
  }
  return null;
}

function supportedAlgorithmsForGraph(graph: ScenarioGraph): AlgorithmId[] {
  const openEdges = graph.edges.filter((edge) => !edge.closed);
  const uniform =
    openEdges.length === 0 ||
    openEdges.every((edge) => edge.weight === openEdges[0].weight);
  const algorithms: AlgorithmId[] = [];
  if (uniform) algorithms.push("bfs");
  algorithms.push(
    "dijkstra",
    "astar",
    "greedy-best-first",
    "bidirectional-dijkstra",
    "bellman-ford",
  );
  if (graph.nodes.length <= SCENARIO_LIMITS.maxFloydWarshallNodes) {
    algorithms.push("floyd-warshall");
  }
  return algorithms;
}

function buildGrid(options: z.output<typeof gridOptionsSchema>): {
  graph: ScenarioGraph;
  editableEdgeIds: string[];
} {
  const random = createSeededRandom(options.seed);
  const nodes: ScenarioNode[] = [];
  for (let row = 0; row < options.rows; row += 1) {
    for (let column = 0; column < options.columns; column += 1) {
      const offsetX =
        options.jitter === 0 ? 0 : (random() * 2 - 1) * options.jitter;
      const offsetY =
        options.jitter === 0 ? 0 : (random() * 2 - 1) * options.jitter;
      nodes.push({
        id: `n-${row}-${column}`,
        label: `${String.fromCharCode(65 + (column % 26))}${row + 1}`,
        x: round((column + offsetX) * options.spacing),
        y: round((row + offsetY) * options.spacing),
        nodeType: "intersection",
      });
    }
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const edges: ScenarioEdge[] = [];
  const editableEdgeIds: string[] = [];
  let edgeIndex = 0;
  const addEdge = (
    row: number,
    column: number,
    nextRow: number,
    nextColumn: number,
  ) => {
    let fromId = `n-${row}-${column}`;
    let toId = `n-${nextRow}-${nextColumn}`;
    const directed = random() < options.oneWayProbability;
    if (directed && random() < 0.5) {
      [fromId, toId] = [toId, fromId];
    }
    const closed = random() < options.closedEdgeProbability;
    const id = `e-${edgeIndex}`;
    edgeIndex += 1;
    const from = nodeById.get(fromId) as ScenarioNode;
    const to = nodeById.get(toId) as ScenarioNode;
    const weight = randomInteger(random, options.minWeight, options.maxWeight);
    edges.push({
      id,
      fromId,
      toId,
      weight,
      directed,
      distance: round(Math.hypot(to.x - from.x, to.y - from.y)),
      travelTime: weight,
      roadType: "street",
      ...(closed ? { closed: true, mutable: true } : {}),
    });
    if (closed) editableEdgeIds.push(id);
  };

  for (let row = 0; row < options.rows; row += 1) {
    for (let column = 0; column < options.columns; column += 1) {
      if (column + 1 < options.columns) addEdge(row, column, row, column + 1);
      if (row + 1 < options.rows) addEdge(row, column, row + 1, column);
    }
  }
  return { graph: { nodes, edges }, editableEdgeIds };
}

export function generateGridScenario(
  options: GridScenarioOptions = {},
): Scenario {
  const parsed = parseGeneratorOptions(gridOptionsSchema, options);
  const { graph, editableEdgeIds } = buildGrid(parsed);
  const startRow = parsed.startRow ?? 0;
  const startColumn = parsed.startColumn ?? 0;
  const goalRow = parsed.goalRow ?? parsed.rows - 1;
  const goalColumn = parsed.goalColumn ?? parsed.columns - 1;
  const startId = `n-${startRow}-${startColumn}`;
  const goalId = `n-${goalRow}-${goalColumn}`;
  const supportedAlgorithms = supportedAlgorithmsForGraph(graph);
  const defaultAlgorithms = supportedAlgorithms.includes("bfs")
    ? (["bfs", "dijkstra", "astar"] satisfies AlgorithmId[])
    : (["dijkstra", "astar", "greedy-best-first"] satisfies AlgorithmId[]);
  const heuristics: HeuristicId[] =
    parsed.jitter === 0 && parsed.spacing <= parsed.minWeight
      ? ["zero", "manhattan", "euclidean"]
      : ["zero"];
  const expectedOptimalCost = calculateShortestPathCost(graph, startId, goalId);
  return assertValidScenario({
    schemaVersion: SCENARIO_SCHEMA_VERSION,
    id:
      parsed.id ??
      `generated-grid-${parsed.rows}x${parsed.columns}-${parsed.seed}`,
    name: parsed.name ?? `Seeded ${parsed.rows} by ${parsed.columns} grid`,
    description:
      parsed.description ??
      "A deterministic grid generated locally from explicit dimensions, weights, and seed.",
    category: "grid",
    graph,
    startId,
    goalId,
    defaultAlgorithms,
    supportedAlgorithms,
    allowedHeuristics: heuristics,
    defaultHeuristic: heuristics.includes("manhattan") ? "manhattan" : "zero",
    availableCostMetrics: ["weight", "distance", "travelTime"],
    defaultCostMetric: "weight",
    cameraBounds: calculateCameraBounds(graph.nodes),
    learningObjectives: [
      "Reproduce the same graph from the same seed and generator settings.",
      "Compare uninformed and heuristic search on a controlled topology.",
    ],
    seed: parsed.seed,
    expectedOptimalCost,
    expectedCosts: { weight: expectedOptimalCost },
    maxGraphSize: {
      nodes: supportedAlgorithms.includes("floyd-warshall")
        ? SCENARIO_LIMITS.maxFloydWarshallNodes
        : SCENARIO_LIMITS.maxNodes,
      edges: SCENARIO_LIMITS.maxEdges,
    },
    ...(editableEdgeIds.length > 0 ? { editableEdgeIds } : {}),
  });
}

export function generateGridGraph(
  options: GridScenarioOptions = {},
): ScenarioGraph {
  return generateGridScenario(options).graph;
}

function buildRandomGraph(
  options: z.output<typeof randomOptionsSchema>,
): ScenarioGraph {
  const random = createSeededRandom(options.seed);
  const nodes: ScenarioNode[] = Array.from(
    { length: options.nodeCount },
    (_, index) => ({
      id: `n-${index}`,
      label: `N${index + 1}`,
      x: round(random() * options.width, 3),
      y: round(random() * options.height, 3),
      nodeType:
        index === 0 || index === options.nodeCount - 1
          ? "landmark"
          : "waypoint",
    }),
  );

  const maxPotentialEdges = options.directed
    ? options.nodeCount * (options.nodeCount - 1)
    : (options.nodeCount * (options.nodeCount - 1)) / 2;
  const connectedMinimum = options.ensureConnected ? options.nodeCount - 1 : 0;
  const targetEdgeCount = Math.min(
    SCENARIO_LIMITS.maxEdges,
    maxPotentialEdges,
    Math.max(
      connectedMinimum,
      Math.round(maxPotentialEdges * options.edgeDensity),
    ),
  );
  const edges: ScenarioEdge[] = [];
  const keys = new Set<string>();

  const edgeKey = (fromIndex: number, toIndex: number) =>
    options.directed
      ? `${fromIndex}>${toIndex}`
      : `${Math.min(fromIndex, toIndex)}-${Math.max(fromIndex, toIndex)}`;
  const addEdge = (fromIndex: number, toIndex: number): boolean => {
    if (fromIndex === toIndex) return false;
    const key = edgeKey(fromIndex, toIndex);
    if (keys.has(key)) return false;
    keys.add(key);
    const from = nodes[fromIndex];
    const to = nodes[toIndex];
    const weight = randomInteger(random, options.minWeight, options.maxWeight);
    edges.push({
      id: `e-${edges.length}`,
      fromId: from.id,
      toId: to.id,
      weight,
      directed: options.directed,
      distance: round(Math.hypot(to.x - from.x, to.y - from.y)),
      travelTime: weight,
      roadType: "abstract",
    });
    return true;
  };

  if (options.ensureConnected) {
    for (let index = 1; index < nodes.length; index += 1) {
      addEdge(randomInteger(random, 0, index - 1), index);
    }
  }

  const attemptLimit = Math.max(100, targetEdgeCount * 20);
  let attempts = 0;
  while (edges.length < targetEdgeCount && attempts < attemptLimit) {
    attempts += 1;
    addEdge(
      randomInteger(random, 0, nodes.length - 1),
      randomInteger(random, 0, nodes.length - 1),
    );
  }

  // Dense, small graphs can exhaust random sampling near the end. A stable scan
  // fills the remainder without an unbounded retry loop.
  for (
    let fromIndex = 0;
    fromIndex < nodes.length && edges.length < targetEdgeCount;
    fromIndex += 1
  ) {
    for (
      let toIndex = 0;
      toIndex < nodes.length && edges.length < targetEdgeCount;
      toIndex += 1
    ) {
      addEdge(fromIndex, toIndex);
    }
  }
  return { nodes, edges };
}

export function generateRandomScenario(
  options: RandomScenarioOptions = {},
): Scenario {
  const parsed = parseGeneratorOptions(randomOptionsSchema, options);
  const graph = buildRandomGraph(parsed);
  const supportedAlgorithms = supportedAlgorithmsForGraph(graph);
  const startId = graph.nodes[0].id;
  const goalId = graph.nodes[graph.nodes.length - 1].id;
  const expectedOptimalCost = calculateShortestPathCost(graph, startId, goalId);
  return assertValidScenario({
    schemaVersion: SCENARIO_SCHEMA_VERSION,
    id: parsed.id ?? `generated-random-${parsed.nodeCount}-${parsed.seed}`,
    name: parsed.name ?? `Seeded random graph with ${parsed.nodeCount} nodes`,
    description:
      parsed.description ??
      "A bounded random graph produced by RouteLab's deterministic local generator.",
    category: "generated",
    graph,
    startId,
    goalId,
    defaultAlgorithms: supportedAlgorithms.includes("bfs")
      ? ["bfs", "dijkstra", "astar"]
      : ["dijkstra", "astar", "greedy-best-first"],
    supportedAlgorithms,
    allowedHeuristics: ["zero"],
    defaultHeuristic: "zero",
    availableCostMetrics: ["weight", "distance", "travelTime"],
    defaultCostMetric: "weight",
    cameraBounds: calculateCameraBounds(graph.nodes),
    learningObjectives: [
      "Study how edge density changes frontier size and exploration order.",
      "Repeat an experiment exactly by preserving its seed and settings.",
    ],
    seed: parsed.seed,
    expectedOptimalCost,
    expectedCosts: { weight: expectedOptimalCost },
    maxGraphSize: {
      nodes: supportedAlgorithms.includes("floyd-warshall")
        ? SCENARIO_LIMITS.maxFloydWarshallNodes
        : SCENARIO_LIMITS.maxNodes,
      edges: SCENARIO_LIMITS.maxEdges,
    },
  });
}

export function generateRandomGraph(
  options: RandomScenarioOptions = {},
): ScenarioGraph {
  return generateRandomScenario(options).graph;
}
