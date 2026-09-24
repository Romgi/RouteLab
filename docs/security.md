# Security model

RouteLab treats every value outside the repository as untrusted data. Its central security decision is simple: visitors may describe a bounded graph, but they may not supply behavior.

## Implemented controls

### Data-only imports

Scenario imports are parsed as JSON and passed through the versioned scenario schema before use. Validation covers identifier shape and uniqueness, node and edge references, finite numeric values, coordinates, labels, metadata depth, algorithm compatibility, and graph ceilings. The current limits are defined once in `lib/scenarios/constants.ts`:

| Resource                 |                         Limit |
| ------------------------ | ----------------------------: |
| Import or export payload |                       512 KiB |
| Nodes                    |                           500 |
| Edges                    |                         4,000 |
| Floyd-Warshall nodes     |                            24 |
| Label length             |                 80 characters |
| Trace events             |                       100,000 |
| Animation history        |          50,000 states/events |
| Reserved worker deadline | 5,000 ms (not enforced in v1) |
| Share-state text         |             16,384 characters |

MIME type and `.json` extension are only hints. The object schema is authoritative. Archives, remote URLs, file paths, HTML, SVG, CSS, Markdown, and executable source are not accepted scenario formats.

### No arbitrary execution

- The application does not use `eval`, `Function`, WebAssembly compilation of visitor input, shell commands, dynamic imports selected by a visitor, or executable plugins.
- The code explorer reads only repository-controlled sources represented in the application bundle. It is read-only and is not an online compiler.
- The language smoke tests run in CI against committed files. They are never reachable from a public request.
- Algorithm choice is an allowlisted identifier resolved to a statically imported implementation.

### Cross-site scripting defenses

- React text nodes render imported labels and descriptions; no imported value is inserted through `dangerouslySetInnerHTML`.
- Scenario data cannot contain user-provided HTML, inline styles, event handlers, or SVG markup.
- Code samples are displayed as escaped text.
- URL/search state is validated before it can select a scenario, algorithm, heuristic, or closed edge.
- No arbitrary external SVG or script is rendered.

### Content Security Policy and headers

Production responses configure a same-origin policy and defense-in-depth headers in the application configuration. The intended baseline is:

```text
default-src 'self';
base-uri 'self';
object-src 'none';
frame-ancestors 'none';
form-action 'self';
img-src 'self' data: blob:;
font-src 'self' data:;
connect-src 'self' ws: wss:;
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline';
worker-src 'self' blob:;
manifest-src 'self';
upgrade-insecure-requests
```

The inline script exception is currently required by Next.js's framework-generated React Server Component bootstrap. No visitor-controlled value is interpolated into that bootstrap, and `unsafe-eval` is not allowed. The inline style exception permits framework/React style attributes. These exceptions weaken CSP defense in depth, so removing them through nonce/hash support is tracked as a hardening improvement. WebSocket connections support the local development transport; RouteLab application code does not open arbitrary endpoints. Security review must use a production build.

Additional headers include `X-Content-Type-Options: nosniff`, a restrictive `Referrer-Policy`, a minimal `Permissions-Policy`, cross-origin isolation policies where compatible, and frame denial through CSP. Production-mode responses emit HSTS; browsers apply it only over HTTPS, so a local HTTP production preview does not simulate transport security.

### External requests and SSRF

RouteLab v1 does not fetch a URL supplied by a visitor. Built-in assets and scenarios are bundled with the repository. There is no application proxy, tile relay, link-preview endpoint, webhook, or server-side scenario importer, so untrusted input cannot select a protocol, host, redirect, or internal address.

If map data is introduced later, its server-side fetcher must use a fixed HTTPS origin allowlist, reject credentials and redirects outside that allowlist, enforce time and byte limits, and block private/link-local address ranges after DNS resolution.

### Secrets and environment

- No secret is needed for local or production v1 operation.
- `.env*` files are ignored except `.env.example`.
- A private value must never use a `NEXT_PUBLIC_` name because that prefix deliberately places it in the client bundle.
- CI workflows use no embedded credentials and request read-only repository permissions.
- Errors shown to visitors are normalized messages, not stack traces or server paths.

### Denial-of-service controls

The scenario schema rejects excessive arrays and strings before algorithm execution. Algorithm-specific compatibility rules reject negative weights for Dijkstra/A*, unequal weighted graphs for BFS, and oversized Floyd-Warshall matrices. Runs stop when the trace ceiling is exceeded and report a recoverable error.

Algorithms currently run on the main thread. Limits are preventive bounds, not process isolation: JavaScript cannot preempt a synchronous function at a wall-clock deadline. `maxAlgorithmRuntimeMs` records the intended future worker deadline but is not enforced in v1. The shipped and accepted graph sizes are kept small for this reason. Web Worker isolation with termination is required before substantially increasing limits.

### Dependencies and supply chain

- `package-lock.json` is committed and CI installs with `npm ci`.
- CI runs `npm audit --audit-level=high` after tests and a production build.
- Dependencies are kept narrow; the application does not load runtime code from third-party CDNs.
- GitHub Actions are limited to established setup actions and read-only repository access. A high-assurance deployment should pin actions to reviewed commit SHAs and use automated lockfile update review.
- The six reference implementations compile or run in isolated CI jobs against a fixed shared smoke graph.

## Privacy

RouteLab has no accounts, database writes, advertising, analytics, fingerprinting, or remote scenario upload. Theme preference may be stored in browser local storage. Scenario import, editing, tracing, and export occur locally. Application logs should record aggregate operational failures only and must not include graph contents, labels, share payloads, full IP addresses, or future credentials.

Anyone adding telemetry must make it opt-in or demonstrably privacy-preserving, document retention and processors, avoid importing scenario content, and update both this document and the threat model.

## Security review checklist

Before release:

1. Build the production worker and inspect its response headers.
2. Search for `eval`, `new Function`, `dangerouslySetInnerHTML`, dynamic import paths, and outbound fetches.
3. Test malformed JSON, oversized files, duplicate IDs, dangling edges, `NaN`/infinity encodings, deep objects, and long labels.
4. Confirm no scenario value becomes markup, a URL request, a filesystem path, or a module name.
5. Run dependency audit and review packages with install scripts.
6. Inspect the client bundle for environment names and credential patterns.
7. Exercise graph, Floyd-Warshall, and trace-limit recovery without leaving playback controls in a broken state.

Report vulnerabilities privately to the repository maintainers. Do not include a working exploit or imported personal data in a public issue.
