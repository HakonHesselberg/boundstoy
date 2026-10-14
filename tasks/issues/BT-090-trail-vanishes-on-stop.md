---
{
  "id": "BT-090",
  "title": "Keep the player trail from vanishing when the player stops",
  "type": "bug",
  "status": "done",
  "priority": "P2",
  "depends_on": [],
  "parent": null,
  "scope": ["presentation/scene.ts", "presentation/motion.ts", "tests/player-trail.test.ts", "tasks/issues/BT-090-trail-vanishes-on-stop.md"],
  "approval": "2026-10-14 user filed the trail bug ('The trail disappears when the player stops moving'), then said 'Fix it'. Fade duration delegated to the orchestrator.",
  "assignment": {"owner": "trail-fix", "run": "2d3550c9-fe3d-4403-a107-fdb552450f1e", "branch": "task/bt-090", "worktree": ".worktrees/BT-090"},
  "blocked_reason": null
}
---
# BT-090: Keep the player trail from vanishing when the player stops

## Problem

The user reported that the player's trail disappears when the player stops
moving. Every trail dot is hidden in the same frame once speed drops below the
visibility threshold (for example on hard-ice wall stops or when releasing
input on normal ground), so the trail pops out instead of settling.

Expected: the trail settles or fades out smoothly after a stop rather than
vanishing at once. A stale trail must not reappear when the player starts
moving again.

## Scope

Presentation only: the trail's visibility/fade behaviour in
`presentation/scene.ts`, a named fade duration in `presentation/motion.ts`, and
a focused regression test in `tests/player-trail.test.ts`. Non-goals: movement
rules, simulation state, saves, replays, other effects (heading arrow, death
ring, hazards). Keep the existing clears on death, editing and checkpoint
events, and keep the trail hidden when reduced motion is on.

## Acceptance criteria

- [x] After a stop, the trail no longer disappears in a single frame; it fades
      or shortens over a short, named duration (duration delegated to the
      orchestrator by the user's "Fix it").
- [x] When the player starts moving after a stop, a stale trail from before the
      stop does not reappear.
- [x] The trail still clears on death, while editing, and on checkpoint events,
      and stays hidden when reduced motion is on.
- [x] Simulation, replays and the four movement rules are unchanged.

## Implementation context

- `presentation/scene.ts` (about lines 514-524): trail points are added when
  the player moves more than 0.09 from the last point. Each dot uses
  `dot.visible = !reduced && !!this.trailPoints[i] && speed > 0.2`, so all dots
  hide when speed falls to 0.2 or below. `trailPoints` is not cleared on a stop,
  so the old points probably show again when speed rises; confirm this
  during the fix.
- 14 trail dots are created in the constructor (about line 139).
  Opacity is `0.6 * (1 - i / trail.length)`.
- `tests/motion.test.ts` builds a scene stub with `trailPoints` and `trail`.
  Use it as a pattern for a headless trail test.
- Follow the art direction in `CLAUDE.md`: a soft-lit diorama with smooth fades.

## Verification

- `npm test`, `npm run typecheck` and `npm run build` pass.
- A headless test shows that trail opacity decreases over frames after speed
  drops, not all at once. It also shows that a stale trail is not restored
  when movement resumes.
- Manual check in `npm run dev`: glide and stop on hard ice against a wall, and
  release input on normal ground. In both cases the trail fades smoothly. Start
  moving again and confirm no stale trail appears.

## Handoff

- Summary: Fixed directly by the orchestrator in an isolated worktree because
  BT-086 (review) holds the primary worktree. Ready for review.
- Changes: `presentation/motion.ts` adds `MOTION.trailFadeSeconds = 0.3`.
  In `presentation/scene.ts`, each trail point now carries a `fade` value.
  Points from a moving run stay at 1. Once the run stops, they fade linearly
  over 0.3 s of visual time (frozen while paused) and are then dropped.
  Points are only laid while moving, and a relaunch starts a new run, so old
  dots never light up again. The death/editing/checkpoint clear and the
  reduced-motion hiding are unchanged. `tests/player-trail.test.ts` adds
  5 regression tests.
- Verification: RED reproduced both symptoms first: no dots on the stopping
  frame, and a stale dot at x=6.500 ahead of a relaunching player at 6.620.
  The quick-relaunch test went RED against a first single-fade design, which
  relit old dots. After the fix, the worktree gave `npm test` 496/496, a clean
  `npm run typecheck` and a successful `npm run build`. Headless Chrome at
  1280x900 on the worktree build (port 4390) slid into a hard-ice curb.
  Trail pixel difference against the faded frame: 1852, 1612, 1367, 1189,
  987, 793 over 0-250 ms, 0 trail pixels from 300 ms. Evidence is in
  `artifacts/bt-090/` (`1280x900-stop-t000ms.png`, `-t150ms`, `-t300ms`,
  `-t500ms`, `1280x900-stop-fade-strip.png`, `1280x900-fade-metrics.json`).
  Temporary, uncommitted checks confirmed that releasing input on normal ground
  keeps 10 dots and then fades them, and that death and editing clear the trail.
  The checkpoint clear is the same unchanged statement.
- Risks: The 0.3 s duration is the orchestrator's choice and may need tuning
  after play. Only `MOTION.trailFadeSeconds` needs changing.
- Commit: `77bc4c9` on `task/bt-090`.
- Resources: The preview on 4390, the evidence upload helper on 4391 and the
  `bt090` headless page were all stopped or closed. The worktree
  `.worktrees/BT-090` remains; deleting it was not authorized.
- Decisions: The user's "Fix it" counts as approval, with the fade duration
  left to the orchestrator.

## Result

- Summary: Accepted. The trail fades over 0.3 s after a stop and never relights
  stale dots.
- Verification: On the combined primary tree (with BT-086's uncommitted work),
  `npm test` passed 542/542 and `npm run build` (including typecheck)
  succeeded.
- Integration: `master` fast-forwarded to `77bc4c9`. Only the three BT-090
  files changed; BT-086's uncommitted work was left untouched.
