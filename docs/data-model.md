# Data model and serialization

RouteLab separates durable scenario data, normalized algorithm input, deterministic trace events, and derived playback state. This prevents presentation state from leaking into correctness-critical code.

## Scenario envelope

`Scenario` is the versioned unit used by the built-in library, custom generators, file import/export, and embedded share state.

| Field                                       | Meaning                                                        |
| ------------------------------------------- | -------------------------------------------------------------- |
| `schemaVersion`                             | Literal `1`; other versions are rejected rather than guessed   |
| `id`, `name`, `description`, `category`     | Stable identity and educational context                        |
| `graph`                                     | Arrays of nodes and edges                                      |
| `startId`, `goalId`                         | Existing node identifiers                                      |
| `defaultAlgorithms`                         | Initial compatible selections                                  |
| `supportedAlgorithms`                       | Explicit scenario compatibility allowlist                      |
| `allowedHeuristics`, `defaultHeuristic`     | Heuristic compatibility and initial selection                  |
| `availableCostMetrics`, `defaultCostMetric` | `weight`, `distance`, and/or `travelTime`                      |
| `cameraBounds`                              | Finite coordinate extent and padding                           |
| `learningObjectives`                        | Plain-text explanations                                        |
| `seed`                                      | Unsigned 32-bit deterministic generator seed                   |
| `expectedOptimalCost`, `expectedCosts`      | Optional correctness oracles for known fixtures                |
| `maxGraphSize`                              | A per-scenario ceiling that may be stricter than global limits |
| `editableEdgeIds`                           | Existing mutable edges that the UI may close/reopen            |

Schemas are strict: unknown object keys fail validation. The authoritative definitions are in `lib/scenarios/types.ts`, `lib/scenarios/validation.ts`, and `lib/scenarios/constants.ts`.

## Node

Each node contains:

- a safe unique `id` of at most 64 characters;
- a single-line plain-text `label` of at most 80 characters;
- finite `x` and `y` visualization coordinates;
- a `nodeType` from the fixed scenario vocabulary;
- optional latitude and longitude, which must occur together; and
- optional flat metadata with bounded safe keys and primitive JSON values.

Latitude and longitude are required on every node when the geographic heuristic is enabled. Metadata cannot contain nested objects, arrays, executable values, reserved prototype property names, or unbounded text.

## Edge

An edge contains a unique `id`, existing `fromId` and `toId`, finite `weight`, and a `directed` flag. Optional fields describe alternate costs and display semantics:

- `distance` and `travelTime` are nonnegative finite costs;
- `roadType`, `speed`, `toll`, `terrainMultiplier`, and `safetyMultiplier` describe the travel model;
- `closed` removes the edge from traversal;
- `mutable` and scenario `editableEdgeIds` permit UI closure controls;
- `label` and flat metadata remain plain data.

Self-edges are rejected. A bidirectional edge is represented once with `directed: false` in scenario JSON and is exposed as two traversal directions when the algorithm adjacency is built. Directed edges are exposed only from `fromId` to `toId`. Reverse traversal for bidirectional search uses an explicit reverse adjacency, so one-way semantics are preserved.

The selected cost/travel model determines traversal cost. A scenario can expose direct metrics appropriate to its edges. Closed edges never appear in a returned path.

### Cost and travel models

The scenario schema uses `weight`, `distance`, and `travelTime` as serializable metric names. The algorithm engine maps those to `weight`, `distance`, and `travel-time` and also supports derived teaching models:

| Engine model  | Edge cost                                                                                                  |
| ------------- | ---------------------------------------------------------------------------------------------------------- |
| `weight`      | `edge.weight`                                                                                              |
| `distance`    | `edge.distance`, falling back to weight                                                                    |
| `travel-time` | explicit travel time; otherwise `distance / speed * 60`; otherwise weight                                  |
| `hops`        | `1` for every traversable edge                                                                             |
| `avoid-tolls` | weight plus 1,000 by default when `toll` is true                                                           |
| `cycling`     | `(distance or weight) * terrainMultiplier * safetyMultiplier`, with an additional factor of 3 for highways |

Fallbacks keep repository fixtures usable, but the interface explains when a model uses simulated/derived rather than real travel data. The toll penalty is configurable in engine options; it is not a monetary amount.

## Compatibility invariants

Whole-object validation enforces invariants that field schemas alone cannot express:

- node and edge IDs are unique;
- every edge endpoint and start/goal ID exists;
- default algorithms are a subset of supported algorithms;
- default heuristic and cost metric belong to their respective allowlists;
- nodes lie within valid camera bounds;
- editable IDs name edges marked mutable;
- BFS is enabled only when all open edge weights are equal;
- Dijkstra, A*, Greedy best-first, and bidirectional Dijkstra are disabled when an open edge is negative; and
- Floyd-Warshall is disabled above 24 nodes.

Algorithm execution performs its own defensive precondition checks as well. UI disabling is guidance, not the security boundary.

## Trace events

Algorithm execution returns an ordered sequence of semantic events rather than animation instructions. Events identify graph entities by ID and contain the values needed to reproduce state. The event vocabulary covers:

- initialization and frontier enqueue/dequeue;
- node visits and edge inspection;
- candidate relaxation, distance update, and parent update;
- rejected candidates and reasons;
- forward/backward frontier meetings;
- Floyd-Warshall intermediate/matrix updates;
- path reconstruction, completion, and negative-cycle detection.

Events never contain DOM nodes, React elements, timers, colors, animation durations, or mutable graph references. This keeps traces serializable in principle and makes replay deterministic.

## Run result

A completed run couples the trace with correctness and instrumentation data:

- algorithm, heuristic, scenario, and cost metric identifiers;
- whether a path was found;
- ordered path node and edge IDs plus total cost;
- nodes visited/expanded, edges inspected, relaxations, queue pushes/pops, and maximum frontier size;
- algorithm execution time and trace-event count; and
- a correctness status when an expected cost or independent invariant is available.

Execution time ends before animation begins. Playback duration and rendered frame rate are UI measurements, not algorithm metrics.

## Playback state

The timeline index is a cursor into an immutable trace. Replay derives sets/maps such as visited nodes, frontier membership, current node/edge, distances, parents, matrix cells, final path, and narration. Selected node, panel state, playback speed, and theme are UI state and do not belong to the algorithm result.

Moving backward reconstructs state from the same ordered events; it does not invoke a reverse algorithm. Restart moves the cursor to the initial state without generating a different trace.

## Import and export

`parseScenarioJson` and `importScenarioJson` apply this order:

1. Check `.json`/JSON MIME hints when supplied.
2. Decode bytes as strict UTF-8.
3. Enforce the 512 KiB byte limit.
4. Parse JSON.
5. Reject non-plain/cyclic/deep containers when validating in-memory values.
6. Validate the complete versioned scenario and cross-field invariants.

`exportScenarioJson` revalidates, recursively sorts object keys for canonical output, emits UTF-8 JSON, and enforces the export byte limit. Export does not serialize current animation state.

## Share state

Compact share state contains exactly one built-in `scenarioId` or an embedded validated `scenario`, plus optional algorithm, heuristic, cost metric, and closed-edge IDs. Encoding uses the `rl1.` prefix followed by base64url-encoded compact JSON. It is versioned and limited to 16,384 characters.

Base64url is transport encoding, not encryption. Anyone who receives a share string can decode labels and graph data. Sensitive graph content should not be placed in a URL; use local JSON export and an appropriate secure transfer channel instead.

## Determinism

Generators accept an explicit unsigned seed and use the repository's seeded pseudo-random generator. For a given generator version, seed, dimensions/count, density, and weight options, node/edge ordering and values are stable. Determinism is intentionally scoped to a generator version: a future algorithm change that improves generation must be released as a documented schema/generator change rather than silently altering existing fixtures.
