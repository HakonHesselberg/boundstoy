---
{
  "id": "BT-003",
  "title": "Improve narrow-screen course readability",
  "type": "feature",
  "status": "done",
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

- [x] At 390 CSS pixels wide, the player has a clearly identifiable visual footprint of at least 12 CSS pixels without changing collision dimensions.
- [x] Upcoming hazards and the next checkpoint remain discoverable; no mandatory hidden offscreen move is introduced.
- [x] Touch movement, pause and restart remain visible/reachable with no horizontal page overflow at 390x844 and 844x390.
- [x] Desktop layout at 1440x1200 retains the established complete-course view.
- [x] Before/after evidence records the viewports, player screen-space measurement and relevant interaction behaviour.
- [x] Numbered checkpoint/exit cues and temporary pockets remain distinguishable on all three practice maps; warning/blast visuals retain exact lethal timing.

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

- Summary: Added a hollow non-colliding player locator and adaptive route signs, retaining the original body and complete-board camera.
- Changes: presentation/readability.ts, presentation/scene.ts, tests/mobile-readability.test.ts and tests/hazards.test.ts only. No CSS, input, physics, data, score or dependency changes.
- Verification: Worker evaluation passed 141 tests and full browser acceptance. Actual opaque-pixel regression covers 36 practice-spawn/pocket/escape cases in portrait, landscape, DPR 2 and desktop. Portrait robot widths before were 6.900/7.886/9.200 CSS pixels; locator footprints after are 13x14/14x17/13x16. Minimum phone pocket/escape footprint is 12x14. A genuine 11-pixel failure preceded the fix. All 24 pocket-wave pads retain exact warning/lethal visibility, including reduced motion.
- Risks: Measurements establish visibility and route coverage, not human navigation accuracy or physical touchscreen certification. Dense custom editor layouts are not exhaustively certified.
- Commit: 16303ecd1f7e0be8a8a35a93878d92551f483dd1 on task/bt-003, integrated by d68ad9b.
- Resources: Worker stopped port 4337 and its isolated page/context. Full browser and pixel reports are worker artifacts/browser-check/run-UZWVad and run-D9LaSJ. Parent reports are artifacts/browser-check/run-ZFOU1d and run-jhSaUS; owned automated browsers cleaned, and manual preview 4339 stopped.
- Decisions: Keep physical collision/body geometry unchanged. The locator points away from pocket mouths; 18-pixel signs replace unreadably small labels. Hide redundant START text on narrow views, and omit the locator when the original body is already large enough.

## Result

- Summary: Accepted after scoped review, combined evaluation, exact-pixel rerun and visual inspection.
- Verification: Parent evaluation passed 179 tests/typecheck/build; all 36 real-pixel measurements passed in the integrated game. Parent inspected all three practice maps in portrait, Pocket wave's tick-873 escape in landscape, and the unchanged desktop view. Evidence: artifacts/bt003-integrated-evaluate.log, artifacts/bt003-integrated-pixels.log and artifacts/preplay-visual/. Only the pause overlay was hidden for screenshots, never hazards/collision.
- Integration: Scoped worker commit is on master. BT-019 covers the expanded combined browser suite and release documentation.
