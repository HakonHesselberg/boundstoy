---
{
  "id": "BT-017",
  "title": "Exercise checkpoint recovery and movement robustness",
  "type": "chore",
  "status": "done",
  "priority": "P1",
  "depends_on": [],
  "parent": null,
  "scope": ["tests/recovery.test.ts", "tests/physics.test.ts", "tests/courses.test.ts", "core/simulation.ts"],
  "approval": "User directed autonomous implementation of the proposed pre-playtest reliability batch on 2026-10-09. Preserve intended physics, original layouts and difficulty.",
  "assignment": {
    "owner": "recovery-orchestrator",
    "run": "ae1df791-ee88-45da-87ca-bc2da2630c7d",
    "branch": "master",
    "worktree": "."
  },
  "blocked_reason": null
}
---
# BT-017: Exercise checkpoint recovery and movement robustness

## Problem

Exact clean-run witnesses do not establish that every actual death/checkpoint
recovery is playable at changing hazard phases or under messy directional input.

## Scope

Add deterministic actual-input recovery coverage for every built-in checkpoint,
including holding input during respawn and resuming at different hazard phases.
Probe diagonal/wall interactions and repeated restarts with bounded, reproducible
inputs. Fix only reproduced defects tightly coupled to these checks.
Do not alter speeds, collision dimensions, hazard timing, layouts, score schema
or the intended rule that checkpoints are recovery aids rather than required keys.

## Acceptance criteria

- [x] Every built-in checkpoint is reached legally, followed by an actual death and safe respawn with preserved progress.
- [x] Recovery witnesses complete all remaining sections from checkpoint centers, including all cycle phases of built-in timed courses.
- [x] Held respawn inputs, repeated resets, diagonal/wall cases and deterministic varied inputs have bounded regression coverage.
- [x] Existing nine exact witnesses and original-six preservation assertions remain unchanged and pass.
- [x] Results state the sampled bounds and do not claim exhaustive reachability or human difficulty certification.

## Implementation context

Use immutable createState/step, current data/replays and actual hazard periods.
Prefer test-local input drivers to new production abstractions. Do not teleport,
disable hazards or change collision rules to manufacture successful witnesses.
Any test-selected starting phase must be reached through real safe waiting.

## Verification

Run targeted recovery/physics/course tests, then full evaluation. Record covered
checkpoints/phases, actual failures and any fixes. Release docs belong to BT-019.

## Handoff

- Summary: Added actual-death recovery and bounded varied-input coverage; no production defect or difficulty change was needed.
- Changes: tests/recovery.test.ts and three diagonal corner-seam cases in tests/physics.test.ts. Core, level data and original witnesses are unchanged.
- Verification: Targeted recovery/physics/course run passed 90 tests; full evaluation passed 158 tests, typecheck/build. There are 25 sites (nine spawns plus all 16 checkpoints), 4575 phase-specific recovery runs, nine held-input states across each 54-tick respawn, and 72 seeded 1200-tick runs executed twice with resets and immutable-state checks. Evidence: artifacts/bt017-recovery.log and artifacts/bt017-evaluate.log.
- Risks: The driver rejoins known routes with real cardinal input and safe phase waits; it does not prove all trajectories or human timing accuracy. Varied-input and corner probes are bounded, not an exhaustive shortcut solver.
- Commit: Direct primary-tree changes in the orchestrator's checkpoint-recovery commit.
- Resources: No server, browser, dependency installation or external resource needed.
- Decisions: Keep checkpoints as recovery aids, not mandatory goal keys. Preserve all gameplay rules because no reproducible defect was found.

## Result

- Summary: Accepted. Every current spawn/checkpoint can recover and finish without another death, including every phase of its hazard cycle.
- Verification: Actual legal witness states lead to actual deaths, countdown and center respawn; subsequent movement/waiting uses step without teleportation or hazard disabling. Existing exact-final-tick tests and original-six hash remain intact.
- Integration: Tests are committed on master; combined browser/release acceptance belongs to BT-019.
