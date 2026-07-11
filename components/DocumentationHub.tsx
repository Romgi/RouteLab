import Link from "next/link";

const algorithms = [
  [
    "Breadth-first search",
    "O(V + E)",
    "Unweighted only",
    "Shortest by edge count",
  ],
  ["Dijkstra", "O((V + E) log V)", "Nonnegative costs", "Optimal"],
  [
    "A*",
    "O((V + E) log V)*",
    "Admissible heuristic",
    "Optimal when admissible",
  ],
  [
    "Greedy best-first",
    "O((V + E) log V)",
    "Heuristic available",
    "Not guaranteed",
  ],
  [
    "Bidirectional Dijkstra",
    "O((V + E) log V)",
    "Nonnegative costs",
    "Optimal",
  ],
  [
    "Bellman–Ford",
    "O(VE)",
    "Negative edges allowed",
    "Optimal or negative cycle",
  ],
  ["Floyd–Warshall", "O(V³)", "Small graphs", "All-pairs optimal"],
];

const traceEvents = [
  ["initialize", "Creates the start state, distance map, and frontier."],
  [
    "enqueue / dequeue",
    "Records frontier changes and deterministic priorities.",
  ],
  ["inspectEdge", "Marks the candidate edge currently under consideration."],
  ["relaxEdge", "Compares a candidate route with the best known distance."],
  ["updateDistance / setParent", "Persists the improved cost and predecessor."],
  ["reconstructPath", "Emits the final connected route from start to goal."],
  ["finish", "Reports path cost, outcome, and aggregate run metrics."],
];

export function DocumentationHub() {
  return (
    <div className="docs-page">
      <section className="page-intro shell docs-intro">
        <span className="section-number">RouteLab documentation / v1</span>
        <div className="page-intro-grid">
          <h1>
            Understand the
            <br />
            <em>whole trace.</em>
          </h1>
          <div>
            <p>
              Architecture, algorithm guarantees, keyboard controls, and safety
              boundaries for an inspectable pathfinding laboratory.
            </p>
            <Link className="button button-primary" href="/lab">
              Open the lab <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      <div className="docs-layout shell">
        <aside className="docs-nav">
          <span>On this page</span>
          <nav aria-label="Documentation sections">
            <a href="#mental-model">Mental model</a>
            <a href="#trace-architecture">Trace architecture</a>
            <a href="#algorithms">Algorithms</a>
            <a href="#controls">Controls</a>
            <a href="#data-model">Data model</a>
            <a href="#security">Security</a>
            <a href="#accessibility">Accessibility</a>
          </nav>
          <div className="docs-version">
            <span>Build profile</span>
            <strong>RouteLab 1.0</strong>
            <small>Deterministic · client-side</small>
          </div>
        </aside>

        <article className="docs-content">
          <section id="mental-model">
            <span className="doc-index">01</span>
            <h2>Mental model</h2>
            <p className="doc-lead">
              RouteLab separates finding a route from showing how that route was
              found.
            </p>
            <p>
              A graph contains nodes and directed edges. Each edge exposes one
              or more finite costs—weight, distance, or travel time. A run
              selects a start, goal, cost model, algorithm, and optional
              heuristic. The algorithm returns both a result and an ordered
              semantic trace.
            </p>
            <div
              className="flow-diagram"
              aria-label="Scenario flows to algorithm, trace replay, then visualization and inspector"
            >
              <div>
                <span>01</span>
                <strong>Scenario</strong>
                <small>validated graph</small>
              </div>
              <i>→</i>
              <div>
                <span>02</span>
                <strong>Algorithm</strong>
                <small>pure execution</small>
              </div>
              <i>→</i>
              <div>
                <span>03</span>
                <strong>Trace</strong>
                <small>semantic events</small>
              </div>
              <i>→</i>
              <div>
                <span>04</span>
                <strong>Replay</strong>
                <small>UI state</small>
              </div>
            </div>
            <div className="callout">
              <strong>Key distinction</strong>
              <p>
                Algorithm execution time is measured independently from
                animation duration. Playback speed never changes the algorithm
                result.
              </p>
            </div>
          </section>

          <section id="trace-architecture">
            <span className="doc-index">02</span>
            <h2>Trace architecture</h2>
            <p>
              Every event carries enough information to replay state, explain
              the current decision, and associate it with a conceptual
              source-code section. Timeline navigation folds events into an
              inspectable snapshot.
            </p>
            <div
              className="trace-table"
              role="table"
              aria-label="Semantic trace events"
            >
              {traceEvents.map(([event, meaning]) => (
                <div role="row" key={event}>
                  <code role="cell">{event}</code>
                  <span role="cell">{meaning}</span>
                </div>
              ))}
            </div>
          </section>

          <section id="algorithms">
            <span className="doc-index">03</span>
            <h2>Algorithm guarantees</h2>
            <p>
              Compatibility is enforced before a run. BFS is limited to
              equal-cost graphs, Dijkstra-family searches reject negative
              weights, and Floyd–Warshall is capped to small graphs.
            </p>
            <div className="docs-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Algorithm</th>
                    <th>Time</th>
                    <th>Requirement</th>
                    <th>Guarantee</th>
                  </tr>
                </thead>
                <tbody>
                  {algorithms.map((row) => (
                    <tr key={row[0]}>
                      {row.map((cell) => (
                        <td key={cell}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="equation">
              <code>f(n) = g(n) + h(n)</code>
              <p>
                For A*, <strong>g</strong> is cost already paid and{" "}
                <strong>h</strong> estimates what remains. A zero heuristic
                visibly reduces A* to Dijkstra.
              </p>
            </div>
          </section>

          <section id="controls">
            <span className="doc-index">04</span>
            <h2>Playback controls</h2>
            <p>
              The Lab keeps every primary action available by pointer and
              keyboard. Form fields use native controls and the graph has a
              structured nonvisual alternative.
            </p>
            <div className="shortcut-grid">
              {[
                ["Space", "Play or pause"],
                ["→", "Next event"],
                ["←", "Previous event"],
                ["Home", "Restart trace"],
                ["End", "Jump to result"],
                ["R", "Restart playback"],
                ["?", "Open keyboard help"],
              ].map(([key, label]) => (
                <div key={key}>
                  <kbd>{key}</kbd>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </section>

          <section id="data-model">
            <span className="doc-index">05</span>
            <h2>Scenario data model</h2>
            <p>
              Imports accept JSON data only. A scenario declares its schema
              version, bounded nodes and edges, explicit start and goal IDs,
              deterministic seed, compatibility metadata, and learning
              objectives. The fragment below illustrates core graph fields; use
              the Lab’s Export action for a complete importable document.
            </p>
            <pre className="json-sample">
              <code>{`{
  "schemaVersion": 1,
  "id": "custom-seed-42",
  "name": "My bounded graph",
  "graph": {
    "nodes": [{ "id": "A", "x": 80, "y": 120, "label": "Start" }],
    "edges": [{ "id": "A-B", "fromId": "A", "toId": "B", "weight": 4 }]
  },
  "startId": "A",
  "goalId": "B",
  "seed": 42
}`}</code>
            </pre>
          </section>

          <section id="security">
            <span className="doc-index">06</span>
            <h2>Security boundary</h2>
            <p>
              RouteLab treats labels, imported files, URL state, and graph
              metadata as hostile data. It never evaluates expressions, runs
              submitted code, dynamically imports user paths, or fetches
              user-provided URLs.
            </p>
            <div className="security-grid">
              <article>
                <span>Validate</span>
                <h3>Strict schema</h3>
                <p>
                  Finite numbers, unique IDs, valid references, version checks,
                  and closed object shapes.
                </p>
              </article>
              <article>
                <span>Bound</span>
                <h3>Hard limits</h3>
                <p>
                  File bytes, labels, nodes, edges, share state, trace history,
                  and all-pairs graph size.
                </p>
              </article>
              <article>
                <span>Render</span>
                <h3>Plain text</h3>
                <p>
                  No unsafe HTML, external SVG, user styles, event handlers, or
                  arbitrary URL requests.
                </p>
              </article>
              <article>
                <span>Isolate</span>
                <h3>Client-only import</h3>
                <p>
                  Custom files remain on the device and are not uploaded or
                  logged by RouteLab.
                </p>
              </article>
            </div>
          </section>

          <section id="accessibility">
            <span className="doc-index">07</span>
            <h2>Accessibility</h2>
            <p>
              RouteLab targets WCAG 2.2 AA with visible focus, semantic
              landmarks, live playback announcements, reduced-motion behavior,
              44-pixel touch targets, and redundant state encodings.
            </p>
            <ul className="check-list">
              <li>
                <span>✓</span> The visualization includes a current-state
                summary and node/edge tables.
              </li>
              <li>
                <span>✓</span> Current, frontier, visited, and path states use
                labels and shape—not color alone.
              </li>
              <li>
                <span>✓</span> Native scroll remains available; reduced motion
                removes automated transitions.
              </li>
              <li>
                <span>✓</span> Code panes are read-only, focusable, scrollable,
                and never trap keyboard focus.
              </li>
            </ul>
          </section>
        </article>
      </div>
    </div>
  );
}
