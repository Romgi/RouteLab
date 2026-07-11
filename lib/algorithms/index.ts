/**
 * RouteLab's deterministic, dependency-free algorithm engine.
 *
 * This module deliberately has no React, DOM, worker, or Node dependencies so
 * the same implementation can run on the main thread, in a Web Worker, or in
 * server-side tests.
 */

export const ALGORITHM_IDS = [
  "bfs",
  "dijkstra",
  "astar",
  "greedy-best-first",
  "bidirectional-dijkstra",
  "bellman-ford",
  "floyd-warshall",
] as const;

export type AlgorithmId = (typeof ALGORITHM_IDS)[number];

export const HEURISTIC_IDS = [
  "zero",
  "manhattan",
  "euclidean",
  "geographic",
] as const;

export type HeuristicId = (typeof HEURISTIC_IDS)[number];

export const TRAVEL_MODELS = [
  "weight",
  "distance",
  "travel-time",
  "travelTime",
  "hops",
  "avoid-tolls",
  "cycling",
] as const;

export type TravelModel = (typeof TRAVEL_MODELS)[number];

export type GraphMetadataValue = string | number | boolean | null;

export interface GraphNode {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly latitude?: number;
  readonly longitude?: number;
  readonly label?: string;
  readonly nodeType?: string;
  readonly metadata?: Readonly<Record<string, GraphMetadataValue>>;
}

export interface GraphEdge {
  readonly id: string;
  readonly fromId: string;
  readonly toId: string;
  /** Omitted means directed. Set to false for a road traversable both ways. */
  readonly directed?: boolean;
  readonly weight: number;
  readonly distance?: number;
  readonly travelTime?: number;
  readonly roadType?: string;
  readonly speed?: number;
  readonly toll?: boolean;
  readonly closed?: boolean;
  readonly terrainMultiplier?: number;
  readonly safetyMultiplier?: number;
  readonly label?: string;
  readonly metadata?: Readonly<Record<string, GraphMetadataValue>>;
}

export interface Graph {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
}

export type TraceDirection = "forward" | "backward";

export type CodeSection =
  | "initialize"
  | "frontier"
  | "dequeue"
  | "visit"
  | "neighbor-loop"
  | "relaxation"
  | "distance-update"
  | "parent-update"
  | "meeting-condition"
  | "matrix-initialize"
  | "matrix-intermediate"
  | "matrix-update"
  | "negative-cycle"
  | "path-reconstruction"
  | "termination";

interface TraceEventCommon {
  readonly step: number;
  readonly algorithmId: AlgorithmId;
  readonly codeSection: CodeSection;
  readonly message: string;
}

export type AlgorithmTraceEvent =
  | (TraceEventCommon & {
      readonly type: "initialize";
      readonly startId: string;
      readonly goalId: string;
      readonly travelModel: TravelModel;
      readonly heuristicId: HeuristicId;
    })
  | (TraceEventCommon & {
      readonly type: "enqueue";
      readonly nodeId: string;
      readonly priority: number;
      readonly distance: number;
      readonly direction?: TraceDirection;
    })
  | (TraceEventCommon & {
      readonly type: "dequeue";
      readonly nodeId: string;
      readonly priority: number;
      readonly distance: number;
      readonly direction?: TraceDirection;
    })
  | (TraceEventCommon & {
      readonly type: "visitNode";
      readonly nodeId: string;
      readonly distance: number;
      readonly direction?: TraceDirection;
    })
  | (TraceEventCommon & {
      readonly type: "inspectEdge";
      readonly edgeId: string;
      readonly fromId: string;
      readonly toId: string;
      readonly cost: number;
      readonly direction?: TraceDirection;
    })
  | (TraceEventCommon & {
      readonly type: "relaxEdge";
      readonly edgeId: string;
      readonly fromId: string;
      readonly toId: string;
      readonly oldDistance: number;
      readonly candidateDistance: number;
      readonly direction?: TraceDirection;
    })
  | (TraceEventCommon & {
      readonly type: "updateDistance";
      readonly nodeId: string;
      readonly oldDistance: number;
      readonly newDistance: number;
      readonly direction?: TraceDirection;
    })
  | (TraceEventCommon & {
      readonly type: "setParent";
      readonly nodeId: string;
      readonly parentId: string;
      readonly edgeId: string;
      readonly direction?: TraceDirection;
    })
  | (TraceEventCommon & {
      readonly type: "rejectCandidate";
      readonly nodeId: string;
      readonly reason: string;
      readonly edgeId?: string;
      readonly direction?: TraceDirection;
    })
  | (TraceEventCommon & {
      readonly type: "meetFrontiers";
      readonly nodeId: string;
      readonly forwardDistance: number;
      readonly backwardDistance: number;
      readonly totalDistance: number;
    })
  | (TraceEventCommon & {
      readonly type: "initializeMatrix";
      readonly nodeIds: readonly string[];
      readonly distances: Readonly<
        Record<string, Readonly<Record<string, number>>>
      >;
    })
  | (TraceEventCommon & {
      readonly type: "considerIntermediate";
      readonly nodeId: string;
      readonly intermediateIndex: number;
    })
  | (TraceEventCommon & {
      readonly type: "updateMatrix";
      readonly fromId: string;
      readonly toId: string;
      readonly viaId: string;
      readonly oldDistance: number;
      readonly newDistance: number;
    })
  | (TraceEventCommon & {
      readonly type: "reconstructPath";
      readonly nodeIds: readonly string[];
      readonly edgeIds: readonly string[];
    })
  | (TraceEventCommon & {
      readonly type: "negativeCycleDetected";
      readonly nodeIds: readonly string[];
      readonly edgeIds: readonly string[];
    })
  | (TraceEventCommon & {
      readonly type: "finish";
      readonly found: boolean;
      readonly status: AlgorithmResultStatus;
      readonly pathCost: number | null;
      readonly pathNodeIds: readonly string[];
      readonly pathEdgeIds: readonly string[];
    });

export interface RunOptions {
  readonly algorithmId: AlgorithmId;
  readonly startId: string;
  readonly goalId: string;
  readonly scenarioId?: string;
  readonly travelModel?: TravelModel;
  readonly heuristicId?: HeuristicId;
  /** Multiplies the selected heuristic. Zero visibly reduces A* to Dijkstra. */
  readonly heuristicScale?: number;
  /** Added by the avoid-tolls model. Defaults to 1,000 cost units. */
  readonly tollPenalty?: number;
  /** Hard denial-of-service guard. Defaults to 100,000 semantic events. */
  readonly maxTraceEvents?: number;
  /** Per-run Floyd-Warshall cap. Defaults to 24 and may not exceed 24. */
  readonly floydWarshallNodeLimit?: number;
}

export type AlgorithmRunOptions = Omit<RunOptions, "algorithmId">;

export interface AlgorithmMetrics {
  readonly nodesVisited: number;
  readonly nodesExpanded: number;
  readonly edgesInspected: number;
  readonly relaxations: number;
  readonly queuePushes: number;
  readonly queuePops: number;
  readonly maximumFrontierSize: number;
  readonly executionTimeMs: number;
  readonly traceEventCount: number;
}

export type AlgorithmResultStatus = "success" | "no-path" | "negative-cycle";

export type CorrectnessStatus =
  | "guaranteed-optimal"
  | "optimal-if-admissible"
  | "not-guaranteed-optimal"
  | "undefined-negative-cycle"
  | "unreachable";

export interface CorrectnessSummary {
  readonly status: CorrectnessStatus;
  readonly message: string;
}

export interface AllPairsShortestPaths {
  readonly nodeIds: readonly string[];
  /** Unreachable pairs use null so this result remains JSON-safe. */
  readonly distances: Readonly<
    Record<string, Readonly<Record<string, number | null>>>
  >;
  /** The next node on a shortest path, or null if the pair is unreachable. */
  readonly nextNodeIds: Readonly<
    Record<string, Readonly<Record<string, string | null>>>
  >;
  readonly negativeCycleNodeIds: readonly string[];
}

export interface AlgorithmResult {
  readonly algorithmId: AlgorithmId;
  readonly scenarioId: string | null;
  readonly heuristicId: HeuristicId;
  readonly travelModel: TravelModel;
  readonly found: boolean;
  readonly status: AlgorithmResultStatus;
  readonly pathNodeIds: readonly string[];
  readonly pathEdgeIds: readonly string[];
  readonly pathCost: number | null;
  readonly negativeCycleNodeIds: readonly string[];
  readonly correctness: CorrectnessSummary;
  readonly metrics: AlgorithmMetrics;
  readonly trace: readonly AlgorithmTraceEvent[];
  readonly warnings: readonly CompatibilityIssue[];
  readonly allPairs?: AllPairsShortestPaths;
}

export interface AlgorithmInfo {
  readonly id: AlgorithmId;
  readonly label: string;
  readonly complexity: string;
  readonly spaceComplexity: string;
  readonly optimality: string;
  readonly requirements: readonly string[];
  readonly summary: string;
}

export const ALGORITHM_INFO: Readonly<Record<AlgorithmId, AlgorithmInfo>> = {
  bfs: {
    id: "bfs",
    label: "Breadth-First Search",
    complexity: "O(V + E)",
    spaceComplexity: "O(V)",
    optimality:
      "Optimal only when every traversable edge has the same nonnegative cost.",
    requirements: ["Equal-cost traversable edges"],
    summary: "Explores the graph layer by layer with a FIFO queue.",
  },
  dijkstra: {
    id: "dijkstra",
    label: "Dijkstra's Algorithm",
    complexity: "O((V + E) log V)",
    spaceComplexity: "O(V + E)",
    optimality: "Optimal for nonnegative edge costs.",
    requirements: ["Nonnegative traversable edge costs"],
    summary: "Finalizes nodes in increasing distance from the start.",
  },
  astar: {
    id: "astar",
    label: "A* Search",
    complexity: "O((V + E) log V) worst case",
    spaceComplexity: "O(V + E)",
    optimality:
      "Optimal when the heuristic is admissible; reopens nodes for inconsistent heuristics.",
    requirements: [
      "Nonnegative edge costs",
      "A heuristic expressed in compatible cost units",
    ],
    summary:
      "Combines route cost so far with an estimate of the remaining cost.",
  },
  "greedy-best-first": {
    id: "greedy-best-first",
    label: "Greedy Best-First Search",
    complexity: "O((V + E) log V) worst case",
    spaceComplexity: "O(V + E)",
    optimality: "Not generally optimal.",
    requirements: ["Nonnegative edge costs", "A goal-directed heuristic"],
    summary: "Chases the apparently closest node using only the heuristic.",
  },
  "bidirectional-dijkstra": {
    id: "bidirectional-dijkstra",
    label: "Bidirectional Dijkstra",
    complexity: "O((V + E) log V)",
    spaceComplexity: "O(V + E)",
    optimality: "Optimal for nonnegative edge costs.",
    requirements: ["Nonnegative edge costs", "A known start and goal"],
    summary:
      "Runs Dijkstra from both ends, using reversed arcs for the backward directed search.",
  },
  "bellman-ford": {
    id: "bellman-ford",
    label: "Bellman-Ford",
    complexity: "O(VE)",
    spaceComplexity: "O(V)",
    optimality: "Optimal when no reachable negative cycle exists.",
    requirements: [
      "Negative costs are allowed only for abstract weight models",
    ],
    summary:
      "Repeatedly relaxes every edge and detects reachable negative cycles.",
  },
  "floyd-warshall": {
    id: "floyd-warshall",
    label: "Floyd-Warshall",
    complexity: "O(V³)",
    spaceComplexity: "O(V²)",
    optimality: "Computes every shortest pair when no negative cycle exists.",
    requirements: ["Small graph (24 nodes maximum)", "No negative cycle"],
    summary:
      "Uses dynamic programming to consider each node as an intermediate stop.",
  },
};

export interface GraphValidationIssue {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export interface CompatibilityIssue {
  readonly code: string;
  readonly message: string;
  readonly nodeId?: string;
  readonly edgeId?: string;
}

export interface CompatibilityResult {
  readonly compatible: boolean;
  readonly issues: readonly CompatibilityIssue[];
  readonly warnings: readonly CompatibilityIssue[];
}

export class GraphValidationError extends Error {
  readonly issues: readonly GraphValidationIssue[];

  constructor(issues: readonly GraphValidationIssue[]) {
    super(issues.map((issue) => issue.message).join(" "));
    this.name = "GraphValidationError";
    this.issues = issues;
  }
}

export class AlgorithmCompatibilityError extends Error {
  readonly issues: readonly CompatibilityIssue[];

  constructor(issues: readonly CompatibilityIssue[]) {
    super(issues.map((issue) => issue.message).join(" "));
    this.name = "AlgorithmCompatibilityError";
    this.issues = issues;
  }
}

export class TraceLimitExceededError extends Error {
  readonly limit: number;

  constructor(limit: number) {
    super(`The algorithm exceeded the trace limit of ${limit} events.`);
    this.name = "TraceLimitExceededError";
    this.limit = limit;
  }
}

export const DEFAULT_MAX_TRACE_EVENTS = 100_000;
export const DEFAULT_FLOYD_WARSHALL_NODE_LIMIT = 24;
export const MAX_FLOYD_WARSHALL_NODE_LIMIT = 24;

interface ResolvedRunOptions {
  readonly algorithmId: AlgorithmId;
  readonly startId: string;
  readonly goalId: string;
  readonly scenarioId: string | null;
  readonly travelModel: TravelModel;
  readonly heuristicId: HeuristicId;
  readonly heuristicScale: number;
  readonly tollPenalty: number;
  readonly maxTraceEvents: number;
  readonly floydWarshallNodeLimit: number;
}

interface TraversalArc {
  readonly edgeId: string;
  readonly fromId: string;
  readonly toId: string;
  readonly cost: number;
}

interface TraversalGraph {
  readonly nodeIds: readonly string[];
  readonly nodesById: ReadonlyMap<string, GraphNode>;
  readonly edgesById: ReadonlyMap<string, GraphEdge>;
  readonly arcs: readonly TraversalArc[];
  readonly outgoing: ReadonlyMap<string, readonly TraversalArc[]>;
  readonly incoming: ReadonlyMap<string, readonly TraversalArc[]>;
}

interface ParentLink {
  readonly nodeId: string;
  readonly edgeId: string;
}

interface MutableMetrics {
  nodesVisited: number;
  nodesExpanded: number;
  edgesInspected: number;
  relaxations: number;
  queuePushes: number;
  queuePops: number;
  maximumFrontierSize: number;
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

type TraceEventInput = DistributiveOmit<
  AlgorithmTraceEvent,
  keyof TraceEventCommon
> & {
  readonly codeSection: CodeSection;
  readonly message?: string;
};

function compareIds(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function compareNumbers(left: number, right: number): number {
  if (Object.is(left, right) || left === right) return 0;
  return left < right ? -1 : 1;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function includesLiteral<T extends string>(
  values: readonly T[],
  value: unknown,
): value is T {
  return typeof value === "string" && values.includes(value as T);
}

function createMutableMetrics(): MutableMetrics {
  return {
    nodesVisited: 0,
    nodesExpanded: 0,
    edgesInspected: 0,
    relaxations: 0,
    queuePushes: 0,
    queuePops: 0,
    maximumFrontierSize: 0,
  };
}

function resolveRunOptions(options: RunOptions): ResolvedRunOptions {
  return {
    algorithmId: options.algorithmId,
    startId: options.startId,
    goalId: options.goalId,
    scenarioId: options.scenarioId ?? null,
    travelModel: options.travelModel ?? "weight",
    heuristicId: options.heuristicId ?? "zero",
    heuristicScale: options.heuristicScale ?? 1,
    tollPenalty: options.tollPenalty ?? 1_000,
    maxTraceEvents: options.maxTraceEvents ?? DEFAULT_MAX_TRACE_EVENTS,
    floydWarshallNodeLimit:
      options.floydWarshallNodeLimit ?? DEFAULT_FLOYD_WARSHALL_NODE_LIMIT,
  };
}

/** Return the cost used by a selected travel model for one edge. */
export function getEdgeCost(
  edge: GraphEdge,
  travelModel: TravelModel = "weight",
  options: Pick<RunOptions, "tollPenalty"> = {},
): number {
  switch (travelModel) {
    case "weight":
      return edge.weight;
    case "distance":
      return edge.distance ?? edge.weight;
    case "travel-time":
    case "travelTime":
      if (edge.travelTime !== undefined) return edge.travelTime;
      if (
        edge.distance !== undefined &&
        edge.speed !== undefined &&
        edge.speed > 0
      ) {
        return (edge.distance / edge.speed) * 60;
      }
      return edge.weight;
    case "hops":
      return 1;
    case "avoid-tolls":
      return edge.weight + (edge.toll ? (options.tollPenalty ?? 1_000) : 0);
    case "cycling": {
      const base = edge.distance ?? edge.weight;
      const terrain = edge.terrainMultiplier ?? 1;
      const safety = edge.safetyMultiplier ?? 1;
      const roadPenalty = edge.roadType === "highway" ? 3 : 1;
      return base * terrain * safety * roadPenalty;
    }
  }
}

/** Structural validation is intentionally separate from algorithm compatibility. */
export function validateGraph(graph: Graph): readonly GraphValidationIssue[] {
  const issues: GraphValidationIssue[] = [];
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    return [
      {
        code: "invalid-graph-shape",
        path: "graph",
        message: "Graph must contain node and edge arrays.",
      },
    ];
  }

  const nodeIds = new Set<string>();
  graph.nodes.forEach((node, index) => {
    const path = `nodes[${index}]`;
    if (typeof node.id !== "string" || node.id.length === 0) {
      issues.push({
        code: "invalid-node-id",
        path: `${path}.id`,
        message: `Node at index ${index} must have a non-empty string ID.`,
      });
    } else if (nodeIds.has(node.id)) {
      issues.push({
        code: "duplicate-node-id",
        path: `${path}.id`,
        message: `Node ID "${node.id}" is duplicated.`,
      });
    } else {
      nodeIds.add(node.id);
    }
    if (!isFiniteNumber(node.x) || !isFiniteNumber(node.y)) {
      issues.push({
        code: "invalid-node-coordinate",
        path,
        message: `Node "${node.id}" must have finite x and y coordinates.`,
      });
    }
    if (
      node.latitude !== undefined &&
      (!isFiniteNumber(node.latitude) ||
        node.latitude < -90 ||
        node.latitude > 90)
    ) {
      issues.push({
        code: "invalid-latitude",
        path: `${path}.latitude`,
        message: `Node "${node.id}" has an invalid latitude.`,
      });
    }
    if (
      node.longitude !== undefined &&
      (!isFiniteNumber(node.longitude) ||
        node.longitude < -180 ||
        node.longitude > 180)
    ) {
      issues.push({
        code: "invalid-longitude",
        path: `${path}.longitude`,
        message: `Node "${node.id}" has an invalid longitude.`,
      });
    }
  });

  const edgeIds = new Set<string>();
  graph.edges.forEach((edge, index) => {
    const path = `edges[${index}]`;
    if (typeof edge.id !== "string" || edge.id.length === 0) {
      issues.push({
        code: "invalid-edge-id",
        path: `${path}.id`,
        message: `Edge at index ${index} must have a non-empty string ID.`,
      });
    } else if (edgeIds.has(edge.id)) {
      issues.push({
        code: "duplicate-edge-id",
        path: `${path}.id`,
        message: `Edge ID "${edge.id}" is duplicated.`,
      });
    } else {
      edgeIds.add(edge.id);
    }
    if (!nodeIds.has(edge.fromId) || !nodeIds.has(edge.toId)) {
      issues.push({
        code: "missing-edge-endpoint",
        path,
        message: `Edge "${edge.id}" references a missing node.`,
      });
    }
    if (!isFiniteNumber(edge.weight)) {
      issues.push({
        code: "invalid-edge-weight",
        path: `${path}.weight`,
        message: `Edge "${edge.id}" must have a finite weight.`,
      });
    }
    for (const [key, value] of [
      ["distance", edge.distance],
      ["travelTime", edge.travelTime],
    ] as const) {
      if (value !== undefined && (!isFiniteNumber(value) || value < 0)) {
        issues.push({
          code: `invalid-edge-${key}`,
          path: `${path}.${key}`,
          message: `Edge "${edge.id}" must have a finite, nonnegative ${key}.`,
        });
      }
    }
    if (
      edge.speed !== undefined &&
      (!isFiniteNumber(edge.speed) || edge.speed <= 0)
    ) {
      issues.push({
        code: "invalid-edge-speed",
        path: `${path}.speed`,
        message: `Edge "${edge.id}" must have a positive finite speed.`,
      });
    }
    for (const [key, value] of [
      ["terrainMultiplier", edge.terrainMultiplier],
      ["safetyMultiplier", edge.safetyMultiplier],
    ] as const) {
      if (value !== undefined && (!isFiniteNumber(value) || value < 0)) {
        issues.push({
          code: `invalid-edge-${key}`,
          path: `${path}.${key}`,
          message: `Edge "${edge.id}" must have a finite, nonnegative ${key}.`,
        });
      }
    }
  });

  return issues;
}

/** Throw a structured error if a graph is not safe for algorithm execution. */
export function assertValidGraph(graph: Graph): void {
  const issues = validateGraph(graph);
  if (issues.length > 0) throw new GraphValidationError(issues);
}

function compareArcs(left: TraversalArc, right: TraversalArc): number {
  return (
    compareIds(left.fromId, right.fromId) ||
    compareIds(left.toId, right.toId) ||
    compareNumbers(left.cost, right.cost) ||
    compareIds(left.edgeId, right.edgeId)
  );
}

function buildTraversalGraph(
  graph: Graph,
  options: Pick<ResolvedRunOptions, "travelModel" | "tollPenalty">,
): TraversalGraph {
  const nodes = [...graph.nodes].sort((a, b) => compareIds(a.id, b.id));
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const edges = [...graph.edges].sort((a, b) => compareIds(a.id, b.id));
  const edgesById = new Map(edges.map((edge) => [edge.id, edge]));
  const arcs: TraversalArc[] = [];

  for (const edge of edges) {
    if (edge.closed) continue;
    const cost = getEdgeCost(edge, options.travelModel, options);
    arcs.push({
      edgeId: edge.id,
      fromId: edge.fromId,
      toId: edge.toId,
      cost,
    });
    if (edge.directed === false && edge.fromId !== edge.toId) {
      arcs.push({
        edgeId: edge.id,
        fromId: edge.toId,
        toId: edge.fromId,
        cost,
      });
    }
  }
  arcs.sort(compareArcs);

  const outgoing = new Map<string, TraversalArc[]>();
  const incoming = new Map<string, TraversalArc[]>();
  for (const node of nodes) {
    outgoing.set(node.id, []);
    incoming.set(node.id, []);
  }
  for (const arc of arcs) {
    outgoing.get(arc.fromId)?.push(arc);
    incoming.get(arc.toId)?.push(arc);
  }
  for (const list of incoming.values()) {
    list.sort(
      (a, b) =>
        compareIds(a.fromId, b.fromId) ||
        compareNumbers(a.cost, b.cost) ||
        compareIds(a.edgeId, b.edgeId),
    );
  }

  return {
    nodeIds: nodes.map((node) => node.id),
    nodesById,
    edgesById,
    arcs,
    outgoing,
    incoming,
  };
}

/** Check graph/algorithm assumptions without executing the algorithm. */
export function validateRunCompatibility(
  graph: Graph,
  options: RunOptions,
): CompatibilityResult {
  const issues: CompatibilityIssue[] = validateGraph(graph).map((issue) => ({
    code: issue.code,
    message: issue.message,
  }));
  const warnings: CompatibilityIssue[] = [];

  if (!includesLiteral(ALGORITHM_IDS, options.algorithmId)) {
    issues.push({
      code: "unknown-algorithm",
      message: `Unknown algorithm "${String(options.algorithmId)}".`,
    });
  }
  if (!includesLiteral(TRAVEL_MODELS, options.travelModel ?? "weight")) {
    issues.push({
      code: "unknown-travel-model",
      message: `Unknown travel model "${String(options.travelModel)}".`,
    });
  }
  if (!includesLiteral(HEURISTIC_IDS, options.heuristicId ?? "zero")) {
    issues.push({
      code: "unknown-heuristic",
      message: `Unknown heuristic "${String(options.heuristicId)}".`,
    });
  }

  const nodeIds = new Set(graph.nodes?.map((node) => node.id) ?? []);
  if (!nodeIds.has(options.startId)) {
    issues.push({
      code: "missing-start-node",
      nodeId: options.startId,
      message: `Start node "${options.startId}" does not exist.`,
    });
  }
  if (!nodeIds.has(options.goalId)) {
    issues.push({
      code: "missing-goal-node",
      nodeId: options.goalId,
      message: `Goal node "${options.goalId}" does not exist.`,
    });
  }

  if (
    options.heuristicScale !== undefined &&
    (!isFiniteNumber(options.heuristicScale) || options.heuristicScale < 0)
  ) {
    issues.push({
      code: "invalid-heuristic-scale",
      message: "Heuristic scale must be a finite, nonnegative number.",
    });
  }
  if (
    options.tollPenalty !== undefined &&
    (!isFiniteNumber(options.tollPenalty) || options.tollPenalty < 0)
  ) {
    issues.push({
      code: "invalid-toll-penalty",
      message: "Toll penalty must be a finite, nonnegative number.",
    });
  }
  if (
    options.maxTraceEvents !== undefined &&
    (!Number.isSafeInteger(options.maxTraceEvents) ||
      options.maxTraceEvents < 1)
  ) {
    issues.push({
      code: "invalid-trace-limit",
      message: "Trace limit must be a positive safe integer.",
    });
  }
  const floydLimit =
    options.floydWarshallNodeLimit ?? DEFAULT_FLOYD_WARSHALL_NODE_LIMIT;
  if (
    !Number.isSafeInteger(floydLimit) ||
    floydLimit < 1 ||
    floydLimit > MAX_FLOYD_WARSHALL_NODE_LIMIT
  ) {
    issues.push({
      code: "invalid-floyd-warshall-limit",
      message: `Floyd-Warshall's node limit must be between 1 and ${MAX_FLOYD_WARSHALL_NODE_LIMIT}.`,
    });
  }

  if (issues.length === 0) {
    const resolved = resolveRunOptions(options);
    const traversal = buildTraversalGraph(graph, resolved);
    const nonfiniteArc = traversal.arcs.find(
      (arc) => !Number.isFinite(arc.cost),
    );
    if (nonfiniteArc) {
      issues.push({
        code: "nonfinite-travel-cost",
        edgeId: nonfiniteArc.edgeId,
        message: `Edge "${nonfiniteArc.edgeId}" produces a nonfinite cost in the ${resolved.travelModel} travel model.`,
      });
    }
    const negativeArcs = traversal.arcs.filter((arc) => arc.cost < 0);
    const requiresNonnegative = [
      "dijkstra",
      "astar",
      "greedy-best-first",
      "bidirectional-dijkstra",
    ].includes(resolved.algorithmId);
    if (requiresNonnegative && negativeArcs.length > 0) {
      issues.push({
        code: "negative-edge-not-supported",
        edgeId: negativeArcs[0]?.edgeId,
        message: `${ALGORITHM_INFO[resolved.algorithmId].label} requires nonnegative traversable edge costs.`,
      });
    }
    if (resolved.algorithmId === "bfs") {
      const firstCost = traversal.arcs[0]?.cost;
      const unequal = traversal.arcs.find((arc) => arc.cost !== firstCost);
      const negative = traversal.arcs.find((arc) => arc.cost < 0);
      if (unequal || negative) {
        issues.push({
          code: "bfs-requires-equal-costs",
          edgeId: (unequal ?? negative)?.edgeId,
          message:
            "Breadth-First Search requires every traversable edge to have the same nonnegative cost.",
        });
      }
    }
    if (
      resolved.algorithmId === "bellman-ford" &&
      resolved.travelModel !== "weight" &&
      negativeArcs.length > 0
    ) {
      issues.push({
        code: "negative-physical-cost",
        edgeId: negativeArcs[0]?.edgeId,
        message:
          "Negative distance, time, toll, and cycling costs are invalid; use the abstract weight model for negative-edge demonstrations.",
      });
    }
    if (
      resolved.algorithmId === "floyd-warshall" &&
      graph.nodes.length > floydLimit
    ) {
      issues.push({
        code: "floyd-warshall-graph-too-large",
        message: `Floyd-Warshall is limited to ${floydLimit} nodes for this run; the graph contains ${graph.nodes.length}.`,
      });
    }
    if (
      resolved.heuristicId === "geographic" &&
      (resolved.algorithmId === "astar" ||
        resolved.algorithmId === "greedy-best-first")
    ) {
      const missingCoordinates = graph.nodes.find(
        (node) => node.latitude === undefined || node.longitude === undefined,
      );
      if (missingCoordinates) {
        issues.push({
          code: "geographic-coordinates-required",
          nodeId: missingCoordinates.id,
          message:
            "The geographic heuristic requires latitude and longitude on every node.",
        });
      }
    }
    if (resolved.algorithmId === "astar" && resolved.heuristicId !== "zero") {
      warnings.push({
        code: "heuristic-admissibility-not-proven",
        message:
          "A* is optimal only when the chosen, scaled heuristic never overestimates remaining cost in the selected travel model.",
      });
    }
    if (resolved.algorithmId === "greedy-best-first") {
      warnings.push({
        code: "greedy-not-optimal",
        message:
          "Greedy Best-First Search can return a nonoptimal route because it ignores accumulated route cost when prioritizing nodes.",
      });
    }
  }

  return { compatible: issues.length === 0, issues, warnings };
}

/** Throw a structured error when a run is not compatible. */
export function assertRunCompatibility(
  graph: Graph,
  options: RunOptions,
): void {
  const compatibility = validateRunCompatibility(graph, options);
  if (!compatibility.compatible) {
    throw new AlgorithmCompatibilityError(compatibility.issues);
  }
}

function describeTraceEvent(event: TraceEventInput): string {
  switch (event.type) {
    case "initialize":
      return `Initialize the search from ${event.startId} to ${event.goalId}.`;
    case "enqueue":
      return `Add ${event.nodeId} to the${event.direction ? ` ${event.direction}` : ""} frontier with priority ${event.priority}.`;
    case "dequeue":
      return `Remove ${event.nodeId} from the${event.direction ? ` ${event.direction}` : ""} frontier.`;
    case "visitNode":
      return `Expand ${event.nodeId} at distance ${event.distance}.`;
    case "inspectEdge":
      return `Inspect edge ${event.edgeId} from ${event.fromId} to ${event.toId}.`;
    case "relaxEdge":
      return `Try distance ${event.candidateDistance} for ${event.toId} through ${event.fromId}.`;
    case "updateDistance":
      return `Update ${event.nodeId}'s distance from ${event.oldDistance} to ${event.newDistance}.`;
    case "setParent":
      return `Set ${event.parentId} as ${event.nodeId}'s predecessor.`;
    case "rejectCandidate":
      return `Reject the candidate for ${event.nodeId}: ${event.reason}.`;
    case "meetFrontiers":
      return `The two frontiers meet at ${event.nodeId} with total cost ${event.totalDistance}.`;
    case "initializeMatrix":
      return `Initialize the ${event.nodeIds.length} by ${event.nodeIds.length} distance matrix.`;
    case "considerIntermediate":
      return `Consider ${event.nodeId} as an intermediate node.`;
    case "updateMatrix":
      return `Improve ${event.fromId} to ${event.toId} through ${event.viaId}.`;
    case "reconstructPath":
      return `Reconstruct a path containing ${event.nodeIds.length} nodes.`;
    case "negativeCycleDetected":
      return `A reachable negative cycle was detected.`;
    case "finish":
      if (event.status === "negative-cycle") {
        return "Finish because shortest paths are undefined for a reachable negative cycle.";
      }
      return event.found
        ? `Finish with a path of cost ${event.pathCost}.`
        : "Finish: no path reaches the destination.";
  }
}

class TraceRecorder {
  private readonly algorithmId: AlgorithmId;
  private readonly limit: number;
  private readonly events: AlgorithmTraceEvent[] = [];

  constructor(algorithmId: AlgorithmId, limit: number) {
    this.algorithmId = algorithmId;
    this.limit = limit;
  }

  emit(input: TraceEventInput): void {
    if (this.events.length >= this.limit) {
      throw new TraceLimitExceededError(this.limit);
    }
    const event = {
      ...input,
      step: this.events.length,
      algorithmId: this.algorithmId,
      message: input.message ?? describeTraceEvent(input),
    } as AlgorithmTraceEvent;
    this.events.push(event);
  }

  get trace(): readonly AlgorithmTraceEvent[] {
    return this.events;
  }
}

interface PriorityQueueEntry {
  readonly nodeId: string;
  readonly priority: number;
  readonly secondary: number;
  readonly distance: number;
  readonly sequence: number;
}

function compareQueueEntries(
  left: PriorityQueueEntry,
  right: PriorityQueueEntry,
): number {
  return (
    compareNumbers(left.priority, right.priority) ||
    compareNumbers(left.secondary, right.secondary) ||
    compareIds(left.nodeId, right.nodeId) ||
    left.sequence - right.sequence
  );
}

class DeterministicPriorityQueue {
  private readonly heap: PriorityQueueEntry[] = [];

  get size(): number {
    return this.heap.length;
  }

  peek(): PriorityQueueEntry | undefined {
    return this.heap[0];
  }

  push(entry: PriorityQueueEntry): void {
    this.heap.push(entry);
    let index = this.heap.length - 1;
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      const parent = this.heap[parentIndex];
      const current = this.heap[index];
      if (!parent || !current || compareQueueEntries(parent, current) <= 0)
        break;
      this.heap[parentIndex] = current;
      this.heap[index] = parent;
      index = parentIndex;
    }
  }

  pop(): PriorityQueueEntry | undefined {
    const first = this.heap[0];
    const last = this.heap.pop();
    if (!first) return undefined;
    if (last && this.heap.length > 0) {
      this.heap[0] = last;
      let index = 0;
      while (true) {
        const leftIndex = index * 2 + 1;
        const rightIndex = leftIndex + 1;
        let smallestIndex = index;
        const smallest = this.heap[smallestIndex];
        const left = this.heap[leftIndex];
        const right = this.heap[rightIndex];
        if (left && smallest && compareQueueEntries(left, smallest) < 0) {
          smallestIndex = leftIndex;
        }
        const candidate = this.heap[smallestIndex];
        if (right && candidate && compareQueueEntries(right, candidate) < 0) {
          smallestIndex = rightIndex;
        }
        if (smallestIndex === index) break;
        const current = this.heap[index];
        const child = this.heap[smallestIndex];
        if (!current || !child) break;
        this.heap[index] = child;
        this.heap[smallestIndex] = current;
        index = smallestIndex;
      }
    }
    return first;
  }
}

/** Calculate a deterministic built-in heuristic between two nodes. */
export function calculateHeuristic(
  from: GraphNode,
  goal: GraphNode,
  heuristicId: HeuristicId,
  scale = 1,
): number {
  let value: number;
  switch (heuristicId) {
    case "zero":
      value = 0;
      break;
    case "manhattan":
      value = Math.abs(from.x - goal.x) + Math.abs(from.y - goal.y);
      break;
    case "euclidean":
      value = Math.hypot(from.x - goal.x, from.y - goal.y);
      break;
    case "geographic": {
      if (
        from.latitude === undefined ||
        from.longitude === undefined ||
        goal.latitude === undefined ||
        goal.longitude === undefined
      ) {
        throw new AlgorithmCompatibilityError([
          {
            code: "geographic-coordinates-required",
            nodeId: from.id,
            message:
              "The geographic heuristic requires latitude and longitude on every node.",
          },
        ]);
      }
      const radians = Math.PI / 180;
      const latitudeDelta = (goal.latitude - from.latitude) * radians;
      const longitudeDelta = (goal.longitude - from.longitude) * radians;
      const fromLatitude = from.latitude * radians;
      const goalLatitude = goal.latitude * radians;
      const haversine =
        Math.sin(latitudeDelta / 2) ** 2 +
        Math.cos(fromLatitude) *
          Math.cos(goalLatitude) *
          Math.sin(longitudeDelta / 2) ** 2;
      value = 6_371.0088 * 2 * Math.asin(Math.min(1, Math.sqrt(haversine)));
      break;
    }
  }
  return value * scale;
}

function reconstructPredecessorPath(
  startId: string,
  goalId: string,
  parents: ReadonlyMap<string, ParentLink>,
  nodeLimit: number,
): { nodeIds: string[]; edgeIds: string[] } | null {
  if (startId === goalId) return { nodeIds: [startId], edgeIds: [] };
  const reversedNodes = [goalId];
  const reversedEdges: string[] = [];
  const seen = new Set([goalId]);
  let cursor = goalId;

  while (cursor !== startId && reversedNodes.length <= nodeLimit) {
    const parent = parents.get(cursor);
    if (!parent || seen.has(parent.nodeId)) return null;
    reversedEdges.push(parent.edgeId);
    cursor = parent.nodeId;
    reversedNodes.push(cursor);
    seen.add(cursor);
  }
  if (cursor !== startId) return null;
  reversedNodes.reverse();
  reversedEdges.reverse();
  return { nodeIds: reversedNodes, edgeIds: reversedEdges };
}

function correctnessFor(
  options: ResolvedRunOptions,
  status: AlgorithmResultStatus,
): CorrectnessSummary {
  if (status === "negative-cycle") {
    return {
      status: "undefined-negative-cycle",
      message:
        "A reachable negative cycle makes a finite shortest path undefined.",
    };
  }
  if (status === "no-path") {
    return {
      status: "unreachable",
      message:
        "The destination is unreachable through open, directionally valid edges.",
    };
  }
  switch (options.algorithmId) {
    case "astar":
      return options.heuristicId === "zero" || options.heuristicScale === 0
        ? {
            status: "guaranteed-optimal",
            message:
              "With a zero heuristic, A* is Dijkstra's algorithm and is optimal for nonnegative costs.",
          }
        : {
            status: "optimal-if-admissible",
            message:
              "This route is optimal if the selected, scaled heuristic is admissible for the current cost model.",
          };
    case "greedy-best-first":
      return {
        status: "not-guaranteed-optimal",
        message:
          "Greedy Best-First Search can find a route quickly but does not guarantee the cheapest route.",
      };
    default:
      return {
        status: "guaranteed-optimal",
        message:
          "The algorithm's compatibility requirements were validated, so the reported route is optimal.",
      };
  }
}

interface ResultParts {
  readonly found: boolean;
  readonly status: AlgorithmResultStatus;
  readonly pathNodeIds: readonly string[];
  readonly pathEdgeIds: readonly string[];
  readonly pathCost: number | null;
  readonly negativeCycleNodeIds?: readonly string[];
  readonly allPairs?: AllPairsShortestPaths;
}

function monotonicNow(): number {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

function makeResult(
  options: ResolvedRunOptions,
  recorder: TraceRecorder,
  metrics: MutableMetrics,
  startedAt: number,
  warnings: readonly CompatibilityIssue[],
  parts: ResultParts,
): AlgorithmResult {
  const resultMetrics: AlgorithmMetrics = {
    ...metrics,
    executionTimeMs: Math.max(0, monotonicNow() - startedAt),
    traceEventCount: recorder.trace.length,
  };
  return {
    algorithmId: options.algorithmId,
    scenarioId: options.scenarioId,
    heuristicId: options.heuristicId,
    travelModel: options.travelModel,
    found: parts.found,
    status: parts.status,
    pathNodeIds: [...parts.pathNodeIds],
    pathEdgeIds: [...parts.pathEdgeIds],
    pathCost: parts.pathCost,
    negativeCycleNodeIds: [...(parts.negativeCycleNodeIds ?? [])],
    correctness: correctnessFor(options, parts.status),
    metrics: resultMetrics,
    trace: recorder.trace,
    warnings: [...warnings],
    ...(parts.allPairs ? { allPairs: parts.allPairs } : {}),
  };
}

function emitInitialization(
  recorder: TraceRecorder,
  options: ResolvedRunOptions,
): void {
  recorder.emit({
    type: "initialize",
    codeSection: "initialize",
    startId: options.startId,
    goalId: options.goalId,
    travelModel: options.travelModel,
    heuristicId: options.heuristicId,
  });
}

function emitFinishedPath(
  recorder: TraceRecorder,
  path: {
    readonly nodeIds: readonly string[];
    readonly edgeIds: readonly string[];
  } | null,
  pathCost: number | null,
  status: AlgorithmResultStatus,
): void {
  if (path) {
    recorder.emit({
      type: "reconstructPath",
      codeSection: "path-reconstruction",
      nodeIds: [...path.nodeIds],
      edgeIds: [...path.edgeIds],
    });
  }
  recorder.emit({
    type: "finish",
    codeSection: "termination",
    found: path !== null && status === "success",
    status,
    pathCost,
    pathNodeIds: path ? [...path.nodeIds] : [],
    pathEdgeIds: path ? [...path.edgeIds] : [],
  });
}

function executeBreadthFirstSearch(
  graph: Graph,
  options: ResolvedRunOptions,
  warnings: readonly CompatibilityIssue[],
): AlgorithmResult {
  const startedAt = monotonicNow();
  const traversal = buildTraversalGraph(graph, options);
  const recorder = new TraceRecorder(
    options.algorithmId,
    options.maxTraceEvents,
  );
  const metrics = createMutableMetrics();
  const queue: string[] = [];
  let head = 0;
  const discovered = new Set<string>();
  const distances = new Map<string, number>();
  const parents = new Map<string, ParentLink>();
  const edgeCost = traversal.arcs[0]?.cost ?? 0;

  emitInitialization(recorder, options);
  discovered.add(options.startId);
  distances.set(options.startId, 0);
  queue.push(options.startId);
  metrics.nodesVisited = 1;
  metrics.queuePushes = 1;
  metrics.maximumFrontierSize = 1;
  recorder.emit({
    type: "enqueue",
    codeSection: "frontier",
    nodeId: options.startId,
    priority: 0,
    distance: 0,
  });

  let found = false;
  while (head < queue.length) {
    const nodeId = queue[head];
    head += 1;
    if (nodeId === undefined) break;
    const distance = distances.get(nodeId) ?? Number.POSITIVE_INFINITY;
    metrics.queuePops += 1;
    recorder.emit({
      type: "dequeue",
      codeSection: "dequeue",
      nodeId,
      priority: distance,
      distance,
    });
    metrics.nodesExpanded += 1;
    recorder.emit({
      type: "visitNode",
      codeSection: "visit",
      nodeId,
      distance,
    });
    if (nodeId === options.goalId) {
      found = true;
      break;
    }

    for (const arc of traversal.outgoing.get(nodeId) ?? []) {
      metrics.edgesInspected += 1;
      recorder.emit({
        type: "inspectEdge",
        codeSection: "neighbor-loop",
        edgeId: arc.edgeId,
        fromId: arc.fromId,
        toId: arc.toId,
        cost: arc.cost,
      });
      const candidate = distance + edgeCost;
      const oldDistance = distances.get(arc.toId) ?? Number.POSITIVE_INFINITY;
      recorder.emit({
        type: "relaxEdge",
        codeSection: "relaxation",
        edgeId: arc.edgeId,
        fromId: arc.fromId,
        toId: arc.toId,
        oldDistance,
        candidateDistance: candidate,
      });
      if (discovered.has(arc.toId)) {
        recorder.emit({
          type: "rejectCandidate",
          codeSection: "relaxation",
          nodeId: arc.toId,
          edgeId: arc.edgeId,
          reason:
            "the node was already discovered by an equal or earlier BFS layer",
        });
        continue;
      }
      discovered.add(arc.toId);
      distances.set(arc.toId, candidate);
      parents.set(arc.toId, { nodeId, edgeId: arc.edgeId });
      metrics.nodesVisited += 1;
      metrics.relaxations += 1;
      recorder.emit({
        type: "updateDistance",
        codeSection: "distance-update",
        nodeId: arc.toId,
        oldDistance,
        newDistance: candidate,
      });
      recorder.emit({
        type: "setParent",
        codeSection: "parent-update",
        nodeId: arc.toId,
        parentId: nodeId,
        edgeId: arc.edgeId,
      });
      queue.push(arc.toId);
      metrics.queuePushes += 1;
      metrics.maximumFrontierSize = Math.max(
        metrics.maximumFrontierSize,
        queue.length - head,
      );
      recorder.emit({
        type: "enqueue",
        codeSection: "frontier",
        nodeId: arc.toId,
        priority: candidate,
        distance: candidate,
      });
    }
  }

  const path = found
    ? reconstructPredecessorPath(
        options.startId,
        options.goalId,
        parents,
        traversal.nodeIds.length,
      )
    : null;
  const status: AlgorithmResultStatus = path ? "success" : "no-path";
  const pathCost = path ? (distances.get(options.goalId) ?? 0) : null;
  emitFinishedPath(recorder, path, pathCost, status);
  return makeResult(options, recorder, metrics, startedAt, warnings, {
    found: path !== null,
    status,
    pathNodeIds: path?.nodeIds ?? [],
    pathEdgeIds: path?.edgeIds ?? [],
    pathCost,
  });
}

type BestFirstMode = "dijkstra" | "astar" | "greedy-best-first";

function executeBestFirst(
  graph: Graph,
  options: ResolvedRunOptions,
  warnings: readonly CompatibilityIssue[],
  mode: BestFirstMode,
): AlgorithmResult {
  const startedAt = monotonicNow();
  const traversal = buildTraversalGraph(graph, options);
  const goal = traversal.nodesById.get(options.goalId);
  if (!goal) throw new Error("Validated goal node is missing.");
  const recorder = new TraceRecorder(
    options.algorithmId,
    options.maxTraceEvents,
  );
  const metrics = createMutableMetrics();
  const frontier = new DeterministicPriorityQueue();
  const distances = new Map<string, number>();
  const parents = new Map<string, ParentLink>();
  const discovered = new Set<string>();
  const closed = new Set<string>();
  const expandedAtDistance = new Map<string, number>();
  let sequence = 0;

  const heuristicFor = (nodeId: string): number => {
    if (mode === "dijkstra") return 0;
    const node = traversal.nodesById.get(nodeId);
    if (!node) throw new Error("Validated graph node is missing.");
    return calculateHeuristic(
      node,
      goal,
      options.heuristicId,
      options.heuristicScale,
    );
  };
  const priorityFor = (distance: number, heuristic: number): number => {
    if (mode === "dijkstra") return distance;
    if (mode === "astar") return distance + heuristic;
    return heuristic;
  };

  emitInitialization(recorder, options);
  const startHeuristic = heuristicFor(options.startId);
  const startPriority = priorityFor(0, startHeuristic);
  distances.set(options.startId, 0);
  discovered.add(options.startId);
  frontier.push({
    nodeId: options.startId,
    priority: startPriority,
    secondary: mode === "greedy-best-first" ? 0 : startHeuristic,
    distance: 0,
    sequence: sequence++,
  });
  metrics.nodesVisited = 1;
  metrics.queuePushes = 1;
  metrics.maximumFrontierSize = 1;
  recorder.emit({
    type: "enqueue",
    codeSection: "frontier",
    nodeId: options.startId,
    priority: startPriority,
    distance: 0,
  });

  let found = false;
  while (frontier.size > 0) {
    const entry = frontier.pop();
    if (!entry) break;
    metrics.queuePops += 1;
    recorder.emit({
      type: "dequeue",
      codeSection: "dequeue",
      nodeId: entry.nodeId,
      priority: entry.priority,
      distance: entry.distance,
    });
    const knownDistance = distances.get(entry.nodeId);
    if (knownDistance === undefined || entry.distance !== knownDistance) {
      recorder.emit({
        type: "rejectCandidate",
        codeSection: "dequeue",
        nodeId: entry.nodeId,
        reason: "this is a stale priority-queue entry",
      });
      continue;
    }
    if (mode === "greedy-best-first") {
      if (closed.has(entry.nodeId)) {
        recorder.emit({
          type: "rejectCandidate",
          codeSection: "dequeue",
          nodeId: entry.nodeId,
          reason: "the node was already expanded",
        });
        continue;
      }
      closed.add(entry.nodeId);
    } else {
      const priorExpansion = expandedAtDistance.get(entry.nodeId);
      if (priorExpansion !== undefined && entry.distance >= priorExpansion) {
        recorder.emit({
          type: "rejectCandidate",
          codeSection: "dequeue",
          nodeId: entry.nodeId,
          reason:
            "the node was already expanded at an equal or better distance",
        });
        continue;
      }
      expandedAtDistance.set(entry.nodeId, entry.distance);
    }

    metrics.nodesExpanded += 1;
    recorder.emit({
      type: "visitNode",
      codeSection: "visit",
      nodeId: entry.nodeId,
      distance: entry.distance,
    });
    if (entry.nodeId === options.goalId) {
      found = true;
      break;
    }

    for (const arc of traversal.outgoing.get(entry.nodeId) ?? []) {
      metrics.edgesInspected += 1;
      recorder.emit({
        type: "inspectEdge",
        codeSection: "neighbor-loop",
        edgeId: arc.edgeId,
        fromId: arc.fromId,
        toId: arc.toId,
        cost: arc.cost,
      });
      if (mode === "greedy-best-first" && closed.has(arc.toId)) {
        recorder.emit({
          type: "rejectCandidate",
          codeSection: "relaxation",
          nodeId: arc.toId,
          edgeId: arc.edgeId,
          reason: "Greedy Best-First Search does not reopen expanded nodes",
        });
        continue;
      }
      const oldDistance = distances.get(arc.toId) ?? Number.POSITIVE_INFINITY;
      const candidateDistance = entry.distance + arc.cost;
      recorder.emit({
        type: "relaxEdge",
        codeSection: "relaxation",
        edgeId: arc.edgeId,
        fromId: arc.fromId,
        toId: arc.toId,
        oldDistance,
        candidateDistance,
      });
      if (!(candidateDistance < oldDistance)) {
        recorder.emit({
          type: "rejectCandidate",
          codeSection: "relaxation",
          nodeId: arc.toId,
          edgeId: arc.edgeId,
          reason: "the candidate is not cheaper than the known distance",
        });
        continue;
      }

      distances.set(arc.toId, candidateDistance);
      parents.set(arc.toId, {
        nodeId: entry.nodeId,
        edgeId: arc.edgeId,
      });
      metrics.relaxations += 1;
      if (!discovered.has(arc.toId)) {
        discovered.add(arc.toId);
        metrics.nodesVisited += 1;
      }
      recorder.emit({
        type: "updateDistance",
        codeSection: "distance-update",
        nodeId: arc.toId,
        oldDistance,
        newDistance: candidateDistance,
      });
      recorder.emit({
        type: "setParent",
        codeSection: "parent-update",
        nodeId: arc.toId,
        parentId: entry.nodeId,
        edgeId: arc.edgeId,
      });
      const heuristic = heuristicFor(arc.toId);
      const priority = priorityFor(candidateDistance, heuristic);
      frontier.push({
        nodeId: arc.toId,
        priority,
        secondary: mode === "greedy-best-first" ? candidateDistance : heuristic,
        distance: candidateDistance,
        sequence: sequence++,
      });
      metrics.queuePushes += 1;
      metrics.maximumFrontierSize = Math.max(
        metrics.maximumFrontierSize,
        frontier.size,
      );
      recorder.emit({
        type: "enqueue",
        codeSection: "frontier",
        nodeId: arc.toId,
        priority,
        distance: candidateDistance,
      });
    }
  }

  const path = found
    ? reconstructPredecessorPath(
        options.startId,
        options.goalId,
        parents,
        traversal.nodeIds.length,
      )
    : null;
  const status: AlgorithmResultStatus = path ? "success" : "no-path";
  const pathCost = path ? (distances.get(options.goalId) ?? 0) : null;
  emitFinishedPath(recorder, path, pathCost, status);
  return makeResult(options, recorder, metrics, startedAt, warnings, {
    found: path !== null,
    status,
    pathNodeIds: path?.nodeIds ?? [],
    pathEdgeIds: path?.edgeIds ?? [],
    pathCost,
  });
}

function reconstructBidirectionalPath(
  startId: string,
  goalId: string,
  meetingId: string,
  forwardParents: ReadonlyMap<string, ParentLink>,
  backwardSuccessors: ReadonlyMap<string, ParentLink>,
  nodeLimit: number,
): { nodeIds: string[]; edgeIds: string[] } | null {
  const forward = reconstructPredecessorPath(
    startId,
    meetingId,
    forwardParents,
    nodeLimit,
  );
  if (!forward) return null;
  const nodeIds = [...forward.nodeIds];
  const edgeIds = [...forward.edgeIds];
  const seen = new Set(nodeIds);
  let cursor = meetingId;
  while (cursor !== goalId && nodeIds.length <= nodeLimit) {
    const successor = backwardSuccessors.get(cursor);
    if (!successor || seen.has(successor.nodeId)) return null;
    edgeIds.push(successor.edgeId);
    cursor = successor.nodeId;
    nodeIds.push(cursor);
    seen.add(cursor);
  }
  return cursor === goalId ? { nodeIds, edgeIds } : null;
}

function executeBidirectionalDijkstra(
  graph: Graph,
  options: ResolvedRunOptions,
  warnings: readonly CompatibilityIssue[],
): AlgorithmResult {
  const startedAt = monotonicNow();
  const traversal = buildTraversalGraph(graph, options);
  const recorder = new TraceRecorder(
    options.algorithmId,
    options.maxTraceEvents,
  );
  const metrics = createMutableMetrics();
  const forwardQueue = new DeterministicPriorityQueue();
  const backwardQueue = new DeterministicPriorityQueue();
  const forwardDistances = new Map<string, number>([[options.startId, 0]]);
  const backwardDistances = new Map<string, number>([[options.goalId, 0]]);
  const forwardParents = new Map<string, ParentLink>();
  const backwardSuccessors = new Map<string, ParentLink>();
  const forwardSettled = new Set<string>();
  const backwardSettled = new Set<string>();
  const discovered = new Set<string>([options.startId, options.goalId]);
  let sequence = 0;

  emitInitialization(recorder, options);
  forwardQueue.push({
    nodeId: options.startId,
    priority: 0,
    secondary: 0,
    distance: 0,
    sequence: sequence++,
  });
  backwardQueue.push({
    nodeId: options.goalId,
    priority: 0,
    secondary: 0,
    distance: 0,
    sequence: sequence++,
  });
  metrics.nodesVisited = discovered.size;
  metrics.queuePushes = 2;
  metrics.maximumFrontierSize = 2;
  recorder.emit({
    type: "enqueue",
    codeSection: "frontier",
    nodeId: options.startId,
    priority: 0,
    distance: 0,
    direction: "forward",
  });
  recorder.emit({
    type: "enqueue",
    codeSection: "frontier",
    nodeId: options.goalId,
    priority: 0,
    distance: 0,
    direction: "backward",
  });

  let bestDistance = Number.POSITIVE_INFINITY;
  let meetingId: string | null = null;

  const updateMeeting = (nodeId: string): void => {
    const forward = forwardDistances.get(nodeId);
    const backward = backwardDistances.get(nodeId);
    if (forward === undefined || backward === undefined) return;
    const total = forward + backward;
    if (
      total < bestDistance ||
      (total === bestDistance &&
        (meetingId === null || compareIds(nodeId, meetingId) < 0))
    ) {
      bestDistance = total;
      meetingId = nodeId;
      recorder.emit({
        type: "meetFrontiers",
        codeSection: "meeting-condition",
        nodeId,
        forwardDistance: forward,
        backwardDistance: backward,
        totalDistance: total,
      });
    }
  };

  if (options.startId === options.goalId) updateMeeting(options.startId);

  const cleanQueue = (
    queue: DeterministicPriorityQueue,
    distances: ReadonlyMap<string, number>,
    settled: ReadonlySet<string>,
    direction: TraceDirection,
  ): PriorityQueueEntry | undefined => {
    while (queue.size > 0) {
      const entry = queue.peek();
      if (!entry) return undefined;
      const known = distances.get(entry.nodeId);
      if (
        known !== undefined &&
        entry.distance === known &&
        !settled.has(entry.nodeId)
      ) {
        return entry;
      }
      const stale = queue.pop();
      if (!stale) return undefined;
      metrics.queuePops += 1;
      recorder.emit({
        type: "dequeue",
        codeSection: "dequeue",
        nodeId: stale.nodeId,
        priority: stale.priority,
        distance: stale.distance,
        direction,
      });
      recorder.emit({
        type: "rejectCandidate",
        codeSection: "dequeue",
        nodeId: stale.nodeId,
        direction,
        reason: settled.has(stale.nodeId)
          ? "the node is already settled in this direction"
          : "this is a stale priority-queue entry",
      });
    }
    return undefined;
  };

  while (true) {
    const forwardMinimum = cleanQueue(
      forwardQueue,
      forwardDistances,
      forwardSettled,
      "forward",
    );
    const backwardMinimum = cleanQueue(
      backwardQueue,
      backwardDistances,
      backwardSettled,
      "backward",
    );
    if (!forwardMinimum || !backwardMinimum) break;
    if (forwardMinimum.distance + backwardMinimum.distance >= bestDistance)
      break;

    const expandForward =
      forwardMinimum.distance < backwardMinimum.distance ||
      (forwardMinimum.distance === backwardMinimum.distance &&
        compareIds(forwardMinimum.nodeId, backwardMinimum.nodeId) <= 0);
    const direction: TraceDirection = expandForward ? "forward" : "backward";
    const queue = expandForward ? forwardQueue : backwardQueue;
    const distances = expandForward ? forwardDistances : backwardDistances;
    const settled = expandForward ? forwardSettled : backwardSettled;
    const entry = queue.pop();
    if (!entry) break;
    metrics.queuePops += 1;
    recorder.emit({
      type: "dequeue",
      codeSection: "dequeue",
      nodeId: entry.nodeId,
      priority: entry.priority,
      distance: entry.distance,
      direction,
    });
    settled.add(entry.nodeId);
    metrics.nodesExpanded += 1;
    recorder.emit({
      type: "visitNode",
      codeSection: "visit",
      nodeId: entry.nodeId,
      distance: entry.distance,
      direction,
    });
    updateMeeting(entry.nodeId);

    const arcs = expandForward
      ? (traversal.outgoing.get(entry.nodeId) ?? [])
      : (traversal.incoming.get(entry.nodeId) ?? []);
    for (const arc of arcs) {
      const neighborId = expandForward ? arc.toId : arc.fromId;
      metrics.edgesInspected += 1;
      recorder.emit({
        type: "inspectEdge",
        codeSection: "neighbor-loop",
        edgeId: arc.edgeId,
        fromId: entry.nodeId,
        toId: neighborId,
        cost: arc.cost,
        direction,
      });
      const oldDistance = distances.get(neighborId) ?? Number.POSITIVE_INFINITY;
      const candidateDistance = entry.distance + arc.cost;
      recorder.emit({
        type: "relaxEdge",
        codeSection: "relaxation",
        edgeId: arc.edgeId,
        fromId: entry.nodeId,
        toId: neighborId,
        oldDistance,
        candidateDistance,
        direction,
      });
      if (!(candidateDistance < oldDistance)) {
        recorder.emit({
          type: "rejectCandidate",
          codeSection: "relaxation",
          nodeId: neighborId,
          edgeId: arc.edgeId,
          direction,
          reason: "the candidate is not cheaper than the known distance",
        });
        continue;
      }
      distances.set(neighborId, candidateDistance);
      if (expandForward) {
        forwardParents.set(neighborId, {
          nodeId: entry.nodeId,
          edgeId: arc.edgeId,
        });
      } else {
        // The backward tree follows reversed arcs. This link points from the
        // newly reached predecessor toward the goal in the original graph.
        backwardSuccessors.set(neighborId, {
          nodeId: entry.nodeId,
          edgeId: arc.edgeId,
        });
      }
      metrics.relaxations += 1;
      if (!discovered.has(neighborId)) {
        discovered.add(neighborId);
        metrics.nodesVisited += 1;
      }
      recorder.emit({
        type: "updateDistance",
        codeSection: "distance-update",
        nodeId: neighborId,
        oldDistance,
        newDistance: candidateDistance,
        direction,
      });
      recorder.emit({
        type: "setParent",
        codeSection: "parent-update",
        nodeId: neighborId,
        parentId: entry.nodeId,
        edgeId: arc.edgeId,
        direction,
      });
      queue.push({
        nodeId: neighborId,
        priority: candidateDistance,
        secondary: 0,
        distance: candidateDistance,
        sequence: sequence++,
      });
      metrics.queuePushes += 1;
      metrics.maximumFrontierSize = Math.max(
        metrics.maximumFrontierSize,
        forwardQueue.size + backwardQueue.size,
      );
      recorder.emit({
        type: "enqueue",
        codeSection: "frontier",
        nodeId: neighborId,
        priority: candidateDistance,
        distance: candidateDistance,
        direction,
      });
      updateMeeting(neighborId);
    }
  }

  const path = meetingId
    ? reconstructBidirectionalPath(
        options.startId,
        options.goalId,
        meetingId,
        forwardParents,
        backwardSuccessors,
        traversal.nodeIds.length,
      )
    : null;
  const status: AlgorithmResultStatus = path ? "success" : "no-path";
  const pathCost = path ? bestDistance : null;
  emitFinishedPath(recorder, path, pathCost, status);
  return makeResult(options, recorder, metrics, startedAt, warnings, {
    found: path !== null,
    status,
    pathNodeIds: path?.nodeIds ?? [],
    pathEdgeIds: path?.edgeIds ?? [],
    pathCost,
  });
}

function extractNegativeCycle(
  witnessId: string,
  parents: ReadonlyMap<string, ParentLink>,
  nodeCount: number,
): { nodeIds: string[]; edgeIds: string[] } {
  let cursor = witnessId;
  for (let index = 0; index < nodeCount; index += 1) {
    const parent = parents.get(cursor);
    if (!parent) return { nodeIds: [witnessId], edgeIds: [] };
    cursor = parent.nodeId;
  }

  const backwardNodes = [cursor];
  let next = parents.get(cursor)?.nodeId;
  while (
    next !== undefined &&
    next !== cursor &&
    backwardNodes.length <= nodeCount + 1
  ) {
    backwardNodes.push(next);
    next = parents.get(next)?.nodeId;
  }
  if (next !== cursor) return { nodeIds: [witnessId], edgeIds: [] };
  backwardNodes.reverse();
  const nodeIds = [...backwardNodes, backwardNodes[0] as string];
  const edgeIds: string[] = [];
  for (let index = 1; index < nodeIds.length; index += 1) {
    const child = nodeIds[index];
    if (child === undefined) continue;
    const edgeId = parents.get(child)?.edgeId;
    if (edgeId !== undefined) edgeIds.push(edgeId);
  }
  return { nodeIds, edgeIds };
}

function executeBellmanFord(
  graph: Graph,
  options: ResolvedRunOptions,
  warnings: readonly CompatibilityIssue[],
): AlgorithmResult {
  const startedAt = monotonicNow();
  const traversal = buildTraversalGraph(graph, options);
  const recorder = new TraceRecorder(
    options.algorithmId,
    options.maxTraceEvents,
  );
  const metrics = createMutableMetrics();
  const distances = new Map<string, number>([[options.startId, 0]]);
  const parents = new Map<string, ParentLink>();
  const reached = new Set<string>([options.startId]);

  emitInitialization(recorder, options);
  metrics.nodesVisited = 1;
  for (
    let pass = 0;
    pass < Math.max(0, traversal.nodeIds.length - 1);
    pass += 1
  ) {
    let changed = false;
    const expandedThisPass = new Set<string>();
    for (const arc of traversal.arcs) {
      const fromDistance = distances.get(arc.fromId);
      if (fromDistance === undefined) continue;
      if (!expandedThisPass.has(arc.fromId)) {
        expandedThisPass.add(arc.fromId);
        metrics.nodesExpanded += 1;
        recorder.emit({
          type: "visitNode",
          codeSection: "visit",
          nodeId: arc.fromId,
          distance: fromDistance,
          message: `Process ${arc.fromId}'s outgoing edges during Bellman-Ford pass ${pass + 1}.`,
        });
      }
      metrics.edgesInspected += 1;
      recorder.emit({
        type: "inspectEdge",
        codeSection: "neighbor-loop",
        edgeId: arc.edgeId,
        fromId: arc.fromId,
        toId: arc.toId,
        cost: arc.cost,
      });
      const oldDistance = distances.get(arc.toId) ?? Number.POSITIVE_INFINITY;
      const candidateDistance = fromDistance + arc.cost;
      recorder.emit({
        type: "relaxEdge",
        codeSection: "relaxation",
        edgeId: arc.edgeId,
        fromId: arc.fromId,
        toId: arc.toId,
        oldDistance,
        candidateDistance,
      });
      if (!(candidateDistance < oldDistance)) {
        recorder.emit({
          type: "rejectCandidate",
          codeSection: "relaxation",
          nodeId: arc.toId,
          edgeId: arc.edgeId,
          reason: "the candidate is not cheaper than the known distance",
        });
        continue;
      }
      changed = true;
      distances.set(arc.toId, candidateDistance);
      parents.set(arc.toId, { nodeId: arc.fromId, edgeId: arc.edgeId });
      metrics.relaxations += 1;
      if (!reached.has(arc.toId)) {
        reached.add(arc.toId);
        metrics.nodesVisited += 1;
      }
      recorder.emit({
        type: "updateDistance",
        codeSection: "distance-update",
        nodeId: arc.toId,
        oldDistance,
        newDistance: candidateDistance,
      });
      recorder.emit({
        type: "setParent",
        codeSection: "parent-update",
        nodeId: arc.toId,
        parentId: arc.fromId,
        edgeId: arc.edgeId,
      });
    }
    if (!changed) break;
  }

  let cycleWitness: string | null = null;
  for (const arc of traversal.arcs) {
    const fromDistance = distances.get(arc.fromId);
    if (fromDistance === undefined) continue;
    metrics.edgesInspected += 1;
    recorder.emit({
      type: "inspectEdge",
      codeSection: "negative-cycle",
      edgeId: arc.edgeId,
      fromId: arc.fromId,
      toId: arc.toId,
      cost: arc.cost,
      message: `Check edge ${arc.edgeId} for a further improvement after the main passes.`,
    });
    const oldDistance = distances.get(arc.toId) ?? Number.POSITIVE_INFINITY;
    const candidateDistance = fromDistance + arc.cost;
    if (candidateDistance < oldDistance) {
      distances.set(arc.toId, candidateDistance);
      parents.set(arc.toId, { nodeId: arc.fromId, edgeId: arc.edgeId });
      cycleWitness = arc.toId;
      metrics.relaxations += 1;
      recorder.emit({
        type: "relaxEdge",
        codeSection: "negative-cycle",
        edgeId: arc.edgeId,
        fromId: arc.fromId,
        toId: arc.toId,
        oldDistance,
        candidateDistance,
      });
      recorder.emit({
        type: "updateDistance",
        codeSection: "negative-cycle",
        nodeId: arc.toId,
        oldDistance,
        newDistance: candidateDistance,
      });
      recorder.emit({
        type: "setParent",
        codeSection: "negative-cycle",
        nodeId: arc.toId,
        parentId: arc.fromId,
        edgeId: arc.edgeId,
      });
    }
  }

  if (cycleWitness) {
    const cycle = extractNegativeCycle(
      cycleWitness,
      parents,
      traversal.nodeIds.length,
    );
    recorder.emit({
      type: "negativeCycleDetected",
      codeSection: "negative-cycle",
      nodeIds: cycle.nodeIds,
      edgeIds: cycle.edgeIds,
    });
    emitFinishedPath(recorder, null, null, "negative-cycle");
    return makeResult(options, recorder, metrics, startedAt, warnings, {
      found: false,
      status: "negative-cycle",
      pathNodeIds: [],
      pathEdgeIds: [],
      pathCost: null,
      negativeCycleNodeIds: cycle.nodeIds,
    });
  }

  const goalReached = distances.has(options.goalId);
  const path = goalReached
    ? reconstructPredecessorPath(
        options.startId,
        options.goalId,
        parents,
        traversal.nodeIds.length,
      )
    : null;
  const status: AlgorithmResultStatus = path ? "success" : "no-path";
  const pathCost = path ? (distances.get(options.goalId) ?? 0) : null;
  emitFinishedPath(recorder, path, pathCost, status);
  return makeResult(options, recorder, metrics, startedAt, warnings, {
    found: path !== null,
    status,
    pathNodeIds: path?.nodeIds ?? [],
    pathEdgeIds: path?.edgeIds ?? [],
    pathCost,
  });
}

function matrixRecord(
  nodeIds: readonly string[],
  matrix: readonly (readonly number[])[],
  unreachableAsNull: false,
): Readonly<Record<string, Readonly<Record<string, number>>>>;
function matrixRecord(
  nodeIds: readonly string[],
  matrix: readonly (readonly number[])[],
  unreachableAsNull: true,
): Readonly<Record<string, Readonly<Record<string, number | null>>>>;
function matrixRecord(
  nodeIds: readonly string[],
  matrix: readonly (readonly number[])[],
  unreachableAsNull: boolean,
): Readonly<Record<string, Readonly<Record<string, number | null>>>> {
  const result: Record<string, Record<string, number | null>> = {};
  nodeIds.forEach((fromId, fromIndex) => {
    const row: Record<string, number | null> = {};
    nodeIds.forEach((toId, toIndex) => {
      const value = matrix[fromIndex]?.[toIndex] ?? Number.POSITIVE_INFINITY;
      row[toId] = unreachableAsNull && !Number.isFinite(value) ? null : value;
    });
    result[fromId] = row;
  });
  return result;
}

function reconstructFloydWarshallPath(
  startIndex: number,
  goalIndex: number,
  nodeIds: readonly string[],
  next: readonly (readonly number[])[],
  firstEdge: readonly (readonly (string | null)[])[],
): { nodeIds: string[]; edgeIds: string[] } | null {
  if (next[startIndex]?.[goalIndex] === -1) return null;
  const startId = nodeIds[startIndex];
  if (startId === undefined) return null;
  const pathNodeIds = [startId];
  const pathEdgeIds: string[] = [];
  let cursor = startIndex;
  let guard = 0;
  while (cursor !== goalIndex && guard <= nodeIds.length) {
    const edgeId = firstEdge[cursor]?.[goalIndex];
    const nextIndex = next[cursor]?.[goalIndex] ?? -1;
    const nextId = nodeIds[nextIndex];
    if (!edgeId || nextIndex < 0 || nextId === undefined) return null;
    pathEdgeIds.push(edgeId);
    pathNodeIds.push(nextId);
    cursor = nextIndex;
    guard += 1;
  }
  return cursor === goalIndex
    ? { nodeIds: pathNodeIds, edgeIds: pathEdgeIds }
    : null;
}

function executeFloydWarshall(
  graph: Graph,
  options: ResolvedRunOptions,
  warnings: readonly CompatibilityIssue[],
): AlgorithmResult {
  const startedAt = monotonicNow();
  const traversal = buildTraversalGraph(graph, options);
  const recorder = new TraceRecorder(
    options.algorithmId,
    options.maxTraceEvents,
  );
  const metrics = createMutableMetrics();
  const nodeIds = traversal.nodeIds;
  const nodeIndex = new Map(nodeIds.map((nodeId, index) => [nodeId, index]));
  const count = nodeIds.length;
  const distances = Array.from({ length: count }, () =>
    Array<number>(count).fill(Number.POSITIVE_INFINITY),
  );
  const next = Array.from({ length: count }, () =>
    Array<number>(count).fill(-1),
  );
  const firstEdge = Array.from({ length: count }, () =>
    Array<string | null>(count).fill(null),
  );

  emitInitialization(recorder, options);
  for (let index = 0; index < count; index += 1) {
    const row = distances[index];
    const nextRow = next[index];
    if (row && nextRow) {
      row[index] = 0;
      nextRow[index] = index;
    }
  }
  for (const arc of traversal.arcs) {
    const fromIndex = nodeIndex.get(arc.fromId);
    const toIndex = nodeIndex.get(arc.toId);
    if (fromIndex === undefined || toIndex === undefined) continue;
    metrics.edgesInspected += 1;
    const oldDistance =
      distances[fromIndex]?.[toIndex] ?? Number.POSITIVE_INFINITY;
    const oldEdgeId = firstEdge[fromIndex]?.[toIndex];
    if (
      arc.cost < oldDistance ||
      (arc.cost === oldDistance &&
        oldEdgeId !== null &&
        compareIds(arc.edgeId, oldEdgeId) < 0)
    ) {
      const distanceRow = distances[fromIndex];
      const nextRow = next[fromIndex];
      const edgeRow = firstEdge[fromIndex];
      if (!distanceRow || !nextRow || !edgeRow) continue;
      distanceRow[toIndex] = arc.cost;
      nextRow[toIndex] = toIndex;
      edgeRow[toIndex] = arc.edgeId;
      metrics.relaxations += 1;
    }
  }
  metrics.nodesVisited = count;
  recorder.emit({
    type: "initializeMatrix",
    codeSection: "matrix-initialize",
    nodeIds: [...nodeIds],
    distances: matrixRecord(nodeIds, distances, false),
  });

  for (let viaIndex = 0; viaIndex < count; viaIndex += 1) {
    const viaId = nodeIds[viaIndex];
    if (viaId === undefined) continue;
    metrics.nodesExpanded += 1;
    recorder.emit({
      type: "considerIntermediate",
      codeSection: "matrix-intermediate",
      nodeId: viaId,
      intermediateIndex: viaIndex,
    });
    for (let fromIndex = 0; fromIndex < count; fromIndex += 1) {
      const toVia =
        distances[fromIndex]?.[viaIndex] ?? Number.POSITIVE_INFINITY;
      if (!Number.isFinite(toVia)) continue;
      for (let toIndex = 0; toIndex < count; toIndex += 1) {
        const viaTo =
          distances[viaIndex]?.[toIndex] ?? Number.POSITIVE_INFINITY;
        if (!Number.isFinite(viaTo)) continue;
        const oldDistance =
          distances[fromIndex]?.[toIndex] ?? Number.POSITIVE_INFINITY;
        const candidateDistance = toVia + viaTo;
        if (!(candidateDistance < oldDistance)) continue;
        const fromId = nodeIds[fromIndex];
        const toId = nodeIds[toIndex];
        const distanceRow = distances[fromIndex];
        const nextRow = next[fromIndex];
        const edgeRow = firstEdge[fromIndex];
        if (
          fromId === undefined ||
          toId === undefined ||
          !distanceRow ||
          !nextRow ||
          !edgeRow
        ) {
          continue;
        }
        distanceRow[toIndex] = candidateDistance;
        nextRow[toIndex] = next[fromIndex]?.[viaIndex] ?? -1;
        edgeRow[toIndex] = firstEdge[fromIndex]?.[viaIndex] ?? null;
        metrics.relaxations += 1;
        recorder.emit({
          type: "updateMatrix",
          codeSection: "matrix-update",
          fromId,
          toId,
          viaId,
          oldDistance,
          newDistance: candidateDistance,
        });
      }
    }
  }

  const negativeCycleNodeIds = nodeIds.filter(
    (_nodeId, index) => (distances[index]?.[index] ?? 0) < 0,
  );
  const nextNodeIds: Record<string, Record<string, string | null>> = {};
  nodeIds.forEach((fromId, fromIndex) => {
    const row: Record<string, string | null> = {};
    nodeIds.forEach((toId, toIndex) => {
      const nextIndex = next[fromIndex]?.[toIndex] ?? -1;
      row[toId] = nextIndex >= 0 ? (nodeIds[nextIndex] ?? null) : null;
    });
    nextNodeIds[fromId] = row;
  });
  const allPairs: AllPairsShortestPaths = {
    nodeIds: [...nodeIds],
    distances: matrixRecord(nodeIds, distances, true),
    nextNodeIds,
    negativeCycleNodeIds: [...negativeCycleNodeIds],
  };

  if (negativeCycleNodeIds.length > 0) {
    recorder.emit({
      type: "negativeCycleDetected",
      codeSection: "negative-cycle",
      nodeIds: [...negativeCycleNodeIds],
      edgeIds: [],
      message: `Negative diagonal entries identify ${negativeCycleNodeIds.length} node(s) on or affected by negative cycles.`,
    });
    emitFinishedPath(recorder, null, null, "negative-cycle");
    return makeResult(options, recorder, metrics, startedAt, warnings, {
      found: false,
      status: "negative-cycle",
      pathNodeIds: [],
      pathEdgeIds: [],
      pathCost: null,
      negativeCycleNodeIds,
      allPairs,
    });
  }

  const startIndex = nodeIndex.get(options.startId);
  const goalIndex = nodeIndex.get(options.goalId);
  const path =
    startIndex !== undefined && goalIndex !== undefined
      ? reconstructFloydWarshallPath(
          startIndex,
          goalIndex,
          nodeIds,
          next,
          firstEdge,
        )
      : null;
  const status: AlgorithmResultStatus = path ? "success" : "no-path";
  const pathCost =
    path && startIndex !== undefined && goalIndex !== undefined
      ? (distances[startIndex]?.[goalIndex] ?? null)
      : null;
  emitFinishedPath(recorder, path, pathCost, status);
  return makeResult(options, recorder, metrics, startedAt, warnings, {
    found: path !== null,
    status,
    pathNodeIds: path?.nodeIds ?? [],
    pathEdgeIds: path?.edgeIds ?? [],
    pathCost,
    allPairs,
  });
}

/**
 * Unified, validated entry point for all seven RouteLab algorithms.
 *
 * Execution is synchronous to keep traces deterministic. Browser callers should
 * run this function in a worker and enforce their wall-clock deadline by
 * terminating that worker; the engine itself enforces deterministic trace and
 * Floyd-Warshall work limits.
 */
export function runAlgorithm(
  graph: Graph,
  options: RunOptions,
): AlgorithmResult {
  assertValidGraph(graph);
  const compatibility = validateRunCompatibility(graph, options);
  if (!compatibility.compatible) {
    throw new AlgorithmCompatibilityError(compatibility.issues);
  }
  const resolved = resolveRunOptions(options);
  switch (resolved.algorithmId) {
    case "bfs":
      return executeBreadthFirstSearch(graph, resolved, compatibility.warnings);
    case "dijkstra":
      return executeBestFirst(
        graph,
        resolved,
        compatibility.warnings,
        "dijkstra",
      );
    case "astar":
      return executeBestFirst(graph, resolved, compatibility.warnings, "astar");
    case "greedy-best-first":
      return executeBestFirst(
        graph,
        resolved,
        compatibility.warnings,
        "greedy-best-first",
      );
    case "bidirectional-dijkstra":
      return executeBidirectionalDijkstra(
        graph,
        resolved,
        compatibility.warnings,
      );
    case "bellman-ford":
      return executeBellmanFord(graph, resolved, compatibility.warnings);
    case "floyd-warshall":
      return executeFloydWarshall(graph, resolved, compatibility.warnings);
  }
}

export function runBreadthFirstSearch(
  graph: Graph,
  options: AlgorithmRunOptions,
): AlgorithmResult {
  return runAlgorithm(graph, { ...options, algorithmId: "bfs" });
}

export function runDijkstra(
  graph: Graph,
  options: AlgorithmRunOptions,
): AlgorithmResult {
  return runAlgorithm(graph, { ...options, algorithmId: "dijkstra" });
}

export function runAStar(
  graph: Graph,
  options: AlgorithmRunOptions,
): AlgorithmResult {
  return runAlgorithm(graph, { ...options, algorithmId: "astar" });
}

export function runGreedyBestFirst(
  graph: Graph,
  options: AlgorithmRunOptions,
): AlgorithmResult {
  return runAlgorithm(graph, {
    ...options,
    algorithmId: "greedy-best-first",
  });
}

export function runBidirectionalDijkstra(
  graph: Graph,
  options: AlgorithmRunOptions,
): AlgorithmResult {
  return runAlgorithm(graph, {
    ...options,
    algorithmId: "bidirectional-dijkstra",
  });
}

export function runBellmanFord(
  graph: Graph,
  options: AlgorithmRunOptions,
): AlgorithmResult {
  return runAlgorithm(graph, { ...options, algorithmId: "bellman-ford" });
}

export function runFloydWarshall(
  graph: Graph,
  options: AlgorithmRunOptions,
): AlgorithmResult {
  return runAlgorithm(graph, { ...options, algorithmId: "floyd-warshall" });
}

// Concise aliases are useful in tests and educational examples.
export const bfs = runBreadthFirstSearch;
export const dijkstra = runDijkstra;
export const aStar = runAStar;
export const greedyBestFirst = runGreedyBestFirst;
export const bidirectionalDijkstra = runBidirectionalDijkstra;
export const bellmanFord = runBellmanFord;
export const floydWarshall = runFloydWarshall;

export interface ReplayFrontierEntry {
  readonly nodeId: string;
  readonly priority: number;
  readonly distance: number;
  readonly direction?: TraceDirection;
}

export interface ReplayMetrics {
  readonly queuePushes: number;
  readonly queuePops: number;
  readonly nodesExpanded: number;
  readonly edgesInspected: number;
  readonly relaxations: number;
  readonly maximumFrontierSize: number;
}

export interface ReplayState {
  /** Number of trace events already applied; valid cursors range from 0 to trace.length. */
  readonly cursor: number;
  readonly algorithmId: AlgorithmId | null;
  readonly startId: string | null;
  readonly goalId: string | null;
  readonly travelModel: TravelModel | null;
  readonly heuristicId: HeuristicId | null;
  readonly currentNodeId: string | null;
  readonly currentEdgeId: string | null;
  readonly frontier: readonly ReplayFrontierEntry[];
  readonly visitedNodeIds: readonly string[];
  readonly inspectedEdgeIds: readonly string[];
  readonly distances: Readonly<Record<string, number>>;
  readonly backwardDistances: Readonly<Record<string, number>>;
  readonly parents: Readonly<Record<string, string>>;
  readonly parentEdgeIds: Readonly<Record<string, string>>;
  readonly backwardParents: Readonly<Record<string, string>>;
  readonly backwardParentEdgeIds: Readonly<Record<string, string>>;
  readonly matrix: Readonly<
    Record<string, Readonly<Record<string, number>>>
  > | null;
  readonly intermediateNodeId: string | null;
  readonly pathNodeIds: readonly string[];
  readonly pathEdgeIds: readonly string[];
  readonly negativeCycleNodeIds: readonly string[];
  readonly negativeCycleEdgeIds: readonly string[];
  readonly found: boolean | null;
  readonly status: AlgorithmResultStatus | null;
  readonly pathCost: number | null;
  readonly lastMessage: string | null;
  readonly metrics: ReplayMetrics;
}

export interface TraceSnapshot {
  /** The event-count cursor represented by this snapshot. */
  readonly cursor: number;
  readonly state: ReplayState;
}

interface MutableReplayMetrics {
  queuePushes: number;
  queuePops: number;
  nodesExpanded: number;
  edgesInspected: number;
  relaxations: number;
  maximumFrontierSize: number;
}

interface MutableReplayState {
  cursor: number;
  algorithmId: AlgorithmId | null;
  startId: string | null;
  goalId: string | null;
  travelModel: TravelModel | null;
  heuristicId: HeuristicId | null;
  currentNodeId: string | null;
  currentEdgeId: string | null;
  frontier: ReplayFrontierEntry[];
  visitedNodeIds: string[];
  inspectedEdgeIds: string[];
  distances: Record<string, number>;
  backwardDistances: Record<string, number>;
  parents: Record<string, string>;
  parentEdgeIds: Record<string, string>;
  backwardParents: Record<string, string>;
  backwardParentEdgeIds: Record<string, string>;
  matrix: Record<string, Record<string, number>> | null;
  intermediateNodeId: string | null;
  pathNodeIds: string[];
  pathEdgeIds: string[];
  negativeCycleNodeIds: string[];
  negativeCycleEdgeIds: string[];
  found: boolean | null;
  status: AlgorithmResultStatus | null;
  pathCost: number | null;
  lastMessage: string | null;
  metrics: MutableReplayMetrics;
}

function mutableInitialReplayState(): MutableReplayState {
  return {
    cursor: 0,
    algorithmId: null,
    startId: null,
    goalId: null,
    travelModel: null,
    heuristicId: null,
    currentNodeId: null,
    currentEdgeId: null,
    frontier: [],
    visitedNodeIds: [],
    inspectedEdgeIds: [],
    distances: {},
    backwardDistances: {},
    parents: {},
    parentEdgeIds: {},
    backwardParents: {},
    backwardParentEdgeIds: {},
    matrix: null,
    intermediateNodeId: null,
    pathNodeIds: [],
    pathEdgeIds: [],
    negativeCycleNodeIds: [],
    negativeCycleEdgeIds: [],
    found: null,
    status: null,
    pathCost: null,
    lastMessage: null,
    metrics: {
      queuePushes: 0,
      queuePops: 0,
      nodesExpanded: 0,
      edgesInspected: 0,
      relaxations: 0,
      maximumFrontierSize: 0,
    },
  };
}

function cloneMatrix(
  matrix: Readonly<Record<string, Readonly<Record<string, number>>>> | null,
): Record<string, Record<string, number>> | null {
  if (!matrix) return null;
  return Object.fromEntries(
    Object.entries(matrix).map(([rowId, row]) => [rowId, { ...row }]),
  );
}

function cloneReplayState(state: ReplayState): MutableReplayState {
  return {
    cursor: state.cursor,
    algorithmId: state.algorithmId,
    startId: state.startId,
    goalId: state.goalId,
    travelModel: state.travelModel,
    heuristicId: state.heuristicId,
    currentNodeId: state.currentNodeId,
    currentEdgeId: state.currentEdgeId,
    frontier: state.frontier.map((entry) => ({ ...entry })),
    visitedNodeIds: [...state.visitedNodeIds],
    inspectedEdgeIds: [...state.inspectedEdgeIds],
    distances: { ...state.distances },
    backwardDistances: { ...state.backwardDistances },
    parents: { ...state.parents },
    parentEdgeIds: { ...state.parentEdgeIds },
    backwardParents: { ...state.backwardParents },
    backwardParentEdgeIds: { ...state.backwardParentEdgeIds },
    matrix: cloneMatrix(state.matrix),
    intermediateNodeId: state.intermediateNodeId,
    pathNodeIds: [...state.pathNodeIds],
    pathEdgeIds: [...state.pathEdgeIds],
    negativeCycleNodeIds: [...state.negativeCycleNodeIds],
    negativeCycleEdgeIds: [...state.negativeCycleEdgeIds],
    found: state.found,
    status: state.status,
    pathCost: state.pathCost,
    lastMessage: state.lastMessage,
    metrics: { ...state.metrics },
  };
}

function snapshotReplayState(state: MutableReplayState): ReplayState {
  return cloneReplayState(state);
}

/** Return the empty state shown before event zero. */
export function createInitialReplayState(): ReplayState {
  return snapshotReplayState(mutableInitialReplayState());
}

function appendUnique(values: string[], value: string): void {
  if (!values.includes(value)) values.push(value);
}

function reduceReplayState(
  state: MutableReplayState,
  event: AlgorithmTraceEvent,
): void {
  state.cursor = event.step + 1;
  state.lastMessage = event.message;
  switch (event.type) {
    case "initialize":
      state.algorithmId = event.algorithmId;
      state.startId = event.startId;
      state.goalId = event.goalId;
      state.travelModel = event.travelModel;
      state.heuristicId = event.heuristicId;
      state.distances[event.startId] = 0;
      if (event.algorithmId === "bidirectional-dijkstra") {
        state.backwardDistances[event.goalId] = 0;
      }
      break;
    case "enqueue":
      state.frontier.push({
        nodeId: event.nodeId,
        priority: event.priority,
        distance: event.distance,
        ...(event.direction ? { direction: event.direction } : {}),
      });
      state.metrics.queuePushes += 1;
      state.metrics.maximumFrontierSize = Math.max(
        state.metrics.maximumFrontierSize,
        state.frontier.length,
      );
      break;
    case "dequeue": {
      const index = state.frontier.findIndex(
        (entry) =>
          entry.nodeId === event.nodeId &&
          entry.distance === event.distance &&
          entry.priority === event.priority &&
          entry.direction === event.direction,
      );
      if (index >= 0) state.frontier.splice(index, 1);
      state.currentNodeId = event.nodeId;
      state.metrics.queuePops += 1;
      break;
    }
    case "visitNode":
      state.currentNodeId = event.nodeId;
      appendUnique(state.visitedNodeIds, event.nodeId);
      state.metrics.nodesExpanded += 1;
      break;
    case "inspectEdge":
      state.currentEdgeId = event.edgeId;
      appendUnique(state.inspectedEdgeIds, event.edgeId);
      state.metrics.edgesInspected += 1;
      break;
    case "relaxEdge":
      state.currentEdgeId = event.edgeId;
      break;
    case "updateDistance":
      if (event.direction === "backward") {
        state.backwardDistances[event.nodeId] = event.newDistance;
      } else {
        state.distances[event.nodeId] = event.newDistance;
      }
      state.metrics.relaxations += 1;
      break;
    case "setParent":
      if (event.direction === "backward") {
        state.backwardParents[event.nodeId] = event.parentId;
        state.backwardParentEdgeIds[event.nodeId] = event.edgeId;
      } else {
        state.parents[event.nodeId] = event.parentId;
        state.parentEdgeIds[event.nodeId] = event.edgeId;
      }
      break;
    case "rejectCandidate":
      break;
    case "meetFrontiers":
      state.currentNodeId = event.nodeId;
      break;
    case "initializeMatrix":
      state.matrix = cloneMatrix(event.distances);
      break;
    case "considerIntermediate":
      state.intermediateNodeId = event.nodeId;
      state.currentNodeId = event.nodeId;
      state.metrics.nodesExpanded += 1;
      break;
    case "updateMatrix":
      if (!state.matrix) state.matrix = {};
      if (!state.matrix[event.fromId]) state.matrix[event.fromId] = {};
      state.matrix[event.fromId]![event.toId] = event.newDistance;
      state.metrics.relaxations += 1;
      break;
    case "reconstructPath":
      state.pathNodeIds = [...event.nodeIds];
      state.pathEdgeIds = [...event.edgeIds];
      break;
    case "negativeCycleDetected":
      state.negativeCycleNodeIds = [...event.nodeIds];
      state.negativeCycleEdgeIds = [...event.edgeIds];
      break;
    case "finish":
      state.found = event.found;
      state.status = event.status;
      state.pathCost = event.pathCost;
      state.pathNodeIds = [...event.pathNodeIds];
      state.pathEdgeIds = [...event.pathEdgeIds];
      break;
  }
}

/** Apply one event without mutating the caller's state. */
export function applyTraceEvent(
  state: ReplayState,
  event: AlgorithmTraceEvent,
): ReplayState {
  const next = cloneReplayState(state);
  reduceReplayState(next, event);
  return snapshotReplayState(next);
}

/**
 * Build periodic immutable states. A snapshot always represents the number of
 * events in `cursor`, and snapshots include both cursor 0 and the final cursor.
 */
export function createTraceSnapshots(
  trace: readonly AlgorithmTraceEvent[],
  interval = 50,
): readonly TraceSnapshot[] {
  if (!Number.isSafeInteger(interval) || interval < 1) {
    throw new RangeError("Snapshot interval must be a positive safe integer.");
  }
  const state = mutableInitialReplayState();
  const snapshots: TraceSnapshot[] = [
    { cursor: 0, state: snapshotReplayState(state) },
  ];
  trace.forEach((event, index) => {
    reduceReplayState(state, event);
    const cursor = index + 1;
    if (cursor % interval === 0 || cursor === trace.length) {
      snapshots.push({ cursor, state: snapshotReplayState(state) });
    }
  });
  return snapshots;
}

/**
 * Deterministically reconstruct a timeline state. Supplying periodic snapshots
 * makes backward scrubbing proportional to the snapshot interval instead of the
 * full trace length.
 */
export function replayTrace(
  trace: readonly AlgorithmTraceEvent[],
  cursor = trace.length,
  snapshots: readonly TraceSnapshot[] = [],
): ReplayState {
  if (!Number.isSafeInteger(cursor) || cursor < 0 || cursor > trace.length) {
    throw new RangeError(
      `Replay cursor must be between 0 and ${trace.length}.`,
    );
  }
  let bestSnapshot: TraceSnapshot | undefined;
  for (const snapshot of snapshots) {
    if (
      snapshot.cursor <= cursor &&
      (!bestSnapshot || snapshot.cursor > bestSnapshot.cursor)
    ) {
      bestSnapshot = snapshot;
    }
  }
  const state = bestSnapshot
    ? cloneReplayState(bestSnapshot.state)
    : mutableInitialReplayState();
  for (let index = state.cursor; index < cursor; index += 1) {
    const event = trace[index];
    if (event) reduceReplayState(state, event);
  }
  return snapshotReplayState(state);
}
