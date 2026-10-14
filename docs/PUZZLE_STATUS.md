# Puzzle status

Where each level and puzzle stands now, to track progress toward a finished
set. Only the current version counts; feedback, changes and lessons live in
`docs/PUZZLE_HISTORY.md`. Update rows in place.

**Puzzle status:**
- **Finished:** the current version was played and approved.
- **Re-test:** changed after feedback; the current version has not been played.
- **Test level:** built on its own, waiting for a playtest.
- **Paper:** approved as a sketch, not built.
- **Shelved:** kept in Tentative for later.

**Difficulty:** 1 very easy · 2 easy · 3 medium · 4 hard · 5 very hard.
**Placement:** early, middle or late in its level.

## Prototype target

A shareable prototype with one explosion level (Pulse Line) and one soft-ice
level built the same way, Glide Line (BT-089). Only these two will be on the
home screen.

## Levels

| Level | Puzzles | Finished | Status | Next step |
| --- | --- | --- | --- | --- |
| Pulse Line | 11 built, 1 on paper | 11 / 12 | In progress | Build Spine and pockets; play the full 11-section level; rate difficulty and settle the order. |
| Classic bounds | 6 | 2 / 6 | Re-test | Re-test Run-It, Side Pockets, Checker Flip, Closing Corners. |
| Ice escapes | 6 | 2 / 6 | Re-test | Re-test Snow Line, Bumper Alley, Spiral, Warden's Run. |
| Glide Line (soft ice) | 7 built | 7 / 7 | In progress | Design puzzle 8. |

A level is finished when every puzzle is finished, the whole level has been
played through in its final order, and every puzzle has a difficulty rating.

## Pulse Line

`data/pulse-line.ts`, sections in level order. Each puzzle was approved on
its own; the full eleven-section level has not been played since the merges.

| # | Puzzle | Status | Difficulty | Placement | Open points |
| --- | --- | --- | --- | --- | --- |
| 1 | Follow | Finished | | | |
| 2 | Bands | Finished | | | |
| 3 | Checker | Finished | | | |
| 4 | Switchback | Finished | | early | |
| 5 | Rain | Finished | | | **Sim:** one row suffices; no weaving needed. |
| 6 | Duck | Finished | | | **Sim:** wave may be steppable head-on; alcoves may be optional. |
| 7 | Two waves | Finished | | | |
| 8 | Roundabouts | Finished | | | |
| 9 | Snake | Finished | | | |
| 10 | Slot wave | Finished | | | |
| 11 | Zigzag | Finished | 5 | late | **Sim:** non-stop middle-row run survives about a third of start times. |
| – | Spine and pockets | Paper | | | Not built; placement undecided. |

## Glide Line

`data/glide-line.ts`. Co-designed one puzzle at a time; each sketch is built
straight into Test levels, and approved puzzles move into the level.

| # | Puzzle | Status | Difficulty | Placement | Open points |
| --- | --- | --- | --- | --- | --- |
| 1 | Spike slalom | Finished | 2 | early | |
| 2 | Spike run | Finished | | | **Sim:** best route about 0.3 tiles from spikes. |
| 3 | Hairpin | Finished | | | 7 rows tall. **Sim:** best route about 0.35 tiles from spikes. |
| 4 | Oncoming | Finished | 2 | early | First saws. |
| 5 | Divided road | Finished | | | Saw pairs per lane, spike divider with two gaps. |
| 6 | Rush hour | Finished | | | Oncoming saws plus 2x2 spike islands. **Sim:** route from 11/30 start moments (coarse search); no single-row route. |
| 7 | Scissors | Finished | | | Diagonal saw pairs crossing like scissors. **Sim:** route from 22/24 start moments; one row survives 5/24. |

## Classic bounds

`data/classic-bounds.ts`.

| Puzzle | Status | Difficulty | Placement | Open points |
| --- | --- | --- | --- | --- |
| Run-It | Re-test | | | |
| Side Pockets | Re-test | | | **Sim:** may now be medium-hard. |
| Checker Flip | Re-test | | | **Sim:** may now be medium-hard. |
| Slalom | Finished | | | |
| Closing Corners | Re-test | | | |
| Convergence | Finished | 4 | late | |

## Ice escapes

`data/ice-escapes.ts`.

| Puzzle | Status | Difficulty | Placement | Open points |
| --- | --- | --- | --- | --- |
| Snow Line | Re-test | | | Now pure steering, no saws. |
| Wolf Lanes | Finished | | | Judged bare-minimum; may want more. |
| Safe Zones | Finished | | | |
| Bumper Alley | Re-test | | | Now pure steering, no saws. |
| Spiral | Re-test | | | Collectibles idea (BT-083) undecided. |
| Warden's Run | Re-test | | | |

## Shelved

| Puzzle | Waiting for |
| --- | --- |
| Propeller | Locks and keys (BT-087), to stop it playing as a straight run. |
