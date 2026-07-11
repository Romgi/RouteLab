import type {
  AlgorithmId,
  Graph,
  GraphEdge,
  GraphNode,
  HeuristicId,
} from "@/lib/algorithms";

import type {
  COST_METRIC_IDS,
  NODE_TYPE_IDS,
  ROAD_TYPE_IDS,
  SCENARIO_CATEGORY_IDS,
  SCENARIO_SCHEMA_VERSION,
} from "./constants";

export type ScenarioCategory = (typeof SCENARIO_CATEGORY_IDS)[number];
export type CostMetric = (typeof COST_METRIC_IDS)[number];
export type ScenarioNodeType = (typeof NODE_TYPE_IDS)[number];
export type ScenarioRoadType = (typeof ROAD_TYPE_IDS)[number];
export type ScenarioMetadataValue = string | number | boolean | null;
export type ScenarioMetadata = Readonly<Record<string, ScenarioMetadataValue>>;

export interface ScenarioNode extends GraphNode {
  id: string;
  label: string;
  x: number;
  y: number;
  nodeType: ScenarioNodeType;
  latitude?: number;
  longitude?: number;
  metadata?: ScenarioMetadata;
}

export interface ScenarioEdge extends GraphEdge {
  id: string;
  fromId: string;
  toId: string;
  weight: number;
  directed: boolean;
  distance?: number;
  travelTime?: number;
  roadType?: ScenarioRoadType;
  speed?: number;
  toll?: boolean;
  closed?: boolean;
  terrainMultiplier?: number;
  safetyMultiplier?: number;
  label?: string;
  mutable?: boolean;
  metadata?: ScenarioMetadata;
}

export interface ScenarioGraph extends Graph {
  nodes: readonly ScenarioNode[];
  edges: readonly ScenarioEdge[];
}

export interface CameraBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  padding: number;
}

export interface GraphSizeLimit {
  nodes: number;
  edges: number;
}

export interface Scenario {
  schemaVersion: typeof SCENARIO_SCHEMA_VERSION;
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
  availableCostMetrics: readonly CostMetric[];
  defaultCostMetric: CostMetric;
  cameraBounds: CameraBounds;
  learningObjectives: readonly string[];
  seed: number;
  expectedOptimalCost?: number | null;
  expectedCosts?: Partial<Record<CostMetric, number | null>>;
  maxGraphSize: GraphSizeLimit;
  editableEdgeIds?: readonly string[];
}

export interface ScenarioValidationIssue {
  path: string;
  message: string;
  code: string;
}

export type ScenarioValidationResult =
  | { success: true; data: Scenario }
  | { success: false; issues: readonly ScenarioValidationIssue[] };

export interface ScenarioJsonOptions {
  fileName?: string;
  mimeType?: string;
  maxBytes?: number;
}

export interface ScenarioExportOptions {
  pretty?: boolean;
  maxBytes?: number;
}

export interface ScenarioShareState {
  schemaVersion: typeof SCENARIO_SCHEMA_VERSION;
  scenarioId?: string;
  scenario?: Scenario;
  algorithm?: AlgorithmId;
  heuristic?: HeuristicId;
  costMetric?: CostMetric;
  closedEdgeIds?: readonly string[];
}

export type ScenarioShareStateValidationResult =
  | { success: true; data: ScenarioShareState }
  | { success: false; issues: readonly ScenarioValidationIssue[] };

export interface GridScenarioOptions {
  rows?: number;
  columns?: number;
  seed?: number;
  id?: string;
  name?: string;
  description?: string;
  spacing?: number;
  jitter?: number;
  minWeight?: number;
  maxWeight?: number;
  oneWayProbability?: number;
  closedEdgeProbability?: number;
  startRow?: number;
  startColumn?: number;
  goalRow?: number;
  goalColumn?: number;
}

export interface RandomScenarioOptions {
  nodeCount?: number;
  edgeDensity?: number;
  seed?: number;
  id?: string;
  name?: string;
  description?: string;
  directed?: boolean;
  ensureConnected?: boolean;
  minWeight?: number;
  maxWeight?: number;
  width?: number;
  height?: number;
}
