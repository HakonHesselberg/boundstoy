# Architecture

The template's useful ideas are kept without introducing a framework:

| Location | Responsibility |
| --- | --- |
| `data/terrain.ts` | Frozen terrain registry and balance constants |
| `data/levels.ts` | Six frozen, validated teaching levels and checkpoint lessons |
| `data/replays.ts` | Successful, deterministic input sequences |
| `core/level.ts` | Typed level format, strict import validation, coordinates |
| `core/simulation.ts` | Pure `createState`, `step`, hazard sampling and ASCII view |
| `core/editor.ts` | Pure paint/place/blank-level transformations |
| `application/storage.ts` | Progress validation and best-run selection |
| `application/guidance.ts` | Checkpoint-aware lessons and cause-specific retry text |
| `presentation/main.ts` | DOM UI, input, accumulator loop, editor orchestration |
| `presentation/scene.ts` | Three.js rendering and ray/plane pointer picking |
| `presentation/hazard-visuals.ts` | Testable spike geometry and tick-driven charge/blast visuals |
| `presentation/audio.ts` | Opt-in WebAudio effects |
| `astro/Boundstoy.astro` | Static iframe wrapper, no hydration |

The core never imports the DOM, Three.js, storage or the presentation layer.
`step(level, prior, input)` returns a new state. Level arrays/definitions are
frozen and shared between steps; snapshots never depend on rendering.

Soft ice rotates a fixed-length velocity vector towards input. It has no
acceleration/drag path; releasing input and reversing never reduce its speed.
Collisions reflect soft-ice motion, but stop hard-ice motion. Death/finish are
the only frozen soft-ice states, apart from application pause.

Gameplay uses 120 fixed steps per simulated second. Each frame accumulates
elapsed time, caps a hitch at 100 ms, and executes complete steps. This avoids
unbounded catch-up after a stall. A slow device can therefore run in slow motion;
records measure simulated time, not a competitive wall-clock timer. Hiding the
tab or losing window focus pauses the game and clears held inputs.

No gameplay RNG is currently necessary. Any future randomness must be seeded and
stored in state, not use `Math.random` or wall-clock time.

Rendering reads state. Decorative bobbing, glow and turning use a separate
visual clock; hazards always sample the simulation tick. Reduced-motion users
keep static decorations but still see hazards move (necessary game information).

Tiles and spike clusters use instanced geometry. Static markings and path edges
are batched into line segments. The locally generated environment map provides reflections
without an HDR download. Rebuilding the board disposes old geometry/materials;
page teardown releases renderer, textures, audio and event listeners.

The application intentionally has no event bus, ECS, physics package, UI
framework or plugin system. New behaviour should first extend the narrow,
typed core interfaces rather than introducing an abstraction.

The player interface is a playfield plus a small HUD/contextual hint. A compact
menu owns level selection, sound, fullscreen, help and secondary editor entry.
Counts and intro/next/final progression derive from `LEVELS.length`, not a fixed
first/second-level flow. The debug API remains opt-in and has no permanent
developer-facing UI in ordinary play.
