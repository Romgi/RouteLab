# Trace and animation system

RouteLab animates a recorded explanation of an algorithm; it does not animate the algorithm itself. Search code emits deterministic semantic events as it runs, then the UI replays those events at any cadence.

## Design goals

- One algorithm run must support play, pause, step, rewind, reset, and arbitrary scrub without changing its result.
- A trace must drive the graph, inspector, metrics, narration, and code-concept highlight from the same cursor.
- Animation speed and dropped visual frames must never alter search order or measured execution time.
- Compare Mode must reuse the identical scenario/configuration while preserving each algorithm's distinct event stream.
- Reduced motion must keep every state inspectable.
- Bounded traces must fail explicitly instead of being silently truncated.

## Two clocks

RouteLab has two unrelated clocks:

1. **Execution clock:** surrounds synchronous algorithm/trace generation and produces the reported algorithm duration.
2. **Playback clock:** advances the timeline cursor according to the selected speed after execution is complete.

Pausing, changing speed, background-tab throttling, or scrubbing affects only playback. A five-second viewing session can represent an algorithm that executed in a fraction of that time.

## Event model

An event describes meaning, not appearance. Representative mappings are:

| Event                     | Replay effect                                          | Presentation                                     |
| ------------------------- | ------------------------------------------------------ | ------------------------------------------------ |
| `initialize`              | Clear state; establish start/goal and initial distance | Reset graph and announce run configuration       |
| `enqueue`                 | Add/update frontier entry and maximum size             | Frontier styling and queue inspector             |
| `dequeue`                 | Remove physical entry; set current candidate           | Current-node emphasis                            |
| `visitNode`               | Add node to visited/expanded state                     | Visited state and count                          |
| `inspectEdge`             | Set current edge                                       | Edge emphasis and narration                      |
| `relaxEdge`               | Record old/candidate comparison                        | Candidate explanation                            |
| `updateDistance`          | Replace best-known distance                            | Node/table/inspector value                       |
| `setParent`               | Replace predecessor                                    | Parent relationship and tree/path context        |
| `rejectCandidate`         | Preserve state; record reason                          | Explanation, including stale/non-improving entry |
| `meetFrontiers`           | Record best bidirectional meeting candidate            | Forward/backward meeting indicator               |
| matrix/intermediate event | Update active Floyd-Warshall cell/state                | Matrix highlight                                 |
| `reconstructPath`         | Set final node and edge sequence                       | Final-route overlay                              |
| `negativeCycleDetected`   | Mark invalid finite optimum                            | Error/status explanation                         |
| `finish`                  | Freeze outcome and aggregate metrics                   | Completion/no-path status                        |

Events carry stable IDs and numeric values. The renderer resolves IDs against the already validated immutable graph. A missing reference is an engine/test defect and becomes a safe run error; the UI does not invent a node.

## Snapshot reducer

The reducer begins with an empty snapshot and applies events in order. The derived snapshot contains only inspectable state:

- cursor and run status;
- current node/edge/event;
- frontier entries and their priorities;
- visited/expanded nodes;
- distances, heuristics, and parents;
- inspected/rejected/relaxed candidate details;
- bidirectional side/meeting state;
- Floyd-Warshall matrix state when applicable;
- final path and outcome; and
- cumulative counters at that cursor.

The reducer is pure: the same initial snapshot and event prefix produce an equivalent snapshot. It has no timers, random calls, DOM access, audio, or CSS knowledge.

The cursor is the count of applied events, in the closed interval `0..trace.length`. At cursor zero, no search event has been applied. At the final cursor, the snapshot agrees with the returned result.

## Forward, backward, and scrub

- **Next** applies the next event without mutating the current snapshot.
- **Previous** decrements the cursor and deterministically reconstructs from the closest checkpoint.
- **Reset/Home** selects the trace's initialization event (engine replay cursor 1); cursor zero remains the internal pre-run state.
- **End** selects the full trace.
- **Scrub** converts the range value directly to a bounded cursor.

`createTraceSnapshots` records immutable reducer state at cursor zero, every 50 events by default, and the final cursor. `replayTrace` selects the checkpoint with the greatest cursor not beyond the target, clones it, and replays the remaining suffix. Callers may choose another positive interval after profiling. RouteLab does not maintain a separately mutable “undo” implementation that could drift from forward behavior.

No algorithm is rerun during timeline navigation. A new trace is generated only when correctness-affecting configuration changes.

## Playback controller

Autoplay owns one cancelable browser timer. Each tick advances by one semantic event until the final cursor, then stops. Changing route, scenario, algorithm, cost model, heuristic, closure state, or trace cancels the prior timer. Starting playback at the end restarts from cursor zero only through an explicit replay action.

The speed control maps human-readable rates to timer cadence. It does not batch correctness events together. The browser may throttle timers in a background tab; on return, RouteLab continues from the current cursor rather than racing through wall-clock “missed” ticks.

Global keyboard shortcuts are scoped away from editable controls:

- `Space`: play/pause;
- right/left arrows: next/previous event;
- `Home`/`End`: first/final state;
- `R`: reset; and
- `?`: keyboard help.

Native buttons and the range input remain the authoritative accessible controls for users or browsers where a shortcut conflicts.

## Compare synchronization

Compare Mode runs two to four distinct compatible algorithms independently against the same immutable graph, start, goal, closures, and cost metric. Each pane owns a trace/result; the controller owns playback, speed, and a shared step.

At zero-based shared event index `s`, a pane selects `min(s, trace.length - 1)` and replays through that selected event. A shorter trace therefore stays at its completed state while a longer trace continues. Metrics remain the pane's real counters; RouteLab does not stretch or synthesize events to make animations look simultaneous. Reset and scrub apply to every pane atomically.

For comparisons with substantially different event counts, normalized-progress visualization can be added later, but it must be labeled because equal percentages do not represent equivalent algorithm decisions.

## Rendering pipeline

```text
immutable trace + cursor
  -> pure replay snapshot
  -> semantic view model
       -> SVG classes/labels
       -> frontier and node inspector
       -> metric counters
       -> event narration/live status
       -> trace-event-to-code-concept lookup
```

Visual transitions interpolate only between already determined states. The final route overlay is read from `reconstructPath`/result data; it is never inferred from the pixels currently highlighted.

## Reduced motion and assistive technology

Under `prefers-reduced-motion: reduce`, decorative pulses, sweeping route reveals, parallax, and smooth transitions are removed or shortened. Cursor changes remain discrete and understandable. Autoplay does not start solely because content entered the viewport.

The visible current-event description and inspector are updated at every cursor. The polite live region avoids flooding assistive technology at high speed; stepping or pausing exposes exact details. The graph table reads the same snapshot as the SVG.

## Limits and failure behavior

- `maxTraceEvents`: 100,000 events generated for a run.
- `maxAnimationHistory`: 50,000 retained playback entries/states in the UI policy.
- `maxAlgorithmRuntimeMs`: 5,000 ms reserved future worker deadline; not enforced by the synchronous v1 engine.

Ordinary built-in scenarios remain far below the enforced graph/trace ceilings. If a run would exceed one, validation or the engine aborts and reports why/how to reduce the graph. It never drops middle events and then presents the trace as complete. The synchronous engine does not check elapsed wall time because that would be machine-dependent and still could not preempt JavaScript; a future Web Worker can enforce termination.

## Testing invariants

Trace/replay tests should assert:

- the first/last event ordering is valid;
- every referenced node/edge exists;
- queue and parent/distance events occur in a valid causal order;
- replaying the complete trace matches result cost/path/outcome;
- every cursor is replayable without mutating earlier snapshots;
- decrement then increment returns equivalent state;
- scrubbed state equals sequential state at the same cursor;
- identical inputs produce identical event structure and operation counts; and
- Compare Mode never shares mutable snapshot objects between panes.

Timer/component tests use fake timers so they verify cursor behavior without asserting real animation duration. End-to-end coverage checks pause, step, keyboard shortcuts, scrub, completion, and reduced-motion behavior.
