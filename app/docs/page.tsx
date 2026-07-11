import type { Metadata } from "next";
import { DocumentationHub } from "@/components/DocumentationHub";

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "RouteLab architecture, algorithm guarantees, controls, security model, and accessibility guidance.",
};

export default function DocsPage() {
  return (
    <main id="main-content">
      <DocumentationHub />
    </main>
  );
}
