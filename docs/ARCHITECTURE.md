# Architecture

The template's useful ideas are kept without introducing a framework:

| Location | Responsibility |
| --- | --- |
| `data/terrain.ts` | Frozen terrain registry and balance constants |
| `data/levels.ts`, `data/aftershock.ts` | Three frozen, validated playable encounters, hints and mastery targets |
| `data/replays.ts`, `data/aftershock-replays.ts` | Exact ordinary/mastery keyboard witnesses |
| `tests/fixtures/relay-*.ts` | Retired campaign data for movement/recovery regressions, not game content |
| `core/level.ts` | Typed level format, strict import validation, coordinates |
| `core/simulation.ts` | Pure `createState`, `step`, hazard sampling and ASCII view |
| `core/editor.ts` | Pure paint/place/blank-level transformations |
| `application/storage.ts` | Progress validation and best-run selection |
| `application/guidance.ts` | Checkpoint-aware lessons and cause-specific retry text |
| `application/render-loop.ts` | Single RAF chain, fixed-step partitioning, visibility and disposal |
| `presentation/main.ts` | DOM UI, input, accumulator loop, editor orchestration |
| `presentation/scene.ts` | Three.js rendering and ray/plane pointer picking |
| `presentation/hazard-visuals.ts` | Testable spike geometry and tick-driven charge/blast visuals |
| `presentation/readability.ts` | Adaptive non-colliding locator and route signs; camera unchanged |
| `presentation/audio.ts` | Opt-in WebAudio effects |
| `astro/Boundstoy.astro` | Static iframe wrapper, no hydration |

The core never imports the DOM, Three.js, storage or the presentation layer.
`step(level, prior, input)` returns a new state. Level arrays/definitions are
frozen and shared between steps; snapshots never depend on rendering.

The active registry re-exports only Aftershock. The three encounters use ordinary
pulse phase offsets and normal ground; there is no course-specific branch in
physics or rendering. Its three variations are compact travelling sequences,
a wide corridor and a two-group checkerboard. The shortened Borrowed Ground
uses `-v2`; new encounter IDs isolate records from the rejected first iteration.
Retired Relay data remains in test fixtures to preserve ice/mud/saw/recovery
coverage without shipping unwanted levels.

Soft ice rotates a fixed-length velocity vector towards input. It has no
acceleration/drag path; releasing input and reversing never reduce its speed.
Collisions reflect soft-ice motion, but stop hard-ice motion. Death/finish are
the only frozen soft-ice states, apart from application pause.

Gameplay uses 120 fixed steps per simulated second. Each frame accumulates
elapsed time, caps a hitch at 100 ms, and executes complete steps. This avoids
unbounded catch-up after a stall. A slow device can therefore run in slow motion;
records measure simulated time, not a competitive wall-clock timer. Hiding the
tab or losing window focus pauses the game and clears held inputs.
State retains elapsed `tick` plus `patternOffset`; `hazardTick(state)` is their
difference. Opted-in retries set the offset on respawn without erasing run time
or deaths. Collision, ASCII inspection, rendering and detonation audio all use
this same pattern clock. Old imported levels leave the offset at zero.
Checkpoints optionally specify a `radius` in tiles, validated as finite and
greater than zero up to three. Missing radii retain the old 0.42 trigger.
New editor markers default to 1.4 and the visible ring uses the actual radius.
Collection requires a clear floor segment to the marker, preventing large zones
from collecting through walls/void. Each authored completed puzzle has a safe
checkpoint and a separately verified post-death continuation.
The frame loop and tests share fixed-step partitioning with a tiny tick-boundary
rounding tolerance, preventing a lost tick at particular refresh rates while
retaining real partial ticks. Keyboard auto-repeat cannot re-add a direction
cleared by pause, restart or navigation; a fresh press is required.

No gameplay RNG is currently necessary. Any future randomness must be seeded and
stored in state, not use `Math.random` or wall-clock time.

Rendering reads state. Decorative bobbing, glow and turning use a separate
visual clock; hazards always sample the simulation tick. Reduced-motion users
keep static decorations but still see hazards move (necessary game information).
Pulse collisions occur only at cycle tick zero. Burst visibility is independent:
it samples ticks since ignition for a 36-tick one-shot effect, including when
a rendered frame skips ignition. The plate signals safe ground immediately
after the single lethal tick; remaining particles are harmless.

Normal ground uses two muted coordinate-parity shades, with even `(x+y)` lighter.
The same two groups remain visible on safe and warning pulse plates; detonation
retains its common bright signal. This is presentation only: both colors are `.`
with the same movement/geometry and no additional level schema.
Tiles and spike clusters use instanced geometry. Static markings and path edges
are batched into line segments. The locally generated environment map provides reflections
without an HDR download. Rebuilding the board disposes old geometry/materials;
page teardown releases renderer, textures, audio and event listeners.
At small projected body sizes, a hollow locator identifies the player without
enlarging its body/collider or covering narrow-lane entrances. On open observation
pads it points away from nearby pulse signals, keeping their telegraphs exposed.
Route signs adapt to
18 CSS pixels where needed; the full-board camera and large-screen signs stay
unchanged. Locator resources are scene-owned, not allocated on every frame.

The application intentionally has no event bus, ECS, physics package, UI
framework or plugin system. New behaviour should first extend the narrow,
typed core interfaces rather than introducing an abstraction.

The player interface is a playfield plus a small HUD/contextual hint. A compact
menu owns level selection, sound, fullscreen, help and secondary editor entry.
Counts and next/final progression derive from `LEVELS.length`, not a fixed
first/second-level flow. There is one generic initial Play gate, not a tutorial
modal per level. Deliberate level selection, next, retry and editor-return
actions load directly into play; debug loads use an explicit paused entry mode
so witness checks cannot race live ticks. Focus moves to the game before the
activating control is hidden. The debug API remains opt-in and has no permanent
developer-facing UI in ordinary play.
Progress retains `cleanTicks` only when the overall fastest clear is assisted;
otherwise its zero-death `ticks` is already the best clean time. Old v1 saves
still load. Result comparisons never pit a clean finish against an assisted one.

The render loop owns at most one pending RAF. Static paused scenes sleep until
invalidated; hidden pages cancel pending work. `Scene.resize` and highlight
changes invalidate presentation without stepping physics. `drawNow` keeps
debug stepping synchronous. Resume/mode changes reset the elapsed-time anchor
so an idle interval never becomes simulation catch-up. Menus freeze covered
initial-entry/editor/victory animation, which resumes when visible and uncovered.

Production-browser testing lives outside the runtime bundle: `scripts/browser-check.ts`
and private `tests/browser/` helpers use native Node HTTP/WebSocket plus an
installed isolated Chromium. It is an opt-in check, not a game dependency or
background service.
The optional real Astro fixture under `tests/astro-consumer/` copies the same
production bytes and wrapper into an isolated pinned build. It reuses the
browser transport/cleanup primitives and introduces no game runtime dependency.
