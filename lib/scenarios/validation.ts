import { ALGORITHM_IDS, HEURISTIC_IDS } from "@/lib/algorithms";
import { z } from "zod";

import {
  COST_METRIC_IDS,
  NODE_TYPE_IDS,
  ROAD_TYPE_IDS,
  SCENARIO_CATEGORY_IDS,
  SCENARIO_LIMITS,
  SCENARIO_SCHEMA_VERSION,
} from "./constants";
import type {
  Scenario,
  ScenarioValidationIssue,
  ScenarioValidationResult,
} from "./types";

const CONTROL_OR_BIDI_CHARACTER =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u;
const SINGLE_LINE_CONTROL_CHARACTER = /[\r\n\t]/u;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u;
const RESERVED_PROPERTY_NAMES = new Set([
  "__proto__",
  "constructor",
  "prototype",
]);

function textSchema(maxLength: number, singleLine = false) {
  return z
    .string()
    .min(1)
    .max(maxLength)
    .refine((value) => !CONTROL_OR_BIDI_CHARACTER.test(value), {
      message:
        "Text contains a disallowed control or bidirectional formatting character.",
    })
    .refine(
      (value) => !singleLine || !SINGLE_LINE_CONTROL_CHARACTER.test(value),
      {
        message: "Text must be a single line.",
      },
    );
}

const idSchema = z
  .string()
  .min(1)
  .max(SCENARIO_LIMITS.maxIdLength)
  .regex(
    SAFE_ID,
    "Use letters, numbers, dots, colons, underscores, or hyphens only.",
  )
  .refine((value) => !RESERVED_PROPERTY_NAMES.has(value), {
    message: "This identifier is reserved.",
  });

const boundedNumber = z
  .number()
  .refine(Number.isFinite, "Number must be finite.")
  .refine(
    (value) => Math.abs(value) <= SCENARIO_LIMITS.maxCoordinateMagnitude,
    `Number must be between -${SCENARIO_LIMITS.maxCoordinateMagnitude} and ${SCENARIO_LIMITS.maxCoordinateMagnitude}.`,
  );

const weightSchema = z
  .number()
  .refine(Number.isFinite, "Weight must be finite.")
  .refine(
    (value) => Math.abs(value) <= SCENARIO_LIMITS.maxAbsoluteWeight,
    `Weight magnitude cannot exceed ${SCENARIO_LIMITS.maxAbsoluteWeight}.`,
  );

const nonNegativeCostSchema = z
  .number()
  .refine(Number.isFinite, "Cost must be finite.")
  .min(0)
  .max(SCENARIO_LIMITS.maxAbsoluteWeight);

const metadataKeySchema = z
  .string()
  .min(1)
  .max(SCENARIO_LIMITS.maxMetadataKeyLength)
  .regex(SAFE_ID, "Metadata keys must use safe identifier characters.")
  .refine((value) => !RESERVED_PROPERTY_NAMES.has(value), {
    message: "This metadata key is reserved.",
  });

const metadataValueSchema = z.union([
  textSchema(SCENARIO_LIMITS.maxMetadataStringLength),
  boundedNumber,
  z.boolean(),
  z.null(),
]);

const metadataSchema = z
  .record(metadataKeySchema, metadataValueSchema)
  .superRefine((metadata, context) => {
    if (Object.keys(metadata).length > SCENARIO_LIMITS.maxMetadataEntries) {
      context.addIssue({
        code: "custom",
        message: `Metadata cannot contain more than ${SCENARIO_LIMITS.maxMetadataEntries} entries.`,
      });
    }
  });

export const scenarioNodeSchema = z
  .object({
    id: idSchema,
    label: textSchema(SCENARIO_LIMITS.maxLabelLength, true),
    x: boundedNumber,
    y: boundedNumber,
    nodeType: z.enum(NODE_TYPE_IDS),
    latitude: z.number().finite().min(-90).max(90).optional(),
    longitude: z.number().finite().min(-180).max(180).optional(),
    metadata: metadataSchema.optional(),
  })
  .strict()
  .superRefine((node, context) => {
    if ((node.latitude === undefined) !== (node.longitude === undefined)) {
      context.addIssue({
        code: "custom",
        message: "Latitude and longitude must be supplied together.",
        path: [node.latitude === undefined ? "latitude" : "longitude"],
      });
    }
  });

export const scenarioEdgeSchema = z
  .object({
    id: idSchema,
    fromId: idSchema,
    toId: idSchema,
    weight: weightSchema,
    directed: z.boolean().default(true),
    distance: nonNegativeCostSchema.optional(),
    travelTime: nonNegativeCostSchema.optional(),
    roadType: z.enum(ROAD_TYPE_IDS).optional(),
    speed: z
      .number()
      .finite()
      .positive()
      .max(SCENARIO_LIMITS.maxSpeedKph)
      .optional(),
    toll: z.boolean().optional(),
    closed: z.boolean().optional(),
    terrainMultiplier: z.number().finite().positive().max(1_000).optional(),
    safetyMultiplier: z.number().finite().positive().max(1_000).optional(),
    label: textSchema(SCENARIO_LIMITS.maxLabelLength, true).optional(),
    mutable: z.boolean().optional(),
    metadata: metadataSchema.optional(),
  })
  .strict();

const cameraBoundsSchema = z
  .object({
    minX: boundedNumber,
    minY: boundedNumber,
    maxX: boundedNumber,
    maxY: boundedNumber,
    padding: z
      .number()
      .finite()
      .min(0)
      .max(SCENARIO_LIMITS.maxCoordinateMagnitude),
  })
  .strict();

const maxGraphSizeSchema = z
  .object({
    nodes: z.number().int().min(1).max(SCENARIO_LIMITS.maxNodes),
    edges: z.number().int().min(0).max(SCENARIO_LIMITS.maxEdges),
  })
  .strict();

const expectedCostsSchema = z
  .object({
    weight: weightSchema.nullable().optional(),
    distance: weightSchema.nullable().optional(),
    travelTime: weightSchema.nullable().optional(),
  })
  .strict();

function addDuplicateIssues(
  values: readonly string[],
  path: readonly (string | number)[],
  context: z.RefinementCtx,
) {
  const seen = new Set<string>();
  values.forEach((value, index) => {
    if (seen.has(value)) {
      context.addIssue({
        code: "custom",
        message: `Duplicate value '${value}'.`,
        path: [...path, index],
      });
    }
    seen.add(value);
  });
}

export const scenarioSchema = z
  .object({
    schemaVersion: z.literal(SCENARIO_SCHEMA_VERSION),
    id: idSchema,
    name: textSchema(SCENARIO_LIMITS.maxNameLength, true),
    description: textSchema(SCENARIO_LIMITS.maxDescriptionLength),
    category: z.enum(SCENARIO_CATEGORY_IDS),
    graph: z
      .object({
        nodes: z.array(scenarioNodeSchema).min(1).max(SCENARIO_LIMITS.maxNodes),
        edges: z.array(scenarioEdgeSchema).max(SCENARIO_LIMITS.maxEdges),
      })
      .strict(),
    startId: idSchema,
    goalId: idSchema,
    defaultAlgorithms: z
      .array(z.enum(ALGORITHM_IDS))
      .min(1)
      .max(ALGORITHM_IDS.length),
    supportedAlgorithms: z
      .array(z.enum(ALGORITHM_IDS))
      .min(1)
      .max(ALGORITHM_IDS.length),
    allowedHeuristics: z
      .array(z.enum(HEURISTIC_IDS))
      .min(1)
      .max(HEURISTIC_IDS.length),
    defaultHeuristic: z.enum(HEURISTIC_IDS),
    availableCostMetrics: z
      .array(z.enum(COST_METRIC_IDS))
      .min(1)
      .max(COST_METRIC_IDS.length),
    defaultCostMetric: z.enum(COST_METRIC_IDS),
    cameraBounds: cameraBoundsSchema,
    learningObjectives: z
      .array(textSchema(SCENARIO_LIMITS.maxLearningObjectiveLength))
      .min(1)
      .max(SCENARIO_LIMITS.maxLearningObjectives),
    seed: z.number().int().min(0).max(0xffff_ffff),
    expectedOptimalCost: weightSchema.nullable().optional(),
    expectedCosts: expectedCostsSchema.optional(),
    maxGraphSize: maxGraphSizeSchema,
    editableEdgeIds: z.array(idSchema).max(SCENARIO_LIMITS.maxEdges).optional(),
  })
  .strict()
  .superRefine((scenario, context) => {
    addDuplicateIssues(
      scenario.defaultAlgorithms,
      ["defaultAlgorithms"],
      context,
    );
    addDuplicateIssues(
      scenario.supportedAlgorithms,
      ["supportedAlgorithms"],
      context,
    );
    addDuplicateIssues(
      scenario.allowedHeuristics,
      ["allowedHeuristics"],
      context,
    );
    addDuplicateIssues(
      scenario.availableCostMetrics,
      ["availableCostMetrics"],
      context,
    );
    if (scenario.editableEdgeIds) {
      addDuplicateIssues(
        scenario.editableEdgeIds,
        ["editableEdgeIds"],
        context,
      );
    }

    const nodeIds = new Set<string>();
    scenario.graph.nodes.forEach((node, index) => {
      if (nodeIds.has(node.id)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate node id '${node.id}'.`,
          path: ["graph", "nodes", index, "id"],
        });
      }
      nodeIds.add(node.id);
    });

    const edgeIds = new Set<string>();
    scenario.graph.edges.forEach((edge, index) => {
      if (edgeIds.has(edge.id)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate edge id '${edge.id}'.`,
          path: ["graph", "edges", index, "id"],
        });
      }
      edgeIds.add(edge.id);

      if (!nodeIds.has(edge.fromId)) {
        context.addIssue({
          code: "custom",
          message: `Edge references missing source node '${edge.fromId}'.`,
          path: ["graph", "edges", index, "fromId"],
        });
      }
      if (!nodeIds.has(edge.toId)) {
        context.addIssue({
          code: "custom",
          message: `Edge references missing destination node '${edge.toId}'.`,
          path: ["graph", "edges", index, "toId"],
        });
      }
      if (edge.fromId === edge.toId) {
        context.addIssue({
          code: "custom",
          message: "Self-edges are not supported in RouteLab scenarios.",
          path: ["graph", "edges", index],
        });
      }
    });

    if (!nodeIds.has(scenario.startId)) {
      context.addIssue({
        code: "custom",
        message: `Start node '${scenario.startId}' does not exist.`,
        path: ["startId"],
      });
    }
    if (!nodeIds.has(scenario.goalId)) {
      context.addIssue({
        code: "custom",
        message: `Goal node '${scenario.goalId}' does not exist.`,
        path: ["goalId"],
      });
    }

    if (scenario.graph.nodes.length > scenario.maxGraphSize.nodes) {
      context.addIssue({
        code: "custom",
        message: "The graph exceeds this scenario's declared node limit.",
        path: ["maxGraphSize", "nodes"],
      });
    }
    if (scenario.graph.edges.length > scenario.maxGraphSize.edges) {
      context.addIssue({
        code: "custom",
        message: "The graph exceeds this scenario's declared edge limit.",
        path: ["maxGraphSize", "edges"],
      });
    }

    scenario.defaultAlgorithms.forEach((algorithm, index) => {
      if (!scenario.supportedAlgorithms.includes(algorithm)) {
        context.addIssue({
          code: "custom",
          message: `Default algorithm '${algorithm}' is not supported by this scenario.`,
          path: ["defaultAlgorithms", index],
        });
      }
    });
    if (!scenario.allowedHeuristics.includes(scenario.defaultHeuristic)) {
      context.addIssue({
        code: "custom",
        message: "The default heuristic must be included in allowedHeuristics.",
        path: ["defaultHeuristic"],
      });
    }
    if (!scenario.availableCostMetrics.includes(scenario.defaultCostMetric)) {
      context.addIssue({
        code: "custom",
        message:
          "The default cost metric must be included in availableCostMetrics.",
        path: ["defaultCostMetric"],
      });
    }

    if (
      scenario.cameraBounds.minX >= scenario.cameraBounds.maxX ||
      scenario.cameraBounds.minY >= scenario.cameraBounds.maxY
    ) {
      context.addIssue({
        code: "custom",
        message: "Camera minimum bounds must be less than maximum bounds.",
        path: ["cameraBounds"],
      });
    } else {
      scenario.graph.nodes.forEach((node, index) => {
        if (
          node.x < scenario.cameraBounds.minX ||
          node.x > scenario.cameraBounds.maxX ||
          node.y < scenario.cameraBounds.minY ||
          node.y > scenario.cameraBounds.maxY
        ) {
          context.addIssue({
            code: "custom",
            message: "Node lies outside the declared camera bounds.",
            path: ["graph", "nodes", index],
          });
        }
      });
    }

    if (scenario.allowedHeuristics.includes("geographic")) {
      scenario.graph.nodes.forEach((node, index) => {
        if (node.latitude === undefined || node.longitude === undefined) {
          context.addIssue({
            code: "custom",
            message:
              "The geographic heuristic requires coordinates on every node.",
            path: ["graph", "nodes", index],
          });
        }
      });
    }

    scenario.editableEdgeIds?.forEach((edgeId, index) => {
      const edge = scenario.graph.edges.find(
        (candidate) => candidate.id === edgeId,
      );
      if (!edge) {
        context.addIssue({
          code: "custom",
          message: `Editable edge '${edgeId}' does not exist.`,
          path: ["editableEdgeIds", index],
        });
      } else if (!edge.mutable) {
        context.addIssue({
          code: "custom",
          message: `Editable edge '${edgeId}' must set mutable to true.`,
          path: ["editableEdgeIds", index],
        });
      }
    });

    const openEdges = scenario.graph.edges.filter((edge) => !edge.closed);
    const hasNegativeWeight = openEdges.some((edge) => edge.weight < 0);
    const nonNegativeOnlyAlgorithms = [
      "dijkstra",
      "astar",
      "greedy-best-first",
      "bidirectional-dijkstra",
    ] as const;
    if (hasNegativeWeight) {
      nonNegativeOnlyAlgorithms.forEach((algorithm) => {
        if (scenario.supportedAlgorithms.includes(algorithm)) {
          context.addIssue({
            code: "custom",
            message: `${algorithm} cannot be enabled on a graph with negative open edges.`,
            path: ["supportedAlgorithms"],
          });
        }
      });
    }

    if (scenario.supportedAlgorithms.includes("bfs") && openEdges.length > 0) {
      const firstWeight = openEdges[0].weight;
      if (openEdges.some((edge) => edge.weight !== firstWeight)) {
        context.addIssue({
          code: "custom",
          message:
            "BFS can only be enabled when all traversable edge weights are equal.",
          path: ["supportedAlgorithms"],
        });
      }
    }

    if (
      scenario.supportedAlgorithms.includes("floyd-warshall") &&
      (scenario.graph.nodes.length > SCENARIO_LIMITS.maxFloydWarshallNodes ||
        scenario.maxGraphSize.nodes > SCENARIO_LIMITS.maxFloydWarshallNodes)
    ) {
      context.addIssue({
        code: "custom",
        message: `Floyd-Warshall scenarios are limited to ${SCENARIO_LIMITS.maxFloydWarshallNodes} nodes.`,
        path: ["supportedAlgorithms"],
      });
    }
  });

function findUnsafeContainer(
  value: unknown,
  path: readonly (string | number)[] = [],
  ancestors = new WeakSet<object>(),
  depth = 0,
): ScenarioValidationIssue | undefined {
  if (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return undefined;
  }
  if (typeof value !== "object") {
    return {
      path: formatPath(path),
      code: "invalid_type",
      message: "Only JSON data values are accepted.",
    };
  }
  if (depth > 10) {
    return {
      path: formatPath(path),
      code: "too_deep",
      message: "Input nesting is too deep.",
    };
  }
  if (ancestors.has(value)) {
    return {
      path: formatPath(path),
      code: "cycle",
      message: "Cyclic object references are not accepted.",
    };
  }

  ancestors.add(value);

  if (!Array.isArray(value)) {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      ancestors.delete(value);
      return {
        path: formatPath(path),
        code: "non_plain_object",
        message: "Only plain JSON objects are accepted.",
      };
    }
  }

  for (const [key, child] of Object.entries(value)) {
    if (RESERVED_PROPERTY_NAMES.has(key)) {
      ancestors.delete(value);
      return {
        path: formatPath([...path, key]),
        code: "reserved_key",
        message: "Reserved object property is not accepted.",
      };
    }
    const issue = findUnsafeContainer(
      child,
      [...path, Array.isArray(value) ? Number(key) : key],
      ancestors,
      depth + 1,
    );
    if (issue) {
      ancestors.delete(value);
      return issue;
    }
  }
  ancestors.delete(value);
  return undefined;
}

function formatPath(path: readonly PropertyKey[]): string {
  if (path.length === 0) return "$";
  return path.reduce<string>((result, segment) => {
    if (typeof segment === "number") return `${result}[${segment}]`;
    const key = String(segment);
    return SAFE_ID.test(key)
      ? `${result}.${key}`
      : `${result}[${JSON.stringify(key)}]`;
  }, "$");
}

function mapZodIssue(issue: z.core.$ZodIssue): ScenarioValidationIssue {
  return {
    path: formatPath(issue.path),
    message: issue.message,
    code: issue.code,
  };
}

export function validateScenarioData(input: unknown): ScenarioValidationResult {
  if (input && typeof input === "object" && !Array.isArray(input)) {
    const graph = (input as { graph?: unknown }).graph;
    if (graph && typeof graph === "object" && !Array.isArray(graph)) {
      const nodes = (graph as { nodes?: unknown }).nodes;
      const edges = (graph as { edges?: unknown }).edges;
      if (Array.isArray(nodes) && nodes.length > SCENARIO_LIMITS.maxNodes) {
        return {
          success: false,
          issues: [
            {
              path: "$.graph.nodes",
              code: "too_big",
              message: `A scenario cannot contain more than ${SCENARIO_LIMITS.maxNodes} nodes.`,
            },
          ],
        };
      }
      if (Array.isArray(edges) && edges.length > SCENARIO_LIMITS.maxEdges) {
        return {
          success: false,
          issues: [
            {
              path: "$.graph.edges",
              code: "too_big",
              message: `A scenario cannot contain more than ${SCENARIO_LIMITS.maxEdges} edges.`,
            },
          ],
        };
      }
    }
  }

  const unsafeContainer = findUnsafeContainer(input);
  if (unsafeContainer) {
    return { success: false, issues: [unsafeContainer] };
  }

  const result = scenarioSchema.safeParse(input);
  if (!result.success) {
    return {
      success: false,
      issues: result.error.issues.map(mapZodIssue),
    };
  }
  return { success: true, data: result.data as Scenario };
}

export class ScenarioValidationError extends Error {
  readonly issues: readonly ScenarioValidationIssue[];

  constructor(message: string, issues: readonly ScenarioValidationIssue[]) {
    super(message);
    this.name = "ScenarioValidationError";
    this.issues = issues;
  }
}

export function assertValidScenario(input: unknown): Scenario {
  const result = validateScenarioData(input);
  if (!result.success) {
    throw new ScenarioValidationError(
      result.issues[0]?.message ?? "Scenario validation failed.",
      result.issues,
    );
  }
  return result.data;
}
