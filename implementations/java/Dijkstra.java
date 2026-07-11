import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.PriorityQueue;

/** Trusted, repository-controlled Dijkstra reference implementation. */
public final class Dijkstra {
    public record Edge(String to, double weight) {}

    public record Result(boolean found, Double cost, List<String> path) {}

    private record QueueEntry(String node, double distance) {}

    private static void validateGraph(
            Map<String, List<Edge>> graph, String start, String goal) {
        if (!graph.containsKey(start) || !graph.containsKey(goal)) {
            throw new IllegalArgumentException("start and goal must be present in the graph");
        }
        for (List<Edge> edges : graph.values()) {
            for (Edge edge : edges) {
                if (!graph.containsKey(edge.to())) {
                    throw new IllegalArgumentException("unknown node: " + edge.to());
                }
                if (!Double.isFinite(edge.weight()) || edge.weight() < 0) {
                    throw new IllegalArgumentException(
                            "Dijkstra requires finite, nonnegative weights");
                }
            }
        }
    }

    public static Result shortestPath(
            Map<String, List<Edge>> graph, String start, String goal) {
        validateGraph(graph, start, goal);

        Map<String, Double> distances = new HashMap<>();
        Map<String, String> parents = new HashMap<>();
        for (String node : graph.keySet()) {
            distances.put(node, Double.POSITIVE_INFINITY);
        }
        distances.put(start, 0.0);

        PriorityQueue<QueueEntry> frontier = new PriorityQueue<>(
                Comparator.comparingDouble(QueueEntry::distance)
                        .thenComparing(QueueEntry::node));
        frontier.add(new QueueEntry(start, 0.0));

        while (!frontier.isEmpty()) {
            QueueEntry current = frontier.remove();
            if (current.distance() != distances.get(current.node())) {
                continue;
            }
            if (current.node().equals(goal)) {
                break;
            }

            for (Edge edge : graph.get(current.node())) {
                double candidate = current.distance() + edge.weight();
                if (candidate >= distances.get(edge.to())) {
                    continue;
                }

                distances.put(edge.to(), candidate);
                parents.put(edge.to(), current.node());
                frontier.add(new QueueEntry(edge.to(), candidate));
            }
        }

        double goalDistance = distances.get(goal);
        if (Double.isInfinite(goalDistance)) {
            return new Result(false, null, List.of());
        }

        List<String> path = new ArrayList<>();
        for (String node = goal; node != null; node = parents.get(node)) {
            path.add(node);
            if (node.equals(start)) {
                break;
            }
        }
        Collections.reverse(path);
        return new Result(true, goalDistance, List.copyOf(path));
    }

    public static void main(String[] args) {
        Map<String, List<Edge>> graph = Map.of(
                "A", List.of(new Edge("B", 2), new Edge("C", 7)),
                "B", List.of(new Edge("C", 1), new Edge("D", 5)),
                "C", List.of(new Edge("D", 1)),
                "D", List.of());
        Result result = shortestPath(graph, "A", "D");
        if (!result.equals(new Result(true, 4.0, List.of("A", "B", "C", "D")))) {
            throw new AssertionError(result);
        }
        System.out.println("java dijkstra: ok");
    }
}

