# Testing and AI evaluation

`npm run evaluate` runs local issue/index validation, Node tests, TypeScript and
the production build. There is no added test framework or browser automation
dependency. Regenerate `tasks/INDEX.md` after editing issue metadata.

For automated production-browser acceptance, run `npm run test:browser` with an
installed Chromium. It builds, serves an owned temporary origin and drives an
isolated sandboxed browser using native Node/CDP APIs. No AI/MCP session or npm
automation package is required. The default `evaluate` suite remains independent
of Chromium. See [BROWSER_CHECKS.md](BROWSER_CHECKS.md) for prerequisites, failure
fixtures, evidence and cleanup checks.

## Simulation and curriculum

The suite covers walking/release, constant-speed soft-ice steering and U-turns,
no-input gliding, speed-preserving wall bounces, hard-ice locks, mud speed,
normalized diagonals, terrain transitions, immutable updates, repeatability,
hazard phases/collisions, respawns, checkpoints, finish-time freezing, editor
transforms, import validation, guidance and local saves.

Every built-in level has a legal keyboard-input witness. It reaches every
checkpoint in order, has zero retries, and wins on the final recorded tick:

| Index | Level / focus | Checkpoints | Reference finish |
| --- | --- | --- | --- |
| 0 | First steps / walking | 2 | 484 ticks / 4.0333 simulated seconds |
| 1 | Gentle curve / soft ice | 1 | 435 ticks / 3.625 seconds |
| 2 | Curb turn / hard ice | 2 | 575 ticks / 4.7917 seconds |
| 3 | Pulse crossing / pulse timing | 1 | 520 ticks / 4.3333 seconds |
| 4 | Saw crossing / saw timing | 1 | 440 ticks / 3.6667 seconds |
| 5 | Take your time / mud | 1 | 806 ticks / 6.7167 seconds |
| 6 | Switchback sweep / soft-ice practice | 2 | 1277 ticks / 10.6417 seconds |
| 7 | Three curb route / hard-ice practice | 3 | 1580 ticks / 13.1667 seconds |
| 8 | Pocket wave / precise pulse practice | 3 | 1593 ticks / 13.275 seconds |

These are witness solutions, not target times for a new player or an exhaustive
solver. Run `npm run inspect -- N --replay` for any index 0-8 to print the ASCII
board and final state. Inspecting an invalid index reports the actual valid range.

Concept checks prohibit not-yet-taught special mechanics. Behaviour checks
demonstrate that:

- Walking stops on release; holding into a safe wall for 600 ticks does not win
  or kill the player.
- Soft ice needs actual heading changes and retains 4.4 tiles/second throughout.
  Both turn durations tolerate every offset from -6 to +6 ticks (169 landing
  trials), without relying on braking.
- Hard ice requires a correct lane, stops at the curb and then relaunches.
  Alignment +/-6 ticks and curb arrival -24/0/+24 produce 39 safe trials.
- Pulse/saw/mud witnesses survive every launch offset from -24 to +24 ticks.
  Unsafe launch phases are lethal, and the crossings cannot be walked around.
- Pulse witnesses cross within the middle half of the quiet window rather than
  scraping its first safe frame.
- Mud exposure is longer than walking (101 versus 42 ticks); a late crossing
  that walking could clear is not safe in mud.

Geometry/phase tests also check tall spike silhouettes, low curbs, visible
charge/blast states, exact lethal-window visibility, and reduced-motion effects.

The tuning regression uses the pre-tuning nine-course hash, restoring only
halved `on` values for comparison: geometry, phases, periods, lessons and
replays must remain unchanged. Switchback sweep's seven
reference arcs retain 4.4 tiles/second without bounces; omitting each arc fails,
while individual input boundaries tolerate +/-10 ticks. Three curb route
requires three outside lanes and curb relaunches; alignment +/-10 ticks and
combined curb-arrival errors +/-18 ticks remain safe.

Pocket wave tests use actual hazard definitions to verify 12-tick wave steps
and unchanged pocket ignition after the path clears. Camping still dies on the
same pocket blast. For the reference section inputs after the 0.4.2 tuning:

| Section | Safe launch offset | Safe pocket dwell |
| --- | --- | --- |
| Rightward lane / upper pocket | -59 through +10 ticks | 43-112 ticks |
| Upward lane / right pocket | -56 through +8 ticks | 42-116 ticks |
| Leftward lane / lower pocket | -54 through +10 ticks | 43-107 ticks |

Every launch phase and dwell duration in a 240-tick cycle is checked. Straight
runs can now succeed with local departure delays 173-193, 172-187 and 172-197
ticks, respectively, from the recorded reference section starts; all other
straight departures hit a pulse. These newly possible routes are intentional
consequences of halving blast durations, not silently counterbalanced with
faster cycles. Full-route tests also cover individual
input-boundary errors of +/-4 ticks and combined pocket-dwell errors. These
checks establish feasible precise movement, not human input accuracy or fun.

## Browser acceptance

Use the **production preview**, not Vite's development websocket, for release
network checks. Open `/?debug` to opt into `window.__BOUNDSTOY__`; the API is
documented in README. `advance()` uses the same simulation as real inputs and
does not teleport or disable collisions. `project()` returns client coordinates
for a board cell without modifying the game.

1. Start using the actual UI, hold a movement key and release on normal ground.
2. Exercise constant-speed soft-ice steering, pause/resume, restart and focus
   leaving the game; no held keyboard/pointer input may remain stuck.
3. Check the generic initial Play gate, then direct level selection, next-level
   progression, retry and campaign restart without repeated tutorial popups.
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

## Playtest tuning (0.4.2)

The user requested a slightly smaller hitbox and half-duration explosions.
The radius is 0.20 rather than 0.22 tiles; exact wall, pulse and saw boundary
regressions check the new clearance. All 30 built-in pulse `on` values are
halved, with the editor default at 45 ticks. Custom JSON retains literal timing.
The portable suite has 181 checks; all nine exact replay ticks remain unchanged.
The wider windows above replace the previous mandatory-wait/hide assertions.
Production acceptance also passes all 23 browser groups and 36 real-pixel
cases. Evidence: `artifacts/bt020-*.log`, browser reports `run-nnuc15` and
`run-kFjjTA`, and the BT-020 handoff.

## Pre-playtest hardening (0.4.1)

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

## Nine-course baseline evidence (0.4.0)

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

## Six-lesson baseline evidence

The earlier integrated tree passed 116 Node tests: 68 original game/visual/tooling
checks, 15 renderer-scheduling checks, 13 browser-runner infrastructure checks,
and 20 tracker checks, plus TypeScript and the static build.

The orchestrator replayed all six levels in Chromium and verified next-level
navigation and the final campaign screen: exact ticks above, zero retries, all
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
