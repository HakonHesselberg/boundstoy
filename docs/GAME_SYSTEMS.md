# Mechanics and level data

## Current rough world

The production registry contains one V2 world: `aftershock`, revision 2.
Eight sections share a 65x46 board, 226 hazards and continuous elapsed time. Seven
safe checkpoint landings use explicit 0.8-tile collection radii; the last puzzle
ends at the exit without a checkpoint on its safe approach. There is no section
selection. Ordinary/faster full witnesses finish at 5752/5648 ticks with no
deaths. The complete rough map still requires human gameplay acceptance.

Start and New run commit a fresh run before playing; unfinished replacement
requires confirmation. Reload restores checkpoint position and saved totals,
paused, with the active puzzle's pattern restarted. Only the unfinished puzzle
runs; the next starts at its preceding checkpoint, and completed hazards stop.
Neither hidden/closed time nor pause time advances the simulation. Death
advances elapsed and active hazard time; R restarts at the checkpoint and resets
the pattern without erasing elapsed time or deaths. In-session Resume preserves
live position and phase. Best total time
and an independent deathless completion replace the prototypes' mastery targets.

## Explosion puzzle playtest

Open **Menu > Explosion puzzles** for six normal-ground levels, separate from
Aftershock. These replace the surface-comparison menu; no ice, mud or saws are
used. The underlying movement rules and archived benchmark definitions remain
unchanged. All levels use 27-tick warnings and one-tick pulse blasts.

| Level / stable ID | Pattern | Deathless reference ticks |
| --- | --- | --- |
| Follow the wave / `puzzle-wave` | Easy travelling columns, based on accepted benchmark 1 | 542 |
| Alternating bands / `puzzle-bands` | Move, wait and transfer, based on accepted benchmark 5 | 613 |
| Changing refuges / `puzzle-refuges` | Spine bursts at tick 210 of 360; both pockets burst at tick 30 | 796 |
| Checker crossing / `puzzle-checker` | Alternating 2x2 groups; exit requires crossing and moving upward | 616 |
| Crossing waves / `puzzle-crossing` | Column wave along the entry, then row wave up the exit leg | 757 |
| Wave into checker / `puzzle-combination` | Short wave, safe checkpoint, then alternating grid | 1015 |

All IDs are revision 1. Single puzzles have no checkpoints. The combination's
1.4-tile-radius checkpoint spans the three-tile approach and sits before the
final puzzle, not by the exit. Its grid starts only when that checkpoint is
collected; the completed wave stops. Restart after a downstream death is
verified to finish in another 605 ticks without adding a death.

Selection reveals the whole first puzzle, unobstructed and stationary.
**Start trial** starts the clock; the initial landing is safe. The combination
reveals the entire next puzzle after the checkpoint camera pan. Ordinary
death preserves the current rhythm. **R** returns to the start or checkpoint
and resets the pattern, retaining elapsed time and retries. After finishing,
**New trial** starts fresh; **Choose a puzzle** returns to the six-level menu.
The menu shows the last completed trial per level for this session only.

Puzzle play never overwrites the Aftershock run, its records or the editor
draft. Return through the world menu to its parked live state. Reload resumes
normal production checkpoint persistence, not a saved puzzle trial.

All six have exact input-only deathless witnesses and failure probes that
finish when hazards are removed. Changing refuges additionally rejects a
straight dash at every initial phase and its witness visits both pockets.
Minimum measured late-input tolerances range from 13 to at least 24 ticks.
At each command boundary independently extend the previous input by 1..24 ticks
(or wait at spawn for the first input), then replay the remaining inputs.
`24+` is a measurement cap. These one-sided independent tolerances do not
guarantee combined-error robustness, optimality or enjoyable human play.
Finish ticks stop at victory; final held inputs may include unused slack.

Evidence: `node --test tests/explosion-puzzles.test.ts` and, after a build,
`node tests/browser/explosion-puzzles.ts --browser /absolute/path/to/chromium`.
The old 24 surface comparisons remain in `data/benchmarks.ts` with their
original evidence and `tests/benchmarks.test.ts`, but are not in the menu or
runtime bundle. Human feedback for all 24 is recorded in BT-069.

## Movement

Positions and velocity are continuous, in tiles and tiles/second. Array
coordinates are integer `(x, y)` with `y` pointing down the board. A cell's
world center is `(x + 0.5, y + 0.5)`. Input is a direction vector; diagonal
vectors are normalized, so two keys do not make walking faster.

| Tile | Ground | Behaviour |
| --- | --- | --- |
| `.` | Normal | 3.6 tiles/s, immediate direction changes and release-to-stop |
| `~` | Soft ice | Always 4.4 tiles/s; heading turns at up to 3.2 radians/s; no braking |
| `=` | Hard ice | 4.8 tiles/s along entry velocity; ignores input until leaving or hitting a wall. Pale with diagonal streaks |
| `:` | Mud | Normal-style control at 1.5 tiles/s. Brown with scattered pebbles |
| `#` | Wall | Dark matte solid architecture; blocks the player's circular footprint. Curbs beside open cells keep full tone; fill two or more cells away fades toward the background |
| space | Void | Falling is lethal |
| `!` | Spikes | Always lethal |

Soft-ice input chooses a desired heading, not an acceleration or a throttle.
The heading turns by at most `3.2 / 120` radians per tick and velocity is always
`4.4 * (cos(heading), sin(heading))`. No input keeps the heading; reverse makes a
constant-speed U-turn (clockwise for an exactly opposite direction).
The minimum turning radius is about 1.38 tiles. Small analog input changes
heading but never reduces speed. Starting/respawning on soft ice with zero
velocity launches along the input direction, or east if there is no input.

Hard ice can carry a diagonal entry vector:
it locks a straight **line**, not a cardinal direction. A player stopped against
a wall (or starting on hard ice) can choose a new launch direction. Walls stop
hard-ice motion completely. Soft ice reflects the blocked velocity components
without losing speed; normal ground and mud slide along walls.

The player's collision radius is 0.20 tiles. Movement is checked in small steps,
so walls cannot be skipped at the supported speeds. A fall occurs when the
player's center enters void/spikes. Hazard collisions use the full footprint.

## Hazards and goals

- Pulse: a square danger zone, 0.43-tile half-size plus player radius.
  `(tick + phase) % period === 0` is lethal for **one 120 Hz simulation tick**
  (about 8.33 ms), not one displayed frame. The final 27 ticks (225 ms) warn of
  detonation, half the former 54-tick buildup. Period and ignition phase are unchanged.
  The tile is safe on the very next tick, even with visual debris over it.
  The ground plate immediately returns to its safe colour; a six-tick flash,
  expanding shock ring and non-looping debris dissipate over 36 ticks (300 ms).
  Effects sample time since ignition, so skipping the ignition render frame
  does not hide the explosion. Pause freezes the effect; reduced motion removes
  particle travel and expansion but preserves warning, flash and fade.
  Idle pads draw no plate: the actual terrain shows inside a thin rounded
  groove in the style colour with a soft additive inner edge glow. Pads outside
  the running world puzzle are dormant: a grey groove and a faint glow. Idle
  pads are one instanced field (two draws); a pad switches to its own animated
  view only while charging or bursting. During the warning a glowing spark burns
  clockwise round the groove, leaving a hot trail, while a soft edge tint rises
  to at most 0.5 opacity. Ignition holds a soft, rounded white-hot flash for two
  ticks (always more salient than the charge-up), with a smooth eruption that
  shades from the style's white-hot core to its colour at the tips, peaking at
  tick 4 (at most 0.5 tall). A soft ring shockwave and radial glow follow, then
  a radial scorch and glowing embers that cool to the style's debris colour.
  Pad art follows the soft-lit diorama: every visible part is shaded by a
  linear-filtered mask (`presentation/glow-textures.ts`) or a vertex gradient,
  except the thin groove, fuse and embers; there are no stepped or keyline
  pixel-art cues. Every vertex stays inside the projected
  tile for all styles and ticks (`tests/mobile-readability.test.ts`).
- Explosion style: optional cosmetic `style` on a pulse: `ember` (default and
  omitted on export), `plasma`, `toxic` or `psionic` (`data/explosion-styles.ts`).
  Styles change colours and burst motif (petals, rings, cloud, swirl) only, never
  timing, footprint or lethality. Author one style per rhythm group and contrast
  neighbouring groups; colour never carries danger alone. No red style: red is
  reserved for spikes, saws and death feedback. The editor's Pulse brush shows
  style chips; painting an existing pad changes only its style.
  See `docs/ANIMATION.md` and `docs/research/explosion-readability.md`.
  New editor pads use period 360 / on 1 / phase 0 (one detonation every 3 seconds).
  Version-1 imports validate the old `on` field but normalize it to `1`, retaining
  geometry, period and phase. Exported JSON always uses `on: 1`. The editor
  reports this change on import/draft restoration; sustained flames are not
  an alternative mode. The initial state is tick 0; `step` first evaluates tick 1.
- Saw: a 0.31-tile radius moving linearly between two cell centers and back.
  `period` is the complete out-and-back cycle. Its whole path is drawn as a
  flush groove with caps at both turnarounds; its glow stays within one cell.
- Checkpoint: place on safe landings between puzzles, never next to the exit
  or on its safe approach. The exit completes the final puzzle.
  Each activates once per run; the latest becomes the respawn point. New
  checkpoints have explicit generous `radius` values (normally 1.4 tiles),
  shown by their ring. Collection uses the player's center and requires a clear
  floor segment to the marker, so nearby walls/void cannot be skipped.
  Old JSON without `radius` retains 0.42 tiles; optional radius must be finite,
  greater than zero and at most 3. The exit's 0.42 trigger is unchanged.
- Death: 54-tick animation, then respawn at the last checkpoint with no momentum.
  Hazards and run time continue. Unlimited attempts; no lives counter.
  Levels with `resetPatternOnRetry: true` reset the hazard pattern to tick zero
  when respawning; elapsed run time and deaths are never erased. The default
  is false for old imports. This supports repeatable practice from the latest
  puzzle checkpoint, or the start when none exists.
  Soft ice resumes its full-speed glide on the next live tick. The state records
  whether the cause was void, spikes, a pulse or a saw, for specific retry feedback.
- Exit: touch within 0.42 tiles to finish; hazards take precedence if both collide
  on the same tick. The finish tick is frozen.

### Continuous-world progression (version 2)

Only the next section's checkpoint is eligible, in validated metadata order.
Touching a later marker early does not bank it; revisiting an earlier marker
cannot downgrade recovery. At most one checkpoint is collected per tick, using
the same explicit-radius and clear-floor-segment checks as version 1. The exit
is locked until every intermediate section is complete. The runtime uses the
actual section count, including worlds with just a final section and no
checkpoints, rather than hard-coding the planned eight-section content.

Section completion only updates the existing immutable state's checkpoint,
coordinate-key `visited` history and event. It does not reload the world, move
the player or clear momentum/deaths. In checkpoint mode it also sets
`patternOffset = tick`, starting the next puzzle's clock at zero. Version 2 declares
`resetPatternOnRetry: false`: elapsed time and pulse/saw samples advance together
through all 54 respawn ticks, with recovery at the latest checkpoint (or spawn).
Hazards take precedence over checkpoint and exit collection.

`puzzleMode: "checkpoint"` opts into sequential timed-hazard activation.
Every pulse/saw requires `sectionId` referencing its owning section, even when
its sweep crosses a boundary or connector. Ownership is explicit, not inferred
from camera position or the player's location. Only the unfinished section's
hazards are enabled; none remain enabled after winning. Inactive pads are
static identifiers without warning, glow or aftermath; inactive saw blades
are hidden. Spikes and void remain lethal terrain. Without this mode, V2
imports retain the historical global clock; ownership fields are rejected.
The editor uses its selected section when creating timed hazards.

Production phases use fixed authoring offsets `[0,507,1339,1872,2539,3272,4072,4773]`
relative to the historical fragments, then run on the local checkpoint clock.
These are data calibration constants, not required arrival times. A faster or
slower previous puzzle cannot change the next puzzle's starting pattern.

`worldSectionIndex(world, visited)` from `core/world.ts` returns the zero-based
first incomplete section, or the final goal section after all checkpoints
(including after a win). It derives progress without another state field and
assumes validated world metadata and runtime history; it is not a snapshot
validator. Guidance uses that section's name and an authored matching-world
hint, falling back to the objective and terrain hint for custom worlds.
Checkpoint acquisition triggers a presentation-only reveal of the next complete
puzzle at a common fixed scale. The camera pans as needed to retain a
backtracking player without downgrading this progress. Version-1 independent collection, ungated exit,
legacy guidance and explicit retry-reset behavior remain unchanged.

All shipped levels are always available. Best clears compare time first, then
retries to break equal-time ties. A separate best clean time survives a faster
assisted clear. Legacy course results compare clean runs only with clean runs,
not assisted times; V2 world results use the time-first comparison below.
New run clears checkpoints, deaths and time; checkpoint Restart does not.

### World completion records (BT-043)

World records are separate from `boundstoy.progress.v1` and
`boundstoy.draft.v1`. Neither legacy format/key is changed or migrated; even an
old course record with the same ID cannot earn a world achievement.
An exact V2 world ID **and positive safe-integer content revision** identify
each record. Older revisions remain stored but are never fallback comparisons.
Authors must bump revision when content/gameplay changes invalidate old times.

The pure schema has its own version, independent of world/snapshot versions:

```json
{
  "schemaVersion": 1,
  "worldVersion": 2,
  "records": [
    {
      "worldId": "aftershock",
      "revision": 1,
      "run": { "ticks": 900, "deaths": 2, "cleanTicks": 1200 }
    }
  ]
}
```

`run` reuses `Run`: `ticks` is the fastest total completion time, including
every death/recovery; fewer `deaths` break **exact-time** ties. A slower clean
finish never displaces a faster assisted personal best. Deathless achievement
is independently derived from `bestClean(run) !== undefined`; the returned
number is the best deathless time. A zero-death best needs only
`{ticks, deaths: 0}`. An assisted best may retain a strictly slower `cleanTicks`.
Equal-time clean completion wins the tiebreak and becomes the best itself.
There is no redundant achievement flag, target time or checkpoint medal.

```ts
// application/storage.ts; world is a validated World from core/level.ts
const records = readWorldRecords(sourceOrNull);
const previous = getWorldRecord(records, world);
const deathlessTicks = bestClean(previous);
// Only after a legitimate finish, use the ENTIRE run's counters:
const updated = recordWorldFinish(records, world, state.tick, state.deaths);
const joined = mergeWorldRecords(updated, anotherWritersValidatedRecords);
const source = encodeWorldRecords(joined);

// application/campaign.ts; call against records BEFORE recording the finish:
const result = worldFinishResult(records, world, {
  ticks: state.tick, deaths: state.deaths,
}); // {kind: 'first'|'best'|'equal'|'slower', deltaTicks, fewerRetries}
```

`worldFinishResult` compares time first across clean/assisted runs, scoped to
the supplied world revision. `finishResult` retains its legacy clean-only
comparison semantics. Negative `deltaTicks` means faster; positive
`fewerRetries` means fewer deaths. A first completion has zero deltas.
`WorldIdentity` is `Pick<World, 'version' | 'id' | 'revision'>`, so a full V2
world is accepted without requiring target metadata.

`validateWorldRecords(unknown)` is the strict copy boundary.
`readWorldRecords(string | null)` treats **only null** as no save.
Malformed JSON, duplicate JSON fields/identity entries, unsupported versions,
unknown/missing fields, non-plain objects/accessors, array holes, invalid IDs,
non-safe/fractional/negative counters, zero ticks and contradictory clean times
throw explicitly. `encodeWorldRecords` revalidates before serialization.
Callers must retain rejected source and expose recovery rather than silently
replacing it. IDs such as `constructor` are ordinary IDs, never prototype
lookups. Arrays avoid object-key identity ambiguity.

All returned records are detached and deeply frozen. Canonical serialization
sorts IDs lexically and revisions numerically. Merge joins the fastest
time/death pair and minimum deathless time **independently**, using the existing
`recordFinish`/`bestClean` rules. It is commutative, associative and idempotent:
stale or repeated writers cannot erase an earned deathless fact or a better
time. Duplicate entries inside one envelope are corruption, not a merge.

A legitimately saved zero-death continuation remains eligible. Any recorded
death before or after saving prevents that completion from earning deathless.
The record API consumes totals; it does not reconstruct them or independently
prove a win/route. Snapshot validation and the caller establish legitimate
continuation. Personal records are not an anti-cheat authority.
These functions perform no browser reads/writes: storage keys/ownership,
run IDs, tombstones, reset coordination and persistence error UI belong to
BT-044 and subsequent lifecycle/UI work. In particular, merge retains facts;
it does not implement deletion or last-writer-wins snapshot coordination.

### Exact V2 run snapshots (BT-042)

Snapshot schema version 1 stores a V2 world run, not a legacy V1 save. Example
at the initial boundary of `tests/fixtures/world.ts`:

```json
{
  "schemaVersion": 1,
  "worldVersion": 2,
  "runId": "run-042-0001",
  "worldId": "progression-fixture",
  "revision": 1,
  "state": {
    "tick": 0,
    "patternOffset": 0,
    "position": { "x": 1.5, "y": 2.5 },
    "velocity": { "x": 0, "y": 0 },
    "checkpoint": { "x": 1, "y": 2 },
    "visited": [],
    "deaths": 0,
    "respawnTicks": 0,
    "won": false,
    "event": "none",
    "deathCause": null
  }
}
```

The envelope includes every simulation field. Once collected, `checkpoint`
contains the entire authored marker (for example
`{"x":6,"y":2,"radius":0.42,"id":"first-landing"}`), exactly as `step` stores it.
`visited` must be an exact ordered prefix of world checkpoint coordinate keys;
checkpoint recovery must match its last entry, or spawn for an empty history.
Section progress derives from that prefix; no section/camera index is saved.

```ts
const snapshot = createRunSnapshot(world, runId, state);
const source = encodeRunSnapshot(world, snapshot);
const result = decodeRunSnapshot(world, source);
if (result.status === 'valid') {
  const restored = result.snapshot.state; // exact state, not a checkpoint restart
  // A lifecycle caller must keep this paused until explicit resume.
} else {
  // Keep source unchanged; present recovery/reset rather than silently replacing it.
}
```

The codec validates finite positions and velocities, safe nonnegative integer
clocks/counts, ordered history and marker metadata. Global V2 offsets remain
zero; checkpoint-mode offsets range from zero to elapsed tick.
Elapsed ticks must allow the claimed checkpoint collections and death/recovery
intervals. Tick zero must be the initial state. Maximum velocity is derived
from the terrain registry (currently hard ice, 4.8 tiles/s), not the current
tile alone: a live state may have just crossed a terrain boundary.

Live positions cannot intersect walls or current lethal geometry. A dead
position is checked at local `tick - (54 - respawnTicks) - patternOffset`, **not** at the current
countdown tick: a pulse may already be harmless while recovery is still
pending. All four death causes are supported. Boundary falls legitimately
retain a position slightly outside the map throughout recovery. Such positions
must be void deaths within one reachable movement step of safe floor, using
the bordering terrain's speed; the overall maximum is 0.04 tiles, including
diagonal distance, with only a floating-point arithmetic tolerance.
Deep void/spike positions and arbitrary out-of-bounds coordinates are rejected.
The exact codec never clamps or moves accepted positions.
`createCheckpointSnapshot` first validates the complete live state, then
normalizes an unfinished checkpoint-mode save to checkpoint center, zero
velocity/countdown, no event, and `patternOffset = tick`. It preserves totals,
history and persistent death cause; finished states stay exact. Manual Restart
can skip a respawn countdown, so checkpoint-mode count bounds allow one death
per live tick instead of requiring every historical 54-tick animation.
Live in-session state remains separate from this durable representation.

Death means zero velocity, positive deaths, the full 54 remaining ticks and
`event: 'death'`. Subsequent countdown ticks have `event: 'none'`. Recovery
retains `deathCause`, as do subsequent live/checkpoint/win states; only a new
run clears it to null. A finished state has every intermediate marker, a
position inside the goal trigger, zero velocity, no pending respawn and
`event: 'win'`; `step` freezes that state. Zero-death resumed runs keep their
eligibility without an extra achievement flag.

These are bounded structural/local consistency checks, not an exhaustive
proof of route reachability or anti-cheat. Content authors must bump world
revision when layouts, hazards or gameplay semantics become incompatible.
The codec cannot discover a changed world dishonestly reusing the same identity.
Future incompatible simulation/schema changes must likewise invalidate or
explicitly migrate snapshots rather than silently reinterpreting them.

Pause, held keys, rendering objects, accumulator fractions, audio and elapsed
wall time are not simulation state and are rejected as extra fields. A paused
boundary simply has no further `step` calls. Browser saving, ownership,
startup continuation and visible error recovery are separate issues; no such
integration is introduced by this pure contract.

### Browser continuation (BT-045)

Checkpoint-mode worlds use **R / Restart** to return to the checkpoint with
zero velocity and active pattern tick zero. Total elapsed ticks, deaths and
ordered progress remain. **Menu / New run** separately confirms replacement.
Reload applies the checkpoint-normalized committed state, paused with cleared
controls; in-session Resume retains the live position. Editor playtests never
replace campaign progress. Global-clock V2 imports retain their prior exact
continuation and New run semantics.

Checkpoint-mode snapshots are queued on death, checkpoint, completion,
pause/menu, visibility loss, graphics loss and explicit Restart. There are no
periodic or respawn-completion writes. Legacy global-clock worlds retain their
120-tick/respawn-end boundaries for compatibility.
The status changes from Saving to Saved only after transaction completion.
Closing a page is an additional best-effort save, not a guarantee: abrupt
termination can recover only the latest completed transaction. Continuing a
zero-death run retains deathless eligibility; completing it atomically records
the result and retires the active save.

One tab owns saving through play, pause and hidden states. A second tab explains
the conflict and offers an explicit retry after ownership is released. Denied
storage, incompatible content or corrupt bytes remain visible. **Play without
saving** is an explicit session-only choice, not a compatibility pass or a saved
record. Returning from that mode to a committed save requires confirmation
before discarding unsaved play.

Save options can export recovery bytes. Explicit **Reset saved world** preserves
the old stored world/records in a bounded transactional recovery archive before
clearing them; legacy records and drafts are unchanged. If archiving fails,
reset fails too. Original localStorage bytes are retained during one-time
migration, but afterward IndexedDB alone is authoritative. Old application
versions must be closed/reloaded before migration.

These paths are wired for V2 registry entries; the retired V1 encounters
retain their existing restart/record semantics and do not gain exact-run saves.
Their progress and editor drafts now use the same transactional authority.

## Active encounter design: Aftershock

The playable registry contains Borrowed Ground v2, Crosscurrent and Checkerboard.
They use normal ground, walls and instantaneous pulses. Each map is one compact
hazardous puzzle followed by a safe landing and an exit, with no checkpoint. The eight-stage
world is not yet complete. Normal ground alternates muted light/dark shades
without changing its movement model, and pulse plates preserve those groups.

| Encounter | Clear / mastery witness ticks | Clean target | Distinct technique |
| --- | --- | --- | --- |
| Borrowed Ground | 752 / 613 | 690 | Transfer off the expiring elbow or retreat across spent ground; moving sequences rather than repeated whole fields |
| Crosscurrent | 620 / 561 | 590 | Change lanes within a four-lane sequential field; diagonal movement shortens the line |
| Checkerboard | 711 / 503 | 540 | Alternate safe color groups, using diagonal travel and a cardinal color transfer |

Borrowed Ground repeats every 360 ticks: approach steps flash at 1/36/71,
the elbow expires at 190, descent steps at 110/145/180/215, outgoing steps at
285/320/355. Crosscurrent's four lanes use
`(80 + 30*(x-2) + 70*(5-y)) mod 300` for ignition.
Checkerboard fills an 8-by-6 rectangle: all light/even `(x+y)` cells flash at
154, dark/odd at 334, repeating every 360 ticks. No tile has stacked pulses.

Recovery tests deliberately backtrack from the final landing into the completed
field to cause a death, then demonstrate return to the start and a full legal
clear. The final landing does not silently bank progress. Generic checkpoint
support remains available for future multi-puzzle maps and the editor.
Witnesses and measured tolerances prove specific legal strategies, not human
replay-value acceptance or globally optimal routes.

## Retired Relay regression fixtures

The eight-course Relay campaign replaces every prototype layout, ID and witness.
It teaches before combining, then uses existing movement and hazards in longer
phrases. These existing routes are regression fixtures, not the approved
Aftershock world or evidence of interesting gameplay. Pulse courses now have
`-v2` IDs so their times do not compare against sustained-flame `-v1` records.

| Level | Route composition | Observation / commitment |
| --- | --- | --- |
| Relay courtyard | Open balcony around an empty center | Stop at the east corner, descend, turn west |
| Reservoir hairpin | Continuous U-shaped soft-ice reservoir | Read both broad arcs before launching; dry far-bank recovery |
| Spillway locks | Offset descending blue-ice staircase | Align above the clear lane; south/west/south curb launches |
| Signal stairs | Two gates on north/east/north stairs | A dry elbow separates the two timing decisions |
| Patrol looms | Two perpendicular saw threads | Cross east, observe again, cross north and leave east |
| Silt terraces | East and south mud channels | Fresh quiet windows; dry land restores speed before the return |
| High interchange | Green hook, dry transfer, blue curb, high signal bridge | Switch movement rules only on safe ground |
| Last light relay | Two pulse elbows, mud riser, saw finish | Continuous chase phrases alternate with stationary observation |

The hairpin witness turns through exactly 180 degrees, carrying 4.4 tiles/s
without wall reflections for 615 ticks. Omitting either arc leaves the route.
Spillway requires two full stops; continued input into either curb cannot
complete the route. Its inside lane hits spikes even when steering is attempted.

Signal stairs and Silt terraces cross both pulse footprints in the middle half
of each quiet window. Each walking exposure is 42 ticks; mud exposures last
100 and 101 ticks. Both timed launches in the pulse, saw and mud introductions
tolerate every offset from -24 to +24 ticks, while deliberately unsafe launch
phases fail. These are input-specific measured tolerances, not promises that
any trajectory or launch is safe.

The finale's nine-vent east/north phrase and ten-vent east/south answer advance
one tile every 33 ticks (0.275 seconds), close to walking cadence. Their shared
720-tick period and instantaneous blasts make a returning chase: the reference player
passes vent centers 65–85 ticks before they ignite. Camping on any vent dies
at its next ignition. The slow riser detonates for one tick on the same cycle;
the final saw also shares that period. No hiding pockets or inherited
prototype wave geometry remain.

All spawns and checkpoints are on normal ground, safe to observe for two
complete cycles. Actual death/respawn recovery is verified at every cycle phase.
Every reference checkpoint segment is shorter than ten seconds, including
planned observation. Later courses require at least three direction decisions;
blocking any authored bottleneck disconnects even a permissive diagonal walk
graph. Exact replays and margins are listed in [TESTING.md](TESTING.md).

Barriers are 0.24 tiles tall with a contrasting top edge; their collision is
still a full solid cell. Each spike tile has five pointed metal teeth rather
than flat warning symbols. Visual height never changes passability.

## JSON format

```json
{
  "version": 1,
  "id": "my-course",
  "name": "My course",
  "description": "An experiment in momentum.",
  "tiles": [
    "########",
    "#......#",
    "#.~~==.#",
    "#..::..#",
    "#......#",
    "########"
  ],
  "spawn": { "x": 1, "y": 4 },
  "goal": { "x": 6, "y": 1 },
  "checkpoints": [],
  "hazards": [
    { "kind": "pulse", "x": 4, "y": 1, "period": 360, "on": 1, "phase": 0 },
    { "kind": "saw", "from": { "x": 2, "y": 3 }, "to": { "x": 5, "y": 3 }, "period": 360, "phase": 60 }
  ]
}
```

Bounds: 8-40 columns, 6-32 rows, 80 hazards, 30 checkpoints, 100 KB imported JSON.
Periods are 120-3600 ticks. The legacy `on` input remains a required integer
in `1..period-60` for version-1 compatibility, but is normalized to `1`; it
does not control damage or visual duration. Version,
tile characters, coordinates, required text and numeric values are validated;
unknown hazard kinds are rejected. Spawn, exit and checkpoints must be on safe
terrain. Hazard paths can cross void; placing a pulse does not create ground.
Validation checks structure and limits, not whether a custom level is beatable.

## Version-2 continuous-world JSON

BT-038 supersedes the old three-course expansion gate: the first product world
will have eight ordered sections and seven intermediate checkpoints. Those
numbers are content requirements, **not** generic schema or physics constants.
BT-039 supplies the contract only; the active playable registry is unchanged.

Public API:

```ts
import { importLevel, parseLevel, type Level, type World } from '../core/level.ts';
import { V1_LIMITS, V2_LIMITS } from '../data/level-limits.ts';

const level: Level = importLevel(source); // source is JSON text
if (level.version === 2) {
  const world: World = level; // discriminant narrowing, not a cast
  const identity = `${world.id}@${world.revision}`;
  const firstCompletion = world.sections[0].completion;
  // checkpointId exists only when firstCompletion.kind === 'checkpoint'.
}
const frozenCopy = parseLevel(level);
const exportedJSON = JSON.stringify(frozenCopy);
```

A complete small joined example (not a campaign entry):

```json
{
  "version": 2,
  "id": "joined-fixture",
  "revision": 1,
  "name": "Joined fixture",
  "description": "Contract evidence, not a campaign.",
  "resetPatternOnRetry": false,
  "tiles": [
    "################",
    "################",
    "#..............#",
    "#......##......#",
    "################",
    "################"
  ],
  "spawn": { "x": 1, "y": 2 },
  "goal": { "x": 14, "y": 2 },
  "checkpoints": [{ "id": "landing-one", "x": 6, "y": 2, "radius": 1.4 }],
  "hazards": [{ "kind": "pulse", "x": 4, "y": 3, "period": 360, "on": 1, "phase": 60 }],
  "sections": [
    {
      "id": "first",
      "name": "First",
      "bounds": { "x": 1, "y": 2, "width": 6, "height": 2 },
      "entry": { "x": 1, "y": 2 },
      "observation": { "x": 1, "y": 2, "width": 1, "height": 2 },
      "completion": { "kind": "checkpoint", "checkpointId": "landing-one" },
      "camera": { "mode": "fixed", "frame": { "x": 0, "y": 0, "width": 9, "height": 6 } }
    },
    {
      "id": "second",
      "name": "Second",
      "bounds": { "x": 9, "y": 2, "width": 6, "height": 2 },
      "entry": { "x": 9, "y": 2 },
      "observation": { "x": 9, "y": 2, "width": 1, "height": 2 },
      "completion": { "kind": "goal" },
      "camera": { "mode": "follow", "frame": { "x": 7, "y": 0, "width": 9, "height": 6 } }
    }
  ]
}
```

### Authoring/joining conventions

- All points, hazard endpoints and rectangles use **global integer tile
  coordinates**. Rectangle right/bottom edges are exclusive:
  `{x: 9, y: 2, width: 6, height: 2}` owns columns 9–14 and rows 2–3.
  Nothing is rebased by the parser. When moving an authored section, translate
  its terrain, entry, observation, checkpoint, hazards **and camera frame**;
  never translate pulse phase or saw period. There is one spawn and one exit.
- `sections` array order is progression order. Every nonfinal section completes
  at exactly one named checkpoint **inside its own bounds**, on a permanently
  safe, stoppable landing. The following section has its own entry/observation
  area, reachable across connector floor. Entry is an authoring route witness,
  not another spawn, teleport or runtime completion trigger. The first entry
  equals the world spawn. Entry and completion must differ. Only the final
  section completes at `{ "kind": "goal" }`, inside its bounds.
- Checkpoint IDs and section IDs are unique in their respective namespaces;
  lowercase letters, digits and hyphens, 1–60 characters. All checkpoints must
  be referenced exactly once and in array order; no dangling, reused or unused
  references. Checkpoints cannot duplicate positions or coincide with spawn/exit.
  V2 requires an explicit finite radius in `(0, 3]`. Radius controls the existing
  collection rule, not ownership of terrain. Actual trigger width, recovery and
  separation from the final exit approach still require content/playtest evidence.
- Section bounds cannot overlap, even on identical terrain: terrain ownership
  must be unambiguous. Adjacent rectangles are allowed. Unowned safe terrain
  supplies connectors; the example joins via `(7,2)` and `(8,2)`.
  Observation rectangles must be entirely inside their section and contain its
  entry. All observation tiles and checkpoint landing tiles must be normal
  ground or mud (stoppable, unlike ice), clear of hazard swept bounds expanded
  by the player radius for **all** phases. Saw clearance uses a conservative
  swept axis-aligned bounding box; a close diagonal saw arrangement can be
  rejected even when its exact swept disk would miss the area.
- Every section needs a cardinal, non-solid/non-lethal terrain route from entry
  to completion **within that section**. Consecutive sections need a connector
  route from the preceding completion to the next entry, using the preceding
  section, unowned terrain and the next observation area, never a different
  puzzle section. Hazard timing, ice dynamics, diagonal-only routes, input
  margins, bypass prevention and human readability are not proven by this graph.
  Unused decorative floor is allowed; no claim that every tile is reachable.
- `camera.mode` is `fixed` (section-framed view) or `follow` (designed movement
  within the authored framing region). `camera.frame` is a world-bounded
  rectangle containing the section. Camera frames **may overlap** and may
  include connector/landing space; they are never collision/progression bounds.
  Camera interpolation, transition timing, zoom and aspect-ratio fitting are
  presentation responsibilities (BT-041, superseded for gameplay by BT-063),
  not fields that run scripts. Gameplay uses whole-puzzle checkpoint reveals
  at a common scale; `follow` hints remain applicable to editor framing.
- Required world identity is `id` plus positive safe-integer `revision`.
  Bump revision for changed authored content; schema `version` stays 2.
  V2 rejects unknown fields on every schema object, malformed numeric values
  and metadata. It accepts only `on: 1` pulses, rejects multiple pulses on a
  tile and exact duplicate saw definitions. Crossing saw paths or pulse/saw
  footprints remain possible outside protected observation/landing areas.
  Hazard periods/phases and one-tick lethality keep the existing contracts.
- V2 retry reset is forbidden: omitted `resetPatternOnRetry` normalizes to false;
  `true` is rejected. This encodes the approved continuous hazard clock without
  changing V1 retries or implementing new progression yet.

V2 defensive limits: 8–160 columns, 6–128 rows, 640 hazards, 1–64 sections,
0–63 checkpoints (exactly section count minus one), 1,000,000 **UTF-8 bytes**
including whitespace on import. Positive revision is at most
`Number.MAX_SAFE_INTEGER`. These provisional budgets bound data and validation,
not device performance. Boundary tests cover both dimensions, counts and exact
import sizes. One-section worlds are legal; eight/seven is the first world's
product scope. V1 retains its own limits and lenient legacy field handling,
normalizes old pulse durations to one tick, and continues to roundtrip through
the existing editor. Ordered world progression and continuous clocks are described
above; the bounded editor/inspection workflow follows.

### World editor and inspection (BT-047)

The secondary editor accepts the same validated V1/V2 JSON as `importLevel`.
Export preserves IDs, world revisions, whitespace terrain rows, hazards and
section/camera metadata. Ordinary edits do **not** automatically bump a revision:
release authors remain responsible for deliberate revision changes.

For V2, **Editor section view** focuses the existing position-based camera on
the selected section's center. This is a presentation-only position, not a
simulation position, checkpoint collection, respawn or playtest start. Global
tile coordinates still govern painting, saw endpoints, picking and export.
Camera framing may include adjacent sections, connectors or threatening saw
routes under the normal framing rules. There is no player checkpoint-skip UI.
The control is hidden and disabled outside world editing.

Terrain, pulse, two-point saw and hazard-erasure brushes remain available.
Start, exit and checkpoint brushes are disabled for worlds: edit their
dependent section metadata together in JSON instead. Erasing a world checkpoint
is explicitly rejected. All edits pass full world validation before changing
the live draft, undo history or asynchronous saved draft. Invalid metadata,
protected observation/landing changes and broken routes produce a visible
error, never a partial edit or silent fallback. Validation remains structural,
not proof of playability. A new blank is still V1, not a general world-builder.

Playtest always starts at the draft's real spawn. Returning restores the same
draft, section focus and undo history. Tests are isolated even if the imported
ID/revision equals registered campaign content: they cannot update records or
replace the active resumable run. Returning to the campaign restores its exact
saved state through the existing continuation/ownership gates.

Headless tooling retains `npm run inspect -- 0 --replay`. To inspect an
unregistered world without changing the production registry:

```sh
npm run inspect -- --world /absolute/path/world.json --commands /absolute/path/commands.json --json
```

`--world` accepts validated V1 or V2 level JSON (at most 1,000,000 bytes before
parsing, with V1's own stricter parser limits). `--commands` is optional and
accepts a JSON array such as `[{"ticks":167,"x":1,"y":0},{"ticks":54,"x":0,"y":0}]`.
There are at most 1,000 commands, 100,000 command-file bytes and 100,000 total
ticks. Each command has only integer `ticks` in `0..100000` and finite `x`, `y`
in `-1..1`. These are ordinary simulation inputs, never scripts, teleports,
checkpoint setters or snapshot imports. Only regular files are accepted.
`--replay` uses the existing registered witnesses and cannot accompany
`--world` or `--commands`.

The output includes identity, elapsed `tick`, `hazardTick`, `patternOffset`,
deaths, remaining respawn ticks, global position, visited checkpoint keys and
the first incomplete section's index/ID/name (null for V1). `trace` contains
the initial state and each command boundary; split a wait command to inspect
mid-death or recovery. `--json` suppresses the ASCII board.

The opt-in `?debug` API installs only after async persistence initialization.
`window.__BOUNDSTOY__.inspect()` exposes identity, clocks, deaths/respawn,
visited keys and progression section, separately from `editorSection` focus.
`camera()` exposes the actual camera rectangle and orthographic extent;
backtracking can pan away from the revealed section without downgrading progress.
Its gameplay section index is the reveal target, not a claim that every tile
of that puzzle remains visible after backtracking. `snapshot()` still
returns the real simulation state, never the editor camera position. Existing
bounded `advance` uses ordinary inputs in play/playtest only. No additional
state mutation helper or fixture registry ships with these tools.

## Adding types

Terrain definitions live in `data/terrain.ts`. Add a unique character, name,
colour and motion model (`walk`, `steer`, `locked`) with its
speed/turn-rate. The editor palette is
generated from that registry. New visual marks belong in `Scene.tileDetails`.
Normal-style variants can share a motion model; new physical rules need a tested
branch in `step`.

Hazards use a discriminated union, not a generic scripting engine. Add the kind
to `core/level.ts`, validate its fields, sample its deterministic position/phase
in `hazardSample`, implement its hit shape in `lethalAt`, and add its visual and
brush in presentation. Keep rendering and collision dimensions consistent.
This explicit wiring is intentional: untrusted level JSON never executes code.
