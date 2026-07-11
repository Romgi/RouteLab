import { dijkstra, type Graph } from "./dijkstra";

const graph: Graph = new Map([
  [
    "A",
    [
      { to: "B", weight: 2 },
      { to: "C", weight: 7 },
    ],
  ],
  [
    "B",
    [
      { to: "C", weight: 1 },
      { to: "D", weight: 5 },
    ],
  ],
  ["C", [{ to: "D", weight: 1 }]],
  ["D", []],
]);

const result = dijkstra(graph, "A", "D");
if (!result.found || result.cost !== 4 || result.path.join(",") !== "A,B,C,D") {
  throw new Error(`Unexpected result: ${JSON.stringify(result)}`);
}

console.log("typescript dijkstra: ok");
