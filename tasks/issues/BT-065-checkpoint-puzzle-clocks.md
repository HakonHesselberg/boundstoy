---
{
  "id": "BT-065",
  "title": "Run only the active checkpoint puzzle",
  "type": "feature",
  "status": "done",
  "priority": "P1",
  "depends_on": ["BT-040"],
  "parent": "BT-038",
  "scope": ["core/level.ts", "core/world.ts", "core/simulation.ts", "tests/checkpoint-puzzles.test.ts"],
  "approval": "2026-10-11 user requested puzzles start only after the previous puzzle is completed; confirmed completed hazards deactivate, death/respawn preserves the active pattern, and explicit Restart resets that pattern at the checkpoint.",
  "assignment": null,
  "blocked_reason": null
}
---
# BT-065: Run only the active checkpoint puzzle

## Problem

The shared world clock runs later puzzles before the player completes their
predecessor. Completed puzzles also remain hazardous during backtracking.

## Scope

Add an opt-in checkpoint puzzle mode to V2 worlds, explicit hazard section
ownership, active-only timed hazards and a checkpoint-restart transform.
Preserve V1 and existing global-clock V2 imports and all four movement rules.
Void and spikes remain terrain hazards; timed pulse/saw activation is gated.

## Acceptance criteria

- [x] Only the first incomplete section's timed hazards run; future and completed sections are inactive.
- [x] Checkpoint collection starts the next pattern at local tick zero without resetting elapsed time, deaths or motion.
- [x] Ordinary death and respawn do not reset the active clock.
- [x] Explicit restart returns to the saved checkpoint and resets its pattern, retaining elapsed time, deaths and progression.
- [x] Hazard ownership is validated and preserved by JSON import/export.
- [x] Pure regression tests cover activation, deactivation, backtracking, retries and unchanged legacy behavior.

## Implementation context

Use `World.puzzleMode?: 'checkpoint'`, `Hazard.sectionId?: string`, and the
existing `State.patternOffset` as the active section epoch; no second running
clock or wall-clock dependency. Checkpoint-mode hazards require valid section IDs.
Public helpers: `checkpointPuzzles(level)`, `hazardEnabled(level, hazard, state)`,
and `restartCheckpoint(level, state)`. `lethalAt` accepts optional state context,
required for checkpoint-mode worlds, so simulation and snapshot validation can
share activation rules. Completed-world timed hazards are inactive.

## Verification

TDD with `tests/checkpoint-puzzles.test.ts` and existing world/physics tests.
Parent integration handles persistence, renderer/audio and production replays
in BT-066/067 before exposing these rules in the registered world.

## Handoff

Serial-primary assignment: one worker, no concurrent code writers. The
orchestrator preserves the inherited dirty tree and records the runtime ID
after synchronous dispatch. No commits are authorized.

- Summary: Synchronous checkpoint-clock-worker returned the bounded core change.
- Changes: Three core files and fifteen regressions in checkpoint-puzzles.test.ts.
- Verification: Existing targeted baseline 71/71; RED 15 failing tests; GREEN 86/86 targeted, 421/421 full suite; typecheck and diff check pass. Inventory comparison matched the four assigned paths.
- Risks: Production data, snapshots and presentation still require BT-066/067. Finished Restart leaves the won state unchanged.
- Commit: None; primary-tree serial integration. Runtime inventory subsequently identified worker 3c781bba-df14-4eb0-9d23-17de996ee0e1.

## Result

- Summary: Core activation, ownership and checkpoint-reset primitives accepted.
- Verification: Reviewed public activation/collision/restart helpers against the approved contract; worker TDD and full-suite evidence supplied.
- Integration: Primary tree, no concurrent writers. Legacy behavior remains the default until BT-067 registers the new mode.
