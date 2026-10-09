---
{
  "id": "BT-017",
  "title": "Exercise checkpoint recovery and movement robustness",
  "type": "chore",
  "status": "in_progress",
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

- [ ] Every built-in checkpoint is reached legally, followed by an actual death and safe respawn with preserved progress.
- [ ] Recovery witnesses complete all remaining sections from checkpoint centers, including all cycle phases of built-in timed courses.
- [ ] Held respawn inputs, repeated resets, diagonal/wall cases and deterministic varied inputs have bounded regression coverage.
- [ ] Existing nine exact witnesses and original-six preservation assertions remain unchanged and pass.
- [ ] Results state the sampled bounds and do not claim exhaustive reachability or human difficulty certification.

## Implementation context

Use immutable createState/step, current data/replays and actual hazard periods.
Prefer test-local input drivers to new production abstractions. Do not teleport,
disable hazards or change collision rules to manufacture successful witnesses.
Any test-selected starting phase must be reached through real safe waiting.

## Verification

Run targeted recovery/physics/course tests, then full evaluation. Record covered
checkpoints/phases, actual failures and any fixes. Release docs belong to BT-019.

## Handoff

Pending.

## Result

Pending.
