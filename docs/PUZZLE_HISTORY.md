# Puzzle history

Append-only record of playtest feedback, changes and decisions, for analysis
and design decisions. Current state lives in `docs/PUZZLE_STATUS.md`; this file
is never rewritten to match it. Quotes are the playtester's words; designer
simulation notes are marked **Sim**.

## Design lessons

Drawn from the entries below; use them when proposing new puzzles.

- **Moving patterns over waiting.** Puzzles solved by waiting (Traffic lights)
  or by sprinting at the right moment (Pincer) are not interesting.
- **No straight runs.** A puzzle that can be crossed left to right in one line
  loses its idea (Propeller). Walls in the path are allowed to prevent it.
- **Readable rhythm.** Keep one wave front on screen at a time; overlapping
  fronts look out of sync (Run-It r1).
- **Enough time between groups.** Two groups bursting close together make the
  hop between them feel impossible (Checker Flip r1, Closing Corners r1,
  Side Pockets r1).
- **Early puzzles need slack.** Switchback had to be slowed 20% for an early slot.
- **Very precise sequences are late-level material** (Zigzag, Convergence).
- **Ice levels open with walls and spikes, not saws.**
- **Soft ice needs room.** Fast saws in tight soft-ice corridors feel very bad;
  creeps belong where the player can stop or steer (Snow Line, Bumper Alley,
  Warden's Run). Room to manoeuvre gives agency (Wolf Lanes, Safe Zones).
- **Sim:** a head-on wave slower than about 21 ticks per column can be stepped
  through, making refuges optional (Duck, Slot wave).
- **Sim:** any global pause lets players run through; continuous patterns are
  needed to force the intended move (Slot wave, Snake).
- **Sim:** following a burst loses (33 - ticks per tile) of slack per tile, so
  long rings or fast bursts run out of lap time (Roundabouts).
- **Sim:** a single saw crossing a row blocks it only briefly; saws must run
  along the rows or fill a lane to matter (Gates, Oncoming, Divided road).
- **Sim:** in an open ice field a single saw per column blocks too little;
  saws running along the rows force swerving (Oncoming).
- **Sim:** soft ice turns no tighter than a 1.375-tile radius; a U-turn
  needs about 2.75 tiles of room unless a wall bounces you round (Hairpin).
- **Sim:** blast hits are square, so diagonal steps clip both corner tiles;
  diagonal routes are tighter than they look on paper (Zigzag).

## 2026-10-13: Classic bounds, first playtest (BT-076 → BT-081)

| Puzzle | Feedback | Change |
| --- | --- | --- |
| Run-It | "It feels like the right to left explosions are not in sync, so it is hard to plan around it." **Sim:** confirmed, two fronts overlapped. | One wave at a time; gap bursts half a cycle later. |
| Side Pockets | "There is not enough time to get into the side pocket." | More time per pocket. **Sim:** now medium-hard. |
| Checker Flip | "The alternating colors are too close in explosion timing, so it is very hard to get from one to the other." | Colours further apart. **Sim:** now medium-hard. |
| Rotation | "Not actually rotating, but we get two lanes going towards the player, which gives a satisfying slalom feeling. This is a great level." | Renamed Slalom; gameplay unchanged. |
| Closing Corners | "Looks very nice, but there is a part where the blue explosions meet the purple where there doesn't feel like there is any option to survive." | Seam bursts on its own, apart from both sweeps. |
| Convergence | "A doable, but hard puzzle. Good for later stages." | None. |

## 2026-10-13: Ice escapes, first playtest (BT-080 → BT-082)

| Puzzle | Feedback | Change |
| --- | --- | --- |
| Snow Line | "It is impossible to correctly time when to slide past the saw, so fast-moving targets + slow ice in tight corridors feel very bad." | Saws removed. |
| Wolf Lanes | "A decent puzzle. Doesn't feel spectacular, but just bare minimum as an obstacle. We have more room to manoeuvre here which means it feels we have agency." | None. |
| Safe Zones | "A good level. Could also work with hard ice, but soft ice gives a little room to manoeuvre compared to a pure timing puzzle." | None. |
| Bumper Alley | "Feels too chaotic, and the fast moving saw does not work well with the soft ice." | Saws removed. |
| Spiral | "A decent level. From this I also see that adding collectibles is something we can consider. The last part of the spiral can be skipped, so the goal should be slightly to the side." | Exit separated from the earlier arm; collectibles logged as BT-083. |
| Warden's Run | "Not a fun level, same issues as before with the tight saws and gliding." | Saws only in the chutes. |

## 2026-10-13: Pulse Line co-design on paper (BT-085)

- Brief: an explosion level designed together, one puzzle at a time, roughly
  rectangular for landscape phones. The playtester gave the first puzzle
  (Follow: 3x10, columns left to right).
- Duck: the playtester chose one safe alcove above and one below, with the
  wave restarting right after it finishes.
- Switchback: the playtester's idea, whole top row then whole bottom row.
- Follow, Bands, Checker, Switchback, Duck, Two waves approved on paper, then
  "it should come earlier so there is a better progression of difficulty",
  so Switchback was moved earlier before building.
- "I don't need you to test everything in detail, I just need something I can playtest."

## 2026-10-13: Pulse Line first playtest

- "Duck is unwinnable. Switchback needs to be about 20% slower as it is an early level."
  Switchback slowed 20%.
- "Just make the wave coming towards the player about 20% slower and move the
  bottom alcove one to the left." Done.
- "I have tried it out. This is much better. However, as a full level it seems
  kind of short. We need to design at least 6 more puzzles for the level."

## 2026-10-13: Pulse Line puzzles 7-10

- Spine and pockets approved on paper; not built.
- Pincer rejected: "This just seems like you start to sprint the moment the
  leftmost explosion starts, and is not interesting."
- Traffic lights rejected: "Let us go for more interesting patterns of
  explosions instead of waiting. We can also add walls in the path."
- Propeller built as a test level, then shelved: "The level by itself is ok,
  but it basically becomes a level for running straight from left to right.
  We can shelve this puzzle for now ... and improve it later for instance once
  we add locks and keys." Locks and keys logged as BT-087.
- Snake: "Is this even solvable?" **Sim:** solvable but one timed run. The
  conveyor redesign was chosen, built as a test level and approved.
- Slot wave built as a test level and approved. **Sim:** the wave had to be
  fast (12 ticks per column) and continuous.
- Rain built as a test level and approved. **Sim:** can be crossed on a single
  row; weaving is not required.

## 2026-10-13: Pulse Line puzzle 11 and merge

- Approved test puzzles (Snake, Slot wave, Rain) moved into Pulse Line.
- Roundabouts built as a test level. **Sim:** the 1x2-island sketch left no
  lap time; built with four 1x1 islands. "Good level, approved." Moved in.

## 2026-10-14: Pulse Line puzzle 12

- Zigzag built as a test level. **Sim:** the diagonal route was tighter than
  stepping head-on along a row.
- "I think it is just slightly too fast. Reduce speed by 10%." Done.
- "The puzzle is solvable, but should be considered a very hard puzzle ...
  This one is good, it just requires very precise timing over several
  sequences. For sure one of the later levels." Moved into Pulse Line as the
  last section.
- Asked for a document with difficulty and feel per puzzle, then for history
  to be kept separate from the current state of the levels.

## 2026-10-14: Prototype decisions (BT-089)

- "Only two levels on the home screen. Ice levels codesigned. saves as
  suggested, sharing will be me putting it on my astro website later."
- "After designing it, also create it and put it in test."
- Ice puzzle 1, Stepping stones, sketched and built in Test levels: ground
  islands between soft-ice gaps; a bare gap, one slow saw, then two mirrored saws.
- "I think we should not focus on saws. I prefer walls and spikes for the
  first puzzles." Stepping stones dropped; replaced by Spike slalom: a walled
  soft-ice field with three spike bars, gaps alternating bottom and top.
- Spike slalom: "approved. An easy introductory level to soft ice and spikes."
  Moved into the new soft-ice level, Glide Line, as puzzle 1.
- Ice puzzle 2, Rest stops, sketched and built in Test levels: ground posts
  split the field into three ice bands, each a 2-wide spike-lined channel
  that jogs two rows; line up on the ground, launch, steer one S.
- Rest stops: "This is okish, but can maybe be tightened." Second and third
  jogs now overlap by one column and the last exit is one row wide.
  **Sim:** best-route clearance from spikes 0.35 tiles (was 0.65).
- "I think we can just remove the stops and add spikes at top and bottom, so
  it looks more scary." Renamed Spike run: one continuous channel, spikes on
  every side including the top and bottom edges, no walls or ground inside.
  **Sim:** best route about 0.3 tiles from spikes.
- Spike run approved; moved into Glide Line as puzzle 2.
- Ice puzzle 3, Hairpin, sketched and built in Test levels: three 1-wide lanes
  separated by spike rows; U-turn at each end, where walls let you bounce.
- Hairpin: "I think we should have spikes instead of walls, as well as having
  a bigger area to turn." **Sim:** a full-speed U-turn needs about 2.75 tiles,
  so with no walls to bounce off, lanes two rows apart cannot be turned
  between. Rebuilt as a 7-row field (Glide Line now supports 5- or 7-row
  fields): lanes three rows apart, 5-wide pockets, spikes on every edge. Best
  route about 0.35 tiles from spikes.
- Hairpin approved; moved into Glide Line as puzzle 3.
- Puzzle 4 direction: "I think now we want slow moving hazards. We have some
  decent ones in our existing glide levels." **Sim:** three single vertical
  saws (Safe Zones style) in an open field were far too easy (a straight run
  survived a third of start times). Built Oncoming instead, after Wolf Lanes:
  one slow saw per row (about 2 tiles/s) running along the field; a route
  exists from 36/40 start moments, no single-row route survives.
- Oncoming: "this is fairly easy, but ok as an early level." Moved into Glide
  Line as puzzle 4.
- Ice puzzle 5, Divided road, built in Test levels: two 2-row lanes split by a
  spike row with two gaps; a side-by-side saw pair fills each lane. **Sim:**
  with one saw per row you could dodge within your lane and never use the
  gaps; pairs force a lane change. Route from 20/24 start moments.
- Divided road approved; moved into Glide Line as puzzle 5.
- Puzzle 6 candidates rejected in simulation: Gates (a vertical saw sweeping
  the roads beside spike islands) let 61% of plans win; Overtake (saw pairs
  travelling your way) played like Divided road. Built Rush hour in Test
  levels: Oncoming's saws plus three 2x2 spike islands.
- Rush hour approved; moved into Glide Line as puzzle 6.
- Ice puzzle 7, Scissors, built in Test levels: in each 5-column block two
  saws cross corner to corner together; neighbouring blocks half a cycle apart.
- Scissors approved; moved into Glide Line as puzzle 7.
