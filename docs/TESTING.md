# Testing and AI evaluation

`npm run evaluate` runs local issue/index validation, Node tests, TypeScript and
the production build. There is no added test framework or browser automation
dependency. Regenerate `tasks/INDEX.md` after editing issue metadata.
Run the full test suite and typecheck/build sequentially: Astro subprocess
tests briefly generate `.ts` fixtures under their ignored artifacts directory.
Concurrent typechecking can mistake those temporary fixtures for project source.

For automated production-browser acceptance, run `npm run test:browser` with an
installed Chromium. It builds, serves an owned temporary origin and drives an
isolated sandboxed browser using native Node/CDP APIs. No AI/MCP session or npm
automation package is required. The default `evaluate` suite remains independent
of Chromium. See [BROWSER_CHECKS.md](BROWSER_CHECKS.md) for prerequisites, failure
fixtures, evidence and cleanup checks.

## Current Aftershock gameplay gate

`tests/aftershock-world.test.ts` checks the actual single-world registry,
guidance and absent preset mastery targets; `tests/world-records.test.ts`
covers time-first revision-isolated records.
`tests/aftershock-world-sections.test.ts` retains every content batch's exact
routes, necessity checks, actual-arrival margins, checkpoint disk safety and
exhaustive local recovery phases for the historical global-clock fixtures.
`tests/checkpoint-production.test.ts` covers current revision-2 ownership,
active phases, necessity, delay margins and all seven live-death/restart/reload
recoveries. Current ordinary/faster finishes are 5752/5648 ticks (historical
global witnesses remain 5752/5038); all seven markers are reached in order. These are executable
input-only witnesses, not a substitute for the BT-053 human full-map playtest.

`test:browser` exercises production Start/Continue/Restart/New run,
keyboard/touch, checkpoint reload, same-ID restart, ordinary/faster records,
native write counts proving no periodic saves, and offline play.
`test:journey` adds opt-in audio, held/repeated keys, focus and native hidden-tab
behavior, bounded catch-up under CPU throttling, editor isolation/resources,
and live death/respawn clocks plus checkpoint reload/downstream continuation
at all seven checkpoints.
`test:aftershock` captures every section transition/checkpoint and mixed hazards
at desktop/portrait/landscape sizes, then builds an isolated legacy registry and
runs the retained V1 general/journey/Aftershock suites. No fixture replaces the
production bundle. Capture-only pause suppression uses CSS visibility so
asynchronous save HUD updates cannot silently cover the world with a pause card.

The real-pixel runner samples these same legal positions, including the final
pre-win tick, at four viewport/DPR combinations. It requires the actual
fixed-scale camera rectangle to fit, rather than incorrectly demanding every remote
world marker. Whenever the body requires a locator, its actual opaque pixels
must span at least 12 CSS pixels in both dimensions. Readable signals, acceptable
wall treatment and a worthwhile finale still require human evaluation.

`node tests/browser/checkpoint-camera.ts --timeout 600000` additionally measures
the complete authored puzzle, threatening hazard sweeps and incoming landing
at all seven reveals, including full/reduced-motion portrait and landscape.
Halfway captures verify center-only movement, frozen pause and player visibility.
`node tests/browser/world-camera.ts --timeout 600000` retains native held-input
forward/backtracking, global picking, resize, hidden-tab and resource checks.
Portable camera tests exercise every tick of both complete-world legal routes.

## Wall hierarchy

`tests/wall-visuals.test.ts` verifies exact cap area and exposed-side area for
solid blocks, holes, corners, separate islands and outer edges. It checks face
normals, matte/non-reflective material values, an empty-board allocation case,
and production Scene integration/disposal without old per-tile decoration.
Existing physics tests retain both ice wall-contact rules.

After building, `node tests/browser/walls.ts --timeout 600000` captures the
production opening, shelters, arc corners and finale at desktop, portrait and
landscape sizes. Each capture follows legal inputs at fixed replay ticks and
settles only the presentation camera. Real rendered wall-cap luminance must be
below 45% of the sampled playable-floor/pulse-pad luminance. Nine samples per
tile avoid confusing a dark hatch stroke with a quiet overall wall.
`--baseline` records measurements without asserting the new threshold for a
before-build comparison; it is not an acceptance pass. Evidence lives in
`artifacts/walls/before-*` and `after-*`.

## Retired short Aftershock prototype evidence

The former set was Borrowed Ground v2, Crosscurrent and Checkerboard. Tests still
cover genuinely sequential explosions, lateral choices, alternating parity
groups and actual deaths followed by legal continuations. Current single-puzzle
maps must have no checkpoints on their final landings. Future multi-puzzle maps
must prove ordered checkpoint collection and downstream recovery. Failed
approaches must come from input, not teleportation.

`tests/ground-visuals.test.ts` checks actual instance colors, unchanged normal
material/movement, and checkpoint ring geometry. Physics/editor tests cover
generous trigger radii, wall separation, legacy defaults, goal-radius isolation
and JSON/edit roundtrips. Browser evidence includes travelling and alternating
blast phases as well as quiet-state rendered checkerboard contrast.

`tests/hazard-visuals.test.ts` checks pulse readability: idle pilot/outline
contrast on both ground shades, a fuse and glow whose salience rises every
warning tick, a full-footprint flash on every frame of the flash window, cool
subdued aftermath, and unchanged 27-tick warning and one-tick lethality.
`tests/motion.test.ts` checks presentation-only motion: refresh-rate-independent
damping, interpolation that snaps over deaths/respawns, impact classification,
tick-timed cues and bit-identical `step` results. See `docs/ANIMATION.md`.

| Encounter | Clear / mastery ticks | Target | Contiguous zero-launch window, clear / mastery |
| --- | --- | --- | --- |
| Borrowed Ground v2 | 752 / 613 | 690 | 45 / 44 ticks |
| Crosscurrent | 620 / 561 | 590 | 142 / 115 ticks |
| Checkerboard | 711 / 503 | 540 | 38 / 35 ticks |

Full-period sweeps, not sampled offsets, establish those launch windows.
Local in-field decision probes include at least 25 contiguous allowed delay
values starting at zero. Spatial probes and failures cover the actual movement
choices; complete executable evidence is in `tests/aftershock.test.ts`.
Three `LANDING_FAILURE_REPLAYS` fixtures drive actual approach, backtrack death,
54-tick respawn at the original start and full replay in headless/production checks.
There is one hazardous phrase per room; its final landing must not save progress.

Explosion regressions require exactly 27 warning ticks (225 ms), one idle mesh,
one warning symbol, and at most six burst meshes. Every visible mesh throughout
the full cycle must stay inside its own projected pad at desktop, portrait and
landscape sizes with/without reduced motion. Six clear/mastery witnesses keep
their original timings; changing warning length must not move ignition or damage.

The earlier BT-028/029 short-pattern release gate passed **230/230 portable tests**,
typecheck/build and all five production runners. Evidence:
`artifacts/aftershock/pattern-release-check.log`; browser runs `run-2nkXIM`,
`run-rfi6Du`, `run-R1HOij`, `run-p60kZI` and `run-x6eEl0`.
This validates implementation and readable rendering, not player enjoyment.

BT-030's visual/checkpoint pass passes **233/233 portable tests**, typecheck/build
and all five production runners (`artifacts/aftershock/visual-release-check.log`).
The final unobscured dense-field captures were rerun as `run-Fh7MiQ`
(`artifacts/aftershock/visual-captures-check.log`). Desktop/mobile full/reduced
motion captures show separate cell effects; all six finish times above remain
unchanged. See BT-030 for regression and review evidence.

## Historical first Aftershock iteration (rejected by player feedback)

The following measurements describe cefca79, not current gameplay acceptance.
The player found Slipstream repetitive, Borrowed Ground too long/implausible,
and The Cut's alternate path unhelpful. These results motivated the replacement;
they are not constraints that should force the new maps back into that shape.

`tests/aftershock.test.ts` measures all six exact ordinary/mastery witnesses,
intentional pulse/void failures, non-removable observation waits, temporary
refuge recovery, geometric shortcut advantage and complete launch-phase sets.
`tests/aftershock-integration.test.ts` verifies the actual playable registry,
retired-record isolation and real death -> respawn -> unchanged witness recovery.

| Encounter | Clear | Mastery | Target | Mastery launch window around tick zero |
| --- | --- | --- | --- | --- |
| Slipstream | 1664 ticks | 1401 | 1500 | -6 through +6 ticks |
| Borrowed Ground | 1912 | 1672 | 1780 | -6 through +4 ticks |
| The Cut | 1587 | 1231 | 1400 | -8 through +14 ticks |

Targets require zero retries. Other legal phases exist; the tests exhaust full
cycles, including all 1980 phases of The Cut's combined schedule. Its outside
route never waits and travels 47.61 tiles versus 35.73 for the shortcut.
No claim is made that these witnesses are optimal or prove fun.

The historical `npm run test:aftershock` verified three levels in the
then-production selector, ran all six witnesses, checked clean/mastery outcomes and
persistence, causes actual deaths and replays unchanged after pattern reset,
and captures desktop/mobile boards/results under `artifacts/aftershock/`.
The general production runner also verifies real keyboard/touch, every new
ordinary witness, editor, offline use, saving and scene resource disposal.

The integrated `npm run release:check` passes **222/222 portable tests** plus
production gameplay, player journey, explosion/retry, Aftershock and real-pixel
readability checks. Evidence: `artifacts/aftershock/release-check.log`; browser
runs `run-IQTSDz`, `run-aIqvC1`, `run-baGJ5d`, `run-vCTrqH`, `run-k0Ja2g`.
This is implementation acceptance for three encounters; BT-024 remains open
for player feedback and the rest of the world.

## Retired Relay: movement and recovery regressions

The following campaign is now test-only data under `tests/fixtures/`.
Its detailed movement tests remain in `tests/relay-courses.test.ts`, while the
old continuing-clock checkpoint tests remain in `tests/recovery.test.ts`.
Neither file describes the playable level selector.

The suite covers walking/release, constant-speed soft-ice steering and U-turns,
no-input gliding, speed-preserving wall bounces, hard-ice locks, mud speed,
normalized diagonals, terrain transitions, immutable updates, repeatability,
hazard phases/collisions, respawns, checkpoints, finish-time freezing, editor
transforms, import validation, guidance and local saves.

Every built-in level has a legal keyboard-input witness. It reaches every
checkpoint in order, has zero retries, and wins on the final recorded tick:

| Index | Level / focus | Checkpoints | Reference finish |
| --- | --- | --- | --- |
| 0 | Relay courtyard / balcony navigation | 2 | 652 ticks / 5.4333 simulated seconds |
| 1 | Reservoir hairpin / continuous soft-ice U | 1 | 836 ticks / 6.9667 seconds |
| 2 | Spillway locks / two-curb descent | 2 | 806 ticks / 6.7167 seconds |
| 3 | Signal stairs / two pulse gates | 2 | 734 ticks / 6.1167 seconds |
| 4 | Patrol looms / perpendicular saw crossings | 2 | 800 ticks / 6.6667 seconds |
| 5 | Silt terraces / two slow pulse crossings | 2 | 1615 ticks / 13.4583 seconds |
| 6 | High interchange / soft, hard and timing transfer | 3 | 1604 ticks / 13.3667 seconds |
| 7 | Last light relay / chase, slow riser and saw | 3 | 2641 ticks / 22.0083 seconds |

These are witness solutions, not target times for a new player or an exhaustive
solver. `npm run inspect -- N --replay` now inspects the active Aftershock
registry (indices 0-2), not these retired fixtures.

The eight retired Relay IDs are disjoint from all nine prototype IDs. Canonical terrain
fingerprints reject reuse even after translation, rotation or reflection;
this guards exact reuse, not the subjective originality of a minor alteration.
Route compositions and the actual diff still require design review.
Concept checks teach each mechanic before combining it. Behaviour checks show:

- Walking stops on release; holding into a safe wall for 600 ticks does not win
  or kill the player.
- Soft ice needs actual heading changes and retains 4.4 tiles/second throughout:
  615 ice ticks and exactly 180 degrees of steering in the hairpin; 316 ticks
  and 90 degrees in the interchange. No reflections or braking. Omitting
  individual arcs leaves the route. All 169 paired hairpin steering offsets
  from -6 to +6 ticks finish through its checkpoint.
- Spillway alignment +/-6 ticks and both curb arrivals independently
  -24/0/+24 produce 117 safe trials. Incorrect alignment cannot be repaired
  by steering after entry.
- Both launches in each pulse/saw/mud introduction survive every offset from
  -24 to +24 ticks (294 trials). Deliberately unsafe phases hit the named hazard.
- All actual pulse exposure in both introductory timed routes lies in the
  middle half of the quiet window. Walking exposures are 42 ticks each; mud
  exposures are 100 and 101 ticks. A late window that permits walking fails
  at mud speed. Mud still allows immediate release-to-stop.
- Every route needs direction decisions, and the later courses need at least
  three. Bottleneck removal disconnects even an over-permissive walk graph
  with diagonal corner cutting. This is a geometry necessity check, not a
  comprehensive continuous-space solver.
- Every reference checkpoint phrase lasts less than 15 seconds (the current
  maximum is 1147 ticks / 9.5583 seconds), so retries do not repeat long solved
  stretches. Routes have at least 15 tiles of actual travel, or 30 in later maps.

Geometry/phase tests also check tall spike silhouettes, low curbs, warnings,
single-tick detonation and 36-tick harmless aftermath, including phase wrapping,
legacy duration normalization and safe entry on the next tick. Render batching
at 15/30/60/120/144 Hz must detect exact ignition ticks even between display
frames. Effects must remain visible after a skipped ignition frame, dissipate
without particle loops, and repeat deterministically when paused or replayed.

The finale's nineteen wave vents advance every 33 ticks. The legal witness
passes each vent center 65–85 ticks before its returning blast. Camping on
each one dies exactly at its next ignition. The interchange and finale pass
every individual movement-boundary offset from -4 to +4 ticks; their observation
delays tolerate -12 through +12 ticks with no deaths or missing checkpoints.
These margins allow a little input error; they do not establish touchscreen
precision or human enjoyment.

Every spawn and reached checkpoint can remain stationary for two whole cycles.
Recovery tests retain actual deaths, 54-tick respawns, all nine held-input
combinations and cardinal-only rejoining. All **11,048** phase-specific recovery
runs finish without another death: 8 untimed sites, 600 phases on each of
Signal stairs/Patrol looms/High interchange, and 720 on Silt terraces/Last light
relay. Each timed map deliberately uses one shared hazard period. Seeded reset,
immutability and directional-run regressions are retained.

Small-screen locator checks cover every new spawn and actual legal positions
over all twenty finale pulse footprints, including both elbows and the mud
riser. Non-occlusion also checks the finale's observation pads and positions
12/24 ticks before and after each closest crossing. This caught a locator
covering a signal at spawn and on departure; open-pad placement now points
away from nearby signals without changing narrow-lane placement.
The former real-pixel check sampled all three short Aftershock spawns plus three
in-route positions per encounter at four viewport/DPR combinations (48 cases).
The current world coverage is described above.
The pointer remains opaque but uses the transparent render queue to stay above
lingering effects; Slipstream's first crossing caught an 11px color footprint
when explosions could paint over it. Route signs remain
18 CSS pixels or larger, on screen and non-overlapping; desktop camera and
body/collider sizes are unchanged.

## Historical Relay release-candidate checks (before instantaneous explosions)

The integrated `npm run release:check` passes 187 portable tests, production
browser gameplay/offline checks, saved-progress and sound journey checks, and
60 real-pixel readability cases. Reports: `artifacts/browser-check/run-TTZaRp`,
`run-ScC8VT` and `run-Nv0Cm6`; combined log:
`artifacts/release-integrated-check.log`. All eight exact witnesses also pass
inside the unchanged Astro wrapper at root and nested bases, including real
keyboard isolation, fullscreen and offline records. Evidence:
`tests/astro-consumer/artifacts/run-f744701b-71af-4b5c-ad20-ef25af82d1a4/`.

A separate 180-frame headed-browser sample of Last light relay at 1440x900
on Intel/Mesa hardware measured 16.7 ms median and 16.8 ms p95 RAF intervals,
with a 133.4 ms maximum hitch. This is one local observation, not a hardware
compatibility matrix or input-latency certification. The deterministic loop
already bounds simulation catch-up after hitches.

These historical checks established a technical playtest candidate, not
gameplay acceptance. The user subsequently rejected its difficulty and replay
value. Aftershock is tracked separately in BT-024; none of this evidence
establishes that the replacement world is finished or fun.
Independent newcomer playtesting, physical touchscreen precision, Firefox/WebKit,
audio comfort and broader hardware performance remain unverified. The new
campaign's fun, difficulty curve and repeat-play value require real players.

## Browser acceptance

Use the **production preview**, not Vite's development websocket, for release
network checks. Open `/?debug` to opt into `window.__BOUNDSTOY__`; the API is
documented in README. `advance()` uses the same simulation as real inputs and
does not teleport or disable collisions. `project()` returns client coordinates
for a board cell without modifying the game.

1. Start using the actual UI, hold a movement key and release on normal ground.
2. Exercise constant-speed soft-ice steering, pause/resume, restart and focus
   leaving the game; no held keyboard/pointer input may remain stuck.
3. Check the generic initial Play gate, then Continue to the first uncleared
   current course, next-uncleared progression and retry without repeated tutorials.
   Clear courses out of order; the final missing clear celebrates completion
   and Choose a level opens the menu. Results distinguish first/PB/comparison.
   Verify exact input witnesses using explicit paused debug resets, separately
   from live navigation timing, without padding ticks or weakening checkpoint checks.
4. Open Menu, select every level, exercise sound/fullscreen/help, and reload to
   verify saved completion. The normal URL must not expose the debug API.
5. Enter Menu -> Level editor. Paint with the pointer, undo, export JSON, make
   a blank level, then import back. Invalid JSON must preserve the draft and
   report an error. Playtesting must not change built-in records.
6. Inspect 1440x1100 desktop, 390x844 portrait and 844x390 landscape layouts.
   Required actions must remain reachable; menus may scroll internally, but
   there must be no horizontal page overflow or clipped mandatory actions.
7. Turn the network offline after loading and complete a level. No additional
   assets, telemetry or external requests should be required.
8. Rebuild levels/editor scenes repeatedly and check geometry/texture counts
   settle; inspect the console for application errors.
9. Serve `dist/` under a nested path and inside a titled iframe. Verify local
   relative asset URLs and keyboard input. An actual Astro compilation is a
   separate check, not implied by a successful raw iframe test.

`npm run test:journey` exercises the production Continue/out-of-order/PB/audio
journey and captures responsive screenshots. `npm run release:check` runs
evaluate, browser scenarios, journey and real-pixel readability with one build.
Sound is muted on first visit; preferences are remembered and restored audio
waits for a play gesture. Use explicit `#intro-audio` / `#audio` selectors.
The editor's **Restart game level** action deliberately restarts.

The BT-022 isolated content baseline predates those concurrent journey runtime
changes. Its migrated browser journey assertions must be run again on the
integrated tree; content/replay and readability checks are independently runnable.

## Historical evidence: retired prototype

The following 0.4.x results describe earlier releases, not current campaign
acceptance or preservation requirements. Their old layouts and timing tables
must not constrain the Aftershock encounters. Consult the named task evidence for the
old witness inputs; current witnesses and margins are above.

### Playtest tuning (0.4.2)

The user requested a slightly smaller hitbox and half-duration explosions.
The radius is 0.20 rather than 0.22 tiles; exact wall, pulse and saw boundary
regressions check the new clearance. All 30 built-in pulse `on` values are
halved, with the editor default at 45 ticks. Custom JSON retains literal timing.
The portable suite had 181 checks; all nine prototype replay ticks remained unchanged.
The then-wider windows replaced previous mandatory-wait/hide assertions.
Production acceptance also passes all 23 browser groups and 36 real-pixel
cases. Evidence: `artifacts/bt020-*.log`, browser reports `run-nnuc15` and
`run-kFjjTA`, and the BT-020 handoff.

### Pre-playtest hardening (0.4.1)

The integrated portable suite has 179 checks, including actual recovery from
all nine spawns and 16 checkpoints. Every site is reached by real input, followed
by an actual death and 54-tick respawn; nine held-input combinations cannot move
the player during respawn. Safe waiting and cardinal input rejoin known routes:
4575 phase-specific runs finish without another death, covering every tick of
each timed course's cycle. These are constructive recovery witnesses, not an
exhaustive solver for every trajectory.

Seventy-two seeded 1200-tick varied-input runs are each executed twice, with
repeated resets, immutable-state and collision/progress invariants. Normal,
soft and hard movement cannot pass through touching diagonal wall corners.
All original nine exact witnesses and course data remain unchanged.

Frame tests cover 15/30/60/120/144 Hz, irregular intervals and a five-second
stall. They reproduced a 1199-versus-1200 tick discrepancy at 120 Hz before the
shared production stepper fixed floating-point boundary loss. Real browser
auto-repeat also reproduced movement reappearing after restart; a fresh press
is now required after input clearing.

The production browser suite has 23 groups, adding held-key/touch restart,
4x CPU throttling, a 200 ms main-thread stall, 36 level rebuilds and four
editor/playtest returns with stable per-scene geometry/texture counts. Its
whole-run default is now 180 seconds; individual command deadlines remain strict.

`npm run test:readability` measures 36 actual opaque locator footprints, not
nominal sprite boxes: practice spawns, pockets and exact ignition escapes at
390x844/DPR 1 and 2, 844x390 and 1440x1200. Phone cases are at least 12 CSS
pixels in both dimensions (minimum 12x14); desktop omits the redundant cue.
Projected camera framing and physical body/collider dimensions are unchanged.
Adaptive route signs remain visible, and all 24 Pocket wave pads are checked at
exact warning/lethal boundaries with and without reduced motion.

`npm run test:astro` compiles the unmodified wrapper with pinned Astro 7.3.8
at root and nested bases, then checks static assets/notices, actual iframe input
and fullscreen, all nine offline witnesses and saved progress. Its tooling is
isolated from game dependencies; see [ASTRO_CHECKS.md](ASTRO_CHECKS.md).

Physical touchscreen precision, arbitrary custom editor layouts, other browsers,
human route comprehension, enjoyment and difficulty tuning still need direct
assessment. The batch deliberately does not retune levels or mechanics.

Final 0.4.1 acceptance passed `npm run evaluate`, `npm run test:browser`,
`npm run test:readability` and `npm run test:astro`. Evidence is retained in
`artifacts/preplay-*-final.log`, browser reports `run-Mcq4xa` and `run-lK6Rf9`,
and `tests/astro-consumer/artifacts/run-b56ced70-49e9-4e3a-b308-2506851de5e0/`.
The locator adds one retained geometry: repeated Pocket wave builds stay at
174 geometries/10 textures, and editor returns at 33/7. Owned process groups,
profiles and ports were independently checked after completion. Combined
implementation/acceptance records are BT-003, BT-004 and BT-017 through BT-019.

### Nine-course baseline evidence (0.4.0)

The nine-course 0.4.0 tree passed 136 Node tests, TypeScript and the static build.
The integrated production-browser run passed 20 scenario groups, including all
nine exact witness finishes, zero deaths and ordered checkpoints. Direct
selection/next/retry/final flow, keyboard/touch/cancel, idle/hidden rendering,
editor isolation, saves and offline play remain intact. The report is
`artifacts/browser-check/run-3IiDC7/report.json`; BT-015 records the worker
delivery and BT-016 records combined acceptance.

The orchestrator inspected all three new boards at 1280x800 and 390x844.
Pocket wave was inspected with the player safely hidden at tick 230, then
outside the respective pockets as they ignited at ticks 333, 873 and 1371,
before finishing at tick 1593. Paused debug frames had only the pause overlay
temporarily hidden for visual inspection; simulation and hazards were unchanged.
Ordinary UI behaviour was checked separately by the production runner.

At that baseline, mobile actions fit but board markers were small on the larger ice maps. Human
route interpretation, touchscreen precision, enjoyment and difficulty tuning
remain unverified; these synthetic checks do not certify them. No original
lesson tuning or BT-014 research experiment was silently applied.

### Six-lesson baseline evidence

The earlier integrated tree passed 116 Node tests: 68 original game/visual/tooling
checks, 15 renderer-scheduling checks, 13 browser-runner infrastructure checks,
and 20 tracker checks, plus TypeScript and the static build.

The orchestrator replayed all six levels in Chromium and verified next-level
navigation and the final campaign screen: exact historical witness ticks, zero retries, all
checkpoints, and six saved records. Real keyboard walking/release, pause, menu
freeze, native pointer editor painting/undo, JSON round-trip/rejection,
playtest record isolation, portrait finish bounds, landscape level selection,
and offline-after-load completion were exercised. Desktop and mobile
screenshots were inspected.
The six-lesson static output also loaded under `/games/boundstoy/` inside a titled
iframe with correct relative asset URLs and working keyboard input.

Release QA found and fixed a misleading normal-ground void message that referred
to green ice (BT-009). A regression and the rebuilt browser reproduction confirm
terrain-neutral void/spike feedback.

The UI worker separately checked sound/fullscreen, menu focus, ten-entry menu
scrolling, persistence, directional pointers and download Blob/filename creation.
Worker claims are retained in BT-006; curriculum evidence is in BT-007; combined
acceptance belongs to BT-008.

There are no application console errors in the inspected Chromium session.
The existing large-bundle warning and headless software-WebGL warning are not
application failures. Physical touchscreen hardware, OS save dialogs and real
Safari/Firefox/mobile GPU behaviour have not been certified. The Astro wrapper
has not yet been compiled in a real Astro consumer. Rendering quality and fun
still need human play and tuning; tests cannot prove those.

## Browser hardening evidence

BT-002 makes input, all current replay data, editor validation/isolation,
save/reload, non-debug privacy and offline-after-load checks repeatable. The
integrated command passed after BT-011, including 44 live constant-speed
reversal/release samples and all six exact finishes. A deliberately wrong-title
fixture exited 1 with `passed: false, cleaned: true`; a subsequent real run
passed. Recorded profiles, PIDs/process groups and ports were checked absent.
The command also uses an argv/URL entrypoint guard; a regression prevents a
silent pass when `import.meta.main` metadata is absent.

BT-011 replaces the continuously running paused loop with a single-chain
scheduler. Fake-host tests cover coalescing, elapsed-time reset, hidden
invalidation, stale callbacks, immediate debug draws and disposal. The worker
also observed native hidden-tab quiescence and a one-frame paused restoration.

The orchestrator's integrated visible-pause probe observed live rendering first,
then **zero** new WebGL submissions or renderer frames during 650 ms of settled
pause (baseline: 297 submissions in 600 ms). Paused portrait resize produced
one fresh 360x586 frame without changing tick 24. Resume's first frame kept
tick 24, then normal play advanced to 55. The resized frozen canvas was visually
inspected and returned to idle after screenshot/focus invalidation.

These are scheduler/render-submission checks, not a hardware energy benchmark.
Visible uncovered initial-entry/editor/victory animation still runs; modal menus freeze
the covered scene. Screenshot tools can themselves cause a valid focus/viewport
invalidation, so assess settled idle windows separately from interactions.

## Tracker verification

`node --test tests/tasks.test.ts` checks the local Markdown tool independently
of gameplay. Disposable fixtures exercise JSON front matter, required sections,
approval/assignment rules, dependency/parent deadlocks, scope/worktree/branch
conflicts, completion evidence, deterministic index output, stale-index
rejection, JSON output, CLI exit codes, symlink rejection and ID limits.
Examples and comments do not count as acceptance evidence.

The tracker has no background queue service. The consumer release used bounded
workers for BT-006 and BT-007; the follow-up batch used two independent parallel
workers for BT-002 and BT-011. Their scoped commits were reviewed and integrated
by the orchestrator. Baselines, worker IDs, accepted SHAs and evidence are
recorded in Git and the issue handoffs.

## Non-blocking level flow

BT-013 removes per-level tutorial gates. One generic initial Play action remains;
selection, next, retry, campaign restart and editor return enter play directly.
Help, contextual hints, pause and results remain separate. Debug loads reset
paused for exact witnesses and do not change ordinary player behaviour.

The integrated browser run passed 17 scenario groups, including real
keyboard/touch/cancel navigation and 44px action bounds at 1280x800, 390x844 and
844x390. It preserved all six exact witness ticks, idle/hidden-loop checks,
editor record isolation, saves and offline operation. The retained acceptance
report is `artifacts/browser-check/run-ZyxA3J/report.json`; its profile, browser
PID/process group and preview/debug ports were independently confirmed cleaned.

Keep the original template's discipline: add regressions before physics fixes,
use immutable inputs, keep checks green, and verify the browser rather than
equating a build with a playable game.
