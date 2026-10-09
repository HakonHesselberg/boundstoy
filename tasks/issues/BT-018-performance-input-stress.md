---
{
  "id": "BT-018",
  "title": "Stress frame pacing input transitions and scene rebuilding",
  "type": "chore",
  "status": "done",
  "priority": "P1",
  "depends_on": [],
  "parent": null,
  "scope": ["application/render-loop.ts", "presentation/main.ts", "tests/render-loop.test.ts", "tests/browser/scenarios.ts", "tests/browser/runtime.ts", "tests/browser-check.test.ts"],
  "approval": "User directed autonomous implementation of the proposed pre-playtest performance/input stress batch on 2026-10-09. Preserve gameplay timings and normal UI.",
  "assignment": {
    "owner": "stress-orchestrator",
    "run": "ae1df791-ee88-45da-87ca-bc2da2630c7d",
    "branch": "master",
    "worktree": "."
  },
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
The shared runner's whole-run default deadline may be adjusted to accommodate
the measured additional rebuild workload; per-command deadlines and failure
assertions remain strict. A 90-second run timed out while making progress,
whereas the complete stress suite passed with a 180-second bound.

## Acceptance criteria

- [x] Fixed-step outcomes agree across representative 30/60/120 Hz frame schedules; stall capping and resume do not create catch-up bursts.
- [x] Restart and level transitions clear held keys/pointers and do not leak duplicate render chains.
- [x] Repeated level/editor rebuilds return geometry/texture counts to a stable per-scene baseline.
- [x] Browser stress checks use explicit bounds/deadlines and preserve all existing acceptance scenarios.
- [x] Full evaluation and production-browser acceptance pass; performance evidence is not mislabeled as physical-device certification.

## Implementation context

Reuse application/render-loop.ts and native CDP scenarios. Mobile scene/style
files belong to BT-003; coordinate any cross-scope defect before editing them.
One orchestrator will do this after BT-017 to avoid two primary-tree writers;
this scheduling choice is not a technical prerequisite.

## Verification

Run targeted scheduler tests and production browser checks. Record exact frame
schedules, repeat counts, resource measurements and recovered defects.

## Handoff

- Summary: Found and fixed two real defects: 120 Hz rendering could consume 1199 rather than 1200 simulation ticks in ten seconds, and keyboard auto-repeat could re-arm movement after restart/selection cleared a held key.
- Changes: Added a shared fixed-step partition function in application/render-loop.ts, used by the real frame loop and tests, with a tiny tick-boundary rounding tolerance and invalid-time guards. Directional auto-repeat no longer re-adds cleared keys. Added frame/stall tests and native browser stress scenarios; raised only the whole-run default from 90 to 180 seconds for the measured larger workload.
- Verification: Both regressions failed before their fixes. Full evaluation passes 165 tests/typecheck/build. All 23 production-browser groups pass, preserving nine exact witnesses. Frame schedules cover 15/30/60/120/144 Hz, irregular intervals and a five-second scheduler stall. Browser tests cover 4x CPU throttling, a 200 ms main-thread stall, held-key repeats, held-touch restart, 36 level rebuilds and four editor/playtest returns.
- Risks: These are synthetic schedules and software-WebGL measurements, not physical-device or energy certification. The complete browser run took 112 seconds without heavy contention and 167 seconds under concurrent work; users can explicitly override the bounded timeout.
- Commit: Direct primary-tree implementation in the orchestrator's frame/input stress commit.
- Resources: Evidence in artifacts/bt018-scheduler-before.log, bt018-scheduler-after.log, bt018-evaluate.log and artifacts/browser-check/run-Xds1Bi/report.json. Independently confirmed PID/groups, profiles and preview/debug ports cleaned for all five reproduction/retry/final runs.
- Decisions: Preserve 120 Hz physics, hazard periods, layouts and reference replay ticks. Round only floating-point noise, retain genuine partial ticks, cap stalls at the existing 100 ms, and require a fresh press after input clearing.

## Result

- Summary: Accepted. The reported timing/input defects are reproduced and fixed; repeated rebuilds show no accumulating geometry/texture counts.
- Verification: Final default npm run test:browser passes with strict per-command deadlines and 23 groups. Pocket wave returns to 173 geometries/10 textures each rebuild; the retained editor returns to 32/7. An initially synchronous 36-scene test batch was split into individually bounded calls rather than weakening command deadlines. Earlier 90-second timeout was resolved by the measured 180-second whole-run budget.
- Integration: Code, tests and canonical evidence are committed on master. BT-019 will verify the combined readability/Astro changes against the expanded suite.
