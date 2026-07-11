"""Trusted, repository-controlled Dijkstra reference implementation."""

from __future__ import annotations

from dataclasses import dataclass
import heapq
import math
from typing import Mapping, Sequence


NodeId = str
Graph = Mapping[NodeId, Sequence[tuple[NodeId, float]]]


@dataclass(frozen=True)
class DijkstraResult:
    found: bool
    cost: float | None
    path: list[NodeId]


def _validate_graph(graph: Graph, start: NodeId, goal: NodeId) -> None:
    if start not in graph or goal not in graph:
        raise ValueError("start and goal must be present in the graph")
    for edges in graph.values():
        for neighbor, weight in edges:
            if neighbor not in graph:
                raise ValueError(f"unknown node: {neighbor}")
            if not math.isfinite(weight) or weight < 0:
                raise ValueError("Dijkstra requires finite, nonnegative weights")


def dijkstra(graph: Graph, start: NodeId, goal: NodeId) -> DijkstraResult:
    """Return one deterministic shortest path from start to goal."""

    _validate_graph(graph, start, goal)
    distances = {node: math.inf for node in graph}
    parents: dict[NodeId, NodeId] = {}
    distances[start] = 0.0

    frontier: list[tuple[float, NodeId]] = [(0.0, start)]
    while frontier:
        current_distance, current = heapq.heappop(frontier)
        if current_distance != distances[current]:
            continue
        if current == goal:
            break

        for neighbor, weight in graph[current]:
            candidate = current_distance + weight
            if candidate >= distances[neighbor]:
                continue

            distances[neighbor] = candidate
            parents[neighbor] = current
            heapq.heappush(frontier, (candidate, neighbor))

    if math.isinf(distances[goal]):
        return DijkstraResult(found=False, cost=None, path=[])

    path = [goal]
    while path[-1] != start:
        path.append(parents[path[-1]])
    path.reverse()
    return DijkstraResult(found=True, cost=distances[goal], path=path)


def _smoke_test() -> None:
    graph: Graph = {
        "A": [("B", 2), ("C", 7)],
        "B": [("C", 1), ("D", 5)],
        "C": [("D", 1)],
        "D": [],
    }
    result = dijkstra(graph, "A", "D")
    assert result == DijkstraResult(True, 4.0, ["A", "B", "C", "D"])


if __name__ == "__main__":
    _smoke_test()
    print("python dijkstra: ok")

