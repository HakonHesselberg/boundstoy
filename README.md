# Boundstoy

A static, two-course browser vertical slice about movement and timing. Walk,
steer a constant-speed glide across soft ice, commit to a hard-ice slide, and
slow down in mud. The workshop lets you build the next course.

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

Click **Let's roll**, then use **WASD / arrow keys**. **Space** pauses, **R**
restarts the course. Checkpoints save your position after a fall. Mobile layouts
include hold-to-move direction buttons. Sound starts muted; enable it explicitly.

**Soft ice has no brakes.** You glide at 4.4 tiles/second even when you release
the controls or hold reverse. Input changes your heading through a bounded turn;
reverse makes a U-turn. Curbs reflect soft-ice momentum instead of stopping it.
Hard ice still locks direction and stops at curbs. Land on normal ground or mud
to wait. The heading arrow and speed readout show your actual movement.

## What's included

- Normal ground, steerable soft ice, direction-locked hard ice, and mud.
- Void, low striped barriers, metal spike clusters, telegraphed explosions, and moving saws.
- Two obstacle courses, unlimited retries, checkpoints, local best times.
- Numbered route markers, checkpoint-aware lessons, cause-specific retry
  feedback, and a two-course completion screen with run and best-time results.
- Paint-and-play editor: ground, hazards, start, exit, checkpoints, undo,
  local draft saving, and validated JSON import/export/download.
- Original procedural 3D geometry, studio reflections, neon accents and audio.
  No downloaded fonts, textures, models or sound files.
- Pure TypeScript simulation with immutable state updates, 120 Hz fixed steps,
  reference input replays, and an optional browser inspection API.

This is a finished two-course slice, not a full campaign. No accounts, analytics,
ads, multiplayer, backend, or runtime external services. After the initial page
and assets load, play and editing need no network. Offline **reload** is not
guaranteed: there is intentionally no service worker.

**Slalom & slide** teaches continuous arcs around alternating spike banks,
landing on solid ground, using a curb to stop and turn a hard slide, then lining
up a one-tile gap. **Commit & cross** combines a timed hard-ice launch, a sweeping
turn to a safe island, a moving-saw crossing, and a slower mud crossing.
Solid-ground islands give you time to observe hazards without inventing brakes
on ice. The no-braking courses have versioned IDs, so earlier physics records
are retained but not compared against these runs. Existing drafts are preserved;
choose **Remix course** for a fresh copy of the new layout.

Explosion pads are dark when safe, charge in amber, then erupt into bright
fireballs, shock rings and sparks. The outlined square is the danger footprint.
Fire stays visible for the complete lethal phase and disappears when it is safe
to cross. Optional audio includes a low detonation thump.

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
built-in runner. The production JS is approximately 164 KB gzipped; Vite warns
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
<Boundstoy />
```

The component uses a titled, lazy-loaded iframe so game CSS and keyboard handling
stay isolated from the host site. No hydration framework is required. For a
custom location use `<Boundstoy src="/play/boundstoy/index.html" height="1100px" />`.
The default URL respects Astro's configured base path. On narrow layouts the
iframe scrolls internally. A static link to the standalone game also works.

## Workshop

Open **Workshop** to remix the selected course or restore your last draft.
Choose a brush, then click/drag on the board. For a saw, click its start and end.
**Erase object** removes a hazard at its start cell or a checkpoint, not the
ground. Start/exit/checkpoints require safe floor; painting unsafe terrain under
one is rejected. Move the marker or erase the checkpoint first.

**New blank** and **Remix course** can be undone. Up to 40 edits are kept in
session memory. **Playtest course** starts from the draft's spawn; return with
**Workshop**. Playtests never alter the built-in course records.

Drafts and records stay in `localStorage`, scoped to the hosting origin. Storage
failures are shown in the UI; export JSON if saving is unavailable. There is no
sync. The JSON panel also exposes pulse period/active time/phase and saw endpoints
and period. Times are integer simulation ticks, not milliseconds.

## Checks and AI inspection

```sh
npm test
npm run typecheck
npm run evaluate                 # tests + production build
npm run inspect -- 0             # ASCII course and state
npm run inspect -- 1 --replay    # deathless reference playthrough
```

Open `http://127.0.0.1:4321/?debug` to opt into `window.__BOUNDSTOY__`:

```js
const game = window.__BOUNDSTOY__;
game.snapshot();                 // cloned state, level, mode, pause and inputs
game.ascii();                    // text view of the current board
game.load(0);                    // reset a built-in course
game.advance(120, { x: 1, y: 0 }); // pause real time and step one simulated second
game.project({ x: 3, y: 13 });    // cell center in browser client coordinates
game.metrics();                  // Three.js draw calls / geometry / textures
game.export();                   // current level JSON
```

`advance` runs the same collision, hazards, checkpoint and win logic as keyboard
play; it does not teleport or disable hazards. The reference inputs in
`data/replays.ts` reach both exits with no falls. This is evidence of
solvability, **not** an exhaustive BFS proof, and it cannot decide whether the
game feels fun. Use real browser screenshots and human play alongside the tests.
The debug API is absent without `?debug`.

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
