---
{
  "id": "BT-085",
  "title": "Build the co-designed six-puzzle explosion level",
  "type": "feature",
  "status": "blocked",
  "priority": "P1",
  "depends_on": [],
  "parent": null,
  "scope": ["data/pulse-line.ts", "data/test-levels.ts", "data/pulse-line-replays.ts", "tests/pulse-line.test.ts", "presentation/main.ts", "index.html", "tests/browser/explosion-puzzles.ts", "docs/GAME_SYSTEMS.md", "docs/ARCHITECTURE.md", "tasks/issues/BT-085-pulse-line-level.md"],
  "approval": "2026-10-13 user designed six explosion puzzles step by step on paper, approved each, asked to move the checker earlier for a better difficulty progression, then said 'build it'.",
  "assignment": null,
  "blocked_reason": "Playable draft delivered; awaiting the user's playtest feedback before verification and acceptance."
}
---
# BT-085: Build the co-designed six-puzzle explosion level

## Problem

The user and Copilot designed an explosion-focused level on paper, one puzzle
at a time, for landscape phone play. It now needs to be playable.

## Scope

One continuous V2 world, normal ground and pulses only, six puzzles joined by
five between-puzzle checkpoints, ordered by difficulty: follow a wave; two
alternating band groups; a checker of the same bands; whole rows alternating;
a head-on wave with one alcove above and one below; two offset head-on waves.
Isolated trial in the Puzzle trials panel; no production world, saves or new
mechanics. Engine rule: checkpoints and entries may not touch a pulse tile,
so each joint is buffer, checkpoint, entry, buffer.

## Acceptance criteria

- [ ] Six sections match the approved sketches and order, each in a landscape camera frame.
- [ ] Exact deathless witness with measured timing windows.
- [ ] Every checkpoint is safe, wide enough for the lane, and recovers after a downstream death.
- [ ] Future puzzles dormant, completed puzzles inactive.
- [ ] Menu lists the level; tests, typecheck, build and browser scenario pass.

## Implementation context

Builder: `buildExplosionPuzzle` (sections, checkpoints, hints). Evidence uses
the classic-bounds re-sync model. Authoring tools in the session `classic/`
directory solve each puzzle, then wait times are re-centred in the full world.

## Verification

`node --test tests/pulse-line.test.ts`, `npm test`, `npm run build`,
`node tests/browser/explosion-puzzles.ts --browser <chromium>`.

## Handoff

- Summary: Playable draft for human playtesting, at the user's request
  ("I just need something I can playtest"). Exact witness, timing windows and
  checkpoint-recovery evidence are deliberately deferred.
- Changes: `data/pulse-line.ts` (six sections, five checkpoints, 160 pulses);
  "Designed together" list in the Puzzle trials panel (`index.html`,
  `presentation/main.ts`).
- Verification: typecheck passes; the level parses with all V2 world
  validation; idling 1200 ticks on the start pad is safe; dev server serves it.
- Risks: No verified route yet; alcove columns in Duck were estimated on paper.
- Follow-up (21:45): playtest found Duck unwinnable and Switchback too fast
  for an early puzzle; Duck now 36 ticks per column with the bottom alcove at
  c7, Switchback rows every 144 ticks. Puzzle 7 (Spine and pockets) approved
  on paper. Puzzle 8 (Propeller, a two-bladed clockwise sweep around a wall
  pillar) is built as `test-propeller` in a new "Test levels" set
  (`data/test-levels.ts`). The set was registered with a one-entry edit to
  BT-086's `application/level-catalogue.ts` and its catalogue test, because
  BT-086 replaced the menu lists this issue had added.
- Follow-up (22:40): Propeller shelved to a "Tentative" set (plays as a
  straight run; revisit with locks and keys, BT-087). New puzzle 8 "Snake" is a
  conveyor: walls force a down/up/down/up route, each column sweeps the way you
  travel (24 ticks per row, period 300, offsets 0/180/180/150) and gap tiles
  are waiting spots. Simulated: winnable from 117/300 start moments; a
  well-timed non-stop run exists from 51/300. In "Test levels" as `test-snake`.
- Follow-up (23:10): Snake approved as puzzle 8. Puzzle 9 "Slot wave" added to
  Test levels (`test-slot-wave`): a continuous head-on wave, 12 ticks per
  column (period 120), with a zig-zag "slot" per column that bursts 60 ticks
  later. Simulation showed a 30-tick wave can be stepped through head-on
  (~21-tick window, so slots were pointless and Duck's alcoves may be optional)
  and a pause can be run through; at 12 ticks and continuous, a slot-free
  route has a 1-tick window while the slot route has about ±21.
- Commit: None.

## Result

Pending.
- Puzzle 10 "Rain" built in Test levels (`data/test-levels.ts`, 5x10, 8 steps x 20 ticks, stagger 3). Non-stop straight runs fail from all 160 start phases; the solver wins stop-and-go along a single row (windows ~48 ticks). Every row is a time-shifted copy, so weaving is not required yet. Approved by the user as is.
- Moved the approved test puzzles into Pulse Line (now nine sections, width 128): Follow, Bands, Checker, Switchback, Rain, Duck, Two waves, Snake, Slot wave. `data/pulse-line.ts` now describes each puzzle as a local design (columns, period, floor, burst) over rows 1-5.
- Puzzle 11 "Roundabouts" built in Test levels: four 1x1 islands each circled by one burst (20 ticks/tile, period 160), alternating clockwise/anticlockwise; follow each burst over/under its island. The paper draft (three 1x2 islands, 15 ticks/tile) left only ~±6 ticks: following loses (33 - S) ticks of slack per tile. Simulated: intended ±16 ticks, head-on straight rows ±5.
- Roundabouts approved and moved into Pulse Line after Two waves (ten sections). Test levels is empty, so the catalogue now hides empty sets.
- Puzzle 12 "Zigzag" built in Test levels (4 groups, beat 30, group = -(c + 2r) mod 4). Simulation contradicts the paper design: pulse hits use the tile square, so a diagonal step clips the two orthogonal neighbours at the shared corner, and all four corner tiles burst on different beats. Diagonal route ±1 (solver), straight rows ±10 via head-on stepping; non-stop straight runs fail from all start phases. Keeping corners safe forces near-uniform column beats, i.e. a Follow wave that rows can follow too. Awaiting the user's decision.
- Zigzag slowed 10% after the user's playtest (beat 33, period 132). Simulated: diagonal route ±3, straight rows ±11; a non-stop run along the middle row now survives from 43/132 start phases (top/bottom 0).
- Zigzag rated very hard but good by the user ("requires very precise timing over several sequences", a late puzzle); moved into Pulse Line as the last of eleven sections. Started `docs/PUZZLE_STATUS.md` (renamed from PUZZLE_FEEDBACK at the user's request) with status, difficulty, feel and all playtest feedback for Pulse Line, classic bounds and ice escapes.
- Split the puzzle document at the user's request: `docs/PUZZLE_STATUS.md` tracks the current state of each level and puzzle toward a finished set; `docs/PUZZLE_HISTORY.md` is an append-only log of feedback, changes and design lessons for decision making.
