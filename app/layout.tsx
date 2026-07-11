import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  const candidateHost =
    forwardedHost ?? requestHeaders.get("host") ?? "localhost:3000";
  const host = /^[a-z0-9.-]+(?::\d+)?$/i.test(candidateHost)
    ? candidateHost
    : "localhost:3000";
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto");
  const protocol = host.startsWith("localhost")
    ? "http"
    : forwardedProtocol === "http"
      ? "http"
      : "https";
  const origin = `${protocol}://${host}`;

  return {
    metadataBase: new URL(origin),
    title: {
      default: "RouteLab — See how algorithms find their way",
      template: "%s · RouteLab",
    },
    description:
      "An interactive, trace-driven pathfinding laboratory for learning, comparing, and inspecting route-planning algorithms.",
    applicationName: "RouteLab",
    keywords: [
      "pathfinding",
      "Dijkstra",
      "A* search",
      "algorithms",
      "graph theory",
      "visualizer",
    ],
    authors: [{ name: "RouteLab" }],
    creator: "RouteLab",
    icons: {
      icon: "/favicon.ico",
      shortcut: "/favicon.ico",
    },
    openGraph: {
      type: "website",
      title: "RouteLab — See how algorithms find their way",
      description:
        "Run, rewind, compare, and understand seven pathfinding algorithms on deterministic graphs.",
      siteName: "RouteLab",
      images: [
        {
          url: `${origin}/og.png`,
          width: 1733,
          height: 910,
          alt: "RouteLab graph search social card",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "RouteLab — See how algorithms find their way",
      description:
        "Run, rewind, compare, and understand pathfinding algorithms.",
      images: [`${origin}/og.png`],
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark light",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#090b0d" },
    { media: "(prefers-color-scheme: light)", color: "#f5f7f8" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <SiteHeader />
        {children}
        <div className="sr-only" aria-live="polite" id="route-announcer" />
      </body>
    </html>
  );
}
