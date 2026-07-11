use std::cmp::Ordering;
use std::collections::{BinaryHeap, HashMap};

// Trusted, repository-controlled Dijkstra reference implementation.
type NodeId = &'static str;
type Graph = HashMap<NodeId, Vec<Edge>>;

#[derive(Clone, Copy)]
struct Edge {
    to: NodeId,
    weight: u64,
}

#[derive(Debug, PartialEq)]
struct DijkstraResult {
    found: bool,
    cost: Option<u64>,
    path: Vec<NodeId>,
}

#[derive(Eq, PartialEq)]
struct QueueEntry {
    node: NodeId,
    distance: u64,
}

impl Ord for QueueEntry {
    fn cmp(&self, other: &Self) -> Ordering {
        other
            .distance
            .cmp(&self.distance)
            .then_with(|| other.node.cmp(self.node))
    }
}

impl PartialOrd for QueueEntry {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

fn validate_graph(graph: &Graph, start: NodeId, goal: NodeId) -> Result<(), String> {
    if !graph.contains_key(start) || !graph.contains_key(goal) {
        return Err("start and goal must be present in the graph".into());
    }
    for edges in graph.values() {
        for edge in edges {
            if !graph.contains_key(edge.to) {
                return Err(format!("unknown node: {}", edge.to));
            }
        }
    }
    Ok(())
}

fn dijkstra(graph: &Graph, start: NodeId, goal: NodeId) -> Result<DijkstraResult, String> {
    validate_graph(graph, start, goal)?;

    let mut distances: HashMap<NodeId, u64> =
        graph.keys().map(|&node| (node, u64::MAX)).collect();
    let mut parents: HashMap<NodeId, NodeId> = HashMap::new();
    distances.insert(start, 0);

    let mut frontier = BinaryHeap::new();
    frontier.push(QueueEntry {
        node: start,
        distance: 0,
    });

    while let Some(current) = frontier.pop() {
        if current.distance != distances[current.node] {
            continue;
        }
        if current.node == goal {
            break;
        }

        for edge in &graph[current.node] {
            let Some(candidate) = current.distance.checked_add(edge.weight) else {
                continue;
            };
            if candidate >= distances[edge.to] {
                continue;
            }

            distances.insert(edge.to, candidate);
            parents.insert(edge.to, current.node);
            frontier.push(QueueEntry {
                node: edge.to,
                distance: candidate,
            });
        }
    }

    if distances[goal] == u64::MAX {
        return Ok(DijkstraResult {
            found: false,
            cost: None,
            path: Vec::new(),
        });
    }

    let mut path = vec![goal];
    while path.last() != Some(&start) {
        path.push(parents[path.last().unwrap()]);
    }
    path.reverse();
    Ok(DijkstraResult {
        found: true,
        cost: Some(distances[goal]),
        path,
    })
}

fn main() {
    let graph = HashMap::from([
        ("A", vec![Edge { to: "B", weight: 2 }, Edge { to: "C", weight: 7 }]),
        ("B", vec![Edge { to: "C", weight: 1 }, Edge { to: "D", weight: 5 }]),
        ("C", vec![Edge { to: "D", weight: 1 }]),
        ("D", vec![]),
    ]);
    let result = dijkstra(&graph, "A", "D").expect("valid graph");
    assert_eq!(
        result,
        DijkstraResult {
            found: true,
            cost: Some(4),
            path: vec!["A", "B", "C", "D"],
        }
    );
    println!("rust dijkstra: ok");
}
