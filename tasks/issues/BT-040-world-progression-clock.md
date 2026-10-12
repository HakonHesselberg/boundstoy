---
{
  "id": "BT-040",
  "title": "Implement ordered world progression with a continuous hazard clock",
  "type": "feature",
  "status": "done",
  "priority": "P1",
  "depends_on": ["BT-039"],
  "parent": "BT-024",
  "scope": ["core/simulation.ts", "core/world.ts", "application/guidance.ts", "tests/fixtures/world.ts", "tests/world-progression.test.ts", "tests/recovery.test.ts", "tests/guidance.test.ts", "docs/GAME_SYSTEMS.md"],
  "approval": "2026-10-10 user approved implementation of the entire BT-038 plan with bounded subagents where helpful.",
  "assignment": null,
  "blocked_reason": null
}
---
# BT-040: Implement ordered world progression with a continuous hazard clock

## Problem

Current checkpoints collect independently and current Aftershock retries reset
hazards. Neither matches the interviewed continuous escape-map rules.

## Scope

Add world-mode ordered completion and exit requirements. Preserve one state and
global simulation clock through all sections, checkpoints and deaths. Retain
legacy behavior for old levels. Do not change movement, pulse warning/lethality,
respawn length, camera or persistence.

## Acceptance criteria

- [x] Only the next valid section checkpoint advances world progress; backtracking cannot downgrade recovery.
- [x] The world exit cannot finish the run until its seven intermediate sections are complete.
- [x] Death consumes the existing 54 respawn ticks and returns to the latest checkpoint without resetting time or pulse/saw phase.
- [x] Section transitions preserve position, velocity, deaths and clock rather than loading a new run.
- [x] World snapshots remain immutable and deterministic, including checkpoints reached near walls and simultaneous hazard/goal contact.
- [x] Version-1 checkpoints and explicit retry-reset imports retain their prior behavior.

## Implementation context

Implementation approved; BT-038 is the product contract. BT-039 supplies ordered section
metadata. Keep checkpoint progression independent of the section a camera
currently shows. Core must not depend on presentation/storage. Actual authored
checkpoint safety and route necessity are tested by the content issues.

## Verification

TDD with a small joined-world fixture, input-driven out-of-order approaches,
backtracking, first-death/respawn and exact pulse/saw sampling before/after
transitions. Run `node --test tests/world-progression.test.ts tests/recovery.test.ts tests/guidance.test.ts`,
then `npm test` and `npm run build`.

## Handoff

- Summary: Synchronous worker completed ordered world progression.
- Changes: `core/simulation.ts`, `core/world.ts`, `application/guidance.ts`,
  new world fixture/progression tests, recovery/guidance tests and mechanics docs.
- Verification: Input-driven RED failures established premature collection,
  ungated exit and stale guidance. Final targeted suite 34/34, full suite
  267/267 and build/typecheck passed.
- Risks: `worldSectionIndex` assumes validated world/history; external snapshot
  validation remains BT-042. No camera or real-world content acceptance implied.
- Commit: None; serial-primary master working tree, preserving BT-037/039.
- Resources: All commands exited; no server/browser created.
- Decisions: Reused immutable `visited` coordinate keys rather than introducing
  redundant state. Camera location remains separate from ordered progress.

## Result

- Summary: Accepted after direct review of simulation, guidance and helper.
- Verification: Orchestrator independently reran progression/recovery/guidance
  tests (34/34) and diff checks. One eligible marker is snapshotted per tick;
  hazards retain priority and all 54 recovery ticks preserve phases.
- Integration: Accepted uncommitted working-tree changes under session
  183b57e8-2976-4cc3-88cc-7f7536f244de. All prior work retained.
