import { ALGORITHM_IDS, HEURISTIC_IDS } from "@/lib/algorithms";
import { z } from "zod";

import {
  COST_METRIC_IDS,
  SCENARIO_LIMITS,
  SCENARIO_SCHEMA_VERSION,
} from "./constants";
import { getScenario } from "./builtins";
import type {
  Scenario,
  ScenarioExportOptions,
  ScenarioJsonOptions,
  ScenarioShareState,
  ScenarioShareStateValidationResult,
  ScenarioValidationIssue,
  ScenarioValidationResult,
} from "./types";
import {
  ScenarioValidationError,
  assertValidScenario,
  scenarioSchema,
  validateScenarioData,
} from "./validation";

const SHARE_PREFIX = "rl1.";
const JSON_MIME_TYPES = new Set([
  "application/json",
  "text/json",
  "application/vnd.routelab+json",
]);
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u;

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function resolveByteLimit(
  requested: number | undefined,
  hardLimit: number,
): number {
  if (requested === undefined) return hardLimit;
  if (!Number.isSafeInteger(requested) || requested < 1) {
    throw new ScenarioValidationError(
      "The byte limit must be a positive integer.",
      [
        {
          path: "$.maxBytes",
          code: "invalid_limit",
          message: "The byte limit must be a positive integer.",
        },
      ],
    );
  }
  return Math.min(requested, hardLimit);
}

function importHintIssues(
  options: ScenarioJsonOptions,
): ScenarioValidationIssue[] {
  const issues: ScenarioValidationIssue[] = [];
  if (options.fileName) {
    const fileName = options.fileName.toLocaleLowerCase("en-US");
    if (!fileName.endsWith(".json")) {
      issues.push({
        path: "$.fileName",
        code: "invalid_extension",
        message: "RouteLab imports must use a .json file extension.",
      });
    }
  }
  if (options.mimeType) {
    const mimeType = options.mimeType
      .split(";", 1)[0]
      .trim()
      .toLocaleLowerCase("en-US");
    if (!JSON_MIME_TYPES.has(mimeType) && !mimeType.endsWith("+json")) {
      issues.push({
        path: "$.mimeType",
        code: "invalid_mime_type",
        message: "RouteLab imports must be JSON data.",
      });
    }
  }
  return issues;
}

function decodeImportSource(source: string | Uint8Array | ArrayBuffer): string {
  if (typeof source === "string") return source;
  const bytes = source instanceof Uint8Array ? source : new Uint8Array(source);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new ScenarioValidationError(
      "The scenario file is not valid UTF-8 text.",
      [
        {
          path: "$",
          code: "invalid_encoding",
          message: "The scenario file is not valid UTF-8 text.",
        },
      ],
    );
  }
}

function throwIssues(
  message: string,
  issues: readonly ScenarioValidationIssue[],
): never {
  throw new ScenarioValidationError(message, issues);
}

export function parseScenarioJson(
  source: string | Uint8Array | ArrayBuffer,
  options: ScenarioJsonOptions = {},
): Scenario {
  const hintIssues = importHintIssues(options);
  if (hintIssues.length > 0) {
    throwIssues(hintIssues[0].message, hintIssues);
  }

  const maxBytes = resolveByteLimit(
    options.maxBytes,
    SCENARIO_LIMITS.maxImportBytes,
  );
  const sourceBytes =
    typeof source === "string" ? byteLength(source) : source.byteLength;
  if (sourceBytes > maxBytes) {
    throwIssues(`Scenario JSON exceeds the ${maxBytes}-byte import limit.`, [
      {
        path: "$",
        code: "too_big",
        message: `Scenario JSON exceeds the ${maxBytes}-byte import limit.`,
      },
    ]);
  }
  const json = decodeImportSource(source);

  let input: unknown;
  try {
    input = JSON.parse(json) as unknown;
  } catch {
    throwIssues("The scenario file is not valid JSON.", [
      {
        path: "$",
        code: "invalid_json",
        message: "The scenario file is not valid JSON.",
      },
    ]);
  }

  return assertValidScenario(input);
}

export function importScenarioJson(
  source: string | Uint8Array | ArrayBuffer,
  options: ScenarioJsonOptions = {},
): ScenarioValidationResult {
  try {
    return { success: true, data: parseScenarioJson(source, options) };
  } catch (error) {
    if (error instanceof ScenarioValidationError) {
      return { success: false, issues: error.issues };
    }
    return {
      success: false,
      issues: [
        {
          path: "$",
          code: "import_failed",
          message: "The scenario could not be imported.",
        },
      ],
    };
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    Object.keys(value)
      .sort((left, right) => left.localeCompare(right, "en"))
      .forEach((key) => {
        result[key] = canonicalize((value as Record<string, unknown>)[key]);
      });
    return result;
  }
  return value;
}

export function exportScenarioJson(
  scenario: unknown,
  options: ScenarioExportOptions = {},
): string {
  const validated = assertValidScenario(scenario);
  const json = JSON.stringify(
    canonicalize(validated),
    null,
    options.pretty === false ? 0 : 2,
  );
  const maxBytes = resolveByteLimit(
    options.maxBytes,
    SCENARIO_LIMITS.maxExportBytes,
  );
  if (byteLength(json) > maxBytes) {
    throwIssues(`Scenario JSON exceeds the ${maxBytes}-byte export limit.`, [
      {
        path: "$",
        code: "too_big",
        message: `Scenario JSON exceeds the ${maxBytes}-byte export limit.`,
      },
    ]);
  }
  return json;
}

export function cloneScenario(scenario: unknown): Scenario {
  return parseScenarioJson(exportScenarioJson(scenario, { pretty: false }));
}

const shareStateSchema = z
  .object({
    schemaVersion: z.literal(SCENARIO_SCHEMA_VERSION),
    scenarioId: z
      .string()
      .min(1)
      .max(SCENARIO_LIMITS.maxIdLength)
      .regex(SAFE_ID)
      .optional(),
    scenario: scenarioSchema.optional(),
    algorithm: z.enum(ALGORITHM_IDS).optional(),
    heuristic: z.enum(HEURISTIC_IDS).optional(),
    costMetric: z.enum(COST_METRIC_IDS).optional(),
    closedEdgeIds: z
      .array(z.string().min(1).max(SCENARIO_LIMITS.maxIdLength).regex(SAFE_ID))
      .max(SCENARIO_LIMITS.maxEdges)
      .optional(),
  })
  .strict()
  .superRefine((state, context) => {
    if ((state.scenarioId === undefined) === (state.scenario === undefined)) {
      context.addIssue({
        code: "custom",
        message:
          "Share state must contain exactly one scenarioId or embedded scenario.",
      });
    }
    const referencedScenario =
      state.scenario ??
      (state.scenarioId ? getScenario(state.scenarioId) : undefined);
    if (state.scenarioId && !referencedScenario) {
      context.addIssue({
        code: "custom",
        message: `Built-in scenario '${state.scenarioId}' does not exist.`,
        path: ["scenarioId"],
      });
    }
    if (state.closedEdgeIds) {
      const seen = new Set<string>();
      state.closedEdgeIds.forEach((edgeId, index) => {
        if (seen.has(edgeId)) {
          context.addIssue({
            code: "custom",
            message: `Duplicate closed edge id '${edgeId}'.`,
            path: ["closedEdgeIds", index],
          });
        }
        seen.add(edgeId);
      });
      if (referencedScenario) {
        const edgeIds = new Set(
          referencedScenario.graph.edges.map((edge) => edge.id),
        );
        state.closedEdgeIds.forEach((edgeId, index) => {
          if (!edgeIds.has(edgeId)) {
            context.addIssue({
              code: "custom",
              message: `Closed edge '${edgeId}' does not exist in the embedded scenario.`,
              path: ["closedEdgeIds", index],
            });
          }
        });
      }
    }
    if (
      referencedScenario &&
      state.algorithm &&
      !referencedScenario.supportedAlgorithms.includes(state.algorithm)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "The selected algorithm is not supported by the embedded scenario.",
        path: ["algorithm"],
      });
    }
    if (
      referencedScenario &&
      state.heuristic &&
      !referencedScenario.allowedHeuristics.includes(state.heuristic)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "The selected heuristic is not allowed by the embedded scenario.",
        path: ["heuristic"],
      });
    }
    if (
      referencedScenario &&
      state.costMetric &&
      !referencedScenario.availableCostMetrics.includes(state.costMetric)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "The selected cost metric is not available in the embedded scenario.",
        path: ["costMetric"],
      });
    }
  });

function mapShareIssues(error: z.ZodError): readonly ScenarioValidationIssue[] {
  return error.issues.map((issue) => ({
    path:
      issue.path.length === 0
        ? "$"
        : `$${issue.path
            .map((segment) =>
              typeof segment === "number"
                ? `[${segment}]`
                : `.${String(segment)}`,
            )
            .join("")}`,
    code: issue.code,
    message: issue.message,
  }));
}

function parseShareState(input: unknown): ScenarioShareStateValidationResult {
  const result = shareStateSchema.safeParse(input);
  if (!result.success) {
    return { success: false, issues: mapShareIssues(result.error) };
  }
  if (result.data.scenario) {
    const embeddedScenario = validateScenarioData(
      typeof input === "object" && input !== null && "scenario" in input
        ? (input as { scenario: unknown }).scenario
        : result.data.scenario,
    );
    if (!embeddedScenario.success) {
      return {
        success: false,
        issues: embeddedScenario.issues.map((issue) => ({
          ...issue,
          path:
            issue.path === "$"
              ? "$.scenario"
              : `$.scenario${issue.path.slice(1)}`,
        })),
      };
    }
  }
  return { success: true, data: result.data as ScenarioShareState };
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary)
    .replace(/\+/gu, "-")
    .replace(/\//gu, "_")
    .replace(/=+$/gu, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) {
    throw new Error("Invalid base64url data.");
  }
  const standard = value.replace(/-/gu, "+").replace(/_/gu, "/");
  const padded = standard.padEnd(Math.ceil(standard.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

type CompactShareState = [
  version: typeof SCENARIO_SCHEMA_VERSION,
  scenario: string | Scenario,
  algorithm: ScenarioShareState["algorithm"] | null,
  heuristic: ScenarioShareState["heuristic"] | null,
  costMetric: ScenarioShareState["costMetric"] | null,
  closedEdgeIds: readonly string[] | null,
];

export function encodeShareState(state: ScenarioShareState): string {
  const validated = parseShareState(state);
  if (!validated.success) {
    throwIssues(
      validated.issues[0]?.message ?? "Invalid share state.",
      validated.issues,
    );
  }
  const data = validated.data;
  const compact: CompactShareState = [
    SCENARIO_SCHEMA_VERSION,
    data.scenarioId ?? (data.scenario as Scenario),
    data.algorithm ?? null,
    data.heuristic ?? null,
    data.costMetric ?? null,
    data.closedEdgeIds ?? null,
  ];
  const encoded = `${SHARE_PREFIX}${bytesToBase64Url(
    new TextEncoder().encode(JSON.stringify(compact)),
  )}`;
  if (encoded.length > SCENARIO_LIMITS.maxShareStateCharacters) {
    throwIssues(
      "The scenario is too large for a share link; export it as JSON instead.",
      [
        {
          path: "$",
          code: "share_state_too_big",
          message:
            "The scenario is too large for a share link; export it as JSON instead.",
        },
      ],
    );
  }
  return encoded;
}

export function decodeShareState(
  encoded: string,
): ScenarioShareStateValidationResult {
  if (
    typeof encoded !== "string" ||
    !encoded.startsWith(SHARE_PREFIX) ||
    encoded.length > SCENARIO_LIMITS.maxShareStateCharacters
  ) {
    return {
      success: false,
      issues: [
        {
          path: "$",
          code: "invalid_share_state",
          message: "This is not a supported RouteLab share state.",
        },
      ],
    };
  }

  try {
    const json = new TextDecoder("utf-8", { fatal: true }).decode(
      base64UrlToBytes(encoded.slice(SHARE_PREFIX.length)),
    );
    const compact = JSON.parse(json) as unknown;
    if (!Array.isArray(compact) || compact.length !== 6) {
      throw new Error("Invalid compact state.");
    }
    const [
      schemaVersion,
      scenarioReference,
      algorithm,
      heuristic,
      costMetric,
      closedEdgeIds,
    ] = compact;
    const expanded: Record<string, unknown> = {
      schemaVersion,
      ...(typeof scenarioReference === "string"
        ? { scenarioId: scenarioReference }
        : { scenario: scenarioReference }),
    };
    if (algorithm !== null) expanded.algorithm = algorithm;
    if (heuristic !== null) expanded.heuristic = heuristic;
    if (costMetric !== null) expanded.costMetric = costMetric;
    if (closedEdgeIds !== null) expanded.closedEdgeIds = closedEdgeIds;
    return parseShareState(expanded);
  } catch {
    return {
      success: false,
      issues: [
        {
          path: "$",
          code: "invalid_share_state",
          message: "The RouteLab share state is malformed or corrupted.",
        },
      ],
    };
  }
}

export function validateShareState(
  input: unknown,
): ScenarioShareStateValidationResult {
  return parseShareState(input);
}

// Retain a direct validation export next to the import/export helpers for
// consumers that only import this module.
export { validateScenarioData };
