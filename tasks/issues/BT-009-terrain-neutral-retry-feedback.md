---
{
  "id": "BT-009",
  "title": "Keep static-hazard retry feedback appropriate for every lesson",
  "type": "bug",
  "status": "in_progress",
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

- [ ] Void and spike retry messages explain the static hazard without teaching ice, braking or arc-specific rules.
- [ ] Pulse/saw messages and all existing gameplay behaviour are unchanged.
- [ ] A regression fails on the old strings and passes after the fix.
- [ ] Production First steps shows the corrected void feedback and the repository checks pass.

## Implementation context

`application/guidance.ts` owns the shared DEATH_MESSAGES map. Browser reproduction:
load level 0, advance 100 ticks right, 100 ticks up, then 80 ticks left. The last
segment leaves the normal-ground connector and records a void death.

## Verification

Targeted guidance tests, `npm run evaluate`, then reproduce the same death in
the rebuilt production browser and inspect its visible feedback.

## Handoff

Pending.

## Result

Pending.
