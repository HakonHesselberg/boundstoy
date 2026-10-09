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
  `(tick + phase) % period < on` is active; the final 54 ticks warn of activation.
  Dark vent = safe, contracting amber ring = warning, fireball and sparks = active.
  All blast animation uses simulation ticks, so pausing freezes it and replay
  screenshots are repeatable. Reduced motion keeps a static but bright blast.
  Built-in active durations were halved in 0.4.2 without changing periods,
  phases or warning lead. New editor pads use period 360 / on 45 / phase 0
  (0.375 seconds active, 2.625 safe). Imported JSON keeps its literal `on` value.
- Saw: a 0.31-tile radius moving linearly between two cell centers and back.
  `period` is the complete out-and-back cycle. Its whole path is drawn.
- Checkpoint: touch within 0.42 tiles to activate. Each checkpoint activates once
  per run; the latest one becomes the respawn point.
- Death: 54-tick animation, then respawn at the last checkpoint with no momentum.
  Hazards and run time continue. Unlimited attempts; no lives counter.
  Soft ice resumes its full-speed glide on the next live tick. The state records
  whether the cause was void, spikes, a pulse or a saw, for specific retry feedback.
- Exit: touch within 0.42 tiles to finish; hazards take precedence if both collide
  on the same tick. The finish tick is frozen.

All nine levels are always available. Best runs compare time first, then retries to
break equal-time ties. Restart clears checkpoints, falls and time.

## Course design

The release uses six short lessons followed by three single-mechanic practices:

| Level | Special mechanic | Existing ideas reused |
| --- | --- | --- |
| First steps | Normal walking and release-to-stop | Static curbs, spikes, void, checkpoints |
| Gentle curve | Constant-speed soft-ice turning | Normal staging/landing pads and static obstacles |
| Curb turn | Locked hard-ice movement and curb relaunch | Normal ground and static alignment obstacles |
| Pulse crossing | Periodic explosion timing | Normal ground, checkpoints, safe waiting pads |
| Saw crossing | Moving-patrol timing | Normal ground and a crossing that cannot be walked around |
| Take your time | Mud slowdown | The already-taught pulse; no other special terrain/hazard |
| Switchback sweep | Repeated soft-ice steering | Staggered spikes, normal checkpoint landings |
| Three curb route | Three hard-ice curb relaunches | Lane alignment, static obstacles, normal staging pads |
| Pocket wave | Precise travelling explosion waves | Normal movement, existing pulse phases, temporary side pockets |

No level introduces an additional mechanic that belongs to a later lesson.
The original six layouts, IDs, lessons and reference inputs are unchanged.
Nine courses stay below the ten-level cap; mixed-mechanic challenges are not
part of this release.

The soft-ice lesson requires actual heading changes and has a broad landing.
The hard-ice lesson requires choosing the lane before entering and stopping at
a curb to turn. Each introductory timed crossing has a safe place to wait and a reference
launch away from the edge of its safe window. The mud lesson's hazard exposure
lasts 101 ticks versus 42 for the walking pulse witness, making the slower
speed relevant rather than merely cosmetic.

Switchback sweep routes a full-speed glide through two sections; its reference
path uses seven separate steering arcs without wall bounces. Three curb route
requires three outside lanes, curb stops and north/west/south relaunches.

Pocket wave deliberately demands more precise timing than the lessons. Three
one-tile corridors run right, up and left, each with a one-tile side pocket and
a safe checkpoint beyond it. Seven pulse pads per corridor activate in travel
order, 12 ticks (0.1 seconds) apart, on a 240-tick cycle. Lane blasts last
50, 55 and 45 ticks respectively. Each pocket ignites 78, 83 or 73 ticks
(about 0.61-0.69 seconds) after its adjacent path pad clears and burns for 25 ticks.
All of this uses the existing pulse period/on/phase fields, not new hazard logic.

The reference route hides and then leaves each pocket. Shorter blasts widen
its safe dwell windows to 70, 75 and 65 legal tick choices; exiting too early
meets the path wave and too late meets the pocket blast. They also allow
straight-through crossings in narrow 21-, 16- and 26-tick launch windows.
These are measured input-specific margins, not an exhaustive bound on every
trajectory. Checkpoints provide safe observation and recovery.

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
    { "kind": "pulse", "x": 4, "y": 1, "period": 360, "on": 90, "phase": 0 },
    { "kind": "saw", "from": { "x": 2, "y": 3 }, "to": { "x": 5, "y": 3 }, "period": 360, "phase": 60 }
  ]
}
```

Bounds: 8-40 columns, 6-32 rows, 80 hazards, 30 checkpoints, 100 KB imported JSON.
Periods are 120-3600 ticks. Pulses must leave at least 60 safe ticks. Version,
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
