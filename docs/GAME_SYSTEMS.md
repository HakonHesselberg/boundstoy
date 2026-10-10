# Mechanics and level data

## Movement

Positions and velocity are continuous, in tiles and tiles/second. Array
coordinates are integer `(x, y)` with `y` pointing down the board. A cell's
world center is `(x + 0.5, y + 0.5)`. Input is a direction vector; diagonal
vectors are normalized, so two keys do not make walking faster.

| Tile | Ground | Behaviour |
| --- | --- | --- |
| `.` | Normal | 3.6 tiles/s, immediate direction changes and release-to-stop |
| `~` | Soft ice | Always 4.4 tiles/s; heading turns at up to 3.2 radians/s; no braking |
| `=` | Hard ice | 4.8 tiles/s along entry velocity; ignores input until leaving or hitting a wall |
| `:` | Mud | Normal-style control at 1.5 tiles/s |
| `#` | Low barrier | Solid striped curb; blocks the player's circular footprint |
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
  Pads are low-profile with one warning ring. A compact flash, shock ring and
  four short shards stay inside the projected tile; no raised vent or smoke shell.
  New editor pads use period 360 / on 1 / phase 0 (one detonation every 3 seconds).
  Version-1 imports validate the old `on` field but normalize it to `1`, retaining
  geometry, period and phase. Exported JSON always uses `on: 1`. The editor
  reports this change on import/draft restoration; sustained flames are not
  an alternative mode. The initial state is tick 0; `step` first evaluates tick 1.
- Saw: a 0.31-tile radius moving linearly between two cell centers and back.
  `period` is the complete out-and-back cycle. Its whole path is drawn.
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

All shipped levels are always available. Best clears compare time first, then
retries to break equal-time ties. A separate best clean time survives a faster
assisted clear. Results compare clean runs only with clean runs, not assisted
times. Restart clears checkpoints, falls and time.

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
