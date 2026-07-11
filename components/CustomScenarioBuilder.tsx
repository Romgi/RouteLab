"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  SCENARIO_LIMITS,
  calculateCameraBounds,
  encodeShareState,
  exportScenarioJson,
  generateGridScenario,
  generateRandomScenario,
  parseScenarioJson,
  validateScenarioData,
  type Scenario,
  type ScenarioEdge,
  type ScenarioNode,
} from "@/lib/scenarios";

function cloneWithGraph(
  scenario: Scenario,
  nodes: readonly ScenarioNode[],
  edges: readonly ScenarioEdge[],
): Scenario {
  const startId = nodes.some((node) => node.id === scenario.startId)
    ? scenario.startId
    : (nodes[0]?.id ?? "");
  const goalId = nodes.some((node) => node.id === scenario.goalId)
    ? scenario.goalId
    : (nodes.at(-1)?.id ?? startId);
  return {
    ...scenario,
    id: scenario.id.startsWith("custom-")
      ? scenario.id
      : `custom-${scenario.id}`,
    name: scenario.name.startsWith("Custom")
      ? scenario.name
      : `Custom ${scenario.name}`,
    graph: { nodes, edges },
    startId,
    goalId,
    cameraBounds: calculateCameraBounds(nodes),
    seed: scenario.seed,
    expectedOptimalCost: undefined,
    expectedCosts: undefined,
    editableEdgeIds: edges.map((edge) => edge.id),
  };
}

function BuilderGraph({
  scenario,
  selectedNodeId,
  onSelectNode,
}: {
  scenario: Scenario;
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
}) {
  const bounds = scenario.cameraBounds;
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxY - bounds.minY);
  const padding = bounds.padding || Math.max(width, height) * 0.1;
  const unit = Math.max(width + padding * 2, height + padding * 2);
  const radius = unit * 0.019;
  const nodes = new Map(scenario.graph.nodes.map((node) => [node.id, node]));
  return (
    <svg
      className="builder-graph"
      viewBox={`${bounds.minX - padding} ${bounds.minY - padding} ${width + padding * 2} ${height + padding * 2}`}
      aria-label="Custom graph editor canvas"
    >
      {scenario.graph.edges.map((edge) => {
        const from = nodes.get(edge.fromId);
        const to = nodes.get(edge.toId);
        if (!from || !to) return null;
        return (
          <line
            key={edge.id}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            className={edge.closed ? "is-closed" : undefined}
          />
        );
      })}
      {scenario.graph.nodes.map((node) => (
        <g
          key={node.id}
          transform={`translate(${node.x} ${node.y})`}
          className={selectedNodeId === node.id ? "is-selected" : undefined}
          onClick={() => onSelectNode(node.id)}
        >
          <circle r={radius} />
          <text
            y={-radius * 2.2}
            textAnchor="middle"
            style={{ fontSize: unit * 0.014, strokeWidth: unit * 0.012 }}
          >
            {node.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function CustomScenarioBuilder({
  open,
  onClose,
  onUseScenario,
}: {
  open: boolean;
  onClose: () => void;
  onUseScenario: (scenario: Scenario) => void;
}) {
  const [scenario, setScenario] = useState<Scenario>(() =>
    generateGridScenario({
      rows: 4,
      columns: 5,
      seed: 42,
      id: "custom-grid",
      name: "Custom grid",
    }),
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    scenario.startId,
  );
  const [edgeFrom, setEdgeFrom] = useState(scenario.startId);
  const [edgeTo, setEdgeTo] = useState(scenario.goalId);
  const [edgeWeight, setEdgeWeight] = useState(1);
  const [edgeDirected, setEdgeDirected] = useState(false);
  const [seed, setSeed] = useState(42);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const selectedNode =
    scenario.graph.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const validation = useMemo(() => validateScenarioData(scenario), [scenario]);

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "Tab" && dialogRef.current) {
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((element) => !element.hasAttribute("hidden"));
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
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      returnFocusRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  function updateNodes(
    nodes: readonly ScenarioNode[],
    edges = scenario.graph.edges,
  ) {
    setScenario(cloneWithGraph(scenario, nodes, edges));
    setError(null);
  }

  function updateEdges(edges: readonly ScenarioEdge[]) {
    setScenario(cloneWithGraph(scenario, scenario.graph.nodes, edges));
    setError(null);
  }

  function addNode() {
    if (scenario.graph.nodes.length >= SCENARIO_LIMITS.maxNodes) {
      setError(
        `A custom graph is limited to ${SCENARIO_LIMITS.maxNodes} nodes.`,
      );
      return;
    }
    const serial = scenario.graph.nodes.length + 1;
    const id = `custom-node-${serial}`;
    const node: ScenarioNode = {
      id,
      label: `Node ${serial}`,
      x: serial * 12,
      y: serial % 2 === 0 ? 30 : 55,
      nodeType: "intersection",
    };
    updateNodes([...scenario.graph.nodes, node]);
    setSelectedNodeId(id);
    setEdgeTo(id);
    setMessage(`Added ${node.label}.`);
  }

  function deleteSelectedNode() {
    if (!selectedNode || scenario.graph.nodes.length <= 2) {
      setError(
        "Keep at least two nodes so the scenario has a start and destination.",
      );
      return;
    }
    const nodes = scenario.graph.nodes.filter(
      (node) => node.id !== selectedNode.id,
    );
    const edges = scenario.graph.edges.filter(
      (edge) =>
        edge.fromId !== selectedNode.id && edge.toId !== selectedNode.id,
    );
    updateNodes(nodes, edges);
    setSelectedNodeId(nodes[0]?.id ?? null);
    setMessage(`Deleted ${selectedNode.label} and its incident edges.`);
  }

  function updateSelectedNode(
    patch: Partial<Pick<ScenarioNode, "label" | "x" | "y">>,
  ) {
    if (!selectedNode) return;
    updateNodes(
      scenario.graph.nodes.map((node) =>
        node.id === selectedNode.id ? { ...node, ...patch } : node,
      ),
    );
  }

  function addEdge() {
    if (scenario.graph.edges.length >= SCENARIO_LIMITS.maxEdges) {
      setError(
        `A custom graph is limited to ${SCENARIO_LIMITS.maxEdges} edges.`,
      );
      return;
    }
    if (edgeFrom === edgeTo) {
      setError("Choose two different nodes; self-edges are not supported.");
      return;
    }
    if (
      !Number.isFinite(edgeWeight) ||
      edgeWeight < 0 ||
      edgeWeight > SCENARIO_LIMITS.maxAbsoluteWeight
    ) {
      setError("Weight must be a finite number between 0 and 1,000,000.");
      return;
    }
    const duplicate = scenario.graph.edges.some(
      (edge) =>
        edge.fromId === edgeFrom &&
        edge.toId === edgeTo &&
        edge.directed === edgeDirected,
    );
    if (duplicate) {
      setError("That connection already exists.");
      return;
    }
    const edge: ScenarioEdge = {
      id: `custom-edge-${scenario.graph.edges.length + 1}`,
      fromId: edgeFrom,
      toId: edgeTo,
      weight: edgeWeight,
      directed: edgeDirected,
      roadType: "abstract",
      mutable: true,
    };
    updateEdges([...scenario.graph.edges, edge]);
    setMessage("Added a validated edge.");
  }

  function deleteEdge(edgeId: string) {
    updateEdges(scenario.graph.edges.filter((edge) => edge.id !== edgeId));
    setMessage("Deleted the selected edge.");
  }

  function generate(kind: "grid" | "random") {
    try {
      const next =
        kind === "grid"
          ? generateGridScenario({
              rows: 5,
              columns: 6,
              seed,
              id: `custom-grid-${seed}`,
              name: `Custom grid · seed ${seed}`,
            })
          : generateRandomScenario({
              nodeCount: 18,
              edgeDensity: 0.18,
              seed,
              id: `custom-random-${seed}`,
              name: `Custom random · seed ${seed}`,
            });
      setScenario(next);
      setSelectedNodeId(next.startId);
      setEdgeFrom(next.startId);
      setEdgeTo(next.goalId);
      setMessage(`Generated a deterministic ${kind} with seed ${seed}.`);
      setError(null);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The graph could not be generated.",
      );
    }
  }

  async function importFile(file: File | undefined) {
    if (!file) return;
    if (file.size > SCENARIO_LIMITS.maxImportBytes) {
      setError(
        `Import rejected: files must be at most ${Math.round(SCENARIO_LIMITS.maxImportBytes / 1024)} KB.`,
      );
      return;
    }
    try {
      const source = await file.text();
      const imported = parseScenarioJson(source, {
        fileName: file.name,
        mimeType: file.type,
        maxBytes: SCENARIO_LIMITS.maxImportBytes,
      });
      setScenario(imported);
      setSelectedNodeId(imported.startId);
      setEdgeFrom(imported.startId);
      setEdgeTo(imported.goalId);
      setMessage(`Imported “${imported.name}” as data only.`);
      setError(null);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Import failed. Check the RouteLab JSON format.",
      );
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function exportFile() {
    try {
      const json = exportScenarioJson(scenario);
      const url = URL.createObjectURL(
        new Blob([json], { type: "application/json" }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${scenario.id}.routelab.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage("Exported validated RouteLab JSON.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Export failed.");
    }
  }

  async function copyShareState() {
    try {
      const compact = encodeShareState({ schemaVersion: 1, scenario });
      await navigator.clipboard.writeText(compact);
      setMessage(
        `Copied ${compact.length.toLocaleString()} characters of validated share state.`,
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "This scenario is too large for compact sharing. Export JSON instead.",
      );
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="builder-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="builder-title"
        aria-describedby="builder-description"
      >
        <header className="builder-header">
          <div>
            <span className="section-number">Safe data-only editor</span>
            <h2 id="builder-title">Custom scenario builder</h2>
            <p id="builder-description">
              Create a bounded graph. Imported values are validated and never
              executed.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="Close custom scenario builder"
          >
            ×
          </button>
        </header>
        <div className="builder-toolbar">
          <label>
            Seed
            <input
              type="number"
              min="0"
              max="2147483647"
              value={seed}
              onChange={(event) => setSeed(Number(event.target.value))}
            />
          </label>
          <button type="button" onClick={() => generate("grid")}>
            Generate grid
          </button>
          <button type="button" onClick={() => generate("random")}>
            Generate random
          </button>
          <button type="button" onClick={addNode}>
            Add node
          </button>
          <button
            type="button"
            onClick={deleteSelectedNode}
            disabled={!selectedNode}
          >
            Delete node
          </button>
          <label className="file-button">
            Import JSON
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              onChange={(event) => void importFile(event.target.files?.[0])}
            />
          </label>
          <button type="button" onClick={exportFile}>
            Export JSON
          </button>
          <button type="button" onClick={() => void copyShareState()}>
            Copy share data
          </button>
        </div>
        <div className="builder-body">
          <div className="builder-canvas-panel">
            <BuilderGraph
              scenario={scenario}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
            />
            <div className="builder-canvas-meta">
              <span>
                {scenario.graph.nodes.length} / {SCENARIO_LIMITS.maxNodes} nodes
              </span>
              <span>
                {scenario.graph.edges.length} / {SCENARIO_LIMITS.maxEdges} edges
              </span>
              <span>seed {scenario.seed}</span>
            </div>
          </div>
          <aside className="builder-inspector">
            <section>
              <p className="panel-label">Selected node</p>
              {selectedNode ? (
                <div className="form-stack">
                  <label>
                    Node
                    <select
                      value={selectedNode.id}
                      onChange={(event) =>
                        setSelectedNodeId(event.target.value)
                      }
                    >
                      {scenario.graph.nodes.map((node) => (
                        <option key={node.id} value={node.id}>
                          {node.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Label
                    <input
                      maxLength={SCENARIO_LIMITS.maxLabelLength}
                      value={selectedNode.label}
                      onChange={(event) =>
                        updateSelectedNode({ label: event.target.value })
                      }
                    />
                  </label>
                  <div className="form-row">
                    <label>
                      X
                      <input
                        type="number"
                        value={selectedNode.x}
                        onChange={(event) =>
                          updateSelectedNode({ x: Number(event.target.value) })
                        }
                      />
                    </label>
                    <label>
                      Y
                      <input
                        type="number"
                        value={selectedNode.y}
                        onChange={(event) =>
                          updateSelectedNode({ y: Number(event.target.value) })
                        }
                      />
                    </label>
                  </div>
                  <div className="form-row">
                    <button
                      type="button"
                      className={
                        scenario.startId === selectedNode.id ? "is-active" : ""
                      }
                      onClick={() =>
                        setScenario({ ...scenario, startId: selectedNode.id })
                      }
                    >
                      Set start
                    </button>
                    <button
                      type="button"
                      className={
                        scenario.goalId === selectedNode.id ? "is-active" : ""
                      }
                      onClick={() =>
                        setScenario({ ...scenario, goalId: selectedNode.id })
                      }
                    >
                      Set goal
                    </button>
                  </div>
                </div>
              ) : (
                <p>Select a node in the graph.</p>
              )}
            </section>
            <section>
              <p className="panel-label">Add edge</p>
              <div className="form-stack">
                <label>
                  From
                  <select
                    value={edgeFrom}
                    onChange={(event) => setEdgeFrom(event.target.value)}
                  >
                    {scenario.graph.nodes.map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  To
                  <select
                    value={edgeTo}
                    onChange={(event) => setEdgeTo(event.target.value)}
                  >
                    {scenario.graph.nodes.map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="form-row">
                  <label>
                    Weight
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={edgeWeight}
                      onChange={(event) =>
                        setEdgeWeight(Number(event.target.value))
                      }
                    />
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={edgeDirected}
                      onChange={(event) =>
                        setEdgeDirected(event.target.checked)
                      }
                    />{" "}
                    One-way
                  </label>
                </div>
                <button type="button" onClick={addEdge}>
                  Add validated edge
                </button>
              </div>
            </section>
            <section>
              <p className="panel-label">Road state</p>
              <div className="edge-list">
                {scenario.graph.edges.slice(0, 18).map((edge) => (
                  <div key={edge.id}>
                    <span>
                      {edge.fromId} → {edge.toId}
                    </span>
                    <div>
                      <button
                        type="button"
                        onClick={() =>
                          updateEdges(
                            scenario.graph.edges.map((item) =>
                              item.id === edge.id
                                ? { ...item, closed: !item.closed }
                                : item,
                            ),
                          )
                        }
                      >
                        {edge.closed ? "Open" : "Close"}
                      </button>
                      <button type="button" onClick={() => deleteEdge(edge.id)}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
        <footer className="builder-footer">
          <div aria-live="polite">
            {error ? (
              <p className="builder-error">
                <strong>Cannot apply:</strong> {error}
              </p>
            ) : message ? (
              <p className="builder-message">{message}</p>
            ) : (
              <p>
                {validation.success
                  ? "Scenario passes all structural checks."
                  : `${validation.issues.length} validation issues remain.`}
              </p>
            )}
          </div>
          <div>
            <button
              className="button button-ghost"
              type="button"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="button button-primary"
              type="button"
              disabled={!validation.success}
              onClick={() =>
                validation.success && onUseScenario(validation.data)
              }
            >
              Use this scenario <span aria-hidden="true">→</span>
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
