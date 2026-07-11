"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { GraphCanvas } from "@/components/GraphCanvas";
import {
  ALGORITHM_IDS,
  ALGORITHM_INFO,
  runAlgorithm,
  validateRunCompatibility,
  type AlgorithmId,
  type AlgorithmResult,
  type AlgorithmTraceEvent,
  type CorrectnessStatus,
  type HeuristicId,
  type RunOptions,
} from "@/lib/algorithms";
import {
  formatExecutionTime,
  getPlaybackDurationMs,
  getRealtimeLaneStep,
  getTimelineStepAtElapsed,
  parsePlaybackMode,
  PLAYBACK_SPEEDS,
  type PlaybackMode,
} from "@/lib/compare-playback";
import {
  BUILT_IN_SCENARIOS,
  SCENARIO_LIMITS,
  type CostMetric,
  type Scenario,
} from "@/lib/scenarios";

import styles from "./CompareWorkspace.module.css";

const DEFAULT_ALGORITHMS: readonly AlgorithmId[] = ["dijkstra", "astar"];

const COST_LABELS: Readonly<Record<CostMetric, string>> = {
  weight: "Edge weight",
  distance: "Distance",
  travelTime: "Travel time",
};

const HEURISTIC_LABELS: Readonly<Record<HeuristicId, string>> = {
  zero: "Zero (A* = Dijkstra)",
  manhattan: "Manhattan",
  euclidean: "Euclidean",
  geographic: "Geographic",
};

const OPTIMALITY_LABELS: Readonly<Record<CorrectnessStatus, string>> = {
  "guaranteed-optimal": "Guaranteed optimal",
  "optimal-if-admissible": "Optimal if admissible",
  "not-guaranteed-optimal": "Not guaranteed optimal",
  "undefined-negative-cycle": "Undefined: negative cycle",
  unreachable: "Destination unreachable",
};

const subscribeToHydration = () => () => undefined;
const getHydratedSnapshot = () => true;
const getServerHydratedSnapshot = () => false;

interface ComparisonRun {
  readonly algorithmId: AlgorithmId;
  readonly result: AlgorithmResult | null;
  readonly error: string | null;
}

export interface CompareWorkspaceProps {
  readonly initialScenarioId?: string;
  readonly initialAlgorithms?: string;
  readonly initialCostMetric?: string;
  readonly initialHeuristicId?: string;
}

function isAlgorithmId(value: string): value is AlgorithmId {
  return ALGORITHM_IDS.includes(value as AlgorithmId);
}

function isCostMetric(value: string): value is CostMetric {
  return value === "weight" || value === "distance" || value === "travelTime";
}

function isHeuristicId(value: string): value is HeuristicId {
  return (
    value === "zero" ||
    value === "manhattan" ||
    value === "euclidean" ||
    value === "geographic"
  );
}

function formatNumber(value: number | null): string {
  if (value === null) return "—";
  if (Number.isInteger(value)) return value.toLocaleString("en-US");
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function traceEventLabel(event: AlgorithmTraceEvent | null): string {
  if (!event) return "Waiting for a trace event";
  return event.type
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("-", " ")
    .replace(/^./, (character) => character.toUpperCase());
}

function optimalityTone(status: CorrectnessStatus): string {
  switch (status) {
    case "guaranteed-optimal":
      return styles.badgeGood;
    case "optimal-if-admissible":
      return styles.badgeConditional;
    case "not-guaranteed-optimal":
      return styles.badgeCaution;
    case "undefined-negative-cycle":
      return styles.badgeDanger;
    case "unreachable":
      return styles.badgeNeutral;
  }
}

function createRun(
  scenario: Scenario,
  algorithmId: AlgorithmId,
  costMetric: CostMetric,
  heuristicId: HeuristicId,
): ComparisonRun {
  if (!scenario.supportedAlgorithms.includes(algorithmId)) {
    return {
      algorithmId,
      result: null,
      error: `${ALGORITHM_INFO[algorithmId].label} is not supported by ${scenario.name}.`,
    };
  }

  const options: RunOptions = {
    algorithmId,
    startId: scenario.startId,
    goalId: scenario.goalId,
    scenarioId: scenario.id,
    travelModel: costMetric,
    heuristicId,
    maxTraceEvents: SCENARIO_LIMITS.maxTraceEvents,
    floydWarshallNodeLimit: SCENARIO_LIMITS.maxFloydWarshallNodes,
  };
  const compatibility = validateRunCompatibility(scenario.graph, options);

  if (!compatibility.compatible) {
    return {
      algorithmId,
      result: null,
      error: compatibility.issues.map((issue) => issue.message).join(" "),
    };
  }

  try {
    return {
      algorithmId,
      result: runAlgorithm(scenario.graph, options),
      error: null,
    };
  } catch (error) {
    return {
      algorithmId,
      result: null,
      error:
        error instanceof Error
          ? error.message
          : "This run could not be generated safely.",
    };
  }
}

function pathSummary(result: AlgorithmResult, scenario: Scenario): string {
  if (!result.found) {
    return result.status === "negative-cycle"
      ? "No finite shortest path exists because a reachable negative cycle was detected."
      : "No route reaches the destination.";
  }

  const labels = new Map(
    scenario.graph.nodes.map((node) => [node.id, node.label ?? node.id]),
  );
  return result.pathNodeIds
    .map((nodeId) => labels.get(nodeId) ?? nodeId)
    .join(" → ");
}

export function CompareWorkspace({
  initialScenarioId,
  initialAlgorithms,
  initialCostMetric,
  initialHeuristicId,
}: CompareWorkspaceProps) {
  const defaultScenario = BUILT_IN_SCENARIOS[0]!;
  const initialScenario =
    BUILT_IN_SCENARIOS.find((item) => item.id === initialScenarioId) ??
    defaultScenario;
  const requestedAlgorithms = (initialAlgorithms ?? "")
    .slice(0, SCENARIO_LIMITS.maxShareStateCharacters)
    .split(",")
    .filter(isAlgorithmId);
  const uniqueInitialAlgorithms = [...new Set(requestedAlgorithms)].slice(0, 4);
  const resolvedInitialAlgorithms =
    uniqueInitialAlgorithms.length >= 2
      ? uniqueInitialAlgorithms
      : [...DEFAULT_ALGORITHMS];
  const resolvedInitialCostMetric =
    initialCostMetric &&
    isCostMetric(initialCostMetric) &&
    initialScenario.availableCostMetrics.includes(initialCostMetric)
      ? initialCostMetric
      : initialScenario.defaultCostMetric;
  const resolvedInitialHeuristic =
    initialHeuristicId &&
    isHeuristicId(initialHeuristicId) &&
    initialScenario.allowedHeuristics.includes(initialHeuristicId)
      ? initialHeuristicId
      : initialScenario.defaultHeuristic;
  const [scenarioId, setScenarioId] = useState(initialScenario.id);
  const [algorithmIds, setAlgorithmIds] = useState<AlgorithmId[]>(
    resolvedInitialAlgorithms,
  );
  const [costMetric, setCostMetric] = useState<CostMetric>(
    resolvedInitialCostMetric,
  );
  const [heuristicId, setHeuristicId] = useState<HeuristicId>(
    resolvedInitialHeuristic,
  );
  const [step, setStep] = useState(0);
  const stepRef = useRef(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>(1);
  const [realtimeElapsedMs, setRealtimeElapsedMs] = useState<number | null>(
    null,
  );
  const realtimeElapsedRef = useRef(0);
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    getHydratedSnapshot,
    getServerHydratedSnapshot,
  );
  const [copyState, setCopyState] = useState<"idle" | "copied" | "address-bar">(
    "idle",
  );
  const [announcement, setAnnouncement] = useState(
    initialScenarioId || initialAlgorithms
      ? "Shared comparison configuration loaded."
      : "Compare Mode ready with Dijkstra and A star.",
  );

  const scenario =
    BUILT_IN_SCENARIOS.find((item) => item.id === scenarioId) ??
    defaultScenario;
  const activeCostMetric = scenario.availableCostMetrics.includes(costMetric)
    ? costMetric
    : scenario.defaultCostMetric;
  const activeHeuristic = scenario.allowedHeuristics.includes(heuristicId)
    ? heuristicId
    : scenario.defaultHeuristic;

  const runs = useMemo(
    () =>
      algorithmIds.map((algorithmId) =>
        createRun(scenario, algorithmId, activeCostMetric, activeHeuristic),
      ),
    [activeCostMetric, activeHeuristic, algorithmIds, scenario],
  );

  const maxStep = useMemo(
    () =>
      Math.max(
        0,
        ...runs.map((run) => Math.max(0, (run.result?.trace.length ?? 1) - 1)),
      ),
    [runs],
  );
  const validRuns = runs.filter(
    (run): run is ComparisonRun & { result: AlgorithmResult } =>
      run.result !== null,
  );
  const maxExecutionTimeMs = Math.max(
    0,
    ...validRuns.map((run) => run.result.metrics.executionTimeMs),
  );
  const resolveLaneStep = (result: AlgorithmResult) =>
    playbackMode === "realtime" && realtimeElapsedMs !== null
      ? getRealtimeLaneStep({
          elapsedMs: realtimeElapsedMs,
          executionTimeMs: result.metrics.executionTimeMs,
          traceLength: result.trace.length,
        })
      : Math.min(step, Math.max(0, result.trace.length - 1));
  const completedRunCount = validRuns.filter(
    (run) => resolveLaneStep(run.result) >= run.result.trace.length - 1,
  ).length;
  const sharedComplete = validRuns.length > 0 && step >= maxStep;
  const successfulRuns = validRuns.filter((run) => run.result.found);
  const successfulCosts = successfulRuns
    .map((run) => run.result.pathCost)
    .filter((value): value is number => value !== null);
  const lowestObservedCost =
    successfulCosts.length > 0 ? Math.min(...successfulCosts) : null;
  const allSuccessfulCostsAgree =
    successfulCosts.length > 1 &&
    successfulCosts.every((value) => value === successfulCosts[0]);

  useEffect(() => {
    if (!isPlaying) return undefined;

    const startStep = Math.min(maxStep, stepRef.current);
    const realtimeStartElapsedMs =
      playbackMode === "realtime"
        ? Math.min(maxExecutionTimeMs, realtimeElapsedRef.current)
        : 0;
    const durationMs = getPlaybackDurationMs({
      startStep,
      maxStep,
      mode: playbackMode,
      realtimeDurationMs: maxExecutionTimeMs,
      realtimeStartElapsedMs,
    });
    let frameId = 0;
    const startedAt = window.performance.now();
    let renderedStep = startStep;

    const tick = (timestamp: number) => {
      const elapsedMs = Math.max(0, timestamp - startedAt);

      if (playbackMode === "realtime") {
        const totalElapsedMs =
          maxExecutionTimeMs <= 0
            ? 0
            : Math.min(maxExecutionTimeMs, realtimeStartElapsedMs + elapsedMs);
        realtimeElapsedRef.current = totalElapsedMs;
        setRealtimeElapsedMs(totalElapsedMs);
      }

      const nextStep = getTimelineStepAtElapsed({
        startStep,
        maxStep,
        elapsedMs,
        durationMs,
      });
      if (nextStep !== renderedStep) {
        renderedStep = nextStep;
        stepRef.current = nextStep;
        setStep(nextStep);
      }

      if (elapsedMs >= durationMs) {
        stepRef.current = maxStep;
        setStep(maxStep);
        if (playbackMode === "realtime") {
          realtimeElapsedRef.current = maxExecutionTimeMs;
          setRealtimeElapsedMs(maxExecutionTimeMs);
        }
        setIsPlaying(false);
        setAnnouncement(
          `Comparison finished. ${validRuns.length} traces are complete.`,
        );
        return;
      }

      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [isPlaying, maxExecutionTimeMs, maxStep, playbackMode, validRuns.length]);

  function resetTimeline(message: string) {
    setIsPlaying(false);
    stepRef.current = 0;
    setStep(0);
    realtimeElapsedRef.current = 0;
    setRealtimeElapsedMs(null);
    setCopyState("idle");
    setAnnouncement(message);
  }

  function handleScenarioChange(nextScenarioId: string) {
    const nextScenario = BUILT_IN_SCENARIOS.find(
      (item) => item.id === nextScenarioId,
    );
    if (!nextScenario) return;
    setScenarioId(nextScenario.id);
    setCostMetric(nextScenario.defaultCostMetric);
    setHeuristicId(nextScenario.defaultHeuristic);
    resetTimeline(`${nextScenario.name} loaded for every comparison lane.`);
  }

  function handleAlgorithmChange(index: number, algorithmId: AlgorithmId) {
    if (
      algorithmIds.some(
        (selectedAlgorithm, selectedIndex) =>
          selectedIndex !== index && selectedAlgorithm === algorithmId,
      )
    ) {
      return;
    }
    setAlgorithmIds((current) =>
      current.map((selectedAlgorithm, selectedIndex) =>
        selectedIndex === index ? algorithmId : selectedAlgorithm,
      ),
    );
    resetTimeline(
      `${ALGORITHM_INFO[algorithmId].label} added to lane ${index + 1}.`,
    );
  }

  function addAlgorithm() {
    if (algorithmIds.length >= 4) return;
    const nextAlgorithm =
      scenario.supportedAlgorithms.find(
        (algorithmId) => !algorithmIds.includes(algorithmId),
      ) ??
      ALGORITHM_IDS.find((algorithmId) => !algorithmIds.includes(algorithmId));
    if (!nextAlgorithm) return;
    setAlgorithmIds((current) => [...current, nextAlgorithm]);
    resetTimeline(
      `${ALGORITHM_INFO[nextAlgorithm].label} added for comparison.`,
    );
  }

  function removeAlgorithm(algorithmId: AlgorithmId) {
    if (algorithmIds.length <= 2) return;
    setAlgorithmIds((current) =>
      current.filter((selectedAlgorithm) => selectedAlgorithm !== algorithmId),
    );
    resetTimeline(
      `${ALGORITHM_INFO[algorithmId].label} removed from comparison.`,
    );
  }

  function togglePlayback() {
    if (maxStep === 0) return;
    if (isPlaying) {
      setIsPlaying(false);
      setAnnouncement(`Playback paused at shared step ${step + 1}.`);
      return;
    }
    const startStep = sharedComplete ? 0 : stepRef.current;
    if (sharedComplete) {
      stepRef.current = 0;
      setStep(0);
    }
    if (playbackMode === "realtime") {
      const elapsedMs = sharedComplete
        ? 0
        : (realtimeElapsedMs ??
          (maxStep > 0 ? (startStep / maxStep) * maxExecutionTimeMs : 0));
      realtimeElapsedRef.current = elapsedMs;
      setRealtimeElapsedMs(elapsedMs);
    }
    setIsPlaying(true);
    setAnnouncement(
      playbackMode === "realtime"
        ? `Real-time playback started. Slowest measured compute time: ${formatExecutionTime(maxExecutionTimeMs)}.`
        : sharedComplete
          ? "Comparison replay started."
          : `Playback started at ${playbackMode} times speed.`,
    );
  }

  function moveToStep(nextStep: number, message: string) {
    const resolvedStep = Math.min(maxStep, Math.max(0, nextStep));
    setIsPlaying(false);
    stepRef.current = resolvedStep;
    setStep(resolvedStep);
    if (playbackMode === "realtime") {
      const elapsedMs =
        maxStep > 0 ? (resolvedStep / maxStep) * maxExecutionTimeMs : 0;
      realtimeElapsedRef.current = elapsedMs;
      setRealtimeElapsedMs(elapsedMs);
    } else {
      realtimeElapsedRef.current = 0;
      setRealtimeElapsedMs(null);
    }
    setAnnouncement(message);
  }

  function handlePlaybackModeChange(value: string) {
    const nextMode = parsePlaybackMode(value);
    setPlaybackMode(nextMode);
    if (nextMode === "realtime") {
      const elapsedMs =
        maxStep > 0 ? (stepRef.current / maxStep) * maxExecutionTimeMs : 0;
      realtimeElapsedRef.current = elapsedMs;
      setRealtimeElapsedMs(elapsedMs);
      setAnnouncement(
        validRuns.length === 0
          ? "Real-time mode selected, but no compatible runs are available."
          : `Real-time mode selected. Slowest measured compute time: ${formatExecutionTime(maxExecutionTimeMs)}.`,
      );
    } else {
      realtimeElapsedRef.current = 0;
      setRealtimeElapsedMs(null);
      setAnnouncement(`Playback speed changed to ${nextMode} times.`);
    }
  }

  async function copyConfiguration() {
    const url = new URL(window.location.href);
    url.searchParams.set("scenario", scenario.id);
    url.searchParams.set("algorithms", algorithmIds.join(","));
    url.searchParams.set("cost", activeCostMetric);
    url.searchParams.set("heuristic", activeHeuristic);
    window.history.replaceState(window.history.state, "", url);

    try {
      await navigator.clipboard.writeText(url.toString());
      setCopyState("copied");
      setAnnouncement("Shareable comparison link copied to the clipboard.");
    } catch {
      setCopyState("address-bar");
      setAnnouncement(
        "The share configuration is now in the address bar. Clipboard access was unavailable.",
      );
    }
  }

  const sharedStatus =
    validRuns.length === 0
      ? "Unavailable"
      : sharedComplete
        ? "Finished"
        : isPlaying
          ? "Running"
          : step === 0
            ? "Ready"
            : "Paused";

  return (
    <div className={styles.workspace}>
      <header className={styles.intro}>
        <div>
          <p className={styles.eyebrow}>Synchronized algorithm laboratory</p>
          <h1>
            Same graph. <em>Different decisions.</em>
          </h1>
        </div>
        <div className={styles.introCopy}>
          <p>
            Compare real deterministic traces event by event. Every lane shares
            the same scenario, endpoints, and travel model; shorter traces hold
            their final state while the shared clock continues.
          </p>
          <div className={styles.introMeta}>
            <span>{scenario.graph.nodes.length} nodes</span>
            <span>{scenario.graph.edges.length} edges</span>
            <span>seed {scenario.seed}</span>
          </div>
        </div>
      </header>

      <section
        className={styles.configuration}
        aria-labelledby="compare-settings-title"
      >
        <div className={styles.configurationInner}>
          <div className={styles.configurationHeading}>
            <span id="compare-settings-title">Shared configuration</span>
            <strong>{scenario.name}</strong>
          </div>

          <label className={styles.field}>
            <span>Scenario</span>
            <select
              value={scenario.id}
              onChange={(event) => handleScenarioChange(event.target.value)}
            >
              {BUILT_IN_SCENARIOS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span>Travel model</span>
            <select
              value={activeCostMetric}
              onChange={(event) => {
                const nextMetric = event.target.value;
                if (!isCostMetric(nextMetric)) return;
                setCostMetric(nextMetric);
                resetTimeline(
                  `${COST_LABELS[nextMetric]} applied to every lane.`,
                );
              }}
            >
              {scenario.availableCostMetrics.map((metric) => (
                <option key={metric} value={metric}>
                  {COST_LABELS[metric]}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span>Shared heuristic</span>
            <select
              value={activeHeuristic}
              onChange={(event) => {
                const nextHeuristic = event.target.value;
                if (!isHeuristicId(nextHeuristic)) return;
                setHeuristicId(nextHeuristic);
                resetTimeline(
                  `${HEURISTIC_LABELS[nextHeuristic]} heuristic applied where relevant.`,
                );
              }}
            >
              {scenario.allowedHeuristics.map((heuristic) => (
                <option key={heuristic} value={heuristic}>
                  {HEURISTIC_LABELS[heuristic]}
                </option>
              ))}
            </select>
          </label>

          <div className={styles.configurationActions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={addAlgorithm}
              disabled={algorithmIds.length >= 4}
            >
              <span aria-hidden="true">+</span> Add algorithm
            </button>
            <button
              type="button"
              className={styles.copyButton}
              onClick={() => void copyConfiguration()}
            >
              {copyState === "copied"
                ? "Link copied"
                : copyState === "address-bar"
                  ? "Link in address bar"
                  : "Copy setup"}
            </button>
          </div>
        </div>

        <div className={styles.scenarioContext}>
          <p>{scenario.description}</p>
          <span>
            {scenario.graph.nodes.find((node) => node.id === scenario.startId)
              ?.label ?? scenario.startId}
            <i aria-hidden="true">→</i>
            {scenario.graph.nodes.find((node) => node.id === scenario.goalId)
              ?.label ?? scenario.goalId}
          </span>
        </div>
      </section>

      <main
        id="main-content"
        className={styles.comparison}
        aria-labelledby="comparison-title"
      >
        <div className={styles.comparisonHeader}>
          <div>
            <p className={styles.sectionLabel}>Live comparison</p>
            <h2 id="comparison-title">
              One clock, {algorithmIds.length} traces
            </h2>
          </div>
          <div
            className={styles.sharedState}
            data-state={sharedStatus.toLowerCase()}
          >
            <span aria-hidden="true" />
            <div>
              <small>Shared state</small>
              <strong>{sharedStatus}</strong>
            </div>
          </div>
        </div>

        <div
          className={styles.finishStrip}
          aria-label="Shared comparison summary"
        >
          <span>
            <strong>{completedRunCount}</strong> / {validRuns.length} traces
            complete
          </span>
          <span>
            <strong>{successfulRuns.length}</strong> routes found
          </span>
          <span>
            {sharedComplete && allSuccessfulCostsAgree
              ? `All successful runs agree: ${formatNumber(lowestObservedCost)}`
              : lowestObservedCost !== null
                ? `Lowest observed cost: ${formatNumber(lowestObservedCost)}`
                : runs.some((run) => run.error)
                  ? "Choose a supported algorithm to recover unavailable lanes"
                  : "Run totals are computed from deterministic traces"}
          </span>
        </div>

        <div className={styles.lanes} data-lanes={algorithmIds.length}>
          {runs.map((run, index) => {
            const info = ALGORITHM_INFO[run.algorithmId];
            const result = run.result;
            const laneStep = result ? resolveLaneStep(result) : 0;
            const event = result?.trace[laneStep] ?? null;
            const laneComplete = result
              ? laneStep >= result.trace.length - 1
              : false;

            return (
              <article
                className={styles.lane}
                key={run.algorithmId}
                aria-labelledby={`lane-${run.algorithmId}-title`}
              >
                <header className={styles.laneHeader}>
                  <h3 className="sr-only" id={`lane-${run.algorithmId}-title`}>
                    {info.label} comparison lane
                  </h3>
                  <div className={styles.laneIndex}>
                    <span>Lane {String(index + 1).padStart(2, "0")}</span>
                    <small>
                      {run.error
                        ? "Unavailable"
                        : laneComplete && !sharedComplete
                          ? "Complete · holding"
                          : laneComplete
                            ? "Complete"
                            : `Event ${laneStep + 1}`}
                    </small>
                  </div>
                  <div className={styles.algorithmRow}>
                    <label
                      className="sr-only"
                      htmlFor={`algorithm-${run.algorithmId}`}
                    >
                      Algorithm in lane {index + 1}
                    </label>
                    <select
                      id={`algorithm-${run.algorithmId}`}
                      className={styles.algorithmSelect}
                      value={run.algorithmId}
                      onChange={(event) => {
                        const nextAlgorithm = event.target.value;
                        if (isAlgorithmId(nextAlgorithm)) {
                          handleAlgorithmChange(index, nextAlgorithm);
                        }
                      }}
                    >
                      {ALGORITHM_IDS.map((algorithmId) => {
                        const selectedElsewhere = algorithmIds.some(
                          (selectedAlgorithm, selectedIndex) =>
                            selectedIndex !== index &&
                            selectedAlgorithm === algorithmId,
                        );
                        const supported =
                          scenario.supportedAlgorithms.includes(algorithmId);
                        return (
                          <option
                            key={algorithmId}
                            value={algorithmId}
                            disabled={selectedElsewhere || !supported}
                          >
                            {ALGORITHM_INFO[algorithmId].label}
                            {!supported ? " (unsupported)" : ""}
                          </option>
                        );
                      })}
                    </select>
                    <button
                      type="button"
                      className={styles.removeButton}
                      onClick={() => removeAlgorithm(run.algorithmId)}
                      disabled={algorithmIds.length <= 2}
                      aria-label={`Remove ${info.label} from comparison`}
                      title={
                        algorithmIds.length <= 2
                          ? "Compare Mode keeps at least two lanes"
                          : `Remove ${info.label}`
                      }
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                  </div>
                  <div className={styles.algorithmFacts}>
                    <span>{info.complexity}</span>
                    {result ? (
                      <span
                        className={`${styles.badge} ${optimalityTone(
                          result.correctness.status,
                        )}`}
                      >
                        {OPTIMALITY_LABELS[result.correctness.status]}
                      </span>
                    ) : (
                      <span className={`${styles.badge} ${styles.badgeDanger}`}>
                        Unsupported selection
                      </span>
                    )}
                  </div>
                </header>

                {result ? (
                  <>
                    <div
                      className={styles.graphFrame}
                      data-testid="compare-graph-frame"
                    >
                      <GraphCanvas
                        graph={scenario.graph}
                        startId={scenario.startId}
                        goalId={scenario.goalId}
                        result={result}
                        step={laneStep}
                        compact
                        label={`${info.label} on ${scenario.name} at event ${laneStep + 1}`}
                      />
                    </div>

                    <section
                      className={styles.eventPanel}
                      aria-label="Current trace event"
                    >
                      <div>
                        <span>Current event</span>
                        <code>{traceEventLabel(event)}</code>
                      </div>
                      <p>
                        {event?.message ??
                          "Ready to inspect this deterministic trace."}
                      </p>
                    </section>

                    <dl
                      className={styles.metrics}
                      aria-label={`${info.label} run totals`}
                    >
                      <div>
                        <dt>Path cost</dt>
                        <dd>{formatNumber(result.pathCost)}</dd>
                      </div>
                      <div>
                        <dt>Expanded</dt>
                        <dd>
                          {result.metrics.nodesExpanded.toLocaleString("en-US")}
                        </dd>
                      </div>
                      <div>
                        <dt>Edges checked</dt>
                        <dd>
                          {result.metrics.edgesInspected.toLocaleString(
                            "en-US",
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Max frontier</dt>
                        <dd>
                          {result.metrics.maximumFrontierSize.toLocaleString(
                            "en-US",
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Trace events</dt>
                        <dd>
                          {result.metrics.traceEventCount.toLocaleString(
                            "en-US",
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Compute</dt>
                        <dd
                          data-testid="compare-compute-time"
                          suppressHydrationWarning
                        >
                          {hydrated
                            ? formatExecutionTime(
                                result.metrics.executionTimeMs,
                              )
                            : "—"}
                        </dd>
                      </div>
                    </dl>

                    <details className={styles.textSummary}>
                      <summary>Nonvisual result summary</summary>
                      <p>{result.correctness.message}</p>
                      <p>
                        <strong>Route:</strong> {pathSummary(result, scenario)}
                      </p>
                      <p>
                        <strong>Current event:</strong>{" "}
                        {event?.message ?? "No event is selected."}
                      </p>
                    </details>
                  </>
                ) : (
                  <div className={styles.unavailable} role="status">
                    <span aria-hidden="true">!</span>
                    <div>
                      <h3>Unavailable on this scenario</h3>
                      <p>{run.error}</p>
                      <small>
                        Choose one of:{" "}
                        {scenario.supportedAlgorithms
                          .map(
                            (algorithmId) => ALGORITHM_INFO[algorithmId].label,
                          )
                          .join(", ")}
                        .
                      </small>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </main>

      <section
        className={styles.timelineShell}
        aria-label="Synchronized playback controls"
      >
        <div className={styles.timeline}>
          <div className={styles.transport}>
            <button
              type="button"
              onClick={() =>
                moveToStep(0, "Comparison restarted at the first event.")
              }
              disabled={step === 0}
              aria-label="Restart comparison"
              title="Restart"
            >
              <span aria-hidden="true">↺</span>
            </button>
            <button
              type="button"
              onClick={() =>
                moveToStep(
                  step - 1,
                  `Moved to shared step ${Math.max(1, step)}.`,
                )
              }
              disabled={step === 0}
              aria-label="Previous event"
              title="Previous event"
            >
              <span aria-hidden="true">←</span>
            </button>
            <button
              type="button"
              className={styles.playButton}
              onClick={togglePlayback}
              disabled={maxStep === 0}
              aria-label={isPlaying ? "Pause comparison" : "Play comparison"}
            >
              <span aria-hidden="true">{isPlaying ? "Ⅱ" : "▶"}</span>
              {isPlaying ? "Pause" : sharedComplete ? "Replay" : "Play"}
            </button>
            <button
              type="button"
              onClick={() =>
                moveToStep(
                  step + 1,
                  `Moved to shared step ${Math.min(maxStep + 1, step + 2)}.`,
                )
              }
              disabled={step >= maxStep}
              aria-label="Next event"
              title="Next event"
            >
              <span aria-hidden="true">→</span>
            </button>
          </div>

          <label className={styles.scrubber}>
            <span>
              Shared event
              <strong>
                {step + 1} / {maxStep + 1}
              </strong>
            </span>
            <input
              type="range"
              min="0"
              max={maxStep}
              step="1"
              value={Math.min(step, maxStep)}
              onChange={(event) => {
                const nextStep = Number(event.target.value);
                moveToStep(
                  nextStep,
                  `Timeline moved to shared step ${nextStep + 1}.`,
                );
              }}
              disabled={maxStep === 0}
              aria-label={`Shared event ${step + 1} of ${maxStep + 1}`}
            />
          </label>

          <label className={styles.speedField}>
            <span>Speed</span>
            <select
              value={String(playbackMode)}
              onChange={(event) => handlePlaybackModeChange(event.target.value)}
              aria-label="Playback speed"
            >
              {PLAYBACK_SPEEDS.map((speed) => (
                <option key={speed} value={speed}>
                  {speed}×
                </option>
              ))}
              <option value="realtime">Real time</option>
            </select>
            <small suppressHydrationWarning>
              {playbackMode === "realtime"
                ? validRuns.length === 0
                  ? "No compatible runs"
                  : `${hydrated ? formatExecutionTime(maxExecutionTimeMs) : "—"} measured`
                : `${formatExecutionTime(680 / playbackMode)} / event`}
            </small>
          </label>
        </div>
      </section>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </div>
  );
}
