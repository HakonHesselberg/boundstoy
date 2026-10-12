---
{
  "id": "BT-066",
  "title": "Resume from checkpoints without periodic saves",
  "type": "feature",
  "status": "done",
  "priority": "P1",
  "depends_on": ["BT-065", "BT-045"],
  "parent": "BT-038",
  "scope": ["application/run-snapshot.ts", "application/run-continuation.ts", "application/run-storage.ts", "presentation/main.ts", "index.html", "tests/run-snapshot.test.ts", "tests/run-continuation.test.ts", "tests/run-storage.test.ts"],
  "approval": "2026-10-11 user requested checkpoint-position saves and checkpoint Restart; confirmed pattern reset on Restart and saving totals on death/pause/leaving, with no periodic saves.",
  "assignment": null,
  "blocked_reason": null
}
---
# BT-066: Resume from checkpoints without periodic saves

## Problem

Exact mid-puzzle snapshots and periodic writes do not match the requested
checkpoint-based game loop.

## Scope

Checkpoint-position resume and explicit restart for checkpoint-mode worlds.
Keep total elapsed time and deaths; persist totals on death and pause/leaving,
checkpoint progress on collection, and results on completion. Remove periodic
writes for this mode. Preserve ownership/transaction safety and legacy saves.

## Acceptance criteria

- [x] Saved resume position is the latest checkpoint or initial spawn, never a mid-puzzle position.
- [x] Reload restarts the active pattern while preserving saved elapsed time, deaths and checkpoint progress.
- [x] Restart resets the current puzzle at its checkpoint; whole-world New run remains a separate confirmed action.
- [x] No periodic writes; deaths, checkpoints, pause/leaving and completion retain durable totals and honest deathless status.
- [x] Obsolete revision-1 Aftershock active saves are deleted as explicitly requested; prior records stay revision-isolated.
- [x] Failure paths retain source data and surface errors without a silent new run or memory fallback.

## Implementation context

Reuse the snapshot envelope and `patternOffset`, normalizing only the durable
checkpoint resume representation. Live pause may still retain its in-memory
position. Ordinary death continues the live pattern; reload/explicit Restart
start it over. Saved counters must not decrease or allow death washing.
Do not add writes every tick/frame or reintroduce periodic autosaving.
When asked about existing-run migration, the user answered "Just delete old
save". Do not build a migration/archive feature for this transition.

## Verification

Snapshot codec, transaction/queue tests and real checkpoint reload/restart,
deathless eligibility and write-count checks in BT-067.

## Handoff

Serial-primary implementation; no concurrent code writers or commits.

- Summary: Synchronous checkpoint-save-worker returned the bounded persistence/UI change.
- Changes: Five application/UI files and three test files; createCheckpointSnapshot, mode-aware shouldSave, explicitly authorized obsolete-save retirement and separate New run control.
- Verification: Targeted baseline 44/44; RED before implementation; final targeted 57/57 and full portable 434/434; typecheck, non-writing Vite bundling, tracker and diff checks pass. Only assigned paths changed.
- Risks: Production opt-in and native lifecycle verification remain BT-067. Restart rebuilds the scene to clear interpolation; verify camera and resources in browser.
- Commit: None; serial primary tree. Runtime inventory subsequently identified worker 7ee41840-9482-4315-a5ff-538febf92905.

## Result

- Summary: Checkpoint snapshot/save APIs and UI wiring accepted for integration.
- Verification: Reviewed normalized snapshot validation, epoch-aware collision checks, Restart and transactional retirement behavior; worker TDD evidence supplied.
- Integration: New mode remains opt-in until BT-067. Existing global-clock imports preserve exact continuation. New menu action is #new-run.
