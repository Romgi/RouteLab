import type { Metadata } from "next";
import { CodeExplorer } from "@/components/CodeExplorer";

export const metadata: Metadata = {
  title: "Code Explorer",
  description:
    "Compare trusted Dijkstra implementations in TypeScript, Python, Java, C++, Go, and Rust.",
};

export default function CodePage() {
  return (
    <main id="main-content">
      <CodeExplorer />
    </main>
  );
}
