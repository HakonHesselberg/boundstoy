# Architecture

The template's useful ideas are kept without introducing a framework:

| Location | Responsibility |
| --- | --- |
| `data/terrain.ts` | Frozen terrain registry and balance constants |
| `data/levels.ts`, `data/aftershock-world.ts` | One frozen, validated eight-section world and section hints |
| `data/replays.ts`, `data/aftershock-world-replays.ts` | Exact ordinary/faster continuous-world keyboard witnesses |
| `data/explosion-puzzles.ts`, `data/explosion-replays.ts` | Six isolated normal-ground explosion playtests, hints and exact reference inputs |
| `data/benchmarks.ts`, `data/benchmark-replays.ts` | Archived 24-trial surface comparison registry and reference inputs, not in the menu |
| `data/aftershock.ts`, `data/aftershock-replays.ts` | Retired V1 prototypes and compatibility witnesses, not selector entries |
| `tests/fixtures/relay-*.ts` | Retired campaign data for movement/recovery regressions, not game content |
| `core/level.ts` | Typed level format, strict import validation, coordinates |
| `core/world.ts` | V2 section metadata, completion references and structural route validation |
| `data/level-limits.ts` | Explicit legacy limits and provisional continuous-world budgets |
| `core/simulation.ts` | Pure `createState`, `step`, hazard sampling and ASCII view |
| `core/editor.ts` | Pure paint/place/blank-level transformations |
| `application/storage.ts` | Progress validation and best-run selection |
| `application/run-snapshot.ts` | Pure, bounded exact-run codec and V2 compatibility validation |
| `application/run-continuation.ts` | Ordered async save queue, retry ordering and lifecycle drain |
| `application/guidance.ts` | Checkpoint-aware lessons and cause-specific retry text |
| `application/render-loop.ts` | Single RAF chain, fixed-step partitioning, visibility and disposal |
| `presentation/main.ts` | DOM UI, input, accumulator loop, editor orchestration |
| `presentation/scene.ts` | Three.js rendering and ray/plane pointer picking |
| `presentation/wall-visuals.ts` | Continuous matte wall caps and exposed boundary faces, toned by distance from open cells; floor contact shading |
| `presentation/marker-visuals.ts` | Floor-clipped checkpoint collection zones and their radial texture |
| `presentation/terrain-visuals.ts` | Deterministic instanced mud pebbles and the hairline floor texture |
| `presentation/stroke-visuals.ts` | World-unit stroke and square-band geometry replacing GL lines |
| `presentation/player-visuals.ts` | Robot model, footprint ring, heading cue and detail pixel threshold |
| `presentation/world-camera.ts` | Checkpoint-driven fixed-scale gameplay pans; positional editor/audio framing |
| `data/explosion-styles.ts` | Frozen registry of cosmetic explosion styles (colours and burst motif) |
| `presentation/glow-textures.ts` | Data-built soft masks (radial, edge glow, flash, ring, scorch) for pad art |
| `presentation/hazard-visuals.ts` | Testable spike geometry, tick-driven charge/blast visuals, the instanced idle pad field and saw blade/path |
| `presentation/readability.ts` | Adaptive non-colliding locator and depth-independent route signs; camera unchanged |
| `presentation/audio.ts` | Opt-in WebAudio effects |
| `astro/Boundstoy.astro` | Static iframe wrapper, no hydration |

The core never imports the DOM, Three.js, storage or the presentation layer.
`step(level, prior, input)` returns a new state. Level arrays/definitions are
frozen and shared between steps; snapshots never depend on rendering.

The production registry contains only Aftershock, V2 ID `aftershock`, revision 2.
Its eight sections use normal ground, authored pulse phases and moving saws;
there is no world-specific physics or rendering branch. Seven ordered safe
checkpoints separate puzzles; the eighth ends at the goal. Production guidance
matches the world revision and section identity. Audio samples only enabled
pulses in the position-selected section/connector view.
Retired Relay data remains in test fixtures to preserve ice/mud/saw/recovery
coverage without shipping unwanted levels.

`EXPLOSION_PUZZLES` is a separate frozen registry, not an addition to `LEVELS`,
world record resolution or production progression. Six normal-ground layouts
use only pulse hazards and the existing V2 checkpoint clock, collision and
camera. Five are single puzzles; the sixth has two sections and one safe
between-puzzle checkpoint. Hints are data-owned and follow the active section.
The archived 24 surface comparisons remain unchanged but are not imported by
the application (only their erased replay types are reused).

The presentation layer uses the existing playtest save-suppression path, with
an explicit puzzle identity distinct from editor playtests. No puzzle
load/finish/restart writes a world snapshot, production record or draft.
The parked exact in-memory world remains available; reload uses its normal
durable checkpoint snapshot. Session trial summaries are bounded by the six
IDs, not a new persistence format. Trial checkpoint feedback says reached,
not saved.

Reference witnesses are authored inputs, not a browser solver. Tests replay
each witness and remeasure independent late-input tolerances, plus necessity
and checkpoint-recovery probes. The six-card menu replaces the surface
selector. The ready reveal has no covering intro card; Start trial sits outside
the canvas. Legal completion is not human gameplay acceptance.

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
from collecting through walls/void. Checkpoints separate puzzles, not the final
puzzle from its exit. The current single-puzzle maps have none; future
multi-puzzle maps need a verified post-death continuation from each checkpoint.
The frame loop and tests share fixed-step partitioning with a tiny tick-boundary
rounding tolerance, preventing a lost tick at particular refresh rates while
retaining real partial ticks. Keyboard auto-repeat cannot re-add a direction
cleared by pause, restart or navigation; a fresh press is required.

No gameplay RNG is currently necessary. Any future randomness must be seeded and
stored in state, not use `Math.random` or wall-clock time.

## Versioned world foundation (BT-039)

`Level` is the discriminated union `LevelV1 | World`, narrowed by `version`.
Both retain global `tiles`, `spawn`, `goal`, `checkpoints` and `hazards`, so
geometry consumers need no casts. `parseLevel(unknown): Level` and
`importLevel(string): Level` validate/copy/freeze every nested definition.
`JSON.stringify(level)` is the canonical export for either version. V2-only
fields are accessed after `if (level.version === 2)`, never by casting a V1
level to a world. Types are re-exported from `core/level.ts`; the second-stage
`parseWorldMetadata` function in `core/world.ts` is internal parser plumbing,
not an alternative import API.

World identity is `(id, revision)`: `id` is the stable content slug and
`revision` is a positive safe integer, distinct from schema `version: 2`.
Content authors must bump revision when authored geometry, hazards or section
semantics change; the parser cannot enforce release history. Ordered `sections`
use unique local IDs and reference named world checkpoints, in checkpoint-array
order. The final completion is the one world goal, not another checkpoint.
Camera frames are presentation metadata, not progression triggers. See the
complete schema and joining conventions in [GAME_SYSTEMS.md](GAME_SYSTEMS.md).

BT-052 registers the full rough world; the editor and exact browser continuation
use the foundations described below. BT-040 enforces ordered V2 progression
against the frozen world checkpoint list, keeping run state separate from
authored section metadata without loading a new course at every section.
BT-042 supplies the pure exact-run codec; BT-044/045 supply transactional browser continuation.
V2 data always has `resetPatternOnRetry: false`.
V1 imports, exports, editor transformations and optional retry reset retain
their existing behavior.

### Continuous section views (BT-041)

`CheckpointCamera` observes ordered checkpoint history and the interpolated
player position. Each reveal includes the complete authored puzzle frame,
every threatening hazard's all-phase tile sweep, and the incoming checkpoint's
collection disk plus 0.75 tiles of clearance. The maximum reveal width and
height become a common gameplay rectangle. `fitWorldFrame(frame, aspect)` fits
that rectangle with the existing tilt: floor depth projects at 25/hypot(25, 17)
of its length, plus 1.5 tiles of vertical padding for wall bases and route signs
and 2 tiles horizontally. Scale changes on viewport resize, never on room
approaches, checkpoint collection or backtracking.

Collecting a checkpoint pans the center to the next complete puzzle over
0.7 visual seconds with cubic ease-in/out. Reduced motion and initial/restored
views snap. There is no simulation pause, input handoff, clock reset or saved
camera state. The current visual clock freezes a paused/hidden mid-pan view.
During and after reveals, edge tracking retains the player with 0.75 tiles of
clearance without zooming or springing back toward the target. Backtracking
does not downgrade progress. Gameplay `sections` identifies the revealed puzzle;
`frame` is the actual current camera rectangle, which can pan away from it.
Kinds are `reveal` while interpolating, `fixed` at the reveal target and `track`
after player-retaining displacement.

`selectWorldView(world, position)` retains positional selection for editor focus
and audio locality only. It includes neighboring frames within 0.75 tiles of
an approach, full threatening patrols, and the player on bent connectors.
Editor `follow` hints pan only through surplus authored space without hiding
the required section. They never reintroduce gameplay zoom changes.
V1 retains its exact whole-board camera calculation.
Long V2 frames also pull back along that same angle and extend the depth plane
so fitting the ground in two dimensions cannot leave it behind the near plane.
World key-light/shadow positioning follows that center; returning to V1 restores
the legacy light position.

`Scene.draw` selects/fits views without calling `setLevel` or resetting
`PlayerMotion`. Actual canvas-size changes are handled separately from camera
changes (including same-frame editor-import/playtest layout changes); camera
switches neither resize an unchanged canvas nor enqueue extra RAF work.
Picking, marker positions, hazards and projections remain global. Paused/hidden
idleness stays with the existing render loop.

Geometry is built once per **level load**, not per section transition. Existing
terrain/spike instances and batched detail lines remain world-wide; Three.js
frustum-culls individual hazard meshes/markers and whole batches, but does not
per-instance-cull terrain in a partially visible batch. This is a deliberate
bounded, non-streaming implementation: no transition allocates/disposes GPU
resources. Enabled hazards sample the active local clock in checkpoint mode;
dormant/completed hazards have no warning, blast, motion or sound. Global-clock
imports retain their original behavior. Maximum-budget world performance and
human readability of the common puzzle scale remain content/performance gates,
not claims established by the small joined fixture.

The opt-in `?debug` interface adds only read-only `camera()` observability
(view, orthographic extent, level-build count, drawn player and hazard positions) and `pick(x, y)`.
It adds no checkpoint skip, position setter, or public gameplay control.
`tests/world-camera.test.ts` covers checkpoint pans, both full production routes,
positional editor framing/backtracking and real
Scene resize/project/pick methods. After `npm test` and `npm run build`,
`node tests/browser/world-camera.ts --timeout 600000` imports the validated
joined fixture through the real editor UI into production Scene/main, holds
native keyboard input across boundaries in both directions, checks resize,
pause/tab hiding, global projection/picking and repeated resource stability.
It records named captures and endstates under `artifacts/world-camera/run-*`
at 1280×900, 390×844 and 844×390 with full/reduced motion. The native harness owns
an ephemeral loopback port and isolated Chromium profile and cleans both up.
`node tests/browser/checkpoint-camera.ts --timeout 600000` checks all seven
production reveals at those same viewports and motion preferences, captures
intermediate pans, and measures whole-puzzle/hazard/landing visibility, fixed
scale, global picking and frozen pause. Evidence is under
`artifacts/checkpoint-camera/run-*`.

The joined world in `tests/world-level.test.ts` is test-only, not new playable
content. It demonstrates separated authored rectangles plus global connector
floor, translated coordinates, fixed/follow metadata and roundtrip identity.
No assembly framework is needed: author one global terrain grid and concatenate
ordered definitions after translating all coordinates. Structural tests use a
cardinal safe-terrain graph; they prove neither input feasibility nor human
solvability. They deliberately do not alter soft-ice or hazard rules.

The provisional V2 budgets are 160×128 cells, 640 hazards, 64 sections/63
checkpoints and 1,000,000 UTF-8 input bytes. These bound allocations and authoring
complexity: 20,480 cells, eight times the old hazard budget, and room for verbose
JSON. They are **not** user-required dimensions or hardware performance proof.
Full-world simulation/rendering performance must be measured separately before
release. V1 keeps its 40×32, 80-hazard, 30-checkpoint limits and historical
100,000-JavaScript-character import ceiling. JSON import is globally byte-capped
before parsing, then the selected version's budget is checked.

## Exact resumable-run boundary (BT-042)

Snapshot validation calls the simulator's exported `wallAt`, `lethalAt` and
`reachesCheckpoint` functions, so save acceptance cannot drift from a duplicate
collision implementation.

`application/run-snapshot.ts` has no storage, DOM, renderer, clock, random-ID
generation or lifecycle dependencies. Its public API is:

```ts
createRunSnapshot(world: Level, runId: string, state: State): RunSnapshot
validateRunSnapshot(world: Level, value: unknown): RunSnapshotResult
encodeRunSnapshot(world: Level, snapshot: unknown): string
decodeRunSnapshot(world: Level, source: string): RunSnapshotResult
```

Supply a definition already validated by `parseLevel`/`importLevel`.
Only V2 worlds are supported; accepting `Level` lets callers get an explicit
unsupported result for V1 rather than accidentally treating a legacy level as
a world. Creation and encoding throw on invalid/unsupported/incompatible input.
Validation and decoding return a frozen discriminated result:

- `{ status: 'valid', snapshot }`: detached, deeply frozen envelope and state.
- `{ status: 'corrupt', reason }`: malformed, oversized or inconsistent data.
- `{ status: 'unsupported', reason }`: unknown snapshot/world schema or a V1
  target. No migration is attempted.
- `{ status: 'incompatible', reason }`: valid current-schema identity fields,
  but a different world ID or revision. State is not interpreted against the
  wrong layout.

Parsing/size/duplicate-key errors take precedence; supported envelope identity
is checked before world-dependent state validation. Unsupported future schemas
are not interpreted using the current schema's fields. Failures contain no
replacement snapshot. Keep the original `source` untouched for a visible
recovery/reset choice; a failed decode is **not** permission to overwrite it.
BT-045 owns that UX and paused-until-explicit-resume integration. BT-044 owns
storage/ownership coordination; this codec makes no durability promise.

`RUN_SNAPSHOT_VERSION = 1` versions the envelope independently of `worldVersion: 2`
and the positive safe-integer content `revision`. `MAX_RUN_SNAPSHOT_BYTES = 16384`
is a UTF-8 byte limit checked before parsing (with a cheap character precheck).
Known schemas reject missing/extra keys, duplicate JSON fields including escaped
aliases, non-finite/unsafe numbers, sparse/extended histories and invalid
cross-field combinations. Direct object validation requires own data fields,
not accessors or renderer/class instances. All copies preserve values, including
checkpoint `id`/`radius` and the simulator's persistent death cause.

The caller generates a stable `runId` **once per new run**, then retains it for
every save/continue. IDs use 1–128 lowercase ASCII letters, digits or hyphens
(UUID-shaped IDs fit); world IDs retain their 60-character content limit.
This is an identity contract, not a uniqueness generator, storage lease,
authentication mechanism or proof that a run was honestly played.

Use `encodeRunSnapshot`, not plain `JSON.stringify`, for exact persistence:
ordinary stringify discards numeric negative zero, which legal analog input
can produce. The codec emits standard JSON `-0` number literals and decoding
preserves them. It never clamps positions, reorders history, resets a clock,
or substitutes the checkpoint position. See [GAME_SYSTEMS.md](GAME_SYSTEMS.md)
for an envelope example and the simulation consistency rules.

## Transactional storage and ownership (BT-044/045)

`application/indexeddb.ts` is the durable authority. The old localStorage
prototype failed native cross-tab coherence after quota recovery even under
Web Locks; the RED evidence remains at
`artifacts/run-storage/run-T2bbUw/report.json`. There are no coherence sleeps,
cache invalidation guesses, or localStorage projections in the replacement.

The API in `application/run-storage.ts` is:

```ts
openBrowserRunStorage(resolveWorld): Result<Store>
createRunStorage({ database?, legacyStorage?, locks? }, resolveWorld): Store
Store.acquire(): Promise<Result<RunLease>>
Store.read(): Promise<Result<RunView>>
Store.mergeRecords(incomingFacts): Promise<Result<RunView>>
Store.recordLegacyFinish(id, ticks, deaths): Promise<Result<Progress>>
Store.readLegacy(): Promise<Result<LegacyView>>
Store.writeLegacyDraft(source: string | null): Promise<Result<LegacyView>>
Store.exportRecovery(): Promise<Result<RecoveryBytes>>
Store.resetRecovery(): Promise<Result<void>>

RunLease.initial: RunView
RunLease.read(): Promise<Result<RunView>>
RunLease.replace(initialSnapshot): Promise<Result<RunView>>
RunLease.save(snapshot): Promise<Result<RunView>>
RunLease.complete(wonSnapshot): Promise<Result<RunView>>
RunLease.mergeRecords(incomingFacts): Promise<Result<RunView>>
RunLease.recordLegacyFinish(id, ticks, deaths): Promise<Result<Progress>>
RunLease.readLegacy(): Promise<Result<LegacyView>>
RunLease.writeLegacyDraft(source: string | null): Promise<Result<LegacyView>>
RunLease.release(): Promise<void>
```

`resolveWorld(id, revision)` must return that exact validated V2 definition or
`undefined`; unavailable active content is `incompatible`, never a new run.
`Result<T>` is `{ status: 'ok', value: T }` or `{ status, reason }`. Failure
statuses are `busy`, `unsupported`, `incompatible`, `corrupt`, `invalid`,
`storage-error`, `lock-error`, `released`, `stale`, `retired`, and `too-large`.
The opener detects IndexedDB/Web Locks capabilities; acquisition actually opens
the database and can still fail. Legacy localStorage access is guarded only
when import is needed. There is no automatic memory-mode fallback. Missing
capabilities are `unsupported`; blocked/error opens, request failures, quota,
aborts, version changes and unexpected connection closure are `storage-error`
with a reason. BT-062 owns launch-platform qualification and alternatives.

The store holds one exclusive `boundstoy.persistence.v1` Web Lock for the
entire lease, including pause. All cooperating world and legacy record writers
use that same lock. Other tabs receive `busy`, including record-only updates;
they must retain pending facts and explicitly retry after release. The owner
can merge facts asynchronously through its lease. Convenience Store methods
acquire a temporary lease and release it in `finally`, even on validation,
corruption or quota failure. Errors in a retained lease do not silently release
ownership: the caller must deliberately retry or release. Operations on a lease
are FIFO, each reading the latest state inside its own transaction. `release`
invalidates the old capability synchronously: queued, not-yet-started operations
return `released`. An already-started operation is allowed to commit or fail;
the native lock remains held until it settles and the queue drains. The release
promise settles after native release. Await any desired final save **before**
calling release; enqueuing a save then immediately releasing may cancel it.
No unload-time lock acquisition, lock stealing, lease-expiry timer, or
localStorage ownership flag is used.

IndexedDB database `boundstoy.persistence`, schema version 1, object store
`state` holds three string-or-null entries. `boundstoy.runs.v1` encodes:

- `version: 1`;
- strict BT-043 `records`, joined with incoming facts, not overwritten by a
  caller's potentially stale progress map;
- `active`: `null` or the **string returned by `encodeRunSnapshot`**, preserving
  simulation `-0` through outer JSON encoding;
- `retired`: permanent run-ID tombstones with either a completion receipt
  `(worldId, revision, ticks, deaths)` or `null` for explicit replacement.

Completion merges records, removes the active snapshot and adds its permanent
receipt in one readwrite transaction. Success means `transaction.oncomplete`,
**not** request success; a later abort never reports `ok`. Even no-op replay and
reads await completion. The narrow `TransactionPort.transact(keys, body)`
loads declared keys then invokes a synchronous body from an IDB request
callback. No awaited work occurs inside an active transaction. Writes request
strict durability; this is a browser commit boundary, not a guarantee against
device failure, storage eviction or user deletion. Connections are operation-
local, closed afterward, and close on versionchange. Blocked opens reject
explicitly; a late success closes without being used.

Identical receipt replay is a no-op, even if another run is now active. Changed
receipt replay and reuse of retired IDs are rejected. Ordinary save cannot
create a missing run, change its identity/revision, reduce ticks/deaths/history,
or change an already-saved tick. Wins use `complete`, not `save`.
`replace` is the explicit new-run operation: a fresh stable run ID and tick-zero
snapshot, retiring any prior active ID. There is no implicit restart/reset.
BT-043's pure merge selectors and the accepted snapshot codec remain unchanged;
their duplicate-key scanner is now shared through `application/json.ts`.

The envelope and legacy write path are bounded at 1 MiB UTF-8; active snapshot
text retains the codec's 16 KiB limit. Tombstones are not evicted: reaching the
bound fails explicitly, rather than enabling resurrection. Malformed, duplicate,
oversized, unsupported or incompatible saved bytes are not overwritten.
`Store.exportRecovery()` acquires a temporary lock and returns original strings
keyed by their storage keys, including the recovery archive, without decoding, writing, or marking import
complete. It works when corrupt/incompatible data prevents normal acquisition;
it returns `busy` while an owner exists. Explicit `resetRecovery` archives exact
source strings and the prior archive under `boundstoy.recovery.v1`, then clears
only the world envelope in the same transaction. Legacy progress/drafts remain
unchanged. Archive writes share the 1 MiB bound; failure to preserve the copy
rejects the entire reset. This is never an automatic repair or migration.
Raw draft text remains opaque and the application validates it as a level before
use; invalid drafts are not silently discarded.

### One-time migration contract

The other entries are `boundstoy.progress.v1` and `boundstoy.draft.v1`. On the
first successful acquisition, each absent IDB key is copied from localStorage
under the same transaction and lock; absent localStorage entries become explicit
null markers. All original localStorage bytes remain untouched. The provisional
run envelope is imported too, preserving exact snapshot codec text and retired
IDs. An invalid run aborts acquisition/import without replacing any source.
Invalid legacy progress can be retained/imported as raw text, but legacy reads
and writes fail `corrupt`, rather than resetting it. An aborted/quota-failed
import leaves no partial migration markers.

After import, **only IDB is authority**. Reads never merge a stale localStorage
projection back in and writes never project back. `readLegacy` returns
`{ progress, draft }`; `recordLegacyFinish` joins latest legacy best/clean facts
without losing unknown courses; `writeLegacyDraft` explicitly replaces/clears
the opaque IDB draft. Legacy progress stays V1, never guessed into world records.
Old app versions/direct localStorage writers are **not concurrently safe**:
users must close/reload old versions before migration. Their later changes are
not imported. Original bytes remain available for deliberate recovery.

### Browser integration (BT-045)

1. Open the browser store; acquire a lease before reading/creating gameplay.
   Inspect `lease.initial.active`, never a boot-time cached snapshot.
2. Restore its committed state and stable ID, paused until explicit resume. Retain
   the lease while playing, paused, hidden, or in menus.
3. On an explicit New Run action only, create a fresh ID once and call
   `lease.replace(createRunSnapshot(world, newId, createState(world)))`.
4. Enqueue `lease.save(createCheckpointSnapshot(world, sameRunId, currentState))`
   on meaningful boundaries. Checkpoint worlds persist checkpoint position and
   a reset pattern, never periodic saves; global-clock imports keep their exact
   state and old save cadence. Never await storage per physics
   tick or block the fixed-step loop. Snapshots created by the codec are detached
   and frozen. Check every async result; preserve in-memory state on failure
   and show persistence failure. Only a completed `ok` advances the known
   recovery boundary, not enqueue/request success.
5. At a win, call `lease.complete(wonSnapshot)` instead of separately recording
   and deleting the active run. Keep the same receipt for safe retry.
6. When deliberately relinquishing ownership, `RunContinuation.close()` refuses
   new work, drains accepted operations, then calls `lease.release()`. Never reuse that lease. Reacquisition must
   restore the newly read latest state, not the former in-memory copy.
7. Legacy production progress/draft reads and writes use the async lease APIs too.
   Normal unload is best-effort only; the latest completed committed save is
   the crash-recovery boundary. Holding the lock avoids unload-time acquisition
   but cannot make an unfinished transaction durable.

`node tests/browser/run-storage.ts` bundles a test-only Vite entry, serves an
ephemeral loopback origin, and launches an isolated native Chromium profile.
It checks competing writers, close/crash recovery (verified owned renderer PID),
atomic/idempotent completion, legacy import, native request-success-then-abort,
quota via CDP origin override when available, and immediate latest-state
corruption detection after handoff. No fixture hooks enter the production
bundle. Unit lifecycle event drivers additionally cover open/blocked/closure/
versionchange failures. Native quota exhaustion and per-launch-platform
qualification remain separate; simulated rejection is not quota certification.

`RunContinuation` serializes application operations above the lease queue.
Retries occupy the same queue, so newly enqueued saves cannot overtake a failed
tick-zero replacement. Failure freezes play visibly, retains failed operations
and offers retry or explicit memory-only play. Retrying saves the current safe
state after replaying failed operations. New runs receive one UUID and start
only after their initial transaction commits, unless memory-only play was
explicitly chosen; hidden/menu/graphics loss invalidates an outstanding resume
intent. Ordinary simulation ticks do not await storage.

Main schedules checkpoint-world snapshots on death, checkpoint, win, explicit
Restart, pause/menu/visibility and graphics loss, not periodically or at respawn
completion. Global-clock imports keep their older periodic cadence. Page exit additionally
drains the queue best-effort, never promising unload durability. Persisted
pagehide/pageshow releases and reacquires ownership before committed paused
restoration. Editor playtests keep a separate draft and never replace the
campaign snapshot or records. V2 records are revision-isolated and time-first,
without legacy mastery targets. Runtime imports and normal play expose no
checkpoint teleport.

`node tests/browser/continuation.ts` builds the actual UI/renderer with only a
test-only world registry substituted into an isolated output directory. It
checks actual native commits, reload, death/respawn, checkpoint/periodic saves,
graphics loss, two-tab ownership, record retirement, corruption, archive/reset
and explicit unsaved play. No fixture registry or setter ships in production.
The actual registered world is also exercised by `rough-world.ts` and
`rough-journey.ts`: whole-world records, checkpoint-position continuation,
all seven downstream recoveries and same-ID editor playtest isolation.
The isolated legacy-registry runner retains V1 browser coverage without
restoring retired selector entries.

## Rendering and application

Rendering reads state. Decorative bobbing, glow and turning use a separate
visual clock; hazards always sample the simulation tick. `presentation/motion.ts`
observes each step (`Scene.record`) for presentation-only cues: interpolation
between the previous and current tick (player and saws, snapping over deaths and
respawns), frame-rate-independent damping, impact squash, respawn pop and
checkpoint collection. See `docs/ANIMATION.md`. Reduced-motion users
keep static decorations but still see hazards move (necessary game information).
Pulse collisions occur only at cycle tick zero. Burst visibility is independent:
it samples ticks since ignition for a 36-tick one-shot effect, including when
a rendered frame skips ignition. The plate signals safe ground immediately
after the single lethal tick; remaining particles are harmless.
Warnings last 27 ticks (225 ms). Idle pads are a thin rounded style-coloured groove with a soft
edge glow over the visible terrain (neutral grey while dormant); buildup burns a spark-led fuse round that
groove and raises a translucent tint, with salience rising every tick yet peaking
below the white-hot ignition. Styles come from the `data/explosion-styles.ts`
registry. The flash sheet, eruption motif, glow, shockwave, scorch and embers stay within the pad's
projected footprint in the real camera, including reduced motion. There is no
raised vent or overlapping smoke shell.

Normal ground uses two muted coordinate-parity shades, with even `(x+y)` lighter.
The same two groups remain visible on safe and warning pulse plates; detonation
retains its common bright signal. This is presentation only: both colors are `.`
with the same movement/geometry and no additional level schema.
Playable tiles are gapless, flat instanced slabs whose top is the y = 0 play
plane; a shared hairline texture tinted per instance draws the cell grid.
Terrain glyphs, void lips, pad outlines and saw paths are world-unit stroke
meshes (`stroke-visuals.ts`), never fixed one-pixel GL lines; only the
editor-only workshop grid uses lines and it is hidden during play.
Spike clusters use instanced geometry. Walls use one batched
mesh with continuous horizontal-run caps and only exposed vertical faces.
Walls receive but do not cast shadows: a vertex-alpha contact band darkens
the floor along every wall base instead, and the 1024² shadow map serves only
the player, spikes and saws. Pad views share static geometry, and markers share
one material per colour.
There are no per-cell bevels, seams, hatching, outlines or tint variations.
Dark wall tops match the editor swatch; both top and side materials have
roughness 1, metalness 0 and environment intensity 0. Directional shading and
the exposed faces distinguish these solid masses from both floor and void,
without bright trim. Their exact cell footprint and existing 0.24-tile height
retain collision alignment and visibility of adjacent gameplay. The board owns
and disposes the wall geometry and two materials on edits/level changes.
Static markings and path edges
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
