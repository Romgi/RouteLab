# Threat model

## Scope and security objectives

This model covers the RouteLab browser application, its native Next.js delivery on Vercel, repository-controlled scenarios and source examples, JSON import/export/share state, and the CI pipeline. It excludes the security of a visitor's device, browser extensions, GitHub itself, and the underlying hosting provider except where RouteLab configuration affects them.

The primary objectives are:

1. Never turn visitor-controlled data into executable code or active markup.
2. Keep malformed or adversarial graphs from exhausting ordinary browser resources.
3. Preserve algorithm/result integrity so educational claims are not silently corrupted.
4. Avoid collecting or disclosing personal, imported, or secret data.
5. Deliver only reviewed repository assets and dependencies.

## Protected assets

- Integrity of algorithm implementations, deterministic traces, metrics, and explanations.
- Availability and responsiveness of the UI.
- Confidentiality of locally imported graph data and share payloads.
- Integrity of repository-controlled language examples and line mappings.
- Build and deployment credentials held by GitHub or the hosting platform.
- Trust in the published RouteLab origin and its security headers.

RouteLab does not hold user accounts, payment data, server-side saved graphs, or application secrets in v1.

## Actors

- A normal visitor learning from built-in or self-authored graphs.
- A curious or malicious visitor supplying crafted JSON or URL state.
- A third-party site attempting to frame or script the application.
- A network attacker; production TLS is assumed to be terminated by the hosting platform.
- A compromised dependency, CI action, maintainer account, or build environment.
- A malicious browser extension or compromised visitor device, which is outside application control.

## Trust boundaries and data flow

```text
repository assets -> CI/build -> hosting worker -> browser application
                                                  ^
local JSON file / URL share state / form controls -|
                                                  |
validated graph -> algorithm engine -> trace -> replay/renderer
```

Boundaries:

1. **Repository to build:** source and lockfile become executable assets. Maintainer review and CI protect this boundary.
2. **Hosting to browser:** TLS, CSP, response headers, and same-origin loading protect delivery.
3. **Visitor input to validated model:** strict parsing, schema versioning, allowlists, and size ceilings protect the application.
4. **Graph to algorithm engine:** compatibility checks and finite numeric constraints protect correctness and runtime.
5. **Trace to UI:** typed semantic events and deterministic replay protect state integrity.
6. **Browser to filesystem/clipboard:** import and export are explicit visitor actions; filenames and contents remain data.

There is no v1 trust boundary to a database, authentication provider, analytics service, arbitrary map host, compiler service, or user-selected backend.

## Entry points

- Scenario JSON selected through the file picker.
- Compact scenario/settings state in the application URL.
- Custom graph form fields and node/edge pointer interactions.
- Scenario, algorithm, heuristic, travel-cost, speed, and playback controls.
- Clipboard copy and local JSON download.
- HTTP route and static-asset requests.
- Package updates, pull requests, workflow changes, and deployment configuration.

## Threats and mitigations

| Threat                                 | Example                                                       | Primary mitigations                                                                                      | Residual risk                                                           |
| -------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Script/markup injection                | A label contains HTML, an event handler, or SVG               | JSON schema; text rendering; no unsafe HTML; restrictive origins and no `unsafe-eval`                    | Framework-required CSP inline-script allowance reduces defense in depth |
| Arbitrary code execution               | Imported "algorithm" or source is evaluated                   | Algorithms are static allowlists; code viewer is read-only; no eval/compiler/plugin endpoint             | Repository or dependency compromise remains privileged                  |
| Prototype/object abuse                 | Crafted JSON includes unexpected nested keys                  | Strict schemas, bounded plain metadata, own-property access, no merge into executable config             | JavaScript library bugs are possible                                    |
| Resource exhaustion                    | Huge graph, dense matrix, enormous labels, or event explosion | Byte/array/string ceilings; algorithm compatibility; Floyd-Warshall cap; trace/history limits            | Main-thread work has no enforceable wall-clock deadline                 |
| Numeric corruption                     | `NaN`, infinity, unsafe magnitude, negative Dijkstra edge     | Finite/safe-range validation and per-algorithm preconditions                                             | Floating-point rounding can affect near-equal costs                     |
| Dangling or ambiguous graph references | Duplicate node IDs or edge to a missing node                  | Whole-object referential-integrity validation                                                            | None known after validation                                             |
| URL amplification                      | Very large encoded scenario degrades navigation/history       | Share-text ceiling; fall back to local file export                                                       | Browser/address-bar limits vary                                         |
| SSRF                                   | Import references an internal or arbitrary URL                | No user-directed fetch or proxy exists                                                                   | Future map support must add an allowlisted fetch design                 |
| Clickjacking                           | A hostile site frames controls                                | `frame-ancestors 'none'` CSP                                                                             | Misconfigured host headers can weaken this                              |
| Cross-origin data leakage              | Referrer or connection exposes share state                    | restrictive referrer policy and `connect-src`; no telemetry                                              | URLs can still be copied or included in visitor screenshots/history     |
| Data retention                         | Imported graph appears in logs or a database                  | Local-only processing; no app persistence; logging policy excludes contents                              | Browser history/clipboard/storage are controlled by the visitor/device  |
| Dependency compromise                  | Malicious npm update or action exfiltrates build credentials  | lockfile, `npm ci`, audit, minimal permissions, dependency review                                        | Version-tagged actions and install scripts are supply-chain risk        |
| Source/line-map tampering              | Viewer highlights unrelated code                              | repository review; CI line-range validation; compiled smoke samples                                      | Range validation proves bounds, not semantic equivalence                |
| Algorithm integrity failure            | Incorrect result is presented as optimal                      | deterministic fixtures, cross-algorithm properties, known expected costs, trace/result consistency tests | Testing cannot prove every implementation for every graph               |
| Error information disclosure           | Raw stack or filesystem path reaches UI                       | error normalization and production-mode verification                                                     | Hosting platform failures may have their own error pages                |

## Abuse cases

### Malicious import

An attacker selects a 20 MB file containing deep objects, duplicate IDs, enormous strings, and an HTML label. The byte check rejects the file before full application processing. If within the byte cap, strict parsing rejects structure, bounds, or references. If valid text contains HTML characters, React displays those characters as text.

### Algorithmic complexity attack

An attacker creates the densest graph the schema allows and selects Floyd-Warshall. Compatibility validation rejects matrices above 24 nodes. Other runs are constrained by graph and trace ceilings. Synchronous main-thread execution cannot be forcibly terminated and has no wall-clock guard, so the residual UI-stall window is documented and limits must not be increased before worker isolation exists.

### Source execution attempt

An attacker pastes JavaScript into a node label or changes a URL field to resemble a module path. Neither value reaches an execution API: labels are text and selectable identifiers must match static enums. The six language examples cannot be edited or run from a web request.

### Privacy leak through sharing

A visitor includes confidential text in a graph label and copies a share URL. RouteLab does not transmit it itself, but URLs can enter browser history, chat logs, referrer data, or screenshots. The interface and documentation treat sharing as an explicit disclosure and recommend file export for sensitive or large graphs. Future server-side sharing would require a new privacy and authorization model.

## Residual risks and accepted limitations

- Main-thread algorithms enforce structural/trace checks but provide neither process isolation nor wall-clock preemption.
- A valid graph near the maximum can be expensive on low-powered mobile hardware.
- `script-src 'unsafe-inline'` is currently required for the framework-generated RSC bootstrap; visitor data is not interpolated, but nonce/hash support would provide stronger defense in depth.
- `style-src 'unsafe-inline'` supports framework/React styling; eliminating the style exception would improve CSP further.
- Browser local storage, history, downloads, and clipboard contents inherit the security of the visitor's device.
- npm packages, GitHub Actions, and maintainer credentials remain supply-chain trust anchors.
- Floating-point implementations can choose different equal/near-equal paths across languages; correctness is defined by valid path cost, not byte-identical output beyond deterministic fixtures.

## Review triggers

Revisit this threat model before adding any of the following:

- Web Workers that accept serialized messages or load modules.
- Server-side persistence, share links, collaboration, accounts, or analytics.
- Real map providers, arbitrary network requests, uploads, archives, Markdown, or external SVG.
- User-authored algorithms, plugins, compilers, WebAssembly, or sandbox execution.
- Increased graph/trace limits or long-running benchmarks.
- Authentication, authorization, billing, or personal data.
