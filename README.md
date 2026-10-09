# Boundstoy

A small, static browser game about movement and timing, with an original
eight-course Relay campaign and a minimal player-facing interface.
Walk, steer a constant-speed glide across soft ice, commit to a hard-ice slide, and learn
when to cross moving hazards. A secondary level editor lets you build more.

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

Click the single initial **Play**, then use **WASD / arrow keys**. Returning
players get **Continue**, starting at the first uncleared current campaign course.
Selecting a level, **Next level** and **Retry level** start playing
directly—there are no per-level tutorial popups. Hints stay below the board;
full level instructions are available in **Menu → How to play**.
**Space** pauses, **R** restarts, and **Escape** opens the menu.
Checkpoints save your position after a fall.
Pause, restart and level changes clear held controls; release and press again
to move after those transitions.
Mobile layouts include hold-to-move direction buttons. **Menu** contains level
selection, sound, fullscreen, help and the editor. Sound starts muted on the
first visit; the optional intro sound toggle and menu volume preference are
remembered thereafter. Restored sound waits for an explicit play/level-choice gesture.
Results distinguish a first clear, personal best, matched best and time/retry
comparison. **Next level** chooses the next uncleared course cyclically.
Clearing the final missing course celebrates completion regardless of play order;
**Choose a level** opens the menu rather than restarting the campaign.

**Soft ice has no brakes.** You glide at 4.4 tiles/second even when you release
the controls or hold reverse. Input changes your heading through a bounded turn;
reverse makes a U-turn. Curbs reflect soft-ice momentum instead of stopping it.
Hard ice still locks direction and stops at curbs. Land on normal ground or mud
to wait. The heading arrow shows your actual direction; developer readouts are
not part of the normal play screen.

## What's included

- Normal ground, steerable soft ice, direction-locked hard ice, and mud.
- Void, low striped barriers, metal spike clusters, telegraphed explosions, and moving saws.
- Eight original levels, unlimited retries, checkpoints, local best times.
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

## The Relay campaign

| Level | Focus |
| --- | --- |
| Relay courtyard | Two balcony corners teach walking, stopping and reading the floor |
| Reservoir hairpin | One continuous soft-ice U around a reservoir, with two broad steering arcs |
| Spillway locks | Align, descend, stop, launch left, then descend from a second curb |
| Signal stairs | Two independently observed pulse gates on a rising dogleg |
| Patrol looms | Cross two perpendicular saw patrols from safe platforms |
| Silt terraces | Two slow mud crossings; fresh pulse windows matter |
| High interchange | A soft-ice hook, dry transfer, locked curb launch and high pulse bridge |
| Last light relay | Two travelling-pulse elbows, a slow riser and a final saw crossing |

This is a wholly new campaign, not renamed or retuned prototype maps. The arc
borrows design principles—not layouts—from bounds and escape games: observe
from safe ground, commit to a readable movement phrase, then recover at a
checkpoint. Introductory timed crossings tolerate 200 ms launch errors.
Later routes combine taught ideas and reward continuous movement; no new
systems or assets are introduced. All eight courses remain freely selectable.

**Last light relay is a chase, not a hiding-pocket puzzle.** Pulses travel at
33 ticks per tile, close to walking cadence, along two differently oriented
elbows. Keep ahead of the returning blasts and rest on the dry platforms.
Camping on any of the nineteen wave vents fails. Mud then changes the pace
before one last saw-timed crossing. Every reference checkpoint segment takes
less than ten seconds; these are clean execution times, not beginner targets.

The collision radius remains 0.20 tiles and all four movement rules are unchanged.
Explosions now kill for one simulation tick only. Editor pads detonate every
three seconds; imported JSON/drafts retain their periods and phases, but legacy
`on` durations are converted to `1`.

Relay IDs keep earlier prototype scores separate; pulse courses use `-v2` to
separate instantaneous-explosion records from earlier sustained-flame runs.
Existing drafts and older records are preserved, but old clears do not complete changed courses or
affect Continue. Choose **Remix level** in the editor to copy a current layout.

Explosion pads are dark when safe, charge in amber, then erupt into bright
fireballs, shock rings and sparks. The outlined square is the danger footprint.
The tile is safe immediately after detonation, even while the burst dissipates
for 300 ms. Fading debris is harmless, not continuous fire. Optional audio
includes a low detonation thump.

The approved **Aftershock** replacement world is in development, not included
yet. Its first gate is proving three challenging, replayable encounters with
these instantaneous explosions; the Relay campaign is not accepted as that world.

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
built-in runner. The production JS is approximately 167 KB gzipped; Vite warns
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
deliberately leaves editing and restarts the selected built-in level. Playtests never
alter built-in records.

Drafts and records stay in `localStorage`, scoped to the hosting origin. Storage
failures are shown in the UI; export JSON if saving is unavailable. There is no
sync. The JSON panel also exposes pulse period/active time/phase and saw endpoints
and period. Times are integer simulation ticks, not milliseconds.

## Checks and AI inspection

```sh
npm test
npm run typecheck
npm run evaluate                 # tracker + tests + production build
npm run inspect -- 0             # ASCII course and state
npm run inspect -- 1 --replay    # deathless reference playthrough
npm run inspect -- 7 --replay    # Last light relay; valid indices are 0-7
```

For repeatable production-browser acceptance, with an installed Chromium:

```sh
npm run test:browser
npm run test:journey             # Continue, out-of-order completion, PB/audio, responsive screenshots
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
Readability preserves the full-board camera and actual collision sizes; it
measures locator pixels rather than pretending the physical robot is larger.
The Astro check needs npm registry access for its pinned test-only installation.

Open `http://127.0.0.1:4321/?debug` to opt into `window.__BOUNDSTOY__`:

```js
const game = window.__BOUNDSTOY__;
game.snapshot();                 // cloned state, level, mode, pause and inputs
game.ascii();                    // text view of the current board
game.load(0);                    // reset a built-in course paused at tick zero
game.advance(120, { x: 1, y: 0 }); // pause real time and step one simulated second
game.project({ x: 3, y: 5 });     // cell center in browser client coordinates
game.metrics();                  // cumulative frames, draw calls, geometry, textures
game.export();                   // current level JSON
```

`load` is an explicit paused inspection reset, not normal player navigation.
It shows the pause overlay and cannot accumulate live ticks while a witness is
prepared. Normal level selection, Next and Retry still start live play on a
`?debug` page; call `load(index)` before each exact input-only witness.
`advance` runs the same collision, hazards, checkpoint and win logic as keyboard
play; it does not teleport or disable hazards. The reference inputs in
`data/replays.ts` reach all eight exits with no falls. This is evidence of
solvability, **not** an exhaustive BFS proof, and it cannot decide whether the
game feels fun. Use real browser screenshots and human play alongside the tests.
The debug API is absent without `?debug`.

Paused gameplay and hidden documents stop scheduling unchanged render frames.
Resize and explicit debug steps invalidate the scene for a fresh frame; resume
does not catch up elapsed paused time. Visible initial-entry/editor/victory animation
continues, while modal menus freeze the covered scene.

See [mechanics](docs/GAME_SYSTEMS.md), [architecture](docs/ARCHITECTURE.md),
[testing](docs/TESTING.md), and [platform](docs/PLATFORM.md).

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
