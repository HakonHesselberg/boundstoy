---
{
  "id": "BT-041",
  "title": "Frame continuous-world sections without resetting play",
  "type": "feature",
  "status": "done",
  "priority": "P1",
  "depends_on": ["BT-040", "BT-037"],
  "parent": "BT-024",
  "scope": ["presentation/scene.ts", "presentation/main.ts", "presentation/readability.ts", "presentation/world-camera.ts", "tests/world-camera.test.ts", "tests/ground-visuals.test.ts", "tests/motion.test.ts", "tests/browser/world-camera.ts", "docs/ARCHITECTURE.md"],
  "approval": "2026-10-10 user approved implementation of the entire BT-038 plan with bounded subagents where helpful.",
  "assignment": null,
  "blocked_reason": null
}
---
# BT-041: Frame continuous-world sections without resetting play

## Problem

Fitting a complete eight-puzzle world into the existing whole-level camera would
make gameplay unreadable. Loading separate courses would break continuity.

## Scope

Fit mostly fixed views to the current puzzle, entry and completion landmark.
Support safe boundary transitions, backtracking and correct editor picking.
Reuse accepted BT-037 renderer/motion interfaces. Render only necessary world
geometry where practical; do not add a streaming framework or alter physics.

## Acceptance criteria

- [x] A joined-world fixture traverses forward and backward without `loadCourse`, teleportation or clock/progress resets.
- [x] Current and upcoming required hazards are visible before commitment; backtracking does not leave the player off-screen.
- [x] Camera location and highest completed checkpoint are independent.
- [x] Boundary transitions do not steal input, pause time or hide hazards; reduced motion uses stable direct framing.
- [x] Picking/projecting retain global coordinates after each view change.
- [x] Repeated transitions preserve bounded renderer resources and paused/hidden idleness.

## Implementation context

Implementation approved; BT-038 defines camera priorities. Begin with immediate safe
view changes; animation is optional and must never outrank visibility.
Keep global hazard sampling continuous even for off-screen sections. BT-052
and BT-056 own relevant audio behavior; do not emit all-world cues as a side
effect of rendering. BT-037 is now code-accepted, including the body-only
respawn-pop correction; human presentation acceptance remains a later gate.

## Verification

TDD for framing, coordinate conversion and boundary/backtracking selection.
Run `node --test tests/world-camera.test.ts`, `npm test`, `npm run build`,
then the new `node tests/browser/world-camera.ts` using the existing harness.
Record transitions at 1280x900, 390x844 and 844x390, full/reduced motion,
including held movement, resize and repeated section rebuilds.

## Handoff

- Summary: Section/connector/follow camera integrated without run or motion resets.
- Changes: `presentation/world-camera.ts`, scene/main read-only debug hooks,
  unit/native camera tests and architecture docs. Detailed handoff and
  issue-only patch: `artifacts/bt041/handoff.md`, `artifacts/bt041/change.patch`.
- Verification: RED framing/resize/patrol/depth checks, targeted 20/20,
  full 324/324 and build passed. Native final camera run
  `artifacts/browser-check/run-22cBXg/report.json`; 96 captures under
  `artifacts/world-camera/run-tmOks4/`. Existing browser/readability/motion
  coverage passed; one combined motion timeout passed as bounded subsets.
- Risks: Terrain remains resident and instanced; conservative connector/patrol
  unions can shrink tiles. Actual world layout readability/performance remain
  later gates, not guaranteed by this fixture.
- Commit: None; accepted baseline preserved in primary master worktree.
- Resources: All runner-owned browsers, profiles and previews cleaned up.
- Decisions: Direct transitions, position-based backtracking independent of
  progress; follow constrained to required framing. No audio/UI persistence work.

## Result

- Summary: Accepted after direct helper/scene/main diff review.
- Verification: Orchestrator reran 20 targeted rendering tests and diff checks,
  inspected portrait connector and desktop backtrack captures, and reviewed
  native input/resource/pause evidence. Backtracking retains both checkpoints
  while camera shows section zero; level-build count stays unchanged.
- Integration: Accepted uncommitted changes. BT-052 must verify camera framing
  with real authored content rather than the open integration fixture.
