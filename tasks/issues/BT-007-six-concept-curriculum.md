---
{
  "id": "BT-007",
  "title": "Build six focused levels from the existing mechanics",
  "type": "feature",
  "status": "done",
  "priority": "P1",
  "depends_on": ["BT-006"],
  "parent": "BT-005",
  "scope": ["data/levels.ts", "data/replays.ts", "tests/courses.test.ts", "tests/guidance.test.ts", "tests/editor.test.ts", "scripts/inspect.ts"],
  "approval": "Approved by the user's 2026-10-08 maximum-ten-levels, one-concept-at-a-time request, recorded in BT-005; the orchestrator selected six levels.",
  "assignment": {
    "owner": "curriculum-worker",
    "run": "cb987482-eafd-4ca7-899a-bdb8eb078f41",
    "branch": "task/bt-007",
    "worktree": ".worktrees/BT-007"
  },
  "blocked_reason": null
}
---
# BT-007: Build six focused levels from the existing mechanics

## Problem

The two current courses introduce and combine several concepts at once. New
players need a short, deliberate learning curve, and the level tooling/tests
must not assume exactly two maps.

## Scope

Create six attractive, compact, genuinely playable levels in this order:
walking/navigation, soft-ice turning, hard-ice alignment/curb turns, pulse timing,
saw timing, and mud timing. Static walls/void/spikes are established obstacles,
not new powers. The mud lesson may reuse an already-taught pulse to demonstrate
the slower crossing. Do not add a mixed-mechanics final gauntlet.

Use existing terrain and hazard kinds and unchanged simulation rules.
Preserve the LEVELS, COURSE_LESSONS and REPLAYS export interfaces. Give revised
levels stable new IDs so old-physics/course records do not become false scores.
Update only the six declared data/test/inspection surfaces.

## Acceptance criteria

- [x] Exactly six levels ship, each with one named primary concept and no not-yet-taught special mechanic.
- [x] Every level has a legal input-only deathless replay, visits its checkpoints and finishes at a reproducible tick.
- [x] Soft ice requires turning at constant speed; hard ice requires alignment/curb use; timing levels require observing the actual hazard instead of bypassing it.
- [x] Entry/landing zones, checkpoints and timing windows are forgiving enough for learning, with measurable tolerance checks where relevant.
- [x] Lessons are short, accurate, ordered with checkpoints and appropriate for each concept.
- [x] Inspection CLI and tests handle the full curriculum; editor tests no longer accidentally depend on old map coordinates.
- [x] Core physics and validation code are unchanged and the full repository suite/build passes.

## Implementation context

Do not reinterpret "turn only" as braking: soft ice is always 4.4 tiles/s with
bounded steering and speed-preserving wall reflections. Hard ice locks direction
and stops at curbs. Those behaviours already have independent unit tests.

The UI worker generalizes counts and menus first. Use shape/layout variation,
not more systems or assets. Avoid frame-perfect witnesses: favor middle-of-window
waits and test small input errors. Replace tests that wrongly demand soft ice in
every level with concept-specific assertions.

Execution uses an isolated issue worktree based on the integrated UI changes.
Issue-branch commits are authorized; no tracker edits or remote pushes.
Temporary search tools belong in your session artifacts, not the project.

## Verification

Run the targeted course/guidance/editor tests and `npm run evaluate`. Run the
inspection command for all six witnesses and report names, IDs, primary concepts,
checkpoint counts, replay ticks and timing tolerances. Do not merely count tiles:
verify wrong strategies fail where the lesson requires a decision.

## Handoff

- Summary: Six focused levels replace the two mixed courses; implementation is ready for acceptance.
- Changes: Exactly data/levels.ts, data/replays.ts, tests/courses.test.ts, tests/guidance.test.ts, tests/editor.test.ts and scripts/inspect.ts.
- Verification: Worker ran 39 targeted tests and npm run evaluate with 87 total tests passing, tracker/typecheck/build successful, all six inspection witnesses and git diff --check. Inputs are keyboard-realizable, visit checkpoints in order, finish on the exact final tick and never die. Wrong-strategy and safe-window checks are included.
- Risks: Combined production-browser acceptance remains BT-008. Existing Vite bundle-size warning remains non-blocking.
- Commit: 21a270a108469298f4d33b24b9799cae900333fe on task/bt-007.
- Resources: No preview server, browser context or scratch files created by the worker.
- Decisions: New score IDs; mud reuses the taught pulse (104 exposure ticks versus 44 for walking). No physics/UI changes, tracker edits, pushes or worker merges.

| Level / ID | Focus | Checkpoints | Witness ticks | Evidence |
| --- | --- | --- | --- | --- |
| First steps / first-steps-v1 | Walking | 2 | 484 | Release-stop and safe 600-tick wall hold |
| Gentle curve / gentle-curve-v1 | Soft ice | 1 | 435 | Both turn durations +/-6 ticks; 169 safe landing trials |
| Curb turn / curb-turn-v1 | Hard ice | 2 | 575 | Alignment +/-6, curb arrival -24/0/+24; 39 trials |
| Pulse crossing / pulse-crossing-v1 | Pulse timing | 1 | 520 | Every launch offset within +/-24 ticks |
| Saw crossing / saw-crossing-v1 | Saw timing | 1 | 440 | Every launch offset within +/-24 ticks |
| Take your time / mud-crossing-v1 | Mud | 1 | 806 | Every launch offset within +/-24 ticks |

## Result

- Summary: Accepted the six-concept curriculum and unlocked release integration.
- Verification: Orchestrator confirmed exactly the authorized six files changed, clean worker/root trees, whitespace checks, and all 87 tests/typecheck/build passing after integration. Native checks exercise real course behaviour, not just terrain counts.
- Integration: Fast-forwarded master to 21a270a108469298f4d33b24b9799cae900333fe. No remote push; combined browser/UI acceptance is BT-008.
