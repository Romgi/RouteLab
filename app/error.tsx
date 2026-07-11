"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="main-content" className="error-state">
      <span className="section-number">RouteLab / recovery</span>
      <h1>This view lost the route.</h1>
      <p>
        The interactive workspace could not finish rendering. Your imported
        graph was not uploaded or executed.
      </p>
      <button className="button button-primary" type="button" onClick={reset}>
        Try this view again
      </button>
    </main>
  );
}
