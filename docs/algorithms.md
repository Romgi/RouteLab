# Algorithms and guarantees

RouteLab implements seven graph algorithms against the same normalized graph and trace contract. Compatibility is checked before execution; an unsupported selection is an error, not a request to approximate an answer.

Let `V` be the number of nodes and `E` the number of traversable directed edge entries. A scenario edge marked bidirectional contributes two adjacency entries.

## At a glance

| Algorithm              | Valid weights                     | Optimality                                                     | Typical implementation cost                           | Main lesson                                      |
| ---------------------- | --------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------ |
| Breadth-first search   | Equal cost only                   | Shortest edge count                                            | `O(V + E)` time, `O(V)` space                         | Layers and queues                                |
| Dijkstra               | Nonnegative                       | Minimum total cost                                             | `O((V + E) log V)` time, `O(V + E)` space             | Relaxation without direction                     |
| A*                     | Nonnegative                       | Minimum cost with an admissible heuristic                      | Worst case `O((V + E) log V)` for this implementation | `g + h` balances cost and guidance               |
| Greedy best-first      | Nonnegative in RouteLab scenarios | Not guaranteed                                                 | Worst case `O((V + E) log V)`                         | Fast-looking choices can be wrong                |
| Bidirectional Dijkstra | Nonnegative                       | Minimum total cost                                             | Worst case `O((V + E) log V)`                         | Two valid directed searches and a stopping bound |
| Bellman-Ford           | Negative edges allowed            | Minimum cost if no reachable negative cycle affects the result | `O(VE)` time, `O(V)` space                            | Repeated relaxation and cycle detection          |
| Floyd-Warshall         | Negative edges allowed            | All-pairs costs if no relevant negative cycle                  | `O(V³)` time, `O(V²)` space                           | Dynamic programming over intermediates           |

Big-O notation is an upper-bound model, not a benchmark. Constant factors, graph layout, heuristic strength, trace generation, JavaScript engine behavior, and device state all matter.

## Shared conventions

- Closed edges are ignored.
- Directed edges are traversed only from source to destination. A bidirectional scenario edge is normalized into two directions.
- A path is an ordered node/edge sequence whose reported cost equals the selected edge costs.
- Parent/predecessor maps are updated only when a strictly lower cost is found. Equal-cost candidates keep the first deterministic parent.
- The engine sorts IDs/arcs and resolves priority-queue ties by priority, algorithm-specific secondary cost (heuristic for A*, path cost for Greedy), node ID, then insertion sequence. Equal relaxations retain the first canonical parent.
- Start equal to goal returns a found path containing the start node with cost zero.
- An unreachable goal returns `found: false`, `cost: null`, and an empty path; it is not thrown as an exception.
- Algorithm precondition failures, trace/time limit failures, and malformed graphs are recoverable errors distinct from “no path.”

## Breadth-first search

BFS places the start in a FIFO queue, removes nodes in discovery order, and enqueues each undiscovered neighbor. It explores distance layers: every node at edge distance `k` is processed before a node at distance `k + 1`.

That layer invariant proves the first discovered path to a node uses the fewest edges. It minimizes weighted cost only when every traversable edge has the same cost. RouteLab therefore enables BFS only on equal-weight scenarios and explains why it is not a general road-routing algorithm.

Trace emphasis: enqueue/dequeue behavior, layers, first parent assignment, and the explored-versus-frontier distinction.

## Dijkstra's algorithm

Dijkstra stores the best-known cost `g(n)` and orders a min-priority queue by that value. Removing the minimum entry finalizes its node when all open weights are nonnegative. Each outgoing edge proposes:

```text
candidate = distance[current] + cost(current, neighbor)
```

If the candidate is lower, the algorithm updates distance and parent and pushes a new queue entry. The heap may still contain an older entry for the same node; comparing the popped cost with the current distance safely discards this stale entry. Once the goal is popped with its best distance, early termination is correct.

Negative weights break the finalization argument: a later negative edge could improve a node already treated as final. Validation rejects that combination.

Trace emphasis: priority, stale entries, inspected edges, successful/failed relaxation, parent changes, and route reconstruction.

## A* search

A* uses the same relaxation rule as Dijkstra but orders the frontier by:

```text
f(n) = g(n) + h(n)
```

`g(n)` is the route cost already paid; `h(n)` estimates cost remaining to the goal. RouteLab provides:

- **Zero:** always `0`, making A* behave like Dijkstra.
- **Manhattan:** `|x₁ - x₂| + |y₁ - y₂|`, appropriate for axis-aligned movement when cost scale matches coordinates.
- **Euclidean:** straight-line distance in scenario coordinates.
- **Geographic:** great-circle distance from latitude/longitude coordinates.

An admissible heuristic never exceeds true remaining cost. A consistent heuristic also satisfies the triangle inequality relative to edge costs and avoids the need to reopen a finalized-looking node. RouteLab's engine reopens nodes when an inconsistent heuristic produces a later improvement, preserving the admissible-heuristic guarantee. Scenario allowlists are the source of truth because a mathematically familiar heuristic can still be invalid when its units or cost model do not match the graph. With a mismatched or overestimating heuristic, A* may return a nonoptimal route.

Trace emphasis: separate `g`, `h`, and `f` values; compare zero versus informed heuristics on the identical graph.

## Greedy best-first search

Greedy best-first orders the queue only by `h(n)`. It can aim at the goal with few expansions, but it ignores the cost already accumulated. A barrier or expensive “direct” corridor can make it return a route far more costly than the optimum.

RouteLab treats “found quickly” and “optimal” as separate outcomes. Greedy is never labeled optimal merely because it reaches the goal before another algorithm.

Trace emphasis: heuristic attraction, low expansion count, and the final cost gap on the misleading-heuristic scenario.

## Bidirectional Dijkstra

Bidirectional Dijkstra runs one Dijkstra search from the start and another from the goal. The backward search uses reverse adjacency; this is essential for directed graphs. A node reachable from the goal in the drawing is not automatically reachable in reverse along a one-way edge.

Whenever the searches touch, their settled/tentative costs form a candidate complete route. The algorithm keeps the best meeting cost `μ` and stops only when the smallest remaining forward and backward keys cannot combine to beat `μ`. Reconstruction joins the forward parent chain to the meeting point and the backward successor chain from that point to the goal.

The technique often explores less of a spatial network, but has the same asymptotic worst case and can provide little benefit on tiny, highly asymmetric, or poorly connected graphs.

Trace emphasis: forward/backward frontiers, reverse-edge semantics, meeting candidates, stopping condition, and joined reconstruction.

## Bellman-Ford

Bellman-Ford initializes the start distance to zero and performs up to `V - 1` full edge-relaxation passes. Any shortest simple path uses at most `V - 1` edges, so after those passes every reachable shortest cost is known if no reachable negative cycle can reduce it indefinitely. A pass with no update permits early exit.

One additional relaxable edge reveals a negative cycle reachable from the selected start. RouteLab reports that state explicitly instead of displaying a finite “shortest” route. Negative-edge scenarios are abstract graph-theory demonstrations, not claims about ordinary road distance or time.

Trace emphasis: pass number, repeated edge inspection, propagation of an improvement, early stop, and negative-cycle evidence.

## Floyd-Warshall

Floyd-Warshall computes all-pairs distances with a matrix. At intermediate step `k`, it compares the current route from `i` to `j` with a route that is allowed to pass through node `k`:

```text
distance[i][j] = min(distance[i][j], distance[i][k] + distance[k][j])
```

The dynamic-programming invariant is that, after step `k`, matrix entries are optimal among paths whose internal nodes come from the first `k` nodes. A negative diagonal entry after completion identifies a negative cycle anywhere in the graph; unlike the single-source Bellman-Ford result, this check is not limited to cycles reachable from the selected start.

The cubic event volume and quadratic matrix make this an educational small-graph mode. RouteLab enforces a 24-node ceiling and does not offer Floyd-Warshall as an interactive large-network solver.

Trace emphasis: active intermediate node, inspected matrix cells, old/candidate/new values, and the evolving distance matrix.

## Correctness validation

The automated suite uses manually verifiable graphs and cross-algorithm properties. Important checks include:

- direct, equal-cost, disconnected, directed, zero-weight, closed-edge, and start-equals-goal cases;
- stale priority-queue entries and deterministic tie-breaking;
- Dijkstra equals Bellman-Ford on nonnegative graphs;
- A* with zero heuristic equals Dijkstra;
- BFS equals Dijkstra on equal-weight graphs;
- every returned consecutive pair is connected by an open edge;
- summed path cost equals the reported result;
- negative cycles are surfaced; and
- trace completion agrees with the returned result.

The standalone six-language Dijkstra sources use the same four-node smoke graph in CI. They are educational references; the browser engine remains the source of interactive traces.
