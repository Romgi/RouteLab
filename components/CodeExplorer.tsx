"use client";

import { useMemo, useState } from "react";
import {
  CODE_CONCEPTS,
  CODE_LANGUAGES,
  CODE_SAMPLES,
  type CodeConcept,
  type CodeLanguage,
} from "@/lib/code-snippets";

export function CodeExplorer() {
  const [language, setLanguage] = useState<CodeLanguage>("TypeScript");
  const [concept, setConcept] = useState<CodeConcept>("relaxation");
  const [copied, setCopied] = useState(false);
  const sample = CODE_SAMPLES[language];
  const activeConcept = CODE_CONCEPTS.find((item) => item.id === concept)!;
  const lines = useMemo(() => sample.code.split("\n"), [sample]);
  const range = sample.ranges[concept];

  async function copyCode() {
    await navigator.clipboard.writeText(sample.code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function downloadCode() {
    const url = URL.createObjectURL(
      new Blob([sample.code], { type: "text/plain;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `dijkstra.${sample.extension}`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="code-page">
      <section className="page-intro shell">
        <span className="section-number">
          Source explorer / trusted implementations
        </span>
        <div className="page-intro-grid">
          <h1>
            Same algorithm.
            <br />
            <em>Different idioms.</em>
          </h1>
          <div>
            <p>
              Inspect repository-controlled Dijkstra implementations in six
              languages. Concept markers link semantic trace events to the lines
              that produce them.
            </p>
            <div className="security-note">
              <span aria-hidden="true">✓</span>
              <p>
                <strong>Read-only by design.</strong> Code is never compiled or
                executed in the browser.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section
        className="code-explorer-shell shell"
        aria-label="Dijkstra source code explorer"
      >
        <div className="explorer-toolbar">
          <div className="explorer-tabs" role="tablist" aria-label="Language">
            {CODE_LANGUAGES.map((item) => (
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
          <div className="explorer-actions">
            <button type="button" onClick={copyCode}>
              {copied ? "Copied" : "Copy code"}
            </button>
            <button type="button" onClick={downloadCode}>
              Download .{sample.extension}
            </button>
          </div>
        </div>
        <div className="code-explorer-grid">
          <aside className="concept-panel" aria-label="Algorithm concepts">
            <p className="panel-label">Trace → source</p>
            {CODE_CONCEPTS.map((item, index) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={concept === item.id}
                onClick={() => setConcept(item.id)}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{item.label}</strong>
                <code>{item.event}</code>
              </button>
            ))}
            <div className="language-note">
              <span>Language note</span>
              <p>{sample.notes}</p>
            </div>
          </aside>
          <div className="source-pane">
            <div className="source-pane-head">
              <span>dijkstra.{sample.extension}</span>
              <span>{lines.length} lines · read only</span>
            </div>
            <pre tabIndex={0} aria-label={`${language} Dijkstra source code`}>
              <code>
                {lines.map((line, index) => {
                  const lineNumber = index + 1;
                  const active =
                    lineNumber >= range[0] && lineNumber <= range[1];
                  return (
                    <span
                      key={lineNumber}
                      className={active ? "is-highlighted" : undefined}
                    >
                      <i>{String(lineNumber).padStart(2, "0")}</i>
                      {line || " "}
                    </span>
                  );
                })}
              </code>
            </pre>
          </div>
          <aside className="source-inspector" aria-live="polite">
            <p className="panel-label">Current concept</p>
            <span className="trace-tag">{activeConcept.event}</span>
            <h2>{activeConcept.label}</h2>
            <p>{activeConcept.description}</p>
            <dl>
              <div>
                <dt>Highlighted</dt>
                <dd>
                  Lines {range[0]}–{range[1]}
                </dd>
              </div>
              <div>
                <dt>Invariant</dt>
                <dd>Best-known cost never increases</dd>
              </div>
              <div>
                <dt>Complexity</dt>
                <dd>O((V + E) log V)</dd>
              </div>
            </dl>
          </aside>
        </div>
      </section>

      <section
        className="language-principles shell"
        aria-labelledby="principles-title"
      >
        <div>
          <span className="section-number">Implementation notes</span>
          <h2 id="principles-title">Equivalent does not mean identical.</h2>
        </div>
        <div className="principle-grid">
          <article>
            <span>01</span>
            <h3>Native data structures</h3>
            <p>
              Each implementation uses the standard-library priority queue idiom
              its ecosystem expects.
            </p>
          </article>
          <article>
            <span>02</span>
            <h3>Stable tie-breaking</h3>
            <p>
              Equal-cost candidates use node identifiers so fixtures and trace
              order remain reproducible.
            </p>
          </article>
          <article>
            <span>03</span>
            <h3>Shared fixtures</h3>
            <p>
              The same graph inputs verify cost, path connectivity, closed
              roads, and unreachable destinations.
            </p>
          </article>
        </div>
      </section>
    </div>
  );
}
