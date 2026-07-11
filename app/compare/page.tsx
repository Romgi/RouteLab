import type { Metadata } from "next";

import { CompareWorkspace } from "@/components/CompareWorkspace";

export const metadata: Metadata = {
  title: "Compare algorithms",
  description:
    "Run real pathfinding algorithms side by side on one deterministic graph and synchronized timeline.",
};

interface ComparePageProps {
  readonly searchParams: Promise<
    Record<string, string | readonly string[] | undefined>
  >;
}

function firstParameter(
  value: string | readonly string[] | undefined,
): string | undefined {
  return typeof value === "string" ? value : value?.[0];
}

export default async function ComparePage({ searchParams }: ComparePageProps) {
  const parameters = await searchParams;
  return (
    <CompareWorkspace
      initialScenarioId={firstParameter(parameters.scenario)}
      initialAlgorithms={firstParameter(parameters.algorithms)}
      initialCostMetric={firstParameter(parameters.cost)}
      initialHeuristicId={firstParameter(parameters.heuristic)}
    />
  );
}
