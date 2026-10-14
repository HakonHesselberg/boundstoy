---
{
  "id": "BT-076",
  "title": "Add a hard classic-bounds explosion puzzle set",
  "type": "feature",
  "status": "done",
  "priority": "P2",
  "depends_on": [],
  "parent": null,
  "scope": ["data/explosion-puzzles.ts", "data/classic-bounds.ts", "data/classic-bound-replays.ts", "tests/classic-bounds.test.ts", "presentation/main.ts", "index.html", "tests/browser/explosion-puzzles.ts", "docs/GAME_SYSTEMS.md", "docs/ARCHITECTURE.md", "tasks/issues/BT-076-classic-bounds-hard-set.md"],
  "approval": "2026-10-12 user request: create a set of difficult levels using only explosions and normal ground, inspired by real StarCraft bounds maps.",
  "assignment": {"owner": "copilot", "run": "ad09c82a-30e5-4d54-9c5e-24e71265994b", "branch": null, "worktree": "."},
  "blocked_reason": null
}
---
# BT-076: Add a hard classic-bounds explosion puzzle set

## Problem

The six BT-072 explosion puzzles are deliberately gentle (12+ tick margins,
one idea each). Players who finish them have nothing demanding left that uses
only explosions and normal ground. The user wants difficult levels inspired by
real StarCraft bounds maps.

## Scope

A separate, isolated trial set of six hard V2 levels using only normal ground
and one-tick pulses. Each adapts a mechanism decoded in BT-068 from Beginner
Bound (NewRecord) or Level Up Bound (Mp(U)): run-it waves with gap refuges,
odd/even alternation, a side-refuge spine, rotating quadrants, single-cell
"snake" chasers and nested-L corner sweeps. Geometry and timing are original
Boundstoy adaptations, not copies; no third-party map data, art, text or audio
is shipped. One pulse per tile, 27-tick warnings, safe start/exit landings and
existing movement rules are unchanged. No engine, save-format or Aftershock
changes; no new mechanics or surfaces. The set appears beside the existing
explosion puzzles using the same unsaved trial flow.

## Acceptance criteria

- [x] Six immutable parsed levels, normal ground and pulse hazards only, one
  style per rhythm group, no duplicate pulse tiles.
- [x] Each level names its source mechanism (map, obstacle/trigger) and the
  adaptation; documentation states these are inspired adaptations.
- [x] Every level has an exact deathless input replay, plus measured
  per-input timing windows under a documented re-sync model.
- [x] Each level is measurably harder than BT-072: more timed decisions and
  tighter windows. Refined during review: a pause-free run of the witness path
  is never easier (it survives at most 6 start phases, all narrower than the
  witness's tightest window) rather than failing at literally every phase.
- [x] Menu offers the hard set alongside the six existing puzzles; selection,
  finish and retry keep trial results out of world saves.
- [x] Full tests, typecheck and build pass; existing puzzles unchanged.

## Implementation context

Reuse the BT-072 builder (`data/explosion-puzzles.ts`), parser and trial flow.
Source facts: BT-068 record (trigger indexes, location rectangles, waits).
BT-075 is concurrently editing `presentation/main.ts`, `index.html` and docs
in the same tree; keep those edits small and surgical.

## Verification

`node --test tests/classic-bounds.test.ts tests/explosion-puzzles.test.ts`,
`npm test`, `npm run typecheck`, `npm run build`, `npm run tasks:check`.

## Handoff

- Summary: Six hard classic-bounds trials implemented and verified directly in
  the primary worktree (serial, no workers).
- Changes: New `data/classic-bounds.ts` (levels, source credits),
  `data/classic-bound-replays.ts` (witnesses, re-sync windows) and
  `tests/classic-bounds.test.ts`. `data/explosion-puzzles.ts` now exports the
  shared builder (`buildExplosionPuzzle`, optional ID prefix); the six BT-072
  levels are byte-identical. `presentation/main.ts` and `index.html` add a
  "Classic bounds" list to the Explosion puzzles panel (cards show source
  credits; header reads `CLASSIC BOUND n / 6`; status shows tightest window).
  Browser scenario covers all twelve trials. Docs: GAME_SYSTEMS, ARCHITECTURE.
- Verification: `node --test tests/classic-bounds.test.ts` 5/5;
  `npm test` 506/506; typecheck and `npm run build` pass;
  `node tests/browser/explosion-puzzles.ts --browser /usr/lib/chromium/chromium`
  passed (`artifacts/explosion-puzzles/run-f3crlR`); production
  `scripts/browser-check.ts` passed. Screenshots of all six at 1280x900,
  390x844 and 844x390 plus the menu panel were inspected.
- Risks: Windows are measured for witness routes under a re-sync model; the
  authoring search (stop graphs, pass-through corners, straight runs up to ten
  tiles) is not a proof over all routes. Human difficulty/fun is unverified.
  Rotation has two non-adjacent quads that coincidentally share a burst tick
  with different styles; each contiguous burst region is single-style.
- Commit: None. Uncommitted in `/home/hhh/pri/boundstoy`, interleaved in
  `presentation/main.ts`/`index.html` with uncommitted BT-075/BT-077 changes.
- Resources: All harness browsers/previews cleaned up. Authoring tools and
  logs in session `ad09c82a-30e5-4d54-9c5e-24e71265994b/files/classic/`.
- Decisions: Each tile keeps one beat (stacked detonations are rejected), so
  multi-frame Level Up sequences became single-cycle groups. A 5-tick reveal
  offset keeps every pad out of its burst frame at tick 0.

### Witness evidence (early/late ticks per decision, cap 16)

| ID | Ticks | Windows |
| --- | --- | --- |
| `bound-run-it` | 1706 | 13/16 8/9 8/9 8/9 8/9 8/9 8/9 16/16 |
| `bound-side-pockets` | 2083 | 15/16 10/10 10/16 9/11 10/10 10/16 10/11 10/11 11/16 10/11 10/10 10/16 10/11 |
| `bound-checker-flip` | 1122 | 9/16 9/10 8/10 9/11 9/10 9/10 12/15 |
| `bound-rotation` | 1283 | 9/16 9/9 9/8 8/10 9/16 10/9 9/8 8/9 10/16 9/9 9/8 8/10 |
| `bound-closing-corners` | 1147 | 11/11 11/11 11/11 11/11 11/16 11/10 10/11 16/16 |
| `bound-convergence` | 826 | 9/9 9/16 9/12 9/8 8/10 10/10 16/16 |

Same metric on BT-072 witnesses: 1-3 decisions each at 12-16+ per side
(plus one 2-tick early artifact from a 2-tick opening wait).

## Result

- Summary: Accepted as an implemented hard playtest set; human playtesting
  remains a separate gate.
- Verification: As in Handoff; targeted and full suites, build, both browser
  scenarios and inspected screenshots.
- Integration: Working-tree changes only; no commit or publication.
