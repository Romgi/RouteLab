package main

import (
	"container/heap"
	"fmt"
	"math"
)

// Edge is one directed, weighted connection in a trusted graph.
type Edge struct {
	To     string
	Weight float64
}

type Graph map[string][]Edge

type Result struct {
	Found bool
	Cost  *float64
	Path  []string
}

type queueEntry struct {
	node     string
	distance float64
}

type minHeap []queueEntry

func (h minHeap) Len() int { return len(h) }
func (h minHeap) Less(i, j int) bool {
	return h[i].distance < h[j].distance ||
		(h[i].distance == h[j].distance && h[i].node < h[j].node)
}
func (h minHeap) Swap(i, j int) { h[i], h[j] = h[j], h[i] }
func (h *minHeap) Push(value any) { *h = append(*h, value.(queueEntry)) }
func (h *minHeap) Pop() any {
	old := *h
	last := old[len(old)-1]
	*h = old[:len(old)-1]
	return last
}

func validateGraph(graph Graph, start, goal string) error {
	if _, ok := graph[start]; !ok {
		return fmt.Errorf("start node %q is missing", start)
	}
	if _, ok := graph[goal]; !ok {
		return fmt.Errorf("goal node %q is missing", goal)
	}
	for _, edges := range graph {
		for _, edge := range edges {
			if _, ok := graph[edge.To]; !ok {
				return fmt.Errorf("unknown node %q", edge.To)
			}
			if math.IsNaN(edge.Weight) || math.IsInf(edge.Weight, 0) || edge.Weight < 0 {
				return fmt.Errorf("Dijkstra requires finite, nonnegative weights")
			}
		}
	}
	return nil
}

func dijkstra(graph Graph, start, goal string) (Result, error) {
	if err := validateGraph(graph, start, goal); err != nil {
		return Result{}, err
	}

	distances := make(map[string]float64, len(graph))
	parents := make(map[string]string, len(graph))
	for node := range graph {
		distances[node] = math.Inf(1)
	}
	distances[start] = 0

	frontier := &minHeap{{node: start, distance: 0}}
	heap.Init(frontier)
	for frontier.Len() > 0 {
		current := heap.Pop(frontier).(queueEntry)
		if current.distance != distances[current.node] {
			continue
		}
		if current.node == goal {
			break
		}

		for _, edge := range graph[current.node] {
			candidate := current.distance + edge.Weight
			if candidate >= distances[edge.To] {
				continue
			}

			distances[edge.To] = candidate
			parents[edge.To] = current.node
			heap.Push(frontier, queueEntry{node: edge.To, distance: candidate})
		}
	}

	if math.IsInf(distances[goal], 1) {
		return Result{Found: false, Cost: nil, Path: []string{}}, nil
	}

	path := []string{goal}
	for path[len(path)-1] != start {
		path = append(path, parents[path[len(path)-1]])
	}
	for left, right := 0, len(path)-1; left < right; left, right = left+1, right-1 {
		path[left], path[right] = path[right], path[left]
	}
	cost := distances[goal]
	return Result{Found: true, Cost: &cost, Path: path}, nil
}

func main() {
	graph := Graph{
		"A": {{To: "B", Weight: 2}, {To: "C", Weight: 7}},
		"B": {{To: "C", Weight: 1}, {To: "D", Weight: 5}},
		"C": {{To: "D", Weight: 1}},
		"D": {},
	}
	result, err := dijkstra(graph, "A", "D")
	if err != nil || !result.Found || result.Cost == nil || *result.Cost != 4 ||
		fmt.Sprint(result.Path) != "[A B C D]" {
		panic(fmt.Sprintf("unexpected result: %#v (%v)", result, err))
	}
	fmt.Println("go dijkstra: ok")
}

