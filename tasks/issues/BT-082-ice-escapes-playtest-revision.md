---
{
  "id": "BT-082",
  "title": "Revise ice escapes after first human playtest",
  "type": "feature",
  "status": "done",
  "priority": "P1",
  "depends_on": ["BT-080"],
  "parent": null,
  "scope": ["data/ice-escapes.ts", "data/ice-escape-replays.ts", "tests/ice-escapes.test.ts", "docs/GAME_SYSTEMS.md", "tasks/issues/BT-082-ice-escapes-playtest-revision.md"],
  "approval": "2026-10-13 user playtest feedback on BT-080 identifying fast saws in tight soft-ice corridors and a skippable spiral ending.",
  "assignment": {"owner": "copilot", "run": "ad09c82a-30e5-4d54-9c5e-24e71265994b", "branch": null, "worktree": "."},
  "blocked_reason": null
}
---
# BT-082: Revise ice escapes after first human playtest

## Problem

First human playtest of the BT-080 ice escapes (2026-10-13):

| Level | Feedback |
| --- | --- |
| Snow Line | Impossible to time sliding past the saws; fast-moving targets plus slow ice in tight corridors feel very bad. |
| Wolf Lanes | Decent but bare-minimum obstacle; more room means agency. |
| Safe Zones | Good; soft ice gives a little room compared with a pure timing puzzle. |
| Bumper Alley | Too chaotic; the fast saw does not work with soft ice. |
| Spiral | Decent; the last part can be skipped, so move the goal aside. Suggests collectibles. |
| Warden's Run | Not fun; same tight-saw-plus-gliding issue. |

## Scope

Remove fast creeps from tight soft-ice corridors (Snow Line, Bumper Alley,
Warden's Run parts 1 and 3). Keep creeps where the player can stop first or has
room (Safe Zones, Warden's Run chutes, Wolf Lanes, Spiral). Make the spiral exit
unreachable except from the innermost arm. Collectibles are a new system:
recorded as backlog BT-083, not implemented. Bump changed revisions.

## Acceptance criteria

- [x] Snow Line and Bumper Alley have no creeps; Warden's Run creeps only in its chutes.
- [x] Spiral's exit is separated from the earlier arm by void; only the innermost arm reaches it.
- [x] Wolf Lanes and Safe Zones unchanged.
- [x] Witnesses, windows and Warden's Run recovery re-recorded; rest classification fixed (no input on walkable ground is a pause).
- [x] Tests, typecheck, build and browser scenario pass; docs record the playtest lesson.

## Implementation context

Data: `data/ice-escapes.ts`; witnesses regenerated with the BT-080 session
tools (`ice/genreplays.ts`, `recovery.ts`) from repo data.

## Verification

`node --test tests/ice-escapes.test.ts`, `npm test`, `npm run build`,
`node tests/browser/explosion-puzzles.ts --browser <chromium>`.

## Handoff

- Summary: Revised directly in the primary worktree; r2 for Snow Line, Bumper
  Alley, Spiral and Warden's Run.
- Changes: creeps removed from Snow Line, Bumper Alley and Warden's Run parts 1
  and 3; spiral exit pad narrowed with a void gap to the earlier arm. Rest
  classification fixed in tools and tests: no input on walkable ground is a
  pause even on the tick a slide arrives. Departure-timing test now varies the
  first rest that meets creeps. New playtest regression test.
- Verification: ice tests 7/7; `npm test` 522/522; build; browser scenario
  passed; screenshots `artifacts/explosion-puzzles/run-VFR5Hv` inspected.
- Witness windows: Snow Line min 8, Wolf Lanes 5, Safe Zones 6, Bumper Alley 4,
  Spiral 5, Warden's Run 8; Warden's Run recovery 1074 ticks.
- Risks: Snow Line and Bumper Alley are now pure steering; Wolf Lanes was judged
  plain. Human re-test pending. Collectibles deferred to BT-083 (backlog).
- Commit: None.

## Result

- Summary: Accepted pending the user's re-test.
- Verification: As in Handoff.
- Integration: Working-tree changes only.
