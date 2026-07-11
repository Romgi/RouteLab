export const SCENARIO_SCHEMA_VERSION = 1 as const;

export const SCENARIO_LIMITS = Object.freeze({
  maxNodes: 500,
  maxEdges: 4_000,
  maxFloydWarshallNodes: 24,
  maxIdLength: 64,
  maxLabelLength: 80,
  maxNameLength: 100,
  maxDescriptionLength: 800,
  maxLearningObjectives: 10,
  maxLearningObjectiveLength: 240,
  maxMetadataEntries: 20,
  maxMetadataKeyLength: 48,
  maxMetadataStringLength: 240,
  maxImportBytes: 512 * 1024,
  maxExportBytes: 512 * 1024,
  maxShareStateCharacters: 16_384,
  maxCoordinateMagnitude: 1_000_000,
  maxAbsoluteWeight: 1_000_000,
  maxSpeedKph: 500,
  maxTraceEvents: 100_000,
  maxAlgorithmRuntimeMs: 5_000,
  maxAnimationHistory: 50_000,
  maxGeneratorDimension: 50,
} as const);

export const SCENARIO_CATEGORY_IDS = [
  "grid",
  "roads",
  "terrain",
  "maze",
  "directed",
  "dynamic",
  "urban",
  "rural",
  "heuristic",
  "disconnected",
  "graph-theory",
  "all-pairs",
  "generated",
] as const;

export const COST_METRIC_IDS = ["weight", "distance", "travelTime"] as const;

export const NODE_TYPE_IDS = [
  "intersection",
  "waypoint",
  "terrain",
  "obstacle",
  "landmark",
  "abstract",
] as const;

export const ROAD_TYPE_IDS = [
  "street",
  "local",
  "highway",
  "trail",
  "bridge",
  "corridor",
  "abstract",
] as const;
