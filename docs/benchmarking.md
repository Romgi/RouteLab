# Benchmarking methodology

RouteLab reports measurements produced by real algorithm runs. It does not ship invented scores, compare devices against a universal leaderboard, or mix animation duration with algorithm execution time.

## What is measured

Each run records its complete configuration:

- scenario ID and deterministic seed;
- graph node count and traversable directed edge count;
- selected algorithm, heuristic, and cost metric;
- start and goal;
- closed-edge state;
- whether a route was found and its cost; and
- correctness status when the scenario has a known expected result.

Operation counters are deterministic for a fixed engine version and configuration:

| Metric            | Definition                                                       |
| ----------------- | ---------------------------------------------------------------- |
| Nodes visited     | Distinct nodes first discovered/reached                          |
| Nodes expanded    | Nodes whose outgoing edges are processed                         |
| Edges inspected   | Directed adjacency entries examined                              |
| Relaxations       | Candidates that improve a best-known cost                        |
| Queue pushes/pops | Physical priority/FIFO queue operations, including stale entries |
| Maximum frontier  | Largest physical frontier size during the run                    |
| Trace events      | Semantic events retained for playback                            |
| Path cost         | Sum of the selected cost field on returned open edges            |

Algorithm execution time is measured with the highest-resolution monotonic browser clock available around graph preparation/execution and trace production. It excludes playback timers, CSS/SVG animation, React rendering, route loading, and network activity. Because v1 generates the trace synchronously, trace allocation is included in the execution measurement.

## Reproducible comparison protocol

Use Compare Mode for an educational same-session comparison:

1. Select one built-in scenario or generate a graph with an explicit seed.
2. Keep start, goal, cost metric, closures, and graph identical for every algorithm.
3. Use only heuristics allowed by the scenario; record the heuristic with A*/Greedy results.
4. Run once to warm the loaded JavaScript and application path.
5. Reset and run the compared algorithms through the synchronized control.
6. Compare deterministic operation counts and path correctness first; treat sub-millisecond timing differences as noise.
7. Export/copy the scenario configuration when sharing an observation.

For measurements intended for an engineering report, use a production build, close unrelated CPU-intensive work, avoid browser developer tools during timed runs, perform at least 30 measured repetitions after warm-up, and report median plus a dispersion statistic such as interquartile range. Record browser/version, OS, CPU/device, power mode, RouteLab commit, and whether the page was foregrounded.

## Commands

Install and verify the exact dependency graph:

```bash
npm ci
npm run typecheck
npm test
npm run build
```

Run the production-shaped application for browser measurements:

```bash
npm run build
npm run start
```

Then open `/lab` for a single run or `/compare` for synchronized Dijkstra/A*/Greedy comparisons. Development mode (`npm run dev`) is convenient for debugging but is not suitable for publishing timing numbers because transforms, source maps, and hot-reload instrumentation differ.

There is no standalone `npm run benchmark` command in v1 and no checked-in results table. This is deliberate: the current release emphasizes visible per-run instrumentation and deterministic operation counts. A future benchmark runner should reuse the same scenario fixtures and engine, emit machine-readable environment metadata, perform warm-up/repetitions, and keep raw results under an explicitly generated artifact directory.

## Interpreting results

- **Correctness precedes speed.** A nonoptimal Greedy path is not “better” merely because it expands fewer nodes.
- **Operation counts travel better than time.** Counts are reproducible for a fixed version; browser timings vary with JIT, garbage collection, thermal state, background work, and hardware.
- **Heuristics change work.** A* with zero heuristic should match Dijkstra's cost and broadly its search behavior; an informed compatible heuristic may expand fewer nodes.
- **A trace has a cost.** RouteLab is an educational tracer. A production routing library that omits semantic events can run faster and allocate less.
- **Small samples are quantized/noisy.** Very short runs can fall near clock resolution and framework overhead. Prefer meaningful bounded graphs and repeated medians.
- **Asymptotics still matter.** Floyd-Warshall's cubic work is why it is capped at 24 nodes even if one tiny matrix looks fast.
- **Different languages are not browser benchmarks.** The six standalone Dijkstra files are compile/smoke-checked for conceptual parity; RouteLab does not compare their runtime performance.

## Correctness gates

A timing is meaningful only if:

- the returned path is connected and uses no closed edge;
- reported cost equals the sum of selected edge costs;
- a known fixture matches its expected result;
- the run did not hit an execution or trace limit;
- the algorithm was compatible with weights/heuristic; and
- no negative cycle invalidates a finite optimum.

When benchmark data is unavailable or invalid, the UI should say why and suggest recovery. It must not substitute a fabricated value or silently reuse a measurement from another graph.

## Performance targets versus evidence

The product targets responsive controls and approximately 60 frames per second during ordinary playback, but those are rendering goals, not algorithm benchmark results. Lighthouse targets in the product brief are release goals and must be reported only from an actual production audit with its URL, device profile, and date.

Before publishing any performance claim, preserve the raw run configuration and environment, state whether the number includes trace generation, and distinguish measured evidence from a target.
