#include <algorithm>
#include <cmath>
#include <functional>
#include <iostream>
#include <limits>
#include <optional>
#include <queue>
#include <stdexcept>
#include <string>
#include <unordered_map>
#include <utility>
#include <vector>

// Trusted, repository-controlled Dijkstra reference implementation.
using NodeId = std::string;

struct Edge {
  NodeId to;
  double weight;
};

using Graph = std::unordered_map<NodeId, std::vector<Edge>>;

struct Result {
  bool found;
  std::optional<double> cost;
  std::vector<NodeId> path;
};

void validate_graph(const Graph& graph, const NodeId& start, const NodeId& goal) {
  if (!graph.contains(start) || !graph.contains(goal)) {
    throw std::invalid_argument("start and goal must be present in the graph");
  }
  for (const auto& [node, edges] : graph) {
    (void)node;
    for (const Edge& edge : edges) {
      if (!graph.contains(edge.to)) {
        throw std::invalid_argument("unknown node: " + edge.to);
      }
      if (!std::isfinite(edge.weight) || edge.weight < 0) {
        throw std::invalid_argument("Dijkstra requires finite, nonnegative weights");
      }
    }
  }
}

Result dijkstra(const Graph& graph, const NodeId& start, const NodeId& goal) {
  validate_graph(graph, start, goal);

  std::unordered_map<NodeId, double> distances;
  std::unordered_map<NodeId, NodeId> parents;
  for (const auto& [node, edges] : graph) {
    (void)edges;
    distances[node] = std::numeric_limits<double>::infinity();
  }
  distances[start] = 0.0;

  using QueueEntry = std::pair<double, NodeId>;
  std::priority_queue<QueueEntry, std::vector<QueueEntry>,
                      std::greater<QueueEntry>>
      frontier;
  frontier.emplace(0.0, start);

  while (!frontier.empty()) {
    const auto [current_distance, current] = frontier.top();
    frontier.pop();
    if (current_distance != distances.at(current)) continue;
    if (current == goal) break;

    for (const Edge& edge : graph.at(current)) {
      const double candidate = current_distance + edge.weight;
      if (candidate >= distances.at(edge.to)) continue;

      distances[edge.to] = candidate;
      parents[edge.to] = current;
      frontier.emplace(candidate, edge.to);
    }
  }

  if (std::isinf(distances.at(goal))) return {false, std::nullopt, {}};

  std::vector<NodeId> path;
  for (NodeId node = goal;; node = parents.at(node)) {
    path.push_back(node);
    if (node == start) break;
  }
  std::reverse(path.begin(), path.end());
  return {true, distances.at(goal), path};
}

int main() {
  const Graph graph = {
      {"A", {{"B", 2}, {"C", 7}}},
      {"B", {{"C", 1}, {"D", 5}}},
      {"C", {{"D", 1}}},
      {"D", {}},
  };
  const Result result = dijkstra(graph, "A", "D");
  const std::vector<NodeId> expected = {"A", "B", "C", "D"};
  if (!result.found || result.cost != 4.0 || result.path != expected) return 1;
  std::cout << "cpp dijkstra: ok\n";
}

