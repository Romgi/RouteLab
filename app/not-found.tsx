import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main-content" className="error-state">
      <span className="section-number">404 / no path</span>
      <h1>That destination is unreachable.</h1>
      <p>The route does not exist, but the algorithm lab is one edge away.</p>
      <Link className="button button-primary" href="/lab">
        Open the lab
      </Link>
    </main>
  );
}
