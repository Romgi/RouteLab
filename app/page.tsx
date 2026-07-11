import type { Metadata } from "next";
import { StoryExperience } from "@/components/StoryExperience";

export const metadata: Metadata = {
  title: "Story Mode",
  description:
    "A scroll-driven introduction to graphs, route costs, heuristics, and pathfinding algorithms.",
};

export default function HomePage() {
  return (
    <main id="main-content">
      <StoryExperience />
    </main>
  );
}
