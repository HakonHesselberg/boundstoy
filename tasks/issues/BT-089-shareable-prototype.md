---
{
  "id": "BT-089",
  "title": "Shareable prototype with one explosion level and one soft-ice level",
  "type": "feature",
  "status": "ready",
  "priority": "P1",
  "depends_on": [],
  "parent": null,
  "scope": ["data/pulse-line.ts", "data/", "application/level-catalogue.ts", "index.html", "presentation/main.ts", "tests/", "docs/PUZZLE_STATUS.md", "docs/PUZZLE_HISTORY.md", "docs/GAME_SYSTEMS.md", "README.md", "tasks/issues/BT-089-shareable-prototype.md"],
  "approval": "2026-10-14 user: \"Only two levels on the home screen. Ice levels codesigned. saves as suggested, sharing will be me putting it on my astro website later.\" Ice puzzles are built into Test levels right after each sketch.",
  "assignment": null,
  "blocked_reason": null
}
---
# BT-089: Shareable prototype with one explosion level and one soft-ice level

## Problem

2026-10-14, the user: "I want to start looking at creating a fleshed out
prototype to share with people. It should have one explosion level (that we
have built so far, may need a bit more work before being finished) and a soft
ice level (similar to the explosion level)."

Today the home screen is built around the Aftershock world, and every draft
set (Designed together, Test levels, Tentative, Explosions, Classic bounds,
Ice escapes) is listed under Levels. Nothing is curated for outside players.

## Scope

1. **Finish Pulse Line** (BT-085): build Spine and pockets, play the full level
   in order, rate each puzzle's difficulty and settle the order. Possible
   fixes from simulation: Rain (one row suffices), Duck (alcoves may be
   optional), Zigzag (middle-row non-stop run).
2. **Soft-ice level:** a continuous multi-puzzle level like Pulse Line,
   co-designed one puzzle at a time, using the ice lessons in
   `docs/PUZZLE_HISTORY.md` (room to steer; no fast saws in tight corridors;
   Safe Zones and Wolf Lanes were the liked references).
3. **Prototype build:** the two levels presented to testers, with the existing
   checkpoint, restart and save behaviour.

Non-goals: new mechanics (locks and keys BT-087, collectibles BT-083),
accounts, telemetry, backend services.

## Decisions (2026-10-14)

- Home screen shows only the two levels; Aftershock and the draft sets are
  not shown to testers. The home screen belongs to BT-086 (in review), so this
  change waits until both levels are ready and is coordinated with it.
- The soft-ice level is co-designed one puzzle at a time. New in this round:
  after each sketch, the puzzle is also built and put in Test levels.
- Each level saves checkpoint progress and records best time and deaths.
- Sharing: the user will put the build on their Astro website later.

## Acceptance criteria

- [ ] Pulse Line finished per `docs/PUZZLE_STATUS.md`.
- [ ] Soft-ice level finished per `docs/PUZZLE_STATUS.md`.
- [ ] Testers see the agreed presentation; draft sets do not distract.
- [ ] Tests, typecheck and build pass; existing behaviour otherwise preserved.

## Implementation context

Pulse Line: `data/pulse-line.ts` (Design per puzzle, sections, checkpoints).
Ice: `data/ice-escapes.ts` (ASCII maps, creeps, multi-puzzle course with
checkpoints in Warden's Run). Catalogue: `application/level-catalogue.ts`.

## Verification

`npm test`, `npm run build`, browser scenario on desktop and landscape phone,
and a human playthrough of both levels.

## Handoff

- Ice puzzle 1 "Stepping stones" built in Test levels (`data/test-levels.ts`, uses the now-exported `buildIceEscape`). Saws 1 -> 5 over the lane, period 360. Simulated: holding right on the middle row wins; gap B survives from 254/360 wait ticks, gap C 198/360.
- Stepping stones dropped at the user's request (walls and spikes, not saws, for the first puzzles). Ice puzzle 1 is now "Spike slalom" (`test-levels.ts`): walled field, spike bars at x 7, 13, 19 with 2-row gaps bottom/top/bottom. Simulated: weave wins with min 0.95-tile clearance; straight runs on all five rows fail.
- Spike slalom approved ("an easy introductory level"); new `data/glide-line.ts` (Glide Line, `buildGlideLevel` lays 5-row fields between 4-wide ground joints, checkpoint radius 2.5) registered beside Pulse Line in "Designed together". Puzzle 2 "Rest stops" in Test levels; tuned route min clearance 0.65 tiles. Tightened after playtest ("okish, but can maybe be tightened"): one-column overlaps in bands 2-3, one-row final exit; min clearance 0.35.

## Result

Pending.
- Rest stops reworked into "Spike run" at the user's request: posts removed, spiked top/bottom edges (new optional `edge` on Glide Line fields). Simulated pursuit route min clearance 0.29.
- Spike run approved and moved into Glide Line (two sections, one checkpoint). Puzzle 3 "Hairpin" in Test levels: 1-wide lanes, spike dividers, wall-ended 3-wide turnarounds; 42 winning plans in a trigger grid, best tuned clearance 0.45.
- Hairpin revised at the user's request (spikes instead of walls, bigger turn area): `buildGlideLevel` now accepts 5- or 7-row fields (frames per section; existing sections unchanged). 7-row Hairpin, lanes 3 apart, 5-wide pockets, spiked edges; 928 winning plans, best tuned clearance 0.35.
- Hairpin approved and moved into Glide Line (three sections: 7, 7 and 9 rows tall frames). Puzzle 4 direction awaits the user.
- Puzzle 4 "Oncoming" in Test levels after the user asked for slow moving hazards like the decent ice escapes: Glide Line fields now take `creeps` in field coordinates. One saw per row, period 2280 (about 2 tiles/s), staggered by P/5, spiked edges. Survey (40 start moments x 625 four-segment row plans): route from 36/40, single-row 0/40, 5.5% of plans win. Vertical single-saw gates were rejected in simulation as too easy.
- Oncoming approved as an easy early puzzle; moved into Glide Line (four sections). Puzzle 5 "Divided road" in Test levels: spike divider with gaps at field cols 4-7 and 12-15, saw pairs per lane, period 1800, bottom pair offset P/2. Survey (24 start moments x 1024 five-segment plans): route 20/24, one-lane 0/24, about 5.6% of plans win. Survey controller note: plans must steer back to the exit row on the final pad, or none can win.
- Divided road approved; moved into Glide Line (five sections). Puzzle 6 "Rush hour" in Test levels: Oncoming saws (P 2280) plus 2x2 spike islands at field cols 5-6 rows 2-3, 10-11 rows 4-5, 15-16 rows 2-3. Coarse survey: route 11/30 start moments, single row 0/30. Gates (61% of plans win) and Overtake (a phase-shifted Divided road) rejected in simulation.
- Rush hour approved; moved into Glide Line (six sections). Puzzle 7 "Scissors" in Test levels: diagonal saw pairs per 5-column block, P 480 (about 2.8 tiles/s), blocks offset P/2. Survey: route 22/24, single row 5/24, 4% of plans.
