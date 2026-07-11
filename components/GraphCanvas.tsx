"use client";

import { useMemo } from "react";
import type {
  AlgorithmResult,
  AlgorithmTraceEvent,
  Graph,
  GraphEdge,
  GraphNode,
} from "@/lib/algorithms";

export interface ReplayFrame {
  visited: ReadonlySet<string>;
  frontier: ReadonlySet<string>;
  forwardVisited: ReadonlySet<string>;
  backwardVisited: ReadonlySet<string>;
  distances: ReadonlyMap<string, number>;
  parents: ReadonlyMap<string, string>;
  currentNodeId: string | null;
  currentEdgeId: string | null;
  pathNodeIds: ReadonlySet<string>;
  pathEdgeIds: ReadonlySet<string>;
  negativeCycleNodeIds: ReadonlySet<string>;
  event: AlgorithmTraceEvent | null;
}

export function replayTrace(
  trace: readonly AlgorithmTraceEvent[],
  step: number,
): ReplayFrame {
  const visited = new Set<string>();
  const frontier = new Set<string>();
  const forwardVisited = new Set<string>();
  const backwardVisited = new Set<string>();
  const distances = new Map<string, number>();
  const parents = new Map<string, string>();
  const pathNodeIds = new Set<string>();
  const pathEdgeIds = new Set<string>();
  const negativeCycleNodeIds = new Set<string>();
  let currentNodeId: string | null = null;
  let currentEdgeId: string | null = null;
  let event: AlgorithmTraceEvent | null = null;

  for (let index = 0; index <= step && index < trace.length; index += 1) {
    const item = trace[index];
    event = item;
    switch (item.type) {
      case "initialize":
        distances.set(item.startId, 0);
        break;
      case "enqueue":
        frontier.add(item.nodeId);
        break;
      case "dequeue":
        frontier.delete(item.nodeId);
        currentNodeId = item.nodeId;
        break;
      case "visitNode":
        visited.add(item.nodeId);
        currentNodeId = item.nodeId;
        if (item.direction === "backward") backwardVisited.add(item.nodeId);
        else forwardVisited.add(item.nodeId);
        break;
      case "inspectEdge":
      case "relaxEdge":
        currentEdgeId = item.edgeId;
        break;
      case "updateDistance":
        distances.set(item.nodeId, item.newDistance);
        break;
      case "setParent":
        parents.set(item.nodeId, item.parentId);
        break;
      case "reconstructPath":
        item.nodeIds.forEach((id) => pathNodeIds.add(id));
        item.edgeIds.forEach((id) => pathEdgeIds.add(id));
        break;
      case "negativeCycleDetected":
        item.nodeIds.forEach((id) => negativeCycleNodeIds.add(id));
        break;
      case "finish":
        item.pathNodeIds.forEach((id) => pathNodeIds.add(id));
        item.pathEdgeIds.forEach((id) => pathEdgeIds.add(id));
        break;
      default:
        break;
    }
  }

  return {
    visited,
    frontier,
    forwardVisited,
    backwardVisited,
    distances,
    parents,
    currentNodeId,
    currentEdgeId,
    pathNodeIds,
    pathEdgeIds,
    negativeCycleNodeIds,
    event,
  };
}

function getBounds(nodes: readonly GraphNode[]) {
  if (nodes.length === 0) return { x: 0, y: 0, width: 100, height: 100 };
  const xs = nodes.map((node) => node.x);
  const ys = nodes.map((node) => node.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const padding = Math.max(width, height) * 0.11;
  return {
    x: minX - padding,
    y: minY - padding,
    width: width + padding * 2,
    height: height + padding * 2,
  };
}

function nodeState(
  node: GraphNode,
  frame: ReplayFrame,
  startId: string,
  goalId: string,
) {
  const states = ["graph-node-group"];
  if (node.id === startId) states.push("is-start");
  if (node.id === goalId) states.push("is-goal");
  if (frame.visited.has(node.id)) states.push("is-visited");
  if (frame.forwardVisited.has(node.id)) states.push("is-forward");
  if (frame.backwardVisited.has(node.id)) states.push("is-backward");
  if (frame.frontier.has(node.id)) states.push("is-frontier");
  if (frame.currentNodeId === node.id) states.push("is-current");
  if (frame.pathNodeIds.has(node.id)) states.push("is-path");
  if (frame.negativeCycleNodeIds.has(node.id)) states.push("is-negative-cycle");
  return states.join(" ");
}

function edgeState(edge: GraphEdge, frame: ReplayFrame) {
  const states = ["graph-edge-line"];
  if (edge.closed) states.push("is-closed");
  if (frame.currentEdgeId === edge.id) states.push("is-current");
  if (frame.pathEdgeIds.has(edge.id)) states.push("is-path");
  return states.join(" ");
}

export function GraphCanvas({
  graph,
  startId,
  goalId,
  result,
  step,
  selectedNodeId,
  onSelectNode,
  onToggleEdge,
  compact = false,
  label = "Pathfinding graph",
}: {
  graph: Graph;
  startId: string;
  goalId: string;
  result: AlgorithmResult;
  step: number;
  selectedNodeId?: string | null;
  onSelectNode?: (nodeId: string) => void;
  onToggleEdge?: (edgeId: string) => void;
  compact?: boolean;
  label?: string;
}) {
  const frame = useMemo(
    () => replayTrace(result.trace, step),
    [result.trace, step],
  );
  const nodesById = useMemo(
    () => new Map(graph.nodes.map((node) => [node.id, node])),
    [graph.nodes],
  );
  const bounds = useMemo(() => getBounds(graph.nodes), [graph.nodes]);
  const unit = Math.max(bounds.width, bounds.height);
  const ringRadius = unit * (compact ? 0.016 : 0.019);
  const coreRadius = ringRadius * 0.58;
  const labelSize = unit * 0.014;
  const markerId = `arrow-${result.algorithmId.replaceAll("-", "")}-${compact ? "mini" : "full"}`;
  const summary =
    frame.event?.message ?? "Ready to inspect the first trace event.";

  return (
    <div className={compact ? "graph-canvas is-compact" : "graph-canvas"}>
      <div className="graph-visual" role="group" aria-label={label}>
        <svg
          viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          <defs>
            <marker
              id={markerId}
              markerWidth="7"
              markerHeight="7"
              refX="6"
              refY="3.5"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L7,3.5 L0,7 z" className="direction-arrow" />
            </marker>
          </defs>
          <g className="edge-layer">
            {graph.edges.map((edge) => {
              const from = nodesById.get(edge.fromId);
              const to = nodesById.get(edge.toId);
              if (!from || !to) return null;
              const mx = (from.x + to.x) / 2;
              const my = (from.y + to.y) / 2;
              return (
                <g key={edge.id} className={edgeState(edge, frame)}>
                  <line
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    markerEnd={
                      edge.directed === false ? undefined : `url(#${markerId})`
                    }
                  />
                  {!compact && (
                    <text
                      x={mx}
                      y={my - unit * 0.018}
                      style={{
                        fontSize: labelSize * 0.9,
                        strokeWidth: labelSize * 0.9,
                      }}
                    >
                      {edge.closed ? "closed" : String(edge.weight)}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
          <g className="node-layer">
            {graph.nodes.map((node) => {
              const state = nodeState(node, frame, startId, goalId);
              return (
                <g
                  key={node.id}
                  className={`${state}${selectedNodeId === node.id ? " is-selected" : ""}`}
                  transform={`translate(${node.x} ${node.y})`}
                  onClick={() => onSelectNode?.(node.id)}
                >
                  <circle className="node-ring" r={ringRadius} />
                  <circle className="node-core" r={coreRadius} />
                  {!compact && (
                    <text
                      x="0"
                      y={-ringRadius * 2.15}
                      textAnchor="middle"
                      style={{
                        fontSize: labelSize,
                        strokeWidth: labelSize * 0.8,
                      }}
                    >
                      {node.label ?? node.id}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
        {!compact && (
          <div className="graph-overlay">
            <div className="graph-legend" aria-hidden="true">
              <span>
                <i className="legend-current" /> current
              </span>
              <span>
                <i className="legend-frontier" /> frontier
              </span>
              <span>
                <i className="legend-visited" /> visited
              </span>
              <span>
                <i className="legend-path" /> final path
              </span>
            </div>
            <span className="zoom-hint">Select any node to inspect</span>
          </div>
        )}
      </div>
      {!compact && (
        <details className="graph-alternative">
          <summary>Accessible graph data</summary>
          <p className="graph-state-description" aria-live="polite">
            {summary}
          </p>
          <div className="graph-data-tables">
            <div>
              <h3>Nodes</h3>
              <table>
                <thead>
                  <tr>
                    <th>Node</th>
                    <th>State</th>
                    <th>Distance</th>
                  </tr>
                </thead>
                <tbody>
                  {graph.nodes.map((node) => (
                    <tr key={node.id}>
                      <td>
                        {onSelectNode ? (
                          <button
                            type="button"
                            onClick={() => onSelectNode(node.id)}
                            aria-pressed={selectedNodeId === node.id}
                          >
                            Select {node.label ?? node.id}
                          </button>
                        ) : (
                          (node.label ?? node.id)
                        )}
                      </td>
                      <td>
                        {frame.currentNodeId === node.id
                          ? "Current"
                          : frame.pathNodeIds.has(node.id)
                            ? "Final path"
                            : frame.frontier.has(node.id)
                              ? "Frontier"
                              : frame.visited.has(node.id)
                                ? "Visited"
                                : "Unseen"}
                      </td>
                      <td>
                        {frame.distances.has(node.id)
                          ? frame.distances.get(node.id)!.toFixed(2)
                          : "∞"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <h3>Edges</h3>
              <table>
                <thead>
                  <tr>
                    <th>Road</th>
                    <th>Weight</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {graph.edges.map((edge) => (
                    <tr key={edge.id}>
                      <td>
                        {nodesById.get(edge.fromId)?.label ?? edge.fromId} →{" "}
                        {nodesById.get(edge.toId)?.label ?? edge.toId}
                      </td>
                      <td>{edge.weight}</td>
                      <td>
                        {edge.closed
                          ? "Closed"
                          : edge.directed === false
                            ? "Two-way"
                            : "One-way"}
                      </td>
                      <td>
                        {onToggleEdge && (
                          <button
                            type="button"
                            onClick={() => onToggleEdge(edge.id)}
                          >
                            {edge.closed ? "Open" : "Close"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </details>
      )}
    </div>
  );
}
