# Architecture

RouteLab is a client-first Next.js App Router application built with native Next.js and hosted on Vercel. Correctness-critical graph code is framework-independent; React owns selection, playback, and presentation state.

## Runtime shape

```text
HTTP request
  -> Vercel / Next.js route delivery
  -> App Router route and shared layout
  -> client workspace
       -> validated scenario
       -> algorithm engine -> result + immutable semantic trace
       -> timeline replay -> derived snapshot
       -> SVG + inspector + metrics + accessible graph table
```

Next.js renders the application routes and delivers their client assets; algorithms execute in the browser. RouteLab v1 has no API-backed persistence, database, account system, arbitrary outbound fetch, or server-side benchmark service.

## Routes

| Route      | Responsibility                                                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`        | Scroll-led Story Mode with interactive graph/cost/algorithm/language/scenario demonstrations                                                      |
| `/lab`     | Single-run workspace: scenario and algorithm configuration, visualization, inspector, timeline, safe import/export, generators, and edge closures |
| `/compare` | Synchronized two-to-four-algorithm comparison on the same scenario and timeline                                                                   |
| `/code`    | Read-only Dijkstra source explorer for TypeScript, Python, Java, C++, Go, and Rust                                                                |
| `/docs`    | Concise in-application guide to mental model, guarantees, controls, security, and accessibility                                                   |

The Markdown documents in `docs/` are the deeper engineering reference; `/docs` is the product-facing summary.

## Repository boundaries

```text
app/                         route entry points, metadata, shared layout
components/                  product workspaces and reusable presentation
lib/algorithms/              graph types, algorithms, trace, metrics, replay
lib/scenarios/               schemas, fixtures, generators, serialization
lib/code-snippets.ts         browser-bundled trusted code presentation
implementations/             compile/smoke-checked standalone Dijkstra sources
docs/                        design, correctness, security, and operations
tests/                       unit, integration, rendered-route, and E2E coverage
vercel.json                  native Next.js deployment configuration
```

Dependencies point inward: routes depend on components; components may depend on domain modules; domain modules never depend on React, DOM APIs, CSS, routes, animation timers, or hosting APIs. Scenario modules may use shared algorithm identifiers/types, but algorithms operate on the minimal normalized graph contract rather than the educational scenario envelope.

## Scenario loading and normalization

Built-in scenarios are repository exports validated against the same schema used for external data. A custom import follows byte/UTF-8/JSON/schema validation before it can become selected state. Seeded grid and random generators return ordinary versioned scenarios, then validate their own output.

Before a run, the workspace derives an immutable graph view:

1. Resolve the selected travel model. Direct scenario metrics map `weight`, `distance`, and `travelTime` to the engine's `weight`, `distance`, and `travel-time`; derived models also support `hops`, `avoid-tolls`, and `cycling`.
2. Exclude closed edges.
3. Add one adjacency entry for a directed edge or two for a bidirectional edge.
4. Preserve stable node/edge order for deterministic tie-breaking.
5. Build reverse adjacency for algorithms that require backward traversal.
6. Recheck algorithm and heuristic compatibility.

Changing a closure, scenario, metric, heuristic, start, goal, or algorithm invalidates the old trace and generates a new run. Timeline state never mutates scenario data.

## Algorithm execution

`runAlgorithm` is the validated unified entry point. Named exports (`runBreadthFirstSearch`, `runDijkstra`, `runAStar`, `runGreedyBestFirst`, `runBidirectionalDijkstra`, `runBellmanFord`, and `runFloydWarshall`) supply the algorithm identifier and delegate to that entry point. Every function receives plain graph data and options and returns a result, operation metrics, and a bounded ordered trace. Algorithms do not know whether a visitor will play, scrub, compare, or never visualize that trace.

Execution has four stages:

1. **Preconditions:** validate endpoints, weight domain, heuristic availability, algorithm-specific size, and configured budgets.
2. **Initialization:** create distance/parent/frontier structures and emit the initial event.
3. **Search:** update private algorithm state and emit semantic events after deterministic decisions.
4. **Completion:** reconstruct a connected route or explicit no-path/negative-cycle outcome, finalize metrics, and emit `finish`.

The result and final trace state must agree. Queue implementation details may generate stale physical entries; those are surfaced or rejected deterministically rather than hidden behind animation logic.

## Trace contract

Trace events use stable node/edge IDs and values sufficient to explain/replay the decision. The vocabulary includes initialization, enqueue/dequeue, node visits, edge inspection, relaxation, distance/parent updates, rejected candidates, frontier meetings, path reconstruction, matrix updates, finish, and negative-cycle detection.

A trace event does not include color, pixel coordinates, React nodes, prose tied to one screen size, or delay. Presentation maps semantic state to visual tokens and narration separately.

The trace is bounded by `maxTraceEvents` (100,000). Exceeding a limit produces a typed recoverable failure, not a truncated trace that could misrepresent the result.

## Replay and timeline

The timeline cursor denotes how many events have been applied. A pure reducer folds events into a snapshot containing the current node/edge, frontier, visited/expanded sets, distances, parents, active matrix data, final path, status, and current explanation inputs.

Controls change only the cursor or autoplay clock:

- next/previous apply or reconstruct the adjacent snapshot;
- scrub selects an exact trace index;
- reset returns to the initial snapshot;
- speed changes event cadence, not algorithm execution; and
- play/pause owns a cancelable timer cleaned up on route/configuration change.

The engine can create periodic immutable snapshots (50 events by default). Seeking chooses the nearest snapshot at or before the requested cursor, clones it, and replays only the remaining suffix. Snapshots are a replay optimization and never become an independent source of truth.

Compare Mode produces one trace per selected algorithm from the same immutable graph/configuration. A shared event index drives the panes. Each pane retains its own event count and metrics; synchronization never fabricates “matching” events across different algorithms.

## Visualization renderer

The main graph renderer uses SVG for roads, directional cues, labels, nodes, hit targets, and final-path overlays. CSS variables/classes encode current, frontier, visited, closed, and path states. Scenario coordinates map through declared camera bounds into the view box, making resizing independent of algorithm data.

DOM controls handle zoom/pan/selection where present; selection resolves an ID back into the derived snapshot. An accessible table/inspector provides the same essential state without requiring SVG navigation. Story Mode may use decorative CSS/SVG animation, but those layers are hidden from assistive technology and reduced under the user's motion preference.

SVG is an intentional v1 fit for bounded teaching graphs. Canvas/WebGL, spatial indexing, and level-of-detail rendering would be required before targeting very large networks.

## Code-line synchronization

Code synchronization has two repository-controlled representations:

- `implementations/line-map.json` maps semantic trace events to conceptual sections and one-based inclusive ranges in the six compile/smoke-checked sources.
- `lib/code-snippets.ts` provides browser-bundled read-only source text and ranges for the `/code` experience.

The lookup is `trace event -> concept -> active language range`. Concepts include priority-queue setup, main loop, neighbor iteration, relaxation, parent update, and reconstruction. Syntax is not aligned by physical line number between languages.

The application never accepts a path, source string, or range from visitor input. CI validates normalized-content SHA-256 values, source line counts, range bounds, and the presence of every event-mapped concept in every language. Changes to standalone sources and line metadata belong in the same review. Keeping the browser bundle mechanically derived from the authoritative sources is a future maintainability improvement; until then, review must keep the UI excerpts semantically aligned.

## State ownership

Route-local React state is sufficient in v1:

- configuration: scenario, algorithm, heuristic, cost metric, language, closures;
- run: result, trace, limit/error status;
- playback: cursor, playing, speed;
- inspection: selected node, open panel/drawer; and
- preference: theme in local storage plus system reduced-motion media query.

Algorithm/scenario data is immutable. Derived snapshots and metrics use memoization where it improves clarity. No remote cache or client database is needed.

## Worker communication and scalability

There is no Web Worker protocol in v1. Computation runs synchronously on the main browser thread under strict graph, Floyd-Warshall, trace, and history ceilings. This keeps the trace engine simple for the shipped small graphs, but JavaScript cannot preempt a synchronous function; the 5,000 ms policy constant is reserved for a future worker deadline and is not an enforced v1 limit.

The next scaling boundary is a dedicated module worker with a small versioned message protocol:

```text
run { requestId, validatedGraph, algorithm, options, budgets }
  -> progress/status (optional and bounded)
  -> success { requestId, result, trace }
  -> failure { requestId, safeCode, safeMessage }
cancel { requestId }
```

The main thread would validate before posting, enforce a wall-clock timeout by terminating the worker, ignore stale request IDs, and validate the returned event envelope. No source code or dynamic module path would cross that boundary.

## Failure model

Expected failures use explicit states: invalid graph/import/share data, incompatible algorithm/heuristic, no route, negative cycle, and graph/trace limits. The workspace keeps controls recoverable and presents what happened, why, and the next action. Unexpected exceptions are contained by route/workspace error boundaries. RouteLab adds no graph-content logging; hosting/runtime error reporting must be configured not to capture scenario data or secrets. A timeout state belongs to the future worker protocol, not the synchronous v1 engine.

## Deployment

`npm run build` invokes `next build` to produce the native Next.js output in `.next/`. `npm run start` serves that production build locally, including during Playwright E2E checks. `vercel.json` selects the Next.js framework preset, `npm ci` for locked installation, and `npm run build` for production builds. The project carries no required environment variables or bindings. Response security headers remain configured in `next.config.ts`, including HSTS for production; Vercel handles TLS termination and delivery.
