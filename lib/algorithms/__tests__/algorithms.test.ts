import { describe, expect, it } from "vitest";

import {
  AlgorithmCompatibilityError,
  createTraceSnapshots,
  replayTrace,
  runAlgorithm,
  type AlgorithmId,
  type Graph,
} from "../index";

const nodes = (...ids: string[]) =>
  ids.map((id, index) => ({ id, x: index, y: index % 2 }));

describe("RouteLab algorithm engine", () => {
  it("handles start equal to goal in all seven algorithms", () => {
    const graph: Graph = { nodes: nodes("A"), edges: [] };
    const algorithms: AlgorithmId[] = [
      "bfs",
      "dijkstra",
      "astar",
      "greedy-best-first",
      "bidirectional-dijkstra",
      "bellman-ford",
      "floyd-warshall",
    ];

    for (const algorithmId of algorithms) {
      const result = runAlgorithm(graph, {
        algorithmId,
        startId: "A",
        goalId: "A",
        heuristicId: "zero",
      });
      expect(result.status, algorithmId).toBe("success");
      expect(result.pathCost, algorithmId).toBe(0);
      expect(result.pathNodeIds, algorithmId).toEqual(["A"]);
      expect(result.pathEdgeIds, algorithmId).toEqual([]);
    }
  });

  it("uses canonical ID tie-breaking independent of input order", () => {
    const graph: Graph = {
      nodes: nodes("D", "C", "B", "A"),
      edges: [
        { id: "cd", fromId: "C", toId: "D", weight: 1 },
        { id: "ac", fromId: "A", toId: "C", weight: 1 },
        { id: "bd", fromId: "B", toId: "D", weight: 1 },
        { id: "ab", fromId: "A", toId: "B", weight: 1 },
      ],
    };
    const options = {
      algorithmId: "dijkstra" as const,
      startId: "A",
      goalId: "D",
    };
    const first = runAlgorithm(graph, options);
    const reordered = runAlgorithm(
      { nodes: [...graph.nodes].reverse(), edges: [...graph.edges].reverse() },
      options,
    );

    expect(first.pathNodeIds).toEqual(["A", "B", "D"]);
    expect(first.pathEdgeIds).toEqual(["ab", "bd"]);
    expect(first.trace).toEqual(reordered.trace);
  });

  it("rejects incompatible costs and never traverses closed edges", () => {
    const graph: Graph = {
      nodes: nodes("A", "B", "C"),
      edges: [
        { id: "closed", fromId: "A", toId: "C", weight: 1, closed: true },
        { id: "ab", fromId: "A", toId: "B", weight: 2 },
        { id: "bc", fromId: "B", toId: "C", weight: 2 },
      ],
    };
    const result = runAlgorithm(graph, {
      algorithmId: "dijkstra",
      startId: "A",
      goalId: "C",
    });
    expect(result.pathCost).toBe(4);
    expect(result.pathEdgeIds).toEqual(["ab", "bc"]);

    expect(() =>
      runAlgorithm(
        {
          ...graph,
          edges: [
            ...graph.edges,
            { id: "weighted", fromId: "A", toId: "C", weight: 9 },
          ],
        },
        { algorithmId: "bfs", startId: "A", goalId: "C" },
      ),
    ).toThrow(AlgorithmCompatibilityError);
  });

  it("runs backward over reversed arcs without violating directed edges", () => {
    const graph: Graph = {
      nodes: nodes("A", "B", "C", "D"),
      edges: [
        { id: "ab", fromId: "A", toId: "B", weight: 1 },
        { id: "bc", fromId: "B", toId: "C", weight: 1 },
        { id: "ad", fromId: "A", toId: "D", weight: 10 },
        { id: "dc", fromId: "D", toId: "C", weight: 1 },
      ],
    };
    const forward = runAlgorithm(graph, {
      algorithmId: "bidirectional-dijkstra",
      startId: "A",
      goalId: "C",
    });
    const reverse = runAlgorithm(graph, {
      algorithmId: "bidirectional-dijkstra",
      startId: "C",
      goalId: "A",
    });

    expect(forward.pathCost).toBe(2);
    expect(forward.pathNodeIds).toEqual(["A", "B", "C"]);
    expect(reverse.status).toBe("no-path");
  });

  it("handles negative edges only where valid and reports negative cycles", () => {
    const graph: Graph = {
      nodes: nodes("A", "B", "C"),
      edges: [
        { id: "ab", fromId: "A", toId: "B", weight: 1 },
        { id: "bc", fromId: "B", toId: "C", weight: -3 },
        { id: "cb", fromId: "C", toId: "B", weight: 1 },
      ],
    };
    expect(() =>
      runAlgorithm(graph, {
        algorithmId: "dijkstra",
        startId: "A",
        goalId: "C",
      }),
    ).toThrow(AlgorithmCompatibilityError);

    const result = runAlgorithm(graph, {
      algorithmId: "bellman-ford",
      startId: "A",
      goalId: "C",
    });
    expect(result.status).toBe("negative-cycle");
    expect(result.negativeCycleNodeIds).toEqual(["B", "C", "B"]);
    expect(
      result.trace.some((event) => event.type === "negativeCycleDetected"),
    ).toBe(true);
  });

  it("produces all-pairs output with JSON-safe unreachable distances", () => {
    const graph: Graph = {
      nodes: nodes("A", "B", "C", "X"),
      edges: [
        { id: "ab", fromId: "A", toId: "B", weight: 2 },
        { id: "bc", fromId: "B", toId: "C", weight: 3 },
        { id: "ac", fromId: "A", toId: "C", weight: 9 },
      ],
    };
    const result = runAlgorithm(graph, {
      algorithmId: "floyd-warshall",
      startId: "A",
      goalId: "C",
    });

    expect(result.pathCost).toBe(5);
    expect(result.allPairs?.distances.A?.C).toBe(5);
    expect(result.allPairs?.distances.C?.A).toBeNull();
    expect(result.allPairs?.distances.A?.X).toBeNull();
    expect(() => JSON.stringify(result.allPairs)).not.toThrow();
  });

  it("agrees across optimal algorithms on deterministic directed graphs", () => {
    let seed = 0x12345678;
    const random = () => {
      seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
      return seed / 2 ** 32;
    };

    for (let sample = 0; sample < 40; sample += 1) {
      const graphNodes = nodes("A", "B", "C", "D", "E", "F");
      const edges: Graph["edges"][number][] = [];
      let edgeIndex = 0;
      for (const from of graphNodes) {
        for (const to of graphNodes) {
          if (from.id !== to.id && random() < 0.25) {
            edges.push({
              id: `e${edgeIndex++}`,
              fromId: from.id,
              toId: to.id,
              weight: Math.floor(random() * 10),
              directed: random() < 0.8,
            });
          }
        }
      }
      const graph: Graph = { nodes: graphNodes, edges };
      const costs = (
        ["dijkstra", "astar", "bidirectional-dijkstra", "bellman-ford"] as const
      ).map(
        (algorithmId) =>
          runAlgorithm(graph, {
            algorithmId,
            startId: "A",
            goalId: "F",
            heuristicId: "zero",
          }).pathCost,
      );
      expect(
        costs.every((cost) => cost === costs[0]),
        `sample ${sample}`,
      ).toBe(true);
    }
  });

  it("replays every cursor identically with and without snapshots", () => {
    const graph: Graph = {
      nodes: nodes("A", "B", "C", "D"),
      edges: [
        { id: "ab", fromId: "A", toId: "B", weight: 1 },
        { id: "ac", fromId: "A", toId: "C", weight: 4 },
        { id: "bc", fromId: "B", toId: "C", weight: 1 },
        { id: "cd", fromId: "C", toId: "D", weight: 1 },
      ],
    };
    const { trace } = runAlgorithm(graph, {
      algorithmId: "dijkstra",
      startId: "A",
      goalId: "D",
    });
    const snapshots = createTraceSnapshots(trace, 4);

    for (let cursor = 0; cursor <= trace.length; cursor += 1) {
      expect(replayTrace(trace, cursor, snapshots), `cursor ${cursor}`).toEqual(
        replayTrace(trace, cursor),
      );
    }
  });
});
