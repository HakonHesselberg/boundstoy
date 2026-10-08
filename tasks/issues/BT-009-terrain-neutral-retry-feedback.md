---
{
  "id": "BT-009",
  "title": "Keep static-hazard retry feedback appropriate for every lesson",
  "type": "bug",
  "status": "done",
  "priority": "P1",
  "depends_on": ["BT-007"],
  "parent": "BT-005",
  "scope": ["application/guidance.ts", "tests/guidance.test.ts"],
  "approval": "Approved as a tightly scoped release defect under the user's shippable one-concept-per-level request in BT-005; discovered during BT-008 production QA.",
  "assignment": {
    "owner": "orchestrator-feedback-fix",
    "run": "ae1df791-ee88-45da-87ca-bc2da2630c7d",
    "branch": "master",
    "worktree": "."
  },
  "blocked_reason": null
}
---
# BT-009: Keep static-hazard retry feedback appropriate for every lesson

## Problem

In the production First steps level, walking into void produces:
"Over the edge. Turn earlier; green ice has no brakes." The walking lesson does
not contain green ice. The generic spike message also assumes a turning arc.
This confuses the one-concept curriculum and custom levels on normal ground.

## Scope

Make the shared void/spike retry strings accurate without assuming a terrain
model. Keep the specific hazard cause and useful avoidance guidance. Add a
regression for terrain-neutral static-hazard messages.

No physics, UI layout, level data or new feedback system. This is a small direct
orchestrator fix; no additional subagent is warranted.

## Acceptance criteria

- [x] Void and spike retry messages explain the static hazard without teaching ice, braking or arc-specific rules.
- [x] Pulse/saw messages and all existing gameplay behaviour are unchanged.
- [x] A regression fails on the old strings and passes after the fix.
- [x] Production First steps shows the corrected void feedback and the repository checks pass.

## Implementation context

`application/guidance.ts` owns the shared DEATH_MESSAGES map. Browser reproduction:
load level 0, advance 100 ticks right, 100 ticks up, then 80 ticks left. The last
segment leaves the normal-ground connector and records a void death.

## Verification

Targeted guidance tests, `npm run evaluate`, then reproduce the same death in
the rebuilt production browser and inspect its visible feedback.

## Handoff

- Summary: Static-hazard retry text is now terrain-neutral and appropriate for the first walking lesson and custom levels.
- Changes: Two strings in application/guidance.ts and one regression in tests/guidance.test.ts; pulse/saw messages and physics unchanged.
- Verification: New regression failed on the old void message, then npm run evaluate passed all 88 tests/typecheck/build. The production First steps reproduction now reports "Over the edge. Stay on the floor and plan your next move."
- Risks: None identified beyond the release's already documented browser/device limitations.
- Commit: e1fe4fe, with the scoped source/test changes and associated issue records.
- Resources: Reused the orchestrator's existing release preview; no new agent or server.

## Result

- Summary: Accepted; the release blocker is resolved.
- Verification: Reviewed the two-line message diff and regression, and confirmed the corrected actual browser feedback after rebuilding/reloading.
- Integration: e1fe4fe is on master. BT-008 can resume; no new mechanics or dependencies were introduced.
