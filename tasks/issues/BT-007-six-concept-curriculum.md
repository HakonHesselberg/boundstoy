---
{
  "id": "BT-007",
  "title": "Build six focused levels from the existing mechanics",
  "type": "feature",
  "status": "in_progress",
  "priority": "P1",
  "depends_on": ["BT-006"],
  "parent": "BT-005",
  "scope": ["data/levels.ts", "data/replays.ts", "tests/courses.test.ts", "tests/guidance.test.ts", "tests/editor.test.ts", "scripts/inspect.ts"],
  "approval": "Approved by the user's 2026-10-08 maximum-ten-levels, one-concept-at-a-time request, recorded in BT-005; the orchestrator selected six levels.",
  "assignment": {
    "owner": "curriculum-worker",
    "run": "dispatching-sync; runtime agent ID will be recorded when returned",
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

- [ ] Exactly six levels ship, each with one named primary concept and no not-yet-taught special mechanic.
- [ ] Every level has a legal input-only deathless replay, visits its checkpoints and finishes at a reproducible tick.
- [ ] Soft ice requires turning at constant speed; hard ice requires alignment/curb use; timing levels require observing the actual hazard instead of bypassing it.
- [ ] Entry/landing zones, checkpoints and timing windows are forgiving enough for learning, with measurable tolerance checks where relevant.
- [ ] Lessons are short, accurate, ordered with checkpoints and appropriate for each concept.
- [ ] Inspection CLI and tests handle the full curriculum; editor tests no longer accidentally depend on old map coordinates.
- [ ] Core physics and validation code are unchanged and the full repository suite/build passes.

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

Pending.

## Result

Pending.
