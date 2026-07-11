"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  replayTrace as replayAlgorithmTrace,
  runAlgorithm,
  type AlgorithmId,
  type Graph,
} from "@/lib/algorithms";

const heroNodes = [
  [6, 20],
  [18, 36],
  [13, 70],
  [30, 15],
  [35, 51],
  [29, 83],
  [50, 29],
  [50, 68],
  [68, 16],
  [67, 49],
  [72, 83],
  [88, 31],
  [91, 67],
] as const;

const heroEdges = [
  [0, 1],
  [0, 3],
  [1, 2],
  [1, 4],
  [2, 5],
  [3, 4],
  [3, 6],
  [4, 5],
  [4, 6],
  [4, 7],
  [5, 7],
  [6, 7],
  [6, 8],
  [6, 9],
  [7, 9],
  [7, 10],
  [8, 9],
  [8, 11],
  [9, 10],
  [9, 11],
  [9, 12],
  [10, 12],
  [11, 12],
] as const;

const routeEdgeIndexes = new Set([0, 3, 9, 14, 19, 22]);

const objectives = {
  Distance: {
    value: "4.8 km",
    route: "short",
    note: "Direct local streets win.",
  },
  Time: {
    value: "9 min",
    route: "fast",
    note: "A longer arterial avoids slow blocks.",
  },
  Turns: {
    value: "3 turns",
    route: "simple",
    note: "The simplest route stays on two avenues.",
  },
  Cycling: {
    value: "82% protected",
    route: "safe",
    note: "Safety multipliers favor protected lanes.",
  },
} as const;

const raceAlgorithms = [
  {
    id: "dijkstra",
    algorithmId: "dijkstra",
    name: "Dijkstra",
    optimal: "Guaranteed",
    tone: "blue",
  },
  {
    id: "astar",
    algorithmId: "astar",
    name: "A*",
    optimal: "Guaranteed*",
    tone: "cyan",
  },
  {
    id: "greedy",
    algorithmId: "greedy-best-first",
    name: "Greedy best-first",
    optimal: "Not guaranteed",
    tone: "amber",
  },
] as const;

const raceGraph: Graph = {
  nodes: [
    { id: "n0", x: 0, y: 0 },
    { id: "n1", x: 1, y: 1 },
    { id: "n2", x: 1.5, y: -1 },
    { id: "n3", x: 2.3, y: 0.6 },
    { id: "n4", x: 3, y: -0.8 },
    { id: "n5", x: 3.8, y: 0.9 },
    { id: "n6", x: 5, y: 0 },
  ],
  edges: [
    { id: "e01", fromId: "n0", toId: "n1", directed: false, weight: 1.5 },
    { id: "e02", fromId: "n0", toId: "n2", directed: false, weight: 2 },
    { id: "e13", fromId: "n1", toId: "n3", directed: false, weight: 1.4 },
    { id: "e23", fromId: "n2", toId: "n3", directed: false, weight: 2 },
    { id: "e24", fromId: "n2", toId: "n4", directed: false, weight: 1.6 },
    { id: "e34", fromId: "n3", toId: "n4", directed: false, weight: 1.7 },
    { id: "e35", fromId: "n3", toId: "n5", directed: false, weight: 1.6 },
    { id: "e46", fromId: "n4", toId: "n6", directed: false, weight: 2.2 },
    { id: "e56", fromId: "n5", toId: "n6", directed: false, weight: 1.6 },
  ],
};

const languageLines: Record<string, string[]> = {
  Pseudocode: [
    "frontier ← priority queue with start",
    "while frontier is not empty:",
    "  current ← pop minimum priority",
    "  for each edge from current:",
    "    candidate ← distance[current] + cost(edge)",
    "    if candidate < distance[next]: update(next)",
  ],
  TypeScript: [
    "const frontier = new MinHeap([start]);",
    "while (!frontier.isEmpty()) {",
    "  const current = frontier.pop()!;",
    "  for (const edge of graph.outgoing(current.id)) {",
    "    const candidate = distances[current.id] + edge.weight;",
    "    if (candidate < distances[edge.toId]) relax(edge, candidate);",
  ],
  Python: [
    "frontier = [(0, start)]",
    "while frontier:",
    "    current_cost, current = heappop(frontier)",
    "    for edge in graph.outgoing(current):",
    "        candidate = current_cost + edge.weight",
    "        if candidate < distances[edge.to_id]: relax(edge, candidate)",
  ],
  Java: [
    "var frontier = new PriorityQueue<Entry>();",
    "while (!frontier.isEmpty()) {",
    "  Entry current = frontier.remove();",
    "  for (Edge edge : graph.outgoing(current.id())) {",
    "    double candidate = current.cost() + edge.weight();",
    "    if (candidate < distances.get(edge.to())) relax(edge, candidate);",
  ],
  "C++": [
    "priority_queue<Entry, vector<Entry>, greater<>> frontier;",
    "while (!frontier.empty()) {",
    "  auto current = frontier.top(); frontier.pop();",
    "  for (const Edge& edge : graph.outgoing(current.id)) {",
    "    double candidate = current.cost + edge.weight;",
    "    if (candidate < distances[edge.to]) relax(edge, candidate);",
  ],
  Go: [
    "frontier := &PriorityQueue{{node: start, cost: 0}}",
    "for frontier.Len() > 0 {",
    "  current := heap.Pop(frontier).(Entry)",
    "  for _, edge := range graph.Outgoing(current.Node) {",
    "    candidate := current.Cost + edge.Weight",
    "    if candidate < distances[edge.To] { relax(edge, candidate) }",
  ],
  Rust: [
    "let mut frontier = BinaryHeap::from([State::new(start, 0.0)]);",
    "while let Some(current) = frontier.pop() {",
    "    for edge in graph.outgoing(current.node) {",
    "        let candidate = current.cost + edge.weight;",
    "        if candidate < distances[&edge.to] {",
    "            relax(edge, candidate, &mut frontier);",
  ],
};

const storyScenarios = [
  ["Uniform city grid", "Equal weights · many ties", "grid"],
  ["Highway vs local", "Distance ≠ travel time", "highway"],
  ["Weighted terrain", "Cost-aware routing", "terrain"],
  ["Deterministic maze", "Heuristics meet barriers", "maze"],
  ["One-way downtown", "Direction changes everything", "oneway"],
  ["Road closures", "Reroute in real time", "closure"],
  ["Dense urban network", "High branching factor", "urban"],
  ["Sparse rural network", "Critical bridge links", "rural"],
  ["Unreachable destination", "Safe no-path termination", "unreachable"],
] as const;

function HeroGraph() {
  return (
    <div className="hero-graph" aria-hidden="true">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        {heroEdges.map(([from, to], index) => {
          const a = heroNodes[from];
          const b = heroNodes[to];
          return (
            <line
              key={`${from}-${to}`}
              x1={a[0]}
              y1={a[1]}
              x2={b[0]}
              y2={b[1]}
              className={routeEdgeIndexes.has(index) ? "route-line" : undefined}
              style={{ "--edge-index": index } as React.CSSProperties}
            />
          );
        })}
        {heroNodes.map(([x, y], index) => (
          <g
            key={index}
            style={{ "--node-index": index } as React.CSSProperties}
          >
            <circle
              cx={x}
              cy={y}
              r={index === 0 || index === 12 ? 1.1 : 0.62}
            />
            {(index === 0 || index === 12) && (
              <circle className="node-halo" cx={x} cy={y} r="2.4" />
            )}
          </g>
        ))}
      </svg>
      <div className="graph-grid" />
    </div>
  );
}

function MiniNetwork({
  tone = "cyan",
  active = 1,
}: {
  tone?: string;
  active?: number;
}) {
  return (
    <svg
      className={`mini-network tone-${tone}`}
      viewBox="0 0 180 100"
      role="img"
      aria-label="Small graph preview"
    >
      <path d="M12 70 L42 25 L78 52 L109 18 L165 35" />
      <path d="M12 70 L58 84 L96 72 L165 35" />
      <path d="M42 25 L58 84 M78 52 L96 72 M109 18 L96 72" />
      {[
        [12, 70],
        [42, 25],
        [58, 84],
        [78, 52],
        [96, 72],
        [109, 18],
        [165, 35],
      ].map(([x, y], index) => (
        <circle
          key={index}
          cx={x}
          cy={y}
          r={index === active ? 6 : 4}
          className={index <= active ? "visited" : ""}
        />
      ))}
    </svg>
  );
}

function MapToGraph() {
  const [progress, setProgress] = useState(46);
  return (
    <div className="concept-demo">
      <div
        className="concept-stage"
        style={{ "--map-progress": `${progress}%` } as React.CSSProperties}
      >
        <div className="map-block block-a" />
        <div className="map-block block-b" />
        <div className="map-block block-c" />
        <div className="map-road road-a" />
        <div className="map-road road-b" />
        <div className="map-road road-c" />
        <div className="graph-edge edge-a">
          <span>4</span>
        </div>
        <div className="graph-edge edge-b">
          <span>7</span>
        </div>
        <div className="graph-edge edge-c">
          <span>3</span>
        </div>
        <i className="graph-node node-a">A</i>
        <i className="graph-node node-b">B</i>
        <i className="graph-node node-c">C</i>
        <i className="graph-node node-d">D</i>
      </div>
      <label className="range-control">
        <span>Map</span>
        <input
          type="range"
          min="0"
          max="100"
          value={progress}
          onChange={(event) => setProgress(Number(event.target.value))}
          aria-label="Transform map into graph"
        />
        <span>Graph</span>
      </label>
      <p className="demo-caption">
        {progress < 35
          ? "A road map is the familiar surface."
          : progress < 70
            ? "Intersections become nodes; roads become connections."
            : "Direction and cost turn connections into a weighted graph."}
      </p>
    </div>
  );
}

function ObjectiveDemo() {
  const [objective, setObjective] = useState<keyof typeof objectives>("Time");
  const result = objectives[objective];
  return (
    <div className="objective-demo">
      <div className="segmented-control" aria-label="Route objective">
        {(Object.keys(objectives) as Array<keyof typeof objectives>).map(
          (item) => (
            <button
              key={item}
              type="button"
              aria-pressed={objective === item}
              onClick={() => setObjective(item)}
            >
              {item}
            </button>
          ),
        )}
      </div>
      <div className="objective-map">
        <div className={`objective-route route-${result.route}`} />
        <span className="map-pin pin-start">S</span>
        <span className="map-pin pin-end">G</span>
        <span className="road-label label-local">local · 30 km/h</span>
        <span className="road-label label-arterial">arterial · 70 km/h</span>
      </div>
      <div className="objective-result">
        <span>Optimizing for {objective.toLowerCase()}</span>
        <strong>{result.value}</strong>
        <p>{result.note}</p>
      </div>
    </div>
  );
}

function RaceDemo() {
  const [running, setRunning] = useState(false);
  const [round, setRound] = useState(0);
  const results = useMemo(
    () =>
      Object.fromEntries(
        raceAlgorithms.map((algorithm) => [
          algorithm.id,
          runAlgorithm(raceGraph, {
            algorithmId: algorithm.algorithmId as AlgorithmId,
            startId: "n0",
            goalId: "n6",
            scenarioId: "story-race",
            travelModel: "weight",
            heuristicId: "euclidean",
            maxTraceEvents: 10_000,
          }),
        ]),
      ),
    [],
  );
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setRound((current) => {
        if (current >= 6) {
          setRunning(false);
          return 6;
        }
        return current + 1;
      });
    }, 360);
    return () => window.clearInterval(id);
  }, [running]);

  function runRace() {
    if (round >= 6) setRound(0);
    setRunning(true);
  }

  return (
    <div className="race-demo">
      <div className="race-toolbar">
        <div>
          <span className="eyebrow">Same graph · same endpoints</span>
          <strong>Race frame {round} / 6</strong>
        </div>
        <button
          className="button button-secondary button-small"
          type="button"
          onClick={runRace}
          disabled={running}
        >
          {running ? "Running…" : round === 6 ? "Run again" : "Run race"}
        </button>
      </div>
      <div className="race-grid">
        {raceAlgorithms.map((algorithm, index) => {
          const result = results[algorithm.id];
          const cursor = Math.min(
            result.trace.length,
            Math.floor((result.trace.length * round) / 6),
          );
          const replay = replayAlgorithmTrace(result.trace, cursor);
          const event = result.trace[Math.max(0, cursor - 1)];
          const eventNode =
            event && "nodeId" in event
              ? event.nodeId
              : event && "toId" in event
                ? event.toId
                : "n0";
          const activeNode = Number(eventNode.replace("n", "")) || 0;
          return (
            <article key={algorithm.id} className="race-card">
              <div className="race-card-head">
                <span className={`algorithm-dot ${algorithm.tone}`} />
                <h3>{algorithm.name}</h3>
                <code>{index === 1 ? "g + h" : index === 2 ? "h" : "g"}</code>
              </div>
              <MiniNetwork
                tone={algorithm.tone}
                active={Math.min(6, activeNode)}
              />
              <dl>
                <div>
                  <dt>Expanded</dt>
                  <dd>{replay.metrics.nodesExpanded}</dd>
                </div>
                <div>
                  <dt>Optimal</dt>
                  <dd>{algorithm.optimal}</dd>
                </div>
              </dl>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function LanguageDemo() {
  const [language, setLanguage] = useState("TypeScript");
  const lines = languageLines[language];
  return (
    <div className="language-demo">
      <div
        className="code-rail"
        role="tablist"
        aria-label="Programming language"
      >
        {Object.keys(languageLines).map((item) => (
          <button
            key={item}
            role="tab"
            aria-selected={language === item}
            type="button"
            onClick={() => setLanguage(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="code-window">
        <div className="code-window-head">
          <span>
            dijkstra.
            {language === "Python"
              ? "py"
              : language === "Rust"
                ? "rs"
                : language === "Go"
                  ? "go"
                  : language === "Java"
                    ? "java"
                    : language === "C++"
                      ? "cpp"
                      : language === "Pseudocode"
                        ? "algo"
                        : "ts"}
          </span>
          <span>edge relaxation</span>
        </div>
        <pre aria-label={`${language} Dijkstra excerpt`}>
          <code>
            {lines.map((line, index) => (
              <span
                key={`${language}-${index}`}
                className={index === 4 ? "active-code-line" : undefined}
              >
                <i>{String(index + 12).padStart(2, "0")}</i>
                {line}
              </span>
            ))}
          </code>
        </pre>
        <div className="code-explanation">
          <span className="trace-tag">relaxEdge</span>
          The syntax changes; the invariant does not: only keep a route when its
          candidate cost improves the best known distance.
        </div>
      </div>
    </div>
  );
}

function ScenarioGallery() {
  const [selected, setSelected] = useState(0);
  const current = storyScenarios[selected];
  const tone = useMemo(
    () => ["cyan", "blue", "amber"][selected % 3],
    [selected],
  );
  return (
    <div className="scenario-showcase">
      <div className="scenario-preview">
        <div className="scenario-preview-top">
          <span>SCN-{String(selected + 1).padStart(2, "0")}</span>
          <span>seed 42</span>
        </div>
        <MiniNetwork tone={tone} active={(selected % 5) + 1} />
        <div>
          <h3>{current[0]}</h3>
          <p>{current[1]}</p>
        </div>
      </div>
      <div className="scenario-list" aria-label="Scenario previews">
        {storyScenarios.map((scenario, index) => (
          <button
            type="button"
            key={scenario[0]}
            aria-pressed={selected === index}
            onClick={() => setSelected(index)}
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{scenario[0]}</strong>
            <small>{scenario[1]}</small>
            <i aria-hidden="true">↗</i>
          </button>
        ))}
      </div>
    </div>
  );
}

export function StoryExperience() {
  return (
    <div className="story-page">
      <section className="story-hero" aria-labelledby="hero-title">
        <HeroGraph />
        <div className="hero-fade" />
        <div className="hero-content shell">
          <div className="hero-kicker">
            <span /> Trace-driven pathfinding studio
          </div>
          <h1 id="hero-title">
            See how algorithms
            <br />
            <em>find their way.</em>
          </h1>
          <p>
            Run real graph searches step by step. Inspect every decision.
            Compare what each algorithm explores—and what it misses.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/lab">
              Open the Algorithm Lab <span aria-hidden="true">→</span>
            </Link>
            <a className="button button-ghost" href="#map-is-graph">
              Explore the story <span aria-hidden="true">↓</span>
            </a>
          </div>
        </div>
        <div className="hero-metrics shell" aria-label="RouteLab features">
          <div>
            <strong>07</strong>
            <span>real algorithms</span>
          </div>
          <div>
            <strong>12</strong>
            <span>deterministic scenarios</span>
          </div>
          <div>
            <strong>06</strong>
            <span>language implementations</span>
          </div>
          <div>
            <strong>∞</strong>
            <span>timeline control</span>
          </div>
        </div>
        <a className="scroll-cue" href="#map-is-graph">
          <span /> Scroll to trace the idea
        </a>
      </section>

      <section
        className="story-section story-concept shell"
        id="map-is-graph"
        aria-labelledby="map-title"
      >
        <div className="section-copy">
          <span className="section-number">01 / Representation</span>
          <h2 id="map-title">
            A map is a graph
            <br />
            wearing street names.
          </h2>
          <p>
            Intersections become nodes. Roads become directed edges. Distance,
            time, tolls, and safety become costs the algorithm can reason about.
          </p>
          <ul className="concept-legend">
            <li>
              <i className="legend-node" /> node <span>intersection</span>
            </li>
            <li>
              <i className="legend-edge" /> edge <span>road segment</span>
            </li>
            <li>
              <i className="legend-weight" /> weight{" "}
              <span>cost to traverse</span>
            </li>
          </ul>
        </div>
        <MapToGraph />
      </section>

      <section
        className="story-section objective-section"
        aria-labelledby="objective-title"
      >
        <div className="shell two-column-heading">
          <div>
            <span className="section-number">02 / Cost models</span>
            <h2 id="objective-title">
              “Best” is a<br />
              design decision.
            </h2>
          </div>
          <p>
            The shortest route may not be the fastest. Change the objective and
            the same graph tells a different story.
          </p>
        </div>
        <div className="shell">
          <ObjectiveDemo />
        </div>
      </section>

      <section
        className="story-section race-section"
        aria-labelledby="race-title"
      >
        <div className="shell two-column-heading">
          <div>
            <span className="section-number">03 / Search strategy</span>
            <h2 id="race-title">
              Same destination.
              <br />
              Different instincts.
            </h2>
          </div>
          <div>
            <p>
              Dijkstra knows cost. A* adds direction. Greedy follows its
              intuition. Watch their frontiers diverge on the exact same graph.
            </p>
            <Link className="text-link" href="/compare">
              Open synchronized Compare Mode <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
        <div className="shell">
          <RaceDemo />
        </div>
      </section>

      <section
        className="story-section language-section"
        aria-labelledby="language-title"
      >
        <div className="shell language-heading">
          <span className="section-number">04 / Source synchronization</span>
          <h2 id="language-title">
            One invariant.
            <br />
            <em>Six languages.</em>
          </h2>
          <p>
            Each semantic trace event maps to the meaningful source
            lines—without pretending every language works the same way.
          </p>
        </div>
        <div className="shell">
          <LanguageDemo />
        </div>
      </section>

      <section
        className="story-section scenario-section"
        aria-labelledby="scenario-title"
      >
        <div className="shell two-column-heading">
          <div>
            <span className="section-number">05 / Scenario library</span>
            <h2 id="scenario-title">
              Change the world.
              <br />
              Change the search.
            </h2>
          </div>
          <p>
            Every scenario is deterministic, purpose-built, and replayable.
            Closures, one-way streets, negative edges, and unreachable goals
            expose different guarantees.
          </p>
        </div>
        <div className="shell">
          <ScenarioGallery />
        </div>
      </section>

      <section
        className="story-section engineering-section"
        aria-labelledby="engineering-title"
      >
        <div className="shell engineering-grid">
          <div className="engineering-intro">
            <span className="section-number">06 / Built for inspection</span>
            <h2 id="engineering-title">
              The animation is a replay—not the algorithm.
            </h2>
            <p>
              Algorithms emit deterministic semantic events. The interface
              replays them forward, backward, or at any point in time.
            </p>
          </div>
          {[
            [
              "01",
              "Deterministic traces",
              "Same graph and seed, same event stream—every time.",
            ],
            [
              "02",
              "Correctness fixtures",
              "Known paths, costs, negative cycles, and edge cases are tested.",
            ],
            [
              "03",
              "Safe custom data",
              "Strict schemas, finite limits, and plain-text labels. No executable input.",
            ],
            [
              "04",
              "Accessible by design",
              "Keyboard playback, live descriptions, reduced motion, and tabular graph data.",
            ],
          ].map(([number, title, text]) => (
            <article className="engineering-item" key={number}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="final-cta" aria-labelledby="final-title">
        <HeroGraph />
        <div className="shell final-cta-content">
          <span className="hero-kicker">
            <span /> Your turn
          </span>
          <h2 id="final-title">
            Pick a graph.
            <br />
            Trace a route.
          </h2>
          <p>
            Pause at any decision, inspect the frontier, then rewind and try
            another algorithm on the same world.
          </p>
          <Link className="button button-primary button-large" href="/lab">
            Launch RouteLab <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
