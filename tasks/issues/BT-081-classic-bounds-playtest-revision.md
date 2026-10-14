---
{
  "id": "BT-081",
  "title": "Revise classic bounds after first human playtest",
  "type": "feature",
  "status": "done",
  "priority": "P1",
  "depends_on": ["BT-076"],
  "parent": null,
  "scope": ["data/explosion-puzzles.ts", "data/classic-bounds.ts", "data/classic-bound-replays.ts", "tests/classic-bounds.test.ts", "docs/GAME_SYSTEMS.md", "tasks/issues/BT-081-classic-bounds-playtest-revision.md"],
  "approval": "2026-10-13 user playtest feedback on BT-076, requesting fixes to the levels it criticised.",
  "assignment": {"owner": "copilot", "run": "ad09c82a-30e5-4d54-9c5e-24e71265994b", "branch": null, "worktree": "."},
  "blocked_reason": null
}
---
# BT-081: Revise classic bounds after first human playtest

## Problem

First human playtest of the six BT-076 classic bounds (2026-10-13):

| Level | Feedback |
| --- | --- |
| Run-It | Bursts do not read as one wave; hard to plan. (Confirmed: a 280-tick wave repeats every 180 ticks, so two fronts and the gap bursts interleave.) |
| Side Pockets | Not enough time to get into a side pocket. |
| Checker Flip | The two colours burst too close together to get from one to the other. |
| Rotation | Not visibly rotating; reads as two lanes travelling toward the player, a satisfying slalom. Great level. |
| Closing Corners | Looks nice, but where blue meets purple there seems to be no way to survive. |
| Convergence | Doable but hard; good for later stages. |

## Scope

Retune Run-It, Side Pockets, Checker Flip and Closing Corners so each rhythm
is readable and each decision has more time, while staying hard. Keep
Rotation's and Convergence's gameplay; describe Rotation honestly. Same
mechanics, movement, styles and trial flow. Revisions bump level revision.

## Acceptance criteria

- [x] Run-It shows one travelling wave at a time; gap bursts follow it predictably.
- [x] Side Pockets gives clearly more time to enter a pocket than r1.
- [x] Checker Flip separates the two colours by clearly more than r1's 28 ticks.
- [x] Closing Corners separates the seam from both sweeps so the meeting has an obvious opening.
- [x] Rotation gameplay unchanged; its name/hint describe the lanes it actually shows.
- [x] Exact witnesses and windows re-recorded; tests, typecheck, build and browser scenario pass.

## Implementation context

Data: `data/classic-bounds.ts` constants per level; evidence regenerated with the
BT-076 session tools (`classic/final.ts`, `emit.ts`) from repo data.

## Verification

`node --test tests/classic-bounds.test.ts`, `npm test`, `npm run build`,
`node tests/browser/explosion-puzzles.ts --browser <chromium>`.

## Handoff

- Summary: Revised directly in the primary worktree; r2 for five levels.
- Changes: Run-It period 360, step 40, gap wave half a cycle later (one front
  at a time). Side Pockets offsets ±40 (was ±30). Checker Flip gap 40 (was 28).
  Closing Corners period 270: orange 0-90, seam alone at 125, blue 160-250.
  Rotation renamed **Slalom** (`bound-slalom`) with an honest hint, gameplay
  unchanged. Convergence unchanged. Optional layout `revision` added to the
  shared puzzle builder (default 1). New readability test fails on r1 Run-It
  and r1 Closing Corners values and passes on r2.
- Verification: classic tests 6/6; `npm test` 522/522; typecheck; build;
  browser scenario (all 18 trials, witnesses replayed) passed; screenshots
  `artifacts/explosion-puzzles/run-VFR5Hv` inspected.
- Witness windows (early/late): Run-It 8/13 8/8 8/8 8/16 8/16 8/9 16/16 16/16;
  Side Pockets 14-15 each side; Checker Flip 14-15; Slalom unchanged (8-10);
  Closing Corners 10-12; Convergence unchanged.
- Risks: Side Pockets and Checker Flip are now medium-hard (±14-15 vs ±8-10).
  Human re-test pending.
- Commit: None.

## Result

- Summary: Accepted pending the user's re-test.
- Verification: As in Handoff.
- Integration: Working-tree changes only.
