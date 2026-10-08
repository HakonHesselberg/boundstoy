---
{
  "id": "BT-003",
  "title": "Improve narrow-screen course readability",
  "type": "feature",
  "status": "backlog",
  "priority": "P2",
  "depends_on": [],
  "parent": null,
  "scope": ["presentation/scene.ts", "presentation/style.css", "presentation/main.ts", "tests/mobile-readability.test.ts", "docs/TESTING.md"],
  "approval": null,
  "assignment": null,
  "blocked_reason": null
}
---
# BT-003: Improve narrow-screen course readability

## Problem

The entire course fits a narrow viewport, but that makes the robot and obstacle
details small. Improve visibility without losing route context or disrupting
touch controls. This is a candidate for user approval, not a confirmed bug or
permission to choose an unrestricted camera redesign.

## Scope

Measure the current narrow-screen scene, then make a bounded camera/layout
improvement with useful route context. Preserve the established desktop view.
Any new camera interaction must be explained in the UI and work with touch.

Do not change terrain physics, collision sizes, hazard timing, level geometry,
progress data, or the original art direction.

## Acceptance criteria

- [ ] At 390 CSS pixels wide, the player has a clearly identifiable visual footprint of at least 12 CSS pixels without changing collision dimensions.
- [ ] Upcoming hazards and the next checkpoint remain discoverable; no mandatory hidden offscreen move is introduced.
- [ ] Touch movement, pause and restart remain visible/reachable with no horizontal page overflow at 390x844 and 844x390.
- [ ] Desktop layout at 1440x1200 retains the established complete-course view.
- [ ] Before/after evidence records the viewports, player screen-space measurement and relevant interaction behaviour.

## Implementation context

Review `Scene.resize`, `Scene.project`, the mobile CSS and the touch control
handlers. The scene is orthographic, with screen-aligned board axes. Numbered
markers and route guidance are important navigation cues. Discuss a materially
different camera interaction before expanding this issue's scope.

## Verification

Capture reproducible desktop/portrait/landscape evidence with the player and
nearby obstacles at known states. Exercise actual touch input and focus/pause
behaviour. Run the core replay tests and `npm run evaluate` to confirm mechanics
and scores remain unchanged.

## Handoff

Pending.

## Result

Pending.
