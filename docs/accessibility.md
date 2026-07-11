# Accessibility

RouteLab is designed so understanding a run does not depend on seeing color, tracking animation, using a pointer, or reading an SVG. Accessibility is a product behavior shared by the visualizer, inspector, timeline, and documentation—not a separate presentation mode.

## Keyboard operation

All primary actions are native links, buttons, selects, or range inputs. The supported baseline is:

- `Tab` and `Shift+Tab` move through navigation, configuration, graph alternatives, inspector controls, and playback.
- `Enter` activates links and focused buttons; `Space` activates buttons.
- Arrow keys adjust native select and range controls, including speed and timeline position.
- `Home` and `End` move a focused timeline range to its bounds where the browser supports the native range-input behavior.
- Mobile configuration/inspector drawers keep a visible close control and return focus to their trigger when dismissed.

RouteLab does not claim single-letter global shortcuts in v1. That avoids collisions with screen-reader browse commands, browser commands, and editable fields. Every playback action—play/pause, previous, next, reset, speed, and scrub—is reachable through a labeled control.

The focus indicator is deliberately high contrast and is never removed without a visible replacement. Hover is supplementary; no route, explanation, or control is available only on hover.

## Graph alternatives

The SVG gives spatial context, but it is not the sole representation. The Lab exposes an accessible graph table/list with node identifiers, labels, state, best-known distance, parent, and relevant edge information. Selecting an item updates the same inspector as selecting a visual node.

Graph state is conveyed with multiple cues:

- text labels and inspector status;
- shape/stroke/fill differences;
- explicit frontier, visited, current, start, goal, closed, and final-path descriptions; and
- metrics and event narration.

Color is never the only distinction. Decorative graph layers are hidden from the accessibility tree; meaningful SVG views have a concise accessible name rather than hundreds of noisy shape announcements.

## Playback and announcements

Algorithms emit semantic events. The current event is presented in visible text and an appropriately restrained live region. Announcements describe the action and entities—for example, inspecting an edge or improving a distance—rather than narrating decorative animation frames.

The live region is not used for every rapid intermediate frame during high-speed autoplay because that would overwhelm assistive technology. Pausing or stepping exposes the exact current state, and the inspector remains available at every timeline position. Completion, no-path, negative-cycle, validation, and limit errors receive clear status/error treatment.

## Motion

`prefers-reduced-motion: reduce` removes or shortens nonessential entrance, parallax, pulsing, smooth-scroll, and route-reveal effects. It does not hide state changes. Algorithm playback remains manually controllable, can always be paused, and uses immediate transitions under reduced motion.

Story Mode remains a readable document when decorative animation is reduced. Interactive demonstrations use explicit controls rather than requiring scroll velocity or pointer movement.

## Responsive and zoom behavior

- Layouts reflow instead of shrinking desktop panels into unreadable columns.
- The visualization remains primary; secondary controls move into labeled drawers/stacked regions.
- Touch targets are sized for coarse pointers and do not require hover precision.
- Text and controls support browser zoom; fixed heights are avoided around prose and inspector content.
- Playback controls remain reachable on short laptop and mobile viewports.
- Long source lines scroll within the code region instead of widening the page.

## Text, contrast, and themes

Both themes use design tokens for foreground, muted text, surface, border, status, and focus colors. Status colors are paired with labels/icons. Code, metrics, and graph labels use contrast appropriate to their size; muted copy is not used for essential errors or state.

Theme preference is a convenience stored locally. The initial theme follows the system preference when no choice has been stored.

## Forms and errors

- Every input has a visible label or an equivalent programmatic name.
- Groups such as objective, algorithm, and language have group labels.
- Disabled incompatible algorithms/heuristics explain the compatibility reason in nearby text.
- Import errors identify what failed and how to recover without exposing stack traces.
- Validation is not communicated by color alone and focus moves to, or can readily reach, the error summary.
- File import accepts JSON as a hint but still reports schema-level problems in human terms.

## Testing and release checks

The repository's unit/component tests cover deterministic control state and reduced-motion branches where they are represented in JavaScript. Playwright covers the primary keyboard and mobile flows in Chromium in CI. Type checking and linting catch invalid ARIA properties and common JSX issues, but they do not prove accessibility.

Before a release, perform these manual checks against a production build:

1. Navigate Story, Lab, Compare, Code, and Docs with the keyboard only.
2. Run, pause, step, reset, and scrub without using the graph SVG.
3. Read a run using the graph table, event narration, and inspector with NVDA/Firefox or NVDA/Chrome on Windows; add VoiceOver/Safari coverage when macOS is available.
4. Confirm focus visibility and logical order at 320 CSS pixels and at 200% browser zoom.
5. Enable operating-system reduced motion and verify that all content and controls remain usable.
6. Check both themes with an automated axe scan and a contrast analyzer, then manually review graph/status combinations that automation cannot understand.
7. Trigger invalid import, no path, unsupported algorithm, negative cycle, and trace-limit states and verify understandable announcements/recovery.

## Known limitations

- The SVG is a diagram, not an individually navigable virtual graph canvas; the table/inspector is the screen-reader interaction surface.
- v1 has no spoken sonification or spatial audio representation.
- Automated CI currently uses Chromium for selected end-to-end coverage. Firefox, WebKit, multiple screen readers, touch exploration, and switch-control testing remain manual release responsibilities.
- Native range-input keyboard behavior differs slightly among browsers.

Accessibility defects are functional bugs. Reports should include the route, browser, assistive technology and version, input method, expected behavior, and observed behavior without including private scenario content.
