---
{
  "id": "BT-010",
  "title": "Harden browser verification and idle rendering",
  "type": "epic",
  "status": "in_progress",
  "priority": "P1",
  "depends_on": [],
  "parent": null,
  "scope": [],
  "approval": "User requested more issues and agent fixes on 2026-10-08. This bounded batch addresses the measured paused-rendering defect and existing browser-smoke automation gap, without changing levels or mechanics.",
  "assignment": null,
  "blocked_reason": null
}
---
# BT-010: Harden browser verification and idle rendering

## Problem

The game has a checked-in simulation suite but its production-browser acceptance
is still manual. Investigation also measured ongoing WebGL submission while the
game was paused: 297 draw calls in 600 ms with a frozen simulation tick.

## Scope

Complete BT-002 with a dependency-free local browser command, fix paused/hidden
rendering in BT-011, and review their combined behaviour in BT-012. Two workers
may run in parallel because their write scopes are disjoint.

Do not add levels, mechanics, permanent debug UI, runtime dependencies, cloud
services or a large orchestration framework. Keep the existing six-level release.
BT-003 and BT-004 remain backlog candidates outside this batch.

## Acceptance criteria

- [ ] Browser acceptance can be run repeatedly from a documented local command without a new dependency.
- [ ] A frozen paused/hidden game does not continually redraw, while required redraws and animations remain correct.
- [ ] Both worker commits are scoped, reviewed and integrated with passing combined checks.
- [ ] Only owned test resources are stopped/cleaned, and all child issues have truthful evidence.

## Implementation context

Baseline a0c9e8f is clean. Node is v24.19.0 with native WebSocket and fetch;
/usr/bin/chromium is available. Three.js exposes renderer.info.render.frame,
which can support an opt-in debug frame counter without a runtime dependency.

The existing frame loop calls scene.draw and schedules another RAF unconditionally.
setPaused freezes simulation/visual time, but not submission of identical frames.
Handle resize, editor changes, explicit debug steps, menu transitions, visibility
and disposal deliberately rather than merely returning early inside a busy loop.

## Verification

Both children run their targeted checks and npm run evaluate. BT-012 runs the
actual new browser command against the integrated build and checks draw-count
quiescence, wake-ups, input/replays, failure cleanup and clean resources.

## Handoff

Pending.

## Result

Pending.
