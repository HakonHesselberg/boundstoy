---
{
  "id": "BT-010",
  "title": "Harden browser verification and idle rendering",
  "type": "epic",
  "status": "done",
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

- [x] Browser acceptance can be run repeatedly from a documented local command without a new dependency.
- [x] A frozen paused/hidden game does not continually redraw, while required redraws and animations remain correct.
- [x] Both worker commits are scoped, reviewed and integrated with passing combined checks.
- [x] Only owned test resources are stopped/cleaned, and all child issues have truthful evidence.

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

- Summary: Two independent workers completed the scoped follow-up issues, followed by orchestrator review and combined acceptance.
- Changes: BT-002 added dependency-free production Chromium checks; BT-011 removed unnecessary paused/hidden rendering; BT-012 verified integration and documented the workflow.
- Verification: 116 portable tests/typecheck/build pass; integrated browser acceptance passes all current input/editor/save/offline/replay checks. Intentional failure returns nonzero with verified cleanup. Paused WebGL submissions fell from the measured 297/600 ms baseline to zero over a 650 ms settled observation.
- Risks: Documented browser/platform and uncatchable-cleanup limitations remain; no broad cross-browser or battery-life guarantee is implied.
- Commit: Worker commits a5d9d7a and f9ecc6a are integrated, with the small same-scope entrypoint fix and acceptance records in the closing commit.
- Resources: Both workers are idle, no owned preview/browser process remains active, and evidence is retained under ignored artifacts directories.
- Decisions: Preserved the six existing levels and mechanics. The new browser runner uses installed Chromium, native Node APIs and its own isolated sandboxed profile, not additional npm packages.

## Result

- Summary: Accepted and complete; no approved work remains in this batch.
- Verification: BT-002, BT-011 and BT-012 each have checked acceptance criteria, real command/browser evidence and resource-cleanup results.
- Integration: Source, command documentation and local issue records are ready in master; no remote push or deployment.
