# Boundstoy

A static browser game about precise movement through instantaneous explosions.
The playable **Aftershock** candidate is one continuous eight-section world,
with seven between-puzzle checkpoints and one final exit. This is a complete
rough map awaiting human gameplay acceptance, not a released game or an approved
launch candidate. A secondary editor retains all four movement surfaces.

Started from a copy of [ai-game-template](https://github.com/HakonHesselberg/ai-game-template).
Its headless-first structure is retained. There is no game engine code in the
original template.

## Play locally

Requires Node.js 24+ and a browser with WebGL2.

```sh
npm ci
npm run dev
# http://127.0.0.1:4321
```

Click **Start**, then use **WASD / arrow keys**. Returning players get
**Continue** from the latest saved checkpoint, initially paused.
There is no section selector or checkpoint skipping. Hints stay below the board;
full level instructions are available in **Menu → How to play**.
**Space** pauses, **R** restarts the current puzzle at its checkpoint, and
**Escape** opens the menu. **Menu → New run** starts over, with confirmation
before replacing an unfinished run. Only the current puzzle's timed hazards
run; completed and future puzzles are inactive. Death returns to the latest
checkpoint without resetting elapsed time, deaths or the active hazard rhythm.
Restart and reload reset that rhythm, but retain elapsed time and deaths.
Resuming an in-session pause retains the current position and rhythm.
Progress saves at checkpoints, with totals also saved on death and pause/leaving;
there are no periodic saves. Abrupt termination can lose uncommitted totals.
Pause, hidden tabs and closed pages do not advance either clock.
In multi-puzzle custom maps, a tinted floor zone shows each generous collection
area between puzzles, painted only on ground connected to the checkpoint; the final puzzle ends at the exit, not another checkpoint.
Pause, restart and level changes clear held controls; release and press again
to move after those transitions.
Mobile layouts include hold-to-move direction buttons. **Menu** contains level
selection, sound, fullscreen, help and the editor. Sound starts muted on the
first visit; the optional intro sound toggle and menu volume preference are
remembered thereafter. Restored sound waits for an explicit play/level-choice gesture.
Results compare total time first, using fewer deaths to break exact ties.
Deathless completion is retained independently of a faster assisted best.
There are no preset mastery targets. Records are isolated by world ID and
content revision; old prototype clears do not complete this world.

**Soft ice has no brakes.** You glide at 4.4 tiles/second even when you release
the controls or hold reverse. Input changes your heading through a bounded turn;
reverse makes a U-turn. Curbs reflect soft-ice momentum instead of stopping it.
Hard ice still locks direction and stops at curbs. Land on normal ground or mud
to wait. The heading arrow shows your actual direction; developer readouts are
not part of the normal play screen.

## What's included

- Normal ground, steerable soft ice, direction-locked hard ice, and mud.
- Void, matte walls, metal spike clusters, telegraphed explosions, and moving saws.
- One continuous Aftershock world, checkpoint continuation, time-first records and a separate deathless achievement.
- Adaptive route signs and a hollow small-screen player locator, checkpoint-aware lessons, cause-specific retry
  feedback, and a campaign completion screen with run and best-time results.
- Paint-and-play editor: ground, hazards, start, exit, checkpoints, undo,
  local draft saving, and validated JSON import/export/download.
- Original procedural 3D geometry, studio reflections, neon accents and audio.
  No downloaded fonts, textures, models or sound files.
- Pure TypeScript simulation with immutable state updates, 120 Hz fixed steps,
  reference input replays, and an optional browser inspection API.

No accounts, analytics, ads, multiplayer, backend, or runtime external services.
After the initial page
and assets load, play and editing need no network. Offline **reload** is not
guaranteed: there is intentionally no service worker.

## Aftershock: complete rough world

| Section | Pattern |
| --- | --- |
| Following the wake | Follow a travelling blast into spent ground |
| Passing shelter | Use lateral refuges between travelling fronts |
| Read the patrol | Observe and cross a saw patrol |
| Turning fan | Turn through a directional explosion sequence |
| Conflicting appointments | Read saw and pulse timing together |
| Take the open arc | Choose an approach through combined threats |
| Cross the grain | Cross a patrol and a travelling front |
| Carry the current | Transfer through a turning basin to the final exit |

The ordinary and faster whole-world witnesses take **5,752 / 5,038 ticks**
(**47.93 / 41.98 seconds**) without deaths. These are practiced routes, not
first-attempt estimates, global records or evidence of fun. The final section
takes about seven seconds and has deliberately not been padded to a duration target.

The light and dark floor shades are the same normal ground: identical speed,
grip and collision. The group identity persists on explosion plates and warning
states; the bright flash still identifies the actual single lethal tick.
Warnings last 225 ms, followed by a compact flash and harmless 300 ms aftermath.
Explosive tiles are framed rather than covered, so the ground beneath stays readable; every effect stays inside its own tile.
Legal witnesses, actual arrival-phase necessity checks and measured input margins
do not replace the user's full-map playtest.

The three short Borrowed Ground / Crosscurrent / Checkerboard prototypes are
retired from the selector. Their data and dedicated browser regressions remain
for legacy import/record compatibility, not as the production campaign.

The retired Relay layouts are **not in the playable selector or game bundle**.
They remain only as movement/recovery regression fixtures under `tests/fixtures/`.
Retired records remain stored without counting as new clears. Human feedback
on challenge, readable decisions, progression and the finale is still required.

The collision radius remains 0.20 tiles and all four movement rules are unchanged.
Explosions now kill for one simulation tick only. Editor pads detonate every
three seconds; imported JSON/drafts retain their periods and phases, but legacy
`on` durations are converted to `1`.

Existing drafts and older records are preserved, but old clears do not affect
Continue. Choose **Remix level** in the editor to copy a current layout.

An explosive tile shows its real ground (normal, ice or mud) inside a thin, softly glowing rounded
groove. The colour groups pads that fire together: Ember (orange), Plasma (blue), Toxic (green) or
Psionic (violet). Pads outside the running puzzle use a neutral grey groove. As it charges, a spark
burns round the groove while a soft glow rises; then the tile flashes white-hot and a smooth coloured
eruption, shockwave and cooling scorch follow. The grooved square is the danger footprint.
The tile is safe immediately after detonation, even while the burst dissipates
for 300 ms. Fading debris is harmless, not continuous fire. Optional audio
includes a low detonation thump.

Visual polish, broader launch-platform qualification and publication are still
gated separately. The current wall treatment is busy, especially on small
screens; automated locator/footprint checks do not certify perceptual clarity.

## Build / deploy

```sh
npm run build
npm run preview
```

Upload **all of `dist/`** to any static host, including
`THIRD_PARTY_NOTICES.txt`. Paths are relative, so a nested directory works.
Use HTTP rather than opening the HTML through `file://`.

Three.js is the only production dependency (no runtime transitive dependencies).
Vite, TypeScript and type declarations are development-only. Tests use Node's
built-in runner. Vite warns
about its uncompressed size because the WebGL renderer lives in the same bundle.
We keep one preloaded bundle instead of adding lazy network loads during play.

Small systems (physics, editor, validation, saves, input and synth audio) are
implemented here, without extra libraries. Three.js remains a pinned dependency
rather than a hand-vendored renderer fork: copying part of its tightly connected
engine would increase maintenance and make fixes harder. The built output is
self-contained either way.

## Copy into Astro later

No Astro dependency is needed in this project.

1. Build Boundstoy and copy the **contents** of `dist/` into your Astro site's
   `public/games/boundstoy/`.
2. Copy `astro/Boundstoy.astro` into that site's `src/components/`.
3. Use it in an Astro page:

```astro
---
import Boundstoy from '../components/Boundstoy.astro';
---
<Boundstoy height="min(900px, 100dvh)" />
```

The component uses a titled, lazy-loaded iframe so game CSS and keyboard handling
stay isolated from the host site. No hydration framework is required. For a
custom location use `<Boundstoy src="/play/boundstoy/index.html" height="100dvh" />`.
The default URL respects Astro's configured base path. Choose an iframe height
that leaves the game's controls visible on the host page; the wrapper's default
is 1100px if no height is supplied. A static link to the standalone game also works.

The unmodified wrapper has been compiled in a real, pinned Astro consumer at
both root and nested base paths. The optional `npm run test:astro` command
repeats that check, including keyboard isolation, fullscreen and offline play.
Astro is installed only inside the disposable test consumer, never as a game
dependency. See [Astro verification](docs/ASTRO_CHECKS.md) for its scope.

## Level editor

Open **Menu → Level editor** to remix the selected level or restore your last draft.
Choose a brush, then click/drag on the board. For a saw, click its start and end.
**Erase object** removes a hazard at its start cell or a checkpoint, not the
ground. Start/exit/checkpoints require safe floor; painting unsafe terrain under
one is rejected. Move the marker or erase the checkpoint first.

**New blank** and **Remix level** can be undone. Up to 40 edits are kept in
session memory. **Playtest level** starts immediately from the draft's spawn;
return with **Back to editor** or **Menu → Level editor**. **Restart game level**
is called **Back to world** for this campaign and returns to its preserved run.
Playtests never alter built-in records or active world saves. World marker and
section metadata are edited together in validated JSON; section focus changes
only the editor view, never the playtest spawn or progress.

Drafts, records and checkpoint saves use transactional IndexedDB with one tab holding
a Web Lock, scoped to the hosting origin. Old localStorage bytes are preserved
as migration sources, not a second authority. Sound preferences remain separate.
Storage failures offer explicit retry/export/recovery or unsaved play, never a
false saved claim. Native quota exhaustion and BFCache retention still require
launch-platform qualification. The JSON panel also exposes pulse period/active time/phase and saw endpoints
and period. Times are integer simulation ticks, not milliseconds.

## Checks and AI inspection

```sh
npm test
npm run typecheck
npm run evaluate                 # tracker + tests + production build
npm run inspect -- 0             # ASCII course and state
npm run inspect -- 0 --replay    # complete deathless world witness; only index 0 is registered
```

For repeatable production-browser acceptance, with an installed Chromium:

```sh
npm run test:browser
npm run test:journey             # real world lifecycle, editor isolation and seven checkpoint recoveries
npm run test:readability         # actual opaque locator pixels, DPR 1/2, route visibility
npm run release:check            # evaluate + browser + journey + readability, one build
npm run test:astro               # real static Astro builds; isolated tooling install
```

This builds the game, starts an owned temporary loopback server/browser, drives
real input and all current replays, checks direct level transitions, paused/hidden
idleness, desktop/portrait/landscape actions and editor/saves/offline behaviour,
then cleans up. It uses Node's built-in APIs rather than an added npm dependency or
an AI/MCP session. Chromium's sandbox stays enabled and its profile is isolated.
Missing prerequisites and failed checks exit nonzero, never silently skip.
See [browser checks](docs/BROWSER_CHECKS.md) for executable overrides, evidence,
cleanup verification and platform limitations. The regular `evaluate` command
does not require Chromium.
The two additional commands use the same sandboxed browser primitives.
Readability checks the fixed-scale camera rectangle and actual collision sizes; it
measures locator pixels rather than pretending the physical robot is larger.
The Astro check needs npm registry access for its pinned test-only installation.

Open `http://127.0.0.1:4321/?debug` to opt into `window.__BOUNDSTOY__`:

```js
const game = window.__BOUNDSTOY__;
game.snapshot();                 // cloned state, level, mode, pause and inputs
game.ascii();                    // text view of the current board
game.load(0);                    // request world selection; normal replacement confirmation still applies
game.advance(120, { x: 1, y: 0 }); // pause real time and step one simulated second
game.project({ x: 3, y: 5 });     // cell center in browser client coordinates
game.metrics();                  // cumulative frames, draw calls, geometry, textures
game.export();                   // current level JSON
```

For V2, `load` is not a synchronous state setter: ownership, transactions and
replacement confirmation still apply. Before an exact witness, establish a
committed tick-zero run paused through explicit focus loss; the browser checks'
`worldDriver` demonstrates this without rewriting state or bypassing storage.
`advance` runs the same collision, hazards, checkpoint and win logic as keyboard
play; it does not teleport or disable hazards. The reference inputs in
`data/replays.ts` traverse all eight sections and the final exit without deaths. This is evidence of
solvability, **not** an exhaustive BFS proof, and it cannot decide whether the
game feels fun. Use real browser screenshots and human play alongside the tests.
The debug API is absent without `?debug`.

Paused gameplay and hidden documents stop scheduling unchanged render frames.
Resize and explicit debug steps invalidate the scene for a fresh frame; resume
does not catch up elapsed paused time. Visible initial-entry/editor/victory animation
continues, while modal menus freeze the covered scene.

See [mechanics](docs/GAME_SYSTEMS.md), [architecture](docs/ARCHITECTURE.md),
[animation](docs/ANIMATION.md), [testing](docs/TESTING.md), and [platform](docs/PLATFORM.md).

## Local issues and agent coordination

Project work lives in [Markdown issues](tasks/INDEX.md), with a
[workflow and template](tasks/README.md). The Node helper has no added
dependencies and does not launch agents or services:

```sh
npm run tasks                    # Read the backlog and current assignments
npm run tasks -- ready            # Only approved, dependency-ready work
npm run tasks -- index            # Refresh the generated overview
npm run tasks:check               # Validate issues and index freshness
```

`npm run evaluate` includes the tracker check. After editing issue metadata,
regenerate the index before running it.

Copilot profiles are provided for `boundstoy-orchestrator` and
`boundstoy-worker`. Start Copilot in this project and select
`/agent boundstoy-orchestrator` for an explicitly bounded coordination run.
Only the orchestrator changes issue state; workers implement one assigned task
and return evidence. Start with one worker, then allow at most two independent
workers. Worktree-based execution requires a committed baseline first; the
tracker does not create commits or approve its own backlog.

## License

MIT for Boundstoy code and original procedural art/audio. Three.js and the
template are MIT licensed too. Upstream attribution and full license text are
preserved in [third-party notices](public/THIRD_PARTY_NOTICES.txt); the upstream
template's placeholder copyright line is retained verbatim.
