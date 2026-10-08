---
{
  "id": "BT-011",
  "title": "Stop submitting unchanged frames while paused or hidden",
  "type": "bug",
  "status": "in_progress",
  "priority": "P1",
  "depends_on": [],
  "parent": "BT-010",
  "scope": ["presentation/main.ts", "presentation/scene.ts", "application/render-loop.ts", "tests/render-loop.test.ts"],
  "approval": "Approved under the user's 2026-10-08 follow-up issue/fix request and the measured performance defect recorded in BT-010.",
  "assignment": {
    "owner": "idle-render-worker",
    "run": "dispatching-sync; runtime agent ID will be recorded when returned",
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

- [ ] After settling a pause or a frozen menu state, renderer frame/draw counters do not grow during an idle observation window.
- [ ] Hidden documents stop requesting/drawing animation frames; restoration redraws safely without unpausing a manually paused game.
- [ ] Resizing a paused game produces a correct fresh frame, not an empty/stretched canvas, without advancing simulation.
- [ ] Resume continues the current state without catch-up ticks or duplicate RAF loops.
- [ ] Intro, editor and victory visuals still animate when visible; editor hover/paint and debug.advance remain immediately observable.
- [ ] Disposal cancels pending work and repeated transitions cannot restart a disposed loop.
- [ ] Native regression tests and real-browser verification pass, along with the full repository suite/build.

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

Pending.

## Result

Pending.
