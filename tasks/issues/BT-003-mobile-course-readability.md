---
{
  "id": "BT-003",
  "title": "Improve narrow-screen course readability",
  "type": "feature",
  "status": "in_progress",
  "priority": "P2",
  "depends_on": [],
  "parent": null,
  "scope": ["presentation/scene.ts", "presentation/style.css", "presentation/readability.ts", "presentation/hazard-visuals.ts", "tests/mobile-readability.test.ts", "tests/hazards.test.ts"],
  "approval": "User directed autonomous implementation of the proposed pre-playtest reliability, readability, Astro and performance batch on 2026-10-09. Preserve physics, level geometry and difficulty.",
  "assignment": {
    "owner": "mobile-readability-worker",
    "run": "119ed90c-af2d-4c2c-b383-c9803068510d",
    "branch": "task/bt-003",
    "worktree": ".worktrees/BT-003"
  },
  "blocked_reason": null
}
---
# BT-003: Improve narrow-screen course readability

## Problem

The entire course fits a narrow viewport, but that makes the robot and obstacle
details small. Improve visibility without losing route context or disrupting
touch controls. The nine-course screenshots confirmed small player and route
markers, particularly on the larger practice maps.

## Scope

Measure the current narrow-screen scene, then improve adaptive player/route
markers while preserving the complete-board camera and established desktop
view. Prefer clearly distinct non-colliding locator cues to misleadingly
enlarging the physical player. Do not introduce pan/zoom controls or new UI.
Inspect the three pocket-wave orientations and exact warning/blast boundaries.
The orchestrator handles release documentation and shared browser scenarios.

Do not change terrain physics, collision sizes, hazard timing, level geometry,
progress data, or the original art direction.

## Acceptance criteria

- [ ] At 390 CSS pixels wide, the player has a clearly identifiable visual footprint of at least 12 CSS pixels without changing collision dimensions.
- [ ] Upcoming hazards and the next checkpoint remain discoverable; no mandatory hidden offscreen move is introduced.
- [ ] Touch movement, pause and restart remain visible/reachable with no horizontal page overflow at 390x844 and 844x390.
- [ ] Desktop layout at 1440x1200 retains the established complete-course view.
- [ ] Before/after evidence records the viewports, player screen-space measurement and relevant interaction behaviour.
- [ ] Numbered checkpoint/exit cues and temporary pockets remain distinguishable on all three practice maps; warning/blast visuals retain exact lethal timing.

## Implementation context

Review `Scene.resize`, `Scene.project`, marker construction and mobile CSS.
The scene is orthographic, with screen-aligned board axes. Preserve the normal
HUD and no-tutorial flow. Application input code is read-only for this issue.
Do not change core/data/dependencies. Use port 4337 and isolated browser context
boundstoy-bt003 if a manual preview is needed; stop owned resources afterward.

## Verification

Capture reproducible desktop/portrait/landscape evidence with the player and
nearby obstacles at known states. Exercise actual touch input and focus/pause
behaviour. Run the core replay tests and `npm run evaluate` to confirm mechanics
and scores remain unchanged.

## Handoff

Pending.

## Result

Pending.
