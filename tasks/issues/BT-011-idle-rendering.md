---
{
  "id": "BT-011",
  "title": "Stop submitting unchanged frames while paused or hidden",
  "type": "bug",
  "status": "done",
  "priority": "P1",
  "depends_on": [],
  "parent": "BT-010",
  "scope": ["presentation/main.ts", "presentation/scene.ts", "application/render-loop.ts", "tests/render-loop.test.ts"],
  "approval": "Approved under the user's 2026-10-08 follow-up issue/fix request and the measured performance defect recorded in BT-010.",
  "assignment": {
    "owner": "idle-render-worker",
    "run": "1e4380d6-7c3d-470f-9f63-0370d667ae1b",
    "branch": "task/bt-011",
    "worktree": ".worktrees/BT-011"
  },
  "blocked_reason": null
}
---
# BT-011: Stop submitting unchanged frames while paused or hidden

## Problem

With First steps started and paused, a production Chromium probe observed 297
WebGL draw calls over 600 ms while state.tick stayed unchanged. The frame loop
keeps scheduling and drawing the same scene, wasting CPU/GPU/battery.

## Scope

Make the rendering loop idle when there is no visible animation or state change
to present. Paused gameplay and hidden pages must quiesce rather than run a busy
no-op RAF loop. Preserve intended visible intro/editor/win animation.

Wake/redraw correctly for resume, level changes, resize, editor interaction and
explicit debug stepping. Preserve fixed-step simulation, no fast-forward on
resume, input clearing, and safe pagehide/disposal. A small testable render-loop
helper is allowed if it keeps the implementation simpler.

Only edit the four declared files. Do not modify UI layout, levels, physics,
manifests, docs or tracker state. No new dependency.

## Acceptance criteria

- [x] After settling a pause or a frozen menu state, renderer frame/draw counters do not grow during an idle observation window.
- [x] Hidden documents stop requesting/drawing animation frames; restoration redraws safely without unpausing a manually paused game.
- [x] Resizing a paused game produces a correct fresh frame, not an empty/stretched canvas, without advancing simulation.
- [x] Resume continues the current state without catch-up ticks or duplicate RAF loops.
- [x] Intro, editor and victory visuals still animate when visible; editor hover/paint and debug.advance remain immediately observable.
- [x] Disposal cancels pending work and repeated transitions cannot restart a disposed loop.
- [x] Native regression tests and real-browser verification pass, along with the full repository suite/build.

## Implementation context

See frame/setPaused/load/menu/visibility/pagehide in presentation/main.ts and
Scene.resize/draw/dispose in presentation/scene.ts. The debug API is opt-in;
adding an accurate cumulative frames counter to metrics is acceptable and useful
for verification, but do not add a consumer-facing performance panel.

The parallel BT-002 worker owns the browser test harness only. Do not coordinate
through uncommitted shared files; retain the existing debug API contracts.

## Verification

Use fake scheduling/unit tests for pending-frame ownership, pause/resume,
invalidation, visibility and disposal. In an isolated real browser, measure a
stable counter across at least 500 ms of settled pause, then verify resume and a
paused resize. Run the level witnesses and npm run evaluate.

Owned preview port: 4333; browser context: boundstoy-bt011. Stop your server and
close owned pages before returning. Do not touch other previews/profiles.

## Handoff

- Summary: Worker implemented a single-chain idle-aware render loop with explicit invalidation.
- Changes: Exactly application/render-loop.ts, presentation/main.ts, presentation/scene.ts and tests/render-loop.test.ts. Added cumulative opt-in frame metrics, visibility handling and resize/highlight invalidation.
- Verification: Worker passed 103 tests/typecheck/build and all six witnesses. During 650 ms pause, frames 384->384, draw submissions 11584->11584, requests 350->350, tick 24->24, pending RAF 0. Native background-tab measurements also stayed unchanged for 650 ms; restoration drew once and remained paused. Paused resize drew one correctly-sized frame; first resume frame added zero ticks. Editor and disposal/rearm checks passed.
- Risks: Chromium software-WebGL evidence is not a hardware battery benchmark. Existing bundle-size warning remains. Screenshot artifacts were inspected inline because export was denied.
- Commit: f9ecc6ac3de8fab091a6c1608cb5857942e14a1e from worker 1e4380d6-7c3d-470f-9f63-0370d667ae1b, merged into master.
- Resources: Worker stopped preview 4333 and closed owned pages/auxiliary browser/profile. The orchestrator independently verified the combined build on owned port 4331.
- Decisions: Modal menus freeze background animation consistently. Visibility restoration does not unpause gameplay. Intro/editor/victory animations remain active when visible and uncovered.

## Result

- Summary: Accepted the performance fix with unchanged gameplay.
- Verification: Combined production probe observed 132 live control draw calls, then zero additional frames/draw calls during 650 ms of settled pause with tick fixed at 24 (baseline was 297 draws/600 ms). Portrait resize drew exactly one frame at 360x586 without changing tick; first resumed frame retained tick 24, then play advanced to 55. The frozen resized canvas was visually inspected and settled back to zero redraws after external screenshot/focus invalidation. All six integrated browser witnesses and 116 portable tests passed.
- Integration: Worker commit f9ecc6a is merged into master alongside the browser harness; no UI layout, level, physics or dependency changes.
