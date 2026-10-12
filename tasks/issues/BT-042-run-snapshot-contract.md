---
{
  "id": "BT-042",
  "title": "Define exact resumable-run snapshots and revision compatibility",
  "type": "feature",
  "status": "done",
  "priority": "P1",
  "depends_on": ["BT-040"],
  "parent": "BT-024",
  "scope": ["application/run-snapshot.ts", "core/simulation.ts", "tests/run-snapshot.test.ts", "docs/ARCHITECTURE.md", "docs/GAME_SYSTEMS.md"],
  "approval": "2026-10-10 user approved implementation of the entire BT-038 plan with bounded subagents where helpful.",
  "assignment": null,
  "blocked_reason": null
}
---
# BT-042: Define exact resumable-run snapshots and revision compatibility

## Problem

Completed records cannot restore an interrupted world, and checkpoint-only
restoration would allow a free escape from an unfinished puzzle.

## Scope

Create pure snapshot encode/decode/validation against the world definition.
Include run identity, content revision and complete simulation state. Distinguish
valid, corrupt, unsupported and incompatible snapshots explicitly. Do not wire
browser storage or implement lifecycle saving here.

## Acceptance criteria

- [x] Position, velocity, time, hazard phase, checkpoint/section progress, deaths and remaining respawn ticks round-trip exactly.
- [x] Continuing identical input from an encoded/decoded snapshot yields identical subsequent states and finish.
- [x] Malformed, non-finite, inconsistent, oversized or out-of-bounds state is rejected rather than clamped or replaced.
- [x] Content IDs/revisions prevent old layouts or timings from resuming against incompatible worlds.
- [x] Held input, renderer objects and wall-clock catch-up are not serialized gameplay state.
- [x] Failure handling can preserve original bytes for a visible recovery/reset choice; no silent save replacement is required.

## Implementation context

Implementation approved; use BT-038 and BT-040. A saved zero-death run remains achievement
eligible. Resume is at the exact saved state, not at its checkpoint; only death
causes checkpoint recovery. Validate any future local-interaction state only
when such a mechanic is actually approved and implemented.

## Verification

TDD in `tests/run-snapshot.test.ts`: moving, idle, paused-boundary, just-dead,
mid-respawn, checkpoint and completed states; every revision/error case; exact
post-restore replay equivalence. Run `node --test tests/run-snapshot.test.ts`,
then `npm test` and `npm run build`.

## Handoff

- Summary: Synchronous worker implemented pure exact snapshots for V2 worlds.
- Changes: New snapshot module and 16 tests, architecture/mechanics docs.
  Integration exports/reuses existing simulation collision/collection helpers
  rather than retaining a second implementation in the codec.
- Verification: Assertion REDs for overshoot/clock/duplicate keys, final targeted
  16/16 and full 283/283 plus typecheck/build. Actual traces cover all four death
  causes, recovery, completion, mixed surfaces, signed zero and 4,000 steps.
- Risks: Validates local consistency, not honest play or exhaustive historical
  reachability. Authors must bump revisions when gameplay changes.
- Commit: None; accepted primary-working-tree baseline retained.
- Resources: No browser/server created; all commands exited.
- Decisions: 16 KiB bounded schemaVersion-1 envelope for worldVersion-2.
  Caller supplies stable runId. Distinct valid/corrupt/unsupported/incompatible
  results preserve the caller's original bytes; no fallback state.

## Result

- Summary: Accepted after direct codec review and removal of duplicated physics.
- Verification: Orchestrator reran 16 snapshot tests before integration and full
  283-test suite plus build after shared-helper refactor. Evidence:
  session `files/snapshot-integration.log`; diff checks pass.
- Integration: Uncommitted master working-tree changes integrated in session
  183b57e8-2976-4cc3-88cc-7f7536f244de. Browser saving is still BT-044/045.
