# RouteLab

RouteLab is an interactive, trace-driven pathfinding studio. It turns real graph-search executions into a timeline that can be played, paused, stepped, rewound, scrubbed, inspected, and compared—without mixing animation logic into the algorithms.

The application is an educational simulator, not a navigation service. Its built-in road speeds, terrain costs, and routes are deterministic teaching fixtures rather than live travel data.

## Product surfaces

- **Story Mode (`/`)** introduces graphs, route objectives, search strategies, source concepts, scenarios, and trace architecture through responsive interactive demonstrations.
- **Algorithm Lab (`/lab`)** runs one of seven algorithms with scenario, cost-model, heuristic, language, closure, speed, and timeline controls. It includes metrics, frontier/current-event inspection, node details, and an accessible graph table.
- **Compare Mode (`/compare`)** synchronizes two to four compatible algorithms on the same graph and playback clock (two lanes by default).
- **Code Explorer (`/code`)** presents curated read-only Dijkstra excerpts in six languages with conceptual line highlighting, copy, and download actions.
- **Documentation (`/docs`)** provides an in-product guide; the [`docs/`](docs/) directory contains the detailed engineering reference.

Custom work stays local to the browser: users can generate seeded grid/random graphs, add or remove nodes, edit labels/coordinates, add directed or two-way weighted edges, choose start/goal, toggle roads, import validated RouteLab JSON, export canonical JSON, and copy bounded share data. Imported content is data only and is never executed.

## Highlights

- Seven real algorithms with deterministic semantic traces
- Twelve purpose-built scenarios plus seeded generators
- Play, pause, previous, next, reset, speed, keyboard shortcuts, and arbitrary timeline scrub
- Synchronized comparison with real path and operation metrics
- Travel models for weight, distance, travel time, hops, toll avoidance, and cycling where supported
- Safe road-closure experiments and clear no-path/negative-cycle outcomes
- TypeScript, Python, Java, C++, Go, and Rust Dijkstra references
- Dark/light themes, reduced-motion behavior, visible focus, live status, and nonvisual graph data
- Strict Zod schemas, hard graph/trace/import limits, CSP/security headers, and no arbitrary URL fetching
- npm lockfile and GitHub Actions coverage for formatting, lint, strict types, tests, build, dependency audit, E2E, and six language toolchains

## Quick start

Requirements:

- Node.js 22.13 or newer
- npm (the committed `package-lock.json` is authoritative)

```bash
npm ci
npm run dev
```

Open the local URL printed by vinext. No database, account, API key, or environment variable is required.

### Production build

```bash
npm run build
npm run start
```

`vinext` and Vite produce the Cloudflare-compatible worker build. Production response headers include CSP, content-type sniffing protection, referrer/permissions policies, cross-origin policies, and HSTS on production builds.

## Development commands

| Command                | Purpose                                         |
| ---------------------- | ----------------------------------------------- |
| `npm run dev`          | Start vinext/Vite development mode              |
| `npm run build`        | Build the production worker and assets          |
| `npm run start`        | Serve the production build locally              |
| `npm run format`       | Format supported repository files with Prettier |
| `npm run format:check` | Check formatting without modifying files        |
| `npm run lint`         | Run ESLint                                      |
| `npm run typecheck`    | Run strict TypeScript checking                  |
| `npm test`             | Run Vitest unit and integration tests once      |
| `npm run test:watch`   | Run Vitest in watch mode                        |
| `npm run test:e2e`     | Run Playwright end-to-end tests                 |

Append `?debug=1` to `/lab` during development to reveal frame timing, trace generation, replay, graph-size, history, and execution-boundary diagnostics. The panel is absent from ordinary production visits.

For a first local E2E run, install the selected browser once:

```bash
npx playwright install chromium
npm run test:e2e
```

The CI type-check step invokes `npx tsc --noEmit` directly and installs dependencies with `npm ci`.

## Supported algorithms

| Algorithm              | Valid input                                         | Guarantee                                          |
| ---------------------- | --------------------------------------------------- | -------------------------------------------------- |
| Breadth-first search   | Equal-cost traversable edges                        | Minimum number of edges                            |
| Dijkstra               | Nonnegative edge costs                              | Minimum total cost                                 |
| A*                     | Nonnegative costs and scenario-compatible heuristic | Minimum cost when the heuristic is admissible      |
| Greedy best-first      | Heuristic-enabled scenario                          | No general optimality guarantee                    |
| Bidirectional Dijkstra | Nonnegative costs; directed reverse adjacency       | Minimum total cost                                 |
| Bellman-Ford           | Negative edges permitted                            | Minimum cost or reachable negative-cycle report    |
| Floyd-Warshall         | Small graphs (24-node ceiling)                      | All-pairs minimum costs or negative-cycle evidence |

A* supports zero, Manhattan, Euclidean, and geographic heuristics when a scenario allows them. Zero visibly reduces A* to Dijkstra. See [algorithm guarantees](docs/algorithms.md) for invariants, complexity, and compatibility rules.

## Scenario library

The repository provides deterministic educational fixtures for:

1. Uniform city grid
2. Highway versus local roads
3. Weighted terrain
4. Deterministic maze
5. One-way downtown
6. Dynamic road closures
7. Dense urban network
8. Sparse rural network
9. Misleading heuristic
10. No available path
11. Negative edge and optional negative-cycle demonstration
12. All-pairs distance matrix

Every generated scenario carries its seed. The same generator version, options, and seed produce the same graph and ordering.

## Architecture

```text
validated scenario
  -> framework-independent algorithm
  -> immutable result + semantic trace + metrics
  -> deterministic timeline replay
  -> SVG, inspector, graph table, narration, and code concept
```

Routes and components use React state; algorithms and scenarios below `lib/` do not depend on React or browser rendering. Algorithm duration is captured before playback, so changing animation speed cannot change a benchmark result.

The application uses:

- Next.js 16 App Router APIs through vinext/Vite
- React 19 and strict TypeScript
- Tailwind/PostCSS plus a custom tokenized responsive design system
- Zod for runtime validation
- native SVG/CSS for graph and Story presentation
- Vitest and Playwright for automated verification
- the Cloudflare Vite plugin for the deployable worker

The first release deliberately avoids a global state dependency, animation framework, database, and client code editor because the bounded product does not require them. See [architecture](docs/architecture.md), [animation system](docs/animation-system.md), and [data model](docs/data-model.md).

## Project structure

```text
app/                    App Router pages, metadata, and layout
components/             Story, Lab, Compare, Code, Docs, and shared UI
lib/algorithms/          algorithms, trace types, metrics, and replay
lib/scenarios/           strict schemas, fixtures, generators, serialization
lib/code-snippets.ts     curated browser-bundled source excerpts
implementations/         authoritative compile-checked Dijkstra sources/line map
docs/                   architecture, behavior, security, and operations
tests/                   unit/integration/rendered-route tests
e2e/                     Playwright product-flow tests
.github/workflows/       locked-install CI and language smoke checks
worker/                  vinext/Cloudflare worker entry
```

## Trusted language implementations

Authoritative standalone Dijkstra implementations live in:

- [`implementations/typescript/dijkstra.ts`](implementations/typescript/dijkstra.ts)
- [`implementations/python/dijkstra.py`](implementations/python/dijkstra.py)
- [`implementations/java/Dijkstra.java`](implementations/java/Dijkstra.java)
- [`implementations/cpp/dijkstra.cpp`](implementations/cpp/dijkstra.cpp)
- [`implementations/go/dijkstra.go`](implementations/go/dijkstra.go)
- [`implementations/rust/dijkstra.rs`](implementations/rust/dijkstra.rs)

[`implementations/line-map.json`](implementations/line-map.json) maps trace concepts to one-based inclusive ranges. CI verifies content hashes/ranges and compiles or runs all six toolchains against the same smoke graph. The browser's curated excerpts are presentation assets; visitor input cannot select a filesystem path, edit an implementation, or execute code. Language-specific local commands are documented in [`implementations/README.md`](implementations/README.md).

## Benchmarking

RouteLab exposes measured run duration plus deterministic operation counts: visited/expanded nodes, inspected edges, relaxations, queue operations, frontier maximum, trace length, path cost, and outcome. It stores no fabricated benchmark table.

Use a production build for observations:

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run start
```

Open `/compare`, keep scenario/seed/endpoints/cost/closures identical, warm the page once, and compare correctness and operation counts before wall-clock timing. V1 has no standalone `npm run benchmark` corpus; [the benchmarking guide](docs/benchmarking.md) explains repetition, environment reporting, noise, and interpretation.

## Security and privacy

- Imports are strict schema-versioned JSON with a 512 KiB ceiling, finite numbers, plain-text labels, unique safe IDs, valid references, bounded metadata, and graph-specific limits.
- RouteLab never uses `eval`, `new Function`, visitor-selected dynamic imports, executable plugins, a compiler service, or user-directed server fetches.
- The code viewer displays repository-controlled text only.
- CSP forbids `unsafe-eval`, objects, framing, and off-origin HTTP data connections. WebSocket schemes remain available for framework tooling. Next/vinext currently requires a documented inline bootstrap exception; imported values are never interpolated into it.
- No account, analytics, server-side graph storage, or secret is required. Imported graphs remain on the device unless the visitor explicitly shares/downloads them.
- Share strings are encoded, not encrypted; do not put confidential graph labels in a URL.

Read [security controls](docs/security.md) and the [threat model](docs/threat-model.md) before changing imports, network behavior, persistence, limits, or rendering sinks.

## Accessibility

Core workflows use native controls and semantic landmarks with a skip link, visible focus, redundant graph-state encodings, a text/table alternative to SVG, current-event narration, and pausable playback. `prefers-reduced-motion` removes nonessential movement without hiding algorithm state. Lab playback is available through both labeled controls and documented keyboard shortcuts.

The target is WCAG 2.2 AA, but that target is not a certification. Chromium E2E coverage is supplemented by the manual screen-reader, zoom, contrast, reduced-motion, and cross-browser checks in [the accessibility guide](docs/accessibility.md).

## Reproducible screenshots and demo media

Stable desktop and mobile visual-regression baselines are committed under `tests/e2e/visual.spec.ts-snapshots/`. Regenerate them only from the exact commit being published. In the first terminal:

```bash
npm run build
npm run start
```

In a second terminal (replace port 3000 if the server prints another URL):

```bash
node -e "require('fs').mkdirSync('docs/media',{recursive:true})"
npx playwright screenshot --browser=chromium --viewport-size="1440,1000" --full-page http://127.0.0.1:3000/ docs/media/story.png
npx playwright screenshot --browser=chromium --viewport-size="1440,1000" --full-page http://127.0.0.1:3000/lab docs/media/lab.png
npx playwright screenshot --browser=chromium --viewport-size="390,844" --full-page http://127.0.0.1:3000/lab docs/media/lab-mobile.png
```

For an animated demo, record a production session that selects a scenario, plays Dijkstra, pauses/steps, scrubs backward, and opens Compare Mode. Keep the clip under a minute, include captions, avoid rapid flashing, and provide equivalent alt text/transcript in the release notes. Do not present Story Mode's curated explanatory animation as benchmark evidence.

## Known limitations

- Algorithms execute synchronously on the main browser thread. Strict graph, Floyd-Warshall, trace, and history limits protect ordinary educational use, but v1 has no enforceable wall-clock deadline or Web Worker termination boundary and is not suitable for large road networks.
- The code explorer is a lightweight read-only viewer, not Monaco, an IDE, or an online compiler.
- Six-language parity currently covers Dijkstra. The interactive TypeScript engine implements all seven algorithms.
- Custom tooling supports node and edge creation/deletion, coordinate-based node movement, endpoint selection, mutable closures, safe import/export, and seeded generation; it is not a GIS editor or unconstrained drag-and-drop authoring suite.
- Per-run instrumentation is available, but there is no headless statistical benchmark runner or committed benchmark dataset.
- Real maps, live traffic, geocoding, routing directions, user accounts, cloud saves, and collaboration are not included.
- Browser automation in CI uses selected Chromium flows. Firefox/WebKit, assistive technology, and touch behavior require manual release verification.
- Framework-generated inline script/style bootstrap requires CSP `unsafe-inline`; `unsafe-eval` remains forbidden. Nonce/hash-based CSP is a future hardening target.

## Future improvements

- Move algorithm execution to a versioned Web Worker protocol with hard cancellation and memory/runtime telemetry.
- Generate browser code excerpts mechanically from the authoritative language files and line map.
- Add a headless benchmark runner with warm-up, repetitions, raw JSON output, and environment metadata.
- Expand property-based and cross-browser visual/accessibility coverage.
- Add direct drag-and-drop node movement only after equivalent keyboard and touch semantics are designed.
- Consider a small licensed static map fixture without introducing arbitrary URL fetching or private map keys.

## License and attribution

RouteLab is available under the [MIT License](LICENSE). The interface uses trusted operating-system sans and monospace font stacks and loads no third-party font scripts or runtime assets; framework and library dependencies retain their own licenses. The product includes no third-party map tiles, live traffic feed, or external geographic dataset, so no map-provider attribution is required in v1.
