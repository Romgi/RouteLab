export type CodeLanguage =
  "TypeScript" | "Python" | "Java" | "C++" | "Go" | "Rust";
export type CodeConcept =
  "priority-queue" | "main-loop" | "relaxation" | "reconstruction";

export interface CodeSample {
  language: CodeLanguage;
  extension: string;
  notes: string;
  code: string;
  ranges: Record<CodeConcept, [number, number]>;
}

export const CODE_CONCEPTS: Array<{
  id: CodeConcept;
  label: string;
  event: string;
  description: string;
}> = [
  {
    id: "priority-queue",
    label: "Priority queue",
    event: "enqueue",
    description:
      "The frontier always exposes the least expensive candidate next.",
  },
  {
    id: "main-loop",
    label: "Main loop",
    event: "dequeue",
    description:
      "Stale entries are ignored so a node is finalized only at its best known cost.",
  },
  {
    id: "relaxation",
    label: "Edge relaxation",
    event: "relaxEdge",
    description:
      "A parent and distance change only when the candidate route is genuinely better.",
  },
  {
    id: "reconstruction",
    label: "Reconstruction",
    event: "reconstructPath",
    description:
      "Parent links are followed backward from the goal, then reversed into a route.",
  },
];

export const CODE_SAMPLES: Record<CodeLanguage, CodeSample> = {
  TypeScript: {
    language: "TypeScript",
    extension: "ts",
    notes:
      "Typed maps and a repository-owned binary min-heap keep the implementation browser-safe.",
    ranges: {
      "priority-queue": [3, 5],
      "main-loop": [7, 13],
      relaxation: [15, 22],
      reconstruction: [25, 30],
    },
    code: `export function dijkstra(graph: Graph, start: Id, goal: Id) {
  const distances = new Map<Id, number>([[start, 0]]);
  const parents = new Map<Id, Id>();
  const frontier = new MinHeap<Entry>();
  frontier.push({ nodeId: start, priority: 0 });

  while (!frontier.isEmpty()) {
    const current = frontier.pop()!;
    if (current.priority !== distances.get(current.nodeId)) continue;
    if (current.nodeId === goal) break;

    for (const edge of graph.outgoing(current.nodeId)) {
      if (edge.closed) continue;
      const candidate = current.priority + edge.weight;
      const previous = distances.get(edge.toId) ?? Infinity;

      if (candidate < previous) {
        distances.set(edge.toId, candidate);
        parents.set(edge.toId, current.nodeId);
        frontier.push({ nodeId: edge.toId, priority: candidate });
      }
    }
  }

  const path: Id[] = [];
  for (let node: Id | undefined = goal; node; node = parents.get(node)) {
    path.push(node);
    if (node === start) return path.reverse();
  }
  return [];
}`,
  },
  Python: {
    language: "Python",
    extension: "py",
    notes:
      "Python's heapq uses tuples; the node ID supplies a stable deterministic tie-break.",
    ranges: {
      "priority-queue": [5, 5],
      "main-loop": [7, 13],
      relaxation: [15, 22],
      reconstruction: [25, 30],
    },
    code: `from heapq import heappop, heappush
from math import inf

def dijkstra(graph, start, goal):
    distances, parents = {start: 0.0}, {}
    frontier = [(0.0, start)]

    while frontier:
        cost, current = heappop(frontier)
        if cost != distances.get(current, inf):
            continue
        if current == goal:
            break

        for edge in graph.outgoing(current):
            if edge.closed:
                continue
            candidate = cost + edge.weight
            if candidate < distances.get(edge.to_id, inf):
                distances[edge.to_id] = candidate
                parents[edge.to_id] = current
                heappush(frontier, (candidate, edge.to_id))

    path, node = [], goal
    while node in parents or node == start:
        path.append(node)
        if node == start:
            return list(reversed(path))
        node = parents[node]
    return []`,
  },
  Java: {
    language: "Java",
    extension: "java",
    notes:
      "A record makes queue entries immutable; Comparator ordering makes ties explicit.",
    ranges: {
      "priority-queue": [4, 6],
      "main-loop": [8, 14],
      relaxation: [16, 23],
      reconstruction: [26, 31],
    },
    code: `record Entry(String node, double cost) {}

List<String> dijkstra(Graph graph, String start, String goal) {
  var distances = new HashMap<String, Double>();
  var parents = new HashMap<String, String>();
  var frontier = new PriorityQueue<Entry>(
      Comparator.comparingDouble(Entry::cost).thenComparing(Entry::node));
  distances.put(start, 0.0); frontier.add(new Entry(start, 0.0));

  while (!frontier.isEmpty()) {
    var current = frontier.remove();
    if (current.cost() != distances.get(current.node())) continue;
    if (current.node().equals(goal)) break;

    for (var edge : graph.outgoing(current.node())) {
      if (edge.closed()) continue;
      double candidate = current.cost() + edge.weight();
      if (candidate < distances.getOrDefault(edge.to(), Double.POSITIVE_INFINITY)) {
        distances.put(edge.to(), candidate);
        parents.put(edge.to(), current.node());
        frontier.add(new Entry(edge.to(), candidate));
      }
    }
  }

  var path = new ArrayList<String>();
  for (String node = goal; node != null; node = parents.get(node)) {
    path.add(node);
    if (node.equals(start)) { Collections.reverse(path); return path; }
  }
  return List.of();
}`,
  },
  "C++": {
    language: "C++",
    extension: "cpp",
    notes:
      "The priority queue uses greater<> over a lexicographic pair for stable minimum-first ordering.",
    ranges: {
      "priority-queue": [5, 7],
      "main-loop": [9, 15],
      relaxation: [17, 23],
      reconstruction: [26, 31],
    },
    code: `using Entry = std::pair<double, std::string>;

std::vector<std::string> dijkstra(
    const Graph& graph, const std::string& start, const std::string& goal) {
  std::unordered_map<std::string, double> distance{{start, 0.0}};
  std::unordered_map<std::string, std::string> parent;
  std::priority_queue<Entry, std::vector<Entry>, std::greater<>> frontier;
  frontier.push({0.0, start});

  while (!frontier.empty()) {
    auto [cost, current] = frontier.top(); frontier.pop();
    if (cost != distance[current]) continue;
    if (current == goal) break;

    for (const auto& edge : graph.outgoing(current)) {
      if (edge.closed) continue;
      const double candidate = cost + edge.weight;
      if (!distance.contains(edge.to) || candidate < distance[edge.to]) {
        distance[edge.to] = candidate;
        parent[edge.to] = current;
        frontier.push({candidate, edge.to});
      }
    }
  }

  std::vector<std::string> path;
  for (auto node = goal;; node = parent[node]) {
    path.push_back(node);
    if (node == start) { std::ranges::reverse(path); return path; }
    if (!parent.contains(node)) return {};
  }
}`,
  },
  Go: {
    language: "Go",
    extension: "go",
    notes:
      "container/heap needs a small adapter; map lookup's ok flag distinguishes infinity from zero.",
    ranges: {
      "priority-queue": [4, 6],
      "main-loop": [8, 14],
      relaxation: [16, 24],
      reconstruction: [27, 33],
    },
    code: `func Dijkstra(graph Graph, start, goal string) []string {
  distances := map[string]float64{start: 0}
  parents := make(map[string]string)
  frontier := &PriorityQueue{{Node: start, Cost: 0}}
  heap.Init(frontier)

  for frontier.Len() > 0 {
    current := heap.Pop(frontier).(Entry)
    if best := distances[current.Node]; current.Cost != best { continue }
    if current.Node == goal { break }

    for _, edge := range graph.Outgoing(current.Node) {
      if edge.Closed { continue }
      candidate := current.Cost + edge.Weight
      previous, seen := distances[edge.To]
      if !seen || candidate < previous {
        distances[edge.To] = candidate
        parents[edge.To] = current.Node
        heap.Push(frontier, Entry{Node: edge.To, Cost: candidate})
      }
    }
  }

  path := []string{}
  for node := goal; ; node = parents[node] {
    path = append(path, node)
    if node == start { slices.Reverse(path); return path }
    if _, ok := parents[node]; !ok { return nil }
  }
}`,
  },
  Rust: {
    language: "Rust",
    extension: "rs",
    notes:
      "BinaryHeap is max-first, so Reverse wraps an Ord-safe integer cost in this fixture.",
    ranges: {
      "priority-queue": [5, 7],
      "main-loop": [9, 15],
      relaxation: [17, 24],
      reconstruction: [27, 33],
    },
    code: `fn dijkstra(graph: &Graph, start: Id, goal: Id) -> Vec<Id> {
    let mut distances = HashMap::from([(start, 0_u64)]);
    let mut parents: HashMap<Id, Id> = HashMap::new();
    let mut frontier = BinaryHeap::new();
    frontier.push(Reverse((0_u64, start)));

    while let Some(Reverse((cost, current))) = frontier.pop() {
        if Some(&cost) != distances.get(&current) { continue; }
        if current == goal { break; }

        for edge in graph.outgoing(current) {
            if edge.closed { continue; }
            let candidate = cost.saturating_add(edge.weight);
            let previous = distances.get(&edge.to).copied().unwrap_or(u64::MAX);
            if candidate < previous {
                distances.insert(edge.to, candidate);
                parents.insert(edge.to, current);
                frontier.push(Reverse((candidate, edge.to)));
            }
        }
    }

    let mut path = Vec::new();
    let mut node = goal;
    loop {
        path.push(node);
        if node == start { path.reverse(); return path; }
        let Some(parent) = parents.get(&node) else { return Vec::new(); };
        node = *parent;
    }
}`,
  },
};

export const CODE_LANGUAGES = Object.keys(CODE_SAMPLES) as CodeLanguage[];
