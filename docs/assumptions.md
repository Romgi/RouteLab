# Engineering assumptions

This document records the decisions used to turn the broad RouteLab product brief into the repository's first production-shaped release. It describes implemented scope, not aspirational behavior.

## Repository and platform

- Native Next.js builds support Vercel hosting. The original Sites/Cloudflare adapter has been removed; Vite remains only as the underlying tool for Vitest tests.
- npm is the package manager because the repository arrived with `package-lock.json`. CI uses `npm ci`; adding a second lockfile would reduce reproducibility.
- Node.js 22.13 or newer is the supported development runtime, matching `package.json`.
- The application is client-first and does not need a database, object storage, authentication, server persistence, or private environment variables in v1.
- Routes remain inside the existing top-level `app/` structure instead of introducing a monorepo. Domain code is separated below `lib/`, reusable presentation is below `components/`, and trusted teaching sources are below `implementations/`.

## Product scope

- RouteLab is an educational simulator, not a navigation service. Costs and speeds in built-in scenarios are illustrative and must not be used for travel decisions.
- Built-in scenarios are repository-controlled and deterministic. Generated scenarios require an explicit integer seed.
- A run operates on an immutable normalized graph. Closing an edge or changing an objective creates a new run rather than mutating a trace already in playback.
- Equal-cost alternatives are valid. Stable input order and queue tie-breakers make the selected path reproducible, but the UI does not imply that it is the only shortest path.
- Real-world map tiles, live traffic, geocoding, turn-by-turn navigation, accounts, collaboration, and cloud-saved graphs are outside v1.

## Execution and animation

- Algorithms run synchronously on the browser main thread in v1. They emit complete deterministic traces before playback begins.
- Web Workers are intentionally not added in v1. The validator, algorithm compatibility rules, graph-size ceilings, Floyd-Warshall cap, and trace-event limit bound ordinary runs. The 5,000 ms scenario constant reserves a future worker deadline; it is not enforceable by the synchronous v1 engine. This is an explicit scalability limitation, not a claim that main-thread execution is appropriate for large road networks.
- Trace generation time and animation time are separate measurements. Playback speed never changes the reported algorithm duration.
- The renderer favors semantic SVG and ordinary DOM controls for clarity, responsive scaling, and accessible fallbacks. It is designed for the bounded educational graphs shipped here, not million-edge datasets.
- Timeline replay derives visual state from semantic events. It never changes algorithm decisions and does not rerun the algorithm for each animation frame.

## Code explorer

- Monaco is intentionally not bundled in v1. RouteLab uses a lightweight, read-only code presentation so the initial application remains small and compatible with the restrictive execution model.
- The six files in `implementations/` are trusted repository assets. They demonstrate Dijkstra in TypeScript, Python, Java, C++, Go, and Rust; they are never compiled or executed in a visitor's browser.
- `implementations/line-map.json` is versioned alongside those sources and uses one-based, inclusive line ranges. CI rejects stale or out-of-bounds mappings.
- Cross-language examples intentionally share algorithmic invariants rather than identical APIs or numeric types. Rust uses nonnegative integer weights; the other samples use finite floating-point weights.

## Custom and shared data

- Imported scenarios are JSON data only. The browser reads them locally; no upload is required.
- Version 1 accepts only schema version 1 and rejects unknown fields, non-finite values, dangling references, duplicate identifiers, incompatible algorithms, and configured size-limit violations.
- Imported labels are plain text. They are never interpreted as HTML, CSS, Markdown, URLs, module names, or code.
- Share state is intended for compact bounded scenarios and settings. Oversized state is exported as a file rather than forced into a URL.

## Benchmarks

- Browser timing is useful for comparing algorithms on the same graph in the same session. It is not a stable cross-device score.
- No benchmark values are checked into the repository. Results are measured from real runs and include graph/seed/configuration context.
- Animation, rendering, framework startup, and network time are excluded from algorithm execution time.
- A dedicated headless benchmark corpus and statistically rigorous CLI runner are future work; v1 exposes per-run instrumentation and correctness tests.

## Accessibility and browser support

- Core controls must work with keyboard, pointer, and touch without relying on hover.
- Reduced-motion preferences disable or simplify nonessential motion; manual playback remains available because state changes still need to be understandable.
- SVG is supplementary. Text metrics, live status, inspector state, and a graph-data alternative carry the same essential information.
- Current stable Chromium, Firefox, and WebKit are the browser targets. Older browsers may receive the functional layout without decorative motion.

## Security and privacy

- No arbitrary code execution, user-selected URL fetching, executable plugins, online compiler, or general-purpose proxy is part of RouteLab.
- The application collects no personal information, has no analytics by default, and does not persist imported graphs on a server.
- No secret is required by v1. `.env.example` deliberately contains no credential-shaped dummy value that could be mistaken for a working key.
- Dependency, browser, and hosting security remain shared responsibilities; the repository controls application behavior and headers, while the deployment platform controls TLS termination and infrastructure isolation.
