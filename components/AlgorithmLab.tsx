"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ALGORITHM_IDS,
  ALGORITHM_INFO,
  createTraceSnapshots,
  replayTrace as replayEngineTrace,
  runAlgorithm,
  validateRunCompatibility,
  type AlgorithmId,
  type AlgorithmResult,
  type HeuristicId,
  type TravelModel,
} from "@/lib/algorithms";
import {
  BUILT_IN_SCENARIOS,
  SCENARIO_LIMITS,
  cloneScenario,
  encodeShareState,
  type Scenario,
} from "@/lib/scenarios";
import {
  CODE_LANGUAGES,
  CODE_SAMPLES,
  type CodeConcept,
  type CodeLanguage,
} from "@/lib/code-snippets";
import { CustomScenarioBuilder } from "./CustomScenarioBuilder";
import { GraphCanvas } from "./GraphCanvas";

const HEURISTIC_LABELS: Record<HeuristicId, string> = {
  zero: "Zero (A* = Dijkstra)",
  manhattan: "Manhattan distance",
  euclidean: "Euclidean distance",
  geographic: "Geographic straight-line",
};

const TRAVEL_LABELS: Partial<Record<TravelModel, string>> = {
  weight: "General weight",
  distance: "Shortest distance",
  travelTime: "Fastest travel time",
  hops: "Fewest road segments",
  "avoid-tolls": "Avoid tolls",
  cycling: "Safer cycling roads",
};

const TRAVEL_OPTIONS: TravelModel[] = [
  "weight",
  "distance",
  "travelTime",
  "hops",
  "avoid-tolls",
  "cycling",
];
const subscribeToHydration = () => () => undefined;

function sectionToConcept(section: string | undefined): CodeConcept {
  if (section === "frontier" || section === "initialize")
    return "priority-queue";
  if (section === "path-reconstruction" || section === "termination")
    return "reconstruction";
  if (
    [
      "neighbor-loop",
      "relaxation",
      "distance-update",
      "parent-update",
    ].includes(section ?? "")
  )
    return "relaxation";
  return "main-loop";
}

function calculateRun(
  scenario: Scenario,
  algorithmId: AlgorithmId,
  travelModel: TravelModel,
  heuristicId: HeuristicId,
): {
  result: AlgorithmResult | null;
  error: string | null;
  warning: string | null;
} {
  const options = {
    algorithmId,
    startId: scenario.startId,
    goalId: scenario.goalId,
    scenarioId: scenario.id,
    travelModel,
    heuristicId,
    maxTraceEvents: SCENARIO_LIMITS.maxTraceEvents,
    floydWarshallNodeLimit: SCENARIO_LIMITS.maxFloydWarshallNodes,
  } as const;
  const compatibility = validateRunCompatibility(scenario.graph, options);
  if (!compatibility.compatible) {
    return {
      result: null,
      error: compatibility.issues.map((issue) => issue.message).join(" "),
      warning: null,
    };
  }
  try {
    return {
      result: runAlgorithm(scenario.graph, options),
      error: null,
      warning:
        compatibility.warnings.map((item) => item.message).join(" ") || null,
    };
  } catch (reason) {
    return {
      result: null,
      error:
        reason instanceof Error
          ? reason.message
          : "The algorithm could not run on this graph.",
      warning: null,
    };
  }
}

function formatMetric(value: number | null, suffix = "") {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2)}${suffix}`;
}

export function AlgorithmLab() {
  const [scenario, setScenario] = useState<Scenario>(() =>
    cloneScenario(BUILT_IN_SCENARIOS[0]),
  );
  const [algorithmId, setAlgorithmId] = useState<AlgorithmId>(
    scenario.defaultAlgorithms[0],
  );
  const [travelModel, setTravelModel] = useState<TravelModel>(
    scenario.defaultCostMetric,
  );
  const [heuristicId, setHeuristicId] = useState<HeuristicId>(
    scenario.defaultHeuristic,
  );
  const [language, setLanguage] = useState<CodeLanguage>("TypeScript");
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    scenario.startId,
  );
  const [inspectorTab, setInspectorTab] = useState<
    "metrics" | "state" | "code"
  >("metrics");
  const [configCollapsed, setConfigCollapsed] = useState(false);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const debugEnabled = useSyncExternalStore(
    subscribeToHydration,
    () => new URLSearchParams(window.location.search).get("debug") === "1",
    () => false,
  );
  const [averageFrameMs, setAverageFrameMs] = useState<number | null>(null);
  const helpDialogRef = useRef<HTMLElement>(null);
  const helpCloseRef = useRef<HTMLButtonElement>(null);

  const run = useMemo(
    () => calculateRun(scenario, algorithmId, travelModel, heuristicId),
    [scenario, algorithmId, travelModel, heuristicId],
  );
  const result = run.result;
  const maxStep = Math.max(0, (result?.trace.length ?? 1) - 1);
  const snapshots = useMemo(
    () => (result ? createTraceSnapshots(result.trace, 50) : []),
    [result],
  );
  const replay = useMemo(
    () =>
      result
        ? replayEngineTrace(
            result.trace,
            Math.min(step + 1, result.trace.length),
            snapshots,
          )
        : null,
    [result, snapshots, step],
  );
  const currentEvent = result?.trace[Math.min(step, maxStep)] ?? null;
  const currentConcept = sectionToConcept(currentEvent?.codeSection);
  const codeSample = CODE_SAMPLES[language];
  const codeRange = codeSample.ranges[currentConcept];
  const codeLines = codeSample.code.split("\n");
  const selectedNode =
    scenario.graph.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedEdges = selectedNode
    ? scenario.graph.edges.filter(
        (edge) =>
          edge.fromId === selectedNode.id || edge.toId === selectedNode.id,
      )
    : [];

  const announce = useCallback((message: string) => {
    const region = document.getElementById("route-announcer");
    if (region) region.textContent = message;
  }, []);
  const closeBuilder = useCallback(() => setBuilderOpen(false), []);

  const moveStep = useCallback(
    (nextStep: number) => {
      const bounded = Math.max(0, Math.min(maxStep, nextStep));
      setStep(bounded);
      if (bounded >= maxStep) setPlaying(false);
    },
    [maxStep],
  );

  const restart = useCallback(() => {
    setPlaying(false);
    setStep(0);
    announce("Trace restarted at the first event.");
  }, [announce]);

  useEffect(() => {
    if (!playing || !result) return;
    const id = window.setInterval(
      () => {
        setStep((current) => {
          if (current >= maxStep) {
            setPlaying(false);
            announce(
              result.found
                ? `Run complete. Path cost ${formatMetric(result.pathCost)}.`
                : result.status === "negative-cycle"
                  ? "Run complete. A reachable negative cycle was detected."
                  : "Run complete. No path is available.",
            );
            return maxStep;
          }
          return current + 1;
        });
      },
      Math.max(65, 620 / speed),
    );
    return () => window.clearInterval(id);
  }, [playing, result, maxStep, speed, announce]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (builderOpen || helpOpen) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.matches("input, select, textarea") || target.isContentEditable)
      )
        return;
      if (
        target?.matches("button") &&
        (event.key === " " || event.key === "Enter")
      )
        return;
      if (event.key === " ") {
        event.preventDefault();
        setPlaying((value) => !value);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        moveStep(step + 1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        moveStep(step - 1);
      } else if (event.key === "Home") {
        event.preventDefault();
        moveStep(0);
      } else if (event.key === "End") {
        event.preventDefault();
        moveStep(maxStep);
      } else if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        restart();
      } else if (event.key === "?") {
        event.preventDefault();
        setHelpOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [builderOpen, helpOpen, maxStep, moveStep, restart, step]);

  useEffect(() => {
    if (!helpOpen) return;
    const returnTarget =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    window.setTimeout(() => helpCloseRef.current?.focus(), 0);
    const handleDialogKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setHelpOpen(false);
      } else if (event.key === "Tab" && helpDialogRef.current) {
        const focusable = Array.from(
          helpDialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
          ),
        );
        const first = focusable[0];
        const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first && last) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          document.activeElement === last &&
          first
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", handleDialogKey);
    return () => {
      window.removeEventListener("keydown", handleDialogKey);
      returnTarget?.focus();
    };
  }, [helpOpen]);

  useEffect(() => {
    if (!debugEnabled) return;
    let frameId = 0;
    let previous = performance.now();
    let total = 0;
    let samples = 0;
    const sample = (now: number) => {
      total += now - previous;
      samples += 1;
      previous = now;
      if (samples >= 30) {
        setAverageFrameMs(total / samples);
        total = 0;
        samples = 0;
      }
      frameId = window.requestAnimationFrame(sample);
    };
    frameId = window.requestAnimationFrame(sample);
    return () => window.cancelAnimationFrame(frameId);
  }, [debugEnabled]);

  function chooseScenario(id: string) {
    const next = BUILT_IN_SCENARIOS.find((item) => item.id === id);
    if (!next) return;
    const cloned = cloneScenario(next);
    setScenario(cloned);
    setAlgorithmId(cloned.defaultAlgorithms[0]);
    setTravelModel(cloned.defaultCostMetric);
    setHeuristicId(cloned.defaultHeuristic);
    setSelectedNodeId(cloned.startId);
    setStep(0);
    setPlaying(false);
  }

  function chooseAlgorithm(id: AlgorithmId) {
    setAlgorithmId(id);
    if (!scenario.allowedHeuristics.includes(heuristicId))
      setHeuristicId(scenario.defaultHeuristic);
    setStep(0);
    setPlaying(false);
  }

  function toggleEdge(edgeId: string) {
    setScenario({
      ...scenario,
      graph: {
        ...scenario.graph,
        edges: scenario.graph.edges.map((edge) =>
          edge.id === edgeId ? { ...edge, closed: !edge.closed } : edge,
        ),
      },
      expectedOptimalCost: undefined,
      expectedCosts: undefined,
    });
    setStep(0);
    setPlaying(false);
    announce("Road state changed. The trace was recalculated.");
  }

  async function copyConfiguration() {
    try {
      const compact = encodeShareState({
        schemaVersion: 1,
        scenarioId: scenario.id,
        algorithm: algorithmId,
        heuristic: heuristicId,
        costMetric:
          travelModel === "travelTime" ||
          travelModel === "distance" ||
          travelModel === "weight"
            ? travelModel
            : "weight",
        closedEdgeIds: scenario.graph.edges
          .filter((edge) => edge.closed)
          .map((edge) => edge.id),
      });
      await navigator.clipboard.writeText(compact);
      setShareMessage("Configuration copied");
      window.setTimeout(() => setShareMessage(null), 1700);
    } catch (reason) {
      setShareMessage(
        reason instanceof Error
          ? reason.message
          : "Configuration is too large to copy",
      );
    }
  }

  function useCustomScenario(next: Scenario) {
    setScenario(next);
    const nextAlgorithm =
      next.defaultAlgorithms.find((id) =>
        next.supportedAlgorithms.includes(id),
      ) ??
      next.supportedAlgorithms[0] ??
      "dijkstra";
    setAlgorithmId(nextAlgorithm);
    setTravelModel(next.defaultCostMetric);
    setHeuristicId(next.defaultHeuristic);
    setSelectedNodeId(next.startId);
    setStep(0);
    setPlaying(false);
    setBuilderOpen(false);
  }

  return (
    <div className="lab-page">
      <div className="lab-context-bar">
        <div>
          <span className="lab-breadcrumb">
            LAB / {scenario.category.toUpperCase()}
          </span>
          <strong>{scenario.name}</strong>
        </div>
        <div className="lab-context-actions">
          <span className="seed-pill">seed {scenario.seed}</span>
          <button type="button" onClick={() => void copyConfiguration()}>
            {shareMessage ?? "Copy setup"}
          </button>
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            aria-label="Open keyboard shortcuts"
          >
            ?
          </button>
        </div>
      </div>

      <main
        id="main-content"
        className={`lab-workspace${configCollapsed ? " config-collapsed" : ""}${inspectorCollapsed ? " inspector-collapsed" : ""}`}
      >
        <aside className="lab-config-panel" aria-label="Run configuration">
          <div className="panel-title-row">
            <span>Configuration</span>
            <button
              type="button"
              onClick={() => setConfigCollapsed((value) => !value)}
              aria-label={
                configCollapsed
                  ? "Expand configuration"
                  : "Collapse configuration"
              }
            >
              {configCollapsed ? "›" : "‹"}
            </button>
          </div>
          <div className="config-content">
            <section className="config-section">
              <div className="config-section-title">
                <span>01</span>
                <strong>World</strong>
              </div>
              <label>
                Scenario
                <select
                  value={
                    BUILT_IN_SCENARIOS.some((item) => item.id === scenario.id)
                      ? scenario.id
                      : "custom"
                  }
                  onChange={(event) => chooseScenario(event.target.value)}
                >
                  <option value="custom" disabled>
                    {BUILT_IN_SCENARIOS.some((item) => item.id === scenario.id)
                      ? "Custom scenario"
                      : scenario.name}
                  </option>
                  {BUILT_IN_SCENARIOS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="scenario-description">
                <p>{scenario.description}</p>
                <span>
                  {scenario.graph.nodes.length} nodes ·{" "}
                  {scenario.graph.edges.length} edges
                </span>
              </div>
              <button
                className="panel-action"
                type="button"
                disabled={!hydrated}
                onClick={() => setBuilderOpen(true)}
              >
                Open custom builder <span aria-hidden="true">↗</span>
              </button>
            </section>

            <section className="config-section">
              <div className="config-section-title">
                <span>02</span>
                <strong>Search</strong>
              </div>
              <label>
                Algorithm
                <select
                  value={algorithmId}
                  onChange={(event) =>
                    chooseAlgorithm(event.target.value as AlgorithmId)
                  }
                >
                  {ALGORITHM_IDS.map((id) => (
                    <option
                      key={id}
                      value={id}
                      disabled={!scenario.supportedAlgorithms.includes(id)}
                    >
                      {ALGORITHM_INFO[id].label}
                      {scenario.supportedAlgorithms.includes(id)
                        ? ""
                        : " — unavailable"}
                    </option>
                  ))}
                </select>
              </label>
              <div className="algorithm-summary">
                <span>{ALGORITHM_INFO[algorithmId].complexity}</span>
                <p>{ALGORITHM_INFO[algorithmId].summary}</p>
              </div>
              <label>
                Cost model
                <select
                  value={travelModel}
                  onChange={(event) => {
                    setTravelModel(event.target.value as TravelModel);
                    setStep(0);
                    setPlaying(false);
                  }}
                >
                  {TRAVEL_OPTIONS.map((id) => (
                    <option key={id} value={id}>
                      {TRAVEL_LABELS[id]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Heuristic
                <select
                  value={heuristicId}
                  onChange={(event) => {
                    setHeuristicId(event.target.value as HeuristicId);
                    setStep(0);
                    setPlaying(false);
                  }}
                  disabled={
                    algorithmId !== "astar" &&
                    algorithmId !== "greedy-best-first"
                  }
                >
                  {Object.entries(HEURISTIC_LABELS).map(([id, label]) => (
                    <option
                      key={id}
                      value={id}
                      disabled={
                        !scenario.allowedHeuristics.includes(id as HeuristicId)
                      }
                    >
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </section>

            <section className="config-section">
              <div className="config-section-title">
                <span>03</span>
                <strong>Source</strong>
              </div>
              <label>
                Language
                <select
                  value={language}
                  onChange={(event) =>
                    setLanguage(event.target.value as CodeLanguage)
                  }
                >
                  {CODE_LANGUAGES.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <Link className="panel-action" href="/code">
                Open full code explorer <span aria-hidden="true">→</span>
              </Link>
            </section>

            <section className="learning-card">
              <span>Learning objective</span>
              <p>{scenario.learningObjectives[0]}</p>
            </section>
          </div>
        </aside>

        <section className="lab-stage" aria-label="Algorithm visualization">
          <div className="stage-toolbar">
            <div>
              <span className="stage-mode">
                <i />{" "}
                {playing
                  ? "Running trace"
                  : step >= maxStep
                    ? "Trace complete"
                    : "Trace paused"}
              </span>
              <span>{ALGORITHM_INFO[algorithmId].label}</span>
            </div>
            <div>
              <span>
                {scenario.startId} → {scenario.goalId}
              </span>
              <span>{TRAVEL_LABELS[travelModel] ?? travelModel}</span>
            </div>
          </div>
          {result ? (
            <GraphCanvas
              graph={scenario.graph}
              startId={scenario.startId}
              goalId={scenario.goalId}
              result={result}
              step={step}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
              onToggleEdge={toggleEdge}
              label={`${scenario.name} graph running ${ALGORITHM_INFO[algorithmId].label}`}
            />
          ) : (
            <div className="run-error" role="alert">
              <span>Unsupported run</span>
              <h2>This configuration cannot start.</h2>
              <p>{run.error}</p>
              <button
                className="button button-secondary"
                type="button"
                onClick={() => {
                  setAlgorithmId(scenario.defaultAlgorithms[0]);
                  setTravelModel(scenario.defaultCostMetric);
                }}
              >
                Use scenario defaults
              </button>
            </div>
          )}
          {run.warning && (
            <div className="stage-warning">
              <span aria-hidden="true">!</span>
              {run.warning}
            </div>
          )}
          {debugEnabled && result && (
            <aside
              className="debug-panel"
              aria-label="Development performance diagnostics"
            >
              <span>Development diagnostics</span>
              <dl>
                <div>
                  <dt>Frame average</dt>
                  <dd>
                    {averageFrameMs
                      ? `${averageFrameMs.toFixed(1)} ms`
                      : "sampling…"}
                  </dd>
                </div>
                <div>
                  <dt>Trace generation</dt>
                  <dd>{result.metrics.executionTimeMs.toFixed(2)} ms</dd>
                </div>
                <div>
                  <dt>Replay cursor</dt>
                  <dd>
                    {step + 1} / {result.trace.length}
                  </dd>
                </div>
                <div>
                  <dt>Graph</dt>
                  <dd>
                    {scenario.graph.nodes.length} nodes ·{" "}
                    {scenario.graph.edges.length} edges
                  </dd>
                </div>
                <div>
                  <dt>History estimate</dt>
                  <dd>{Math.round((result.trace.length * 140) / 1024)} KiB</dd>
                </div>
                <div>
                  <dt>Execution</dt>
                  <dd>Main thread · capped</dd>
                </div>
              </dl>
            </aside>
          )}
        </section>

        <aside className="lab-inspector-panel" aria-label="Algorithm inspector">
          <div className="panel-title-row">
            <button
              type="button"
              onClick={() => setInspectorCollapsed((value) => !value)}
              aria-label={
                inspectorCollapsed ? "Expand inspector" : "Collapse inspector"
              }
            >
              {inspectorCollapsed ? "‹" : "›"}
            </button>
            <span>Inspector</span>
          </div>
          <div className="inspector-content">
            <div
              className="inspector-tabs"
              role="tablist"
              aria-label="Inspector view"
            >
              {(["metrics", "state", "code"] as const).map((tab) => (
                <button
                  key={tab}
                  role="tab"
                  aria-selected={inspectorTab === tab}
                  type="button"
                  onClick={() => setInspectorTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>

            {inspectorTab === "metrics" && result && (
              <div className="inspector-view">
                <div className={`result-banner status-${result.status}`}>
                  <span>
                    {result.status === "success"
                      ? "Route found"
                      : result.status === "negative-cycle"
                        ? "Negative cycle"
                        : "No path"}
                  </span>
                  <strong>{formatMetric(result.pathCost)}</strong>
                  <small>{result.correctness.message}</small>
                </div>
                <div className="metrics-grid">
                  <div>
                    <span>Visited</span>
                    <strong>{result.metrics.nodesVisited}</strong>
                  </div>
                  <div>
                    <span>Expanded</span>
                    <strong>{result.metrics.nodesExpanded}</strong>
                  </div>
                  <div>
                    <span>Edges seen</span>
                    <strong>{result.metrics.edgesInspected}</strong>
                  </div>
                  <div>
                    <span>Relaxations</span>
                    <strong>{result.metrics.relaxations}</strong>
                  </div>
                  <div>
                    <span>Max frontier</span>
                    <strong>{result.metrics.maximumFrontierSize}</strong>
                  </div>
                  <div>
                    <span>Compute</span>
                    <strong>
                      {formatMetric(
                        hydrated ? result.metrics.executionTimeMs : null,
                        " ms",
                      )}
                    </strong>
                  </div>
                </div>
                <section className="inspector-section">
                  <p className="panel-label">Guarantee</p>
                  <h3>{ALGORITHM_INFO[algorithmId].optimality}</h3>
                  <p>{ALGORITHM_INFO[algorithmId].requirements.join(" · ")}</p>
                </section>
                {result.allPairs && (
                  <section className="inspector-section">
                    <p className="panel-label">All-pairs matrix</p>
                    <div className="matrix-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>from / to</th>
                            {result.allPairs.nodeIds.map((id) => (
                              <th key={id}>{id}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {result.allPairs.nodeIds.map((from) => (
                            <tr key={from}>
                              <th>{from}</th>
                              {result.allPairs!.nodeIds.map((to) => (
                                <td key={to}>
                                  {result.allPairs!.distances[from][to] ?? "∞"}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}
              </div>
            )}

            {inspectorTab === "state" && (
              <div className="inspector-view">
                <section className="current-event-card" aria-live="polite">
                  <span>
                    {currentEvent
                      ? `${String(step + 1).padStart(3, "0")} · ${currentEvent.type}`
                      : "Ready"}
                  </span>
                  <p>
                    {currentEvent?.message ??
                      run.error ??
                      "Choose a compatible configuration."}
                  </p>
                </section>
                <section className="inspector-section">
                  <p className="panel-label">Frontier / queue</p>
                  <div className="frontier-list">
                    {replay?.frontier.length ? (
                      replay.frontier.slice(0, 12).map((item, index) => (
                        <div key={`${item.nodeId}-${index}`}>
                          <span>{item.nodeId}</span>
                          <code>{formatMetric(item.priority)}</code>
                          <small>{item.direction ?? "forward"}</small>
                        </div>
                      ))
                    ) : (
                      <p className="empty-copy">
                        The frontier is empty at this step.
                      </p>
                    )}
                  </div>
                </section>
                <section className="inspector-section">
                  <p className="panel-label">Selected node</p>
                  {selectedNode ? (
                    <div className="selected-node-card">
                      <div>
                        <strong>{selectedNode.label ?? selectedNode.id}</strong>
                        <span>{selectedNode.id}</span>
                      </div>
                      <dl>
                        <div>
                          <dt>Distance</dt>
                          <dd>{replay?.distances[selectedNode.id] ?? "∞"}</dd>
                        </div>
                        <div>
                          <dt>Parent</dt>
                          <dd>{replay?.parents[selectedNode.id] ?? "—"}</dd>
                        </div>
                        <div>
                          <dt>Degree</dt>
                          <dd>{selectedEdges.length}</dd>
                        </div>
                      </dl>
                    </div>
                  ) : (
                    <p className="empty-copy">Select a graph node.</p>
                  )}
                </section>
              </div>
            )}

            {inspectorTab === "code" && (
              <div className="inspector-view code-inspector-view">
                <div className="code-sync-head">
                  <span>dijkstra.{codeSample.extension}</span>
                  <code>{currentEvent?.codeSection ?? "initialize"}</code>
                </div>
                <pre tabIndex={0} aria-label={`${language} synchronized code`}>
                  <code>
                    {codeLines.map((line, index) => {
                      const number = index + 1;
                      const highlighted =
                        number >= codeRange[0] && number <= codeRange[1];
                      return (
                        <span
                          key={number}
                          className={highlighted ? "is-highlighted" : undefined}
                        >
                          <i>{String(number).padStart(2, "0")}</i>
                          {line || " "}
                        </span>
                      );
                    })}
                  </code>
                </pre>
                <p className="code-sync-note">
                  This curated source excerpt highlights the conceptual section
                  associated with the current semantic trace event.
                </p>
              </div>
            )}
          </div>
        </aside>

        <div className="lab-timeline" aria-label="Trace playback controls">
          <div className="playback-buttons">
            <button
              type="button"
              onClick={restart}
              disabled={!hydrated || !result}
              aria-label="Restart trace"
            >
              ↺
            </button>
            <button
              type="button"
              onClick={() => moveStep(step - 1)}
              disabled={!hydrated || !result || step <= 0}
              aria-label="Previous event"
            >
              ←
            </button>
            <button
              className="play-button"
              type="button"
              onClick={() => setPlaying((value) => !value)}
              disabled={!hydrated || !result || step >= maxStep}
              aria-label={playing ? "Pause trace" : "Play trace"}
            >
              {playing ? "Ⅱ" : "▶"}
            </button>
            <button
              type="button"
              onClick={() => moveStep(step + 1)}
              disabled={!hydrated || !result || step >= maxStep}
              aria-label="Next event"
            >
              →
            </button>
          </div>
          <div className="timeline-track">
            <div>
              <span>{currentEvent?.type ?? "unavailable"}</span>
              <strong>
                Step {result ? step + 1 : 0} / {result?.trace.length ?? 0}
              </strong>
            </div>
            <input
              type="range"
              min="0"
              max={maxStep}
              value={Math.min(step, maxStep)}
              onChange={(event) => moveStep(Number(event.target.value))}
              disabled={!hydrated || !result}
              aria-label="Trace position"
            />
          </div>
          <label className="speed-control">
            Speed
            <select
              value={speed}
              onChange={(event) => setSpeed(Number(event.target.value))}
            >
              <option value="0.5">0.5×</option>
              <option value="1">1×</option>
              <option value="2">2×</option>
              <option value="4">4×</option>
            </select>
          </label>
        </div>
      </main>

      <CustomScenarioBuilder
        open={builderOpen}
        onClose={closeBuilder}
        onUseScenario={useCustomScenario}
      />
      {helpOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setHelpOpen(false);
          }}
        >
          <section
            ref={helpDialogRef}
            className="help-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
          >
            <button
              ref={helpCloseRef}
              className="icon-button"
              type="button"
              onClick={() => setHelpOpen(false)}
              aria-label="Close keyboard help"
            >
              ×
            </button>
            <span className="section-number">Keyboard controls</span>
            <h2 id="help-title">
              Navigate the trace without leaving the graph.
            </h2>
            <div className="shortcut-grid">
              {[
                ["Space", "Play or pause"],
                ["← / →", "Previous or next event"],
                ["Home / End", "First or final event"],
                ["R", "Restart trace"],
                ["?", "Open this help"],
              ].map(([key, label]) => (
                <div key={key}>
                  <kbd>{key}</kbd>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
