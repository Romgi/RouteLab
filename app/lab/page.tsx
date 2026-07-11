import type { Metadata } from "next";
import { AlgorithmLab } from "@/components/AlgorithmLab";

export const metadata: Metadata = {
  title: "Algorithm Lab",
  description:
    "Run, pause, rewind, scrub, and inspect deterministic pathfinding traces across twelve scenarios.",
};

export default function LabPage() {
  return <AlgorithmLab />;
}
