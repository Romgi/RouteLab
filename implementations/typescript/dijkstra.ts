/** Trusted, repository-controlled Dijkstra reference implementation. */
export type NodeId = string;

export interface Edge {
  to: NodeId;
  weight: number;
}

export type Graph = ReadonlyMap<NodeId, readonly Edge[]>;

export interface DijkstraResult {
  found: boolean;
  cost: number | null;
  path: NodeId[];
}

interface QueueEntry {
  node: NodeId;
  distance: number;
}

class MinHeap {
  private readonly entries: QueueEntry[] = [];

  get size(): number {
    return this.entries.length;
  }

  push(entry: QueueEntry): void {
    this.entries.push(entry);
    let child = this.entries.length - 1;
    while (child > 0) {
      const parent = Math.floor((child - 1) / 2);
      if (!this.before(this.entries[child], this.entries[parent])) break;
      [this.entries[parent], this.entries[child]] = [
        this.entries[child],
        this.entries[parent],
      ];
      child = parent;
    }
  }

  pop(): QueueEntry | undefined {
    const first = this.entries[0];
    const last = this.entries.pop();
    if (!first || !last || this.entries.length === 0) return first;

    this.entries[0] = last;
    let parent = 0;
    while (true) {
      const left = parent * 2 + 1;
      const right = left + 1;
      let next = parent;
      if (
        left < this.entries.length &&
        this.before(this.entries[left], this.entries[next])
      ) {
        next = left;
      }
      if (
        right < this.entries.length &&
        this.before(this.entries[right], this.entries[next])
      ) {
        next = right;
      }
      if (next === parent) break;
      [this.entries[parent], this.entries[next]] = [
        this.entries[next],
        this.entries[parent],
      ];
      parent = next;
    }
    return first;
  }

  private before(a: QueueEntry, b: QueueEntry): boolean {
    return (
      a.distance < b.distance || (a.distance === b.distance && a.node < b.node)
    );
  }
}

function validateGraph(graph: Graph, start: NodeId, goal: NodeId): void {
  if (!graph.has(start) || !graph.has(goal)) {
    throw new Error("Start and goal must be present in the graph");
  }
  for (const edges of graph.values()) {
    for (const edge of edges) {
      if (!graph.has(edge.to)) throw new Error(`Unknown node: ${edge.to}`);
      if (!Number.isFinite(edge.weight) || edge.weight < 0) {
        throw new Error("Dijkstra requires finite, nonnegative weights");
      }
    }
  }
}

export function dijkstra(
  graph: Graph,
  start: NodeId,
  goal: NodeId,
): DijkstraResult {
  validateGraph(graph, start, goal);

  const distances = new Map<NodeId, number>();
  const parents = new Map<NodeId, NodeId>();
  for (const node of graph.keys())
    distances.set(node, Number.POSITIVE_INFINITY);
  distances.set(start, 0);

  const frontier = new MinHeap();
  frontier.push({ node: start, distance: 0 });

  while (frontier.size > 0) {
    const current = frontier.pop()!;
    if (current.distance !== distances.get(current.node)) continue;
    if (current.node === goal) break;

    for (const edge of graph.get(current.node) ?? []) {
      const candidate = current.distance + edge.weight;
      if (candidate >= distances.get(edge.to)!) continue;

      distances.set(edge.to, candidate);
      parents.set(edge.to, current.node);
      frontier.push({ node: edge.to, distance: candidate });
    }
  }

  const goalDistance = distances.get(goal)!;
  if (!Number.isFinite(goalDistance)) {
    return { found: false, cost: null, path: [] };
  }

  const path: NodeId[] = [];
  let node: NodeId | undefined = goal;
  while (node !== undefined) {
    path.push(node);
    if (node === start) break;
    node = parents.get(node);
  }
  path.reverse();
  return { found: true, cost: goalDistance, path };
}
