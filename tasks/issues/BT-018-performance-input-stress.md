---
{
  "id": "BT-018",
  "title": "Stress frame pacing input transitions and scene rebuilding",
  "type": "chore",
  "status": "ready",
  "priority": "P1",
  "depends_on": [],
  "parent": null,
  "scope": ["application/render-loop.ts", "presentation/main.ts", "tests/render-loop.test.ts", "tests/browser/scenarios.ts"],
  "approval": "User directed autonomous implementation of the proposed pre-playtest performance/input stress batch on 2026-10-09. Preserve gameplay timings and normal UI.",
  "assignment": null,
  "blocked_reason": null
}
---
# BT-018: Stress frame pacing input transitions and scene rebuilding

## Problem

A precision course depends on consistent simulation and clean input transitions.
Ordinary short browser scenarios do not cover repeated rebuilds or frame stalls.

## Scope

Add repeatable scheduler tests at low/normal/high frame rates and after stalls.
Extend native production-browser scenarios for held-input restart/selection,
repeated level/editor switches and resource stability. Fix only reproduced
input/scheduler defects. Do not redesign rendering, retune gameplay or add tools.

## Acceptance criteria

- [ ] Fixed-step outcomes agree across representative 30/60/120 Hz frame schedules; stall capping and resume do not create catch-up bursts.
- [ ] Restart and level transitions clear held keys/pointers and do not leak duplicate render chains.
- [ ] Repeated level/editor rebuilds return geometry/texture counts to a stable per-scene baseline.
- [ ] Browser stress checks use explicit bounds/deadlines and preserve all existing acceptance scenarios.
- [ ] Full evaluation and production-browser acceptance pass; performance evidence is not mislabeled as physical-device certification.

## Implementation context

Reuse application/render-loop.ts and native CDP scenarios. Mobile scene/style
files belong to BT-003; coordinate any cross-scope defect before editing them.
One orchestrator will do this after BT-017 to avoid two primary-tree writers;
this scheduling choice is not a technical prerequisite.

## Verification

Run targeted scheduler tests and production browser checks. Record exact frame
schedules, repeat counts, resource measurements and recovered defects.

## Handoff

Pending.

## Result

Pending.
