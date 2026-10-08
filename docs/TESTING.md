# Testing and AI evaluation

Run `npm run evaluate`: local issue/index checks, Node tests, then TypeScript and the production
build. No additional test framework or browser automation package is installed.

The tests cover walking/release, constant-speed soft-ice steering/U-turns,
no-input gliding, speed-preserving wall bounces and respawn, hard-ice locks,
walls, mud speed, normalized diagonals, terrain transitions, immutable updates,
repeatability, pulse warnings/collision, saw paths, respawns, checkpoints,
finish-time freezing, editor edits/undo inputs, strict JSON parsing and saves.
Both built-in courses have deathless reference runs that visit every checkpoint.
Regression cases also show that straight-line inputs fail the opening obstacles,
soft-ice steering is exercised in both witnesses, skipping the second course's
launch wait is lethal, and the wrong hard-ice lane cannot be corrected mid-slide.
Hazard geometry/phase tests cover tall spike silhouettes, low curbs, visible
warnings, a blast lasting exactly the lethal window, and reduced-motion states.

| Course | Reference finish | Falls |
| --- | --- | --- |
| Slalom & slide | 1,480 ticks / 12.3333 simulated seconds | 0 |
| Commit & cross | 1,722 ticks / 14.35 simulated seconds | 0 |

Input sequences are in `data/replays.ts`. They use only legal per-tick movement
commands, not position injection. Run `npm run inspect -- 1 --replay` for the
ASCII board and ending state. These are witness solutions, not exhaustive
solvers or guarantees that every edited level can be beaten. Every soft-ice
tick in both witnesses is checked for full speed. Twenty-seven combinations of
50 ms turn-input errors still clear the first slalom onto solid ground.
Each second-course wait tolerates a 200 ms earlier or later launch, one change
at a time, while preserving a deathless finish. The witnesses use middle-of-window
launches rather than scraping the first safe simulation tick.

For AI-driven browser checks, run the production preview and use `/?debug`.
The opt-in API is documented in README. Compare the browser's final snapshot
against the same Node replay. `project()` maps a tile to client coordinates
for pointer-based editor testing; it does not alter the board.

## Browser acceptance checks

1. Start using the actual UI, hold a movement key, release it on normal ground.
2. Verify Space pauses both hazards and simulation time; R resets the run.
3. Complete both recorded input runs in the browser, with identical ticks and
   no falls; reload and confirm best-time persistence.
4. In Workshop, paint a tile with the pointer, undo it, add a hazard, rename,
   export JSON, make a blank course, then import back. Invalid JSON must leave
   the existing draft intact and show an error.
5. Playtest the draft and return to Workshop without changing built-in records.
6. Reload to check draft persistence. Exercise audio opt-in and fullscreen.
7. Inspect desktop and narrow/touch screenshots. Check for horizontal overflow,
   visible controls, useful floor contrast, and no stuck input on pointer cancel.
8. Turn the network offline after loading; play/edit without new requests.
   Inspect the request list for only local static resources.
9. Repeat level/editor rebuilds and check geometry/texture counts settle rather
   than grow. Inspect the console for application errors.

## Vertical-slice verification

The current build passed 69 Node tests (49 game/visual and 20 tracker tests), TypeScript checking and production
compilation. In Chromium, both reference runs produced the exact same winning
ticks as Node. Actual keyboard input, pause/restart, pointer painting, undo,
JSON round-trip/rejection, playtesting, reload persistence, sound opt-in and
fullscreen were exercised. A held direction button moved the player and cleared
on release in a 390px touch-emulated viewport.

Desktop and narrow screenshots were inspected. Repeated board rebuilds settled
at the same geometry count. Turning the network offline after loading did not
interrupt playing, respawning or editor export; requests were local static
assets only. A nested `/games/boundstoy/` deployment inside an iframe loaded and
ran correctly. The Astro wrapper itself was not compiled in an Astro project.

After the obstacle redesign, both new witness runs were replayed in Chromium
with the exact Node finish ticks above. Desktop/mobile screenshots were inspected
for pointed spike silhouettes, low striped curbs and the explosion states.
The denser spike clusters are instanced; six rebuilds of the second course
retained the same geometry count. Application console errors were absent.

For the constant-glide slice, real keyboard input was held through a U-turn
and then released in a workshop test room: every sampled live speed remained
4.4 tiles/second, with no braking. The complete first-course -> second-course
intro -> final completion flow matched the new witness ticks, and retry reset
the current course without losing records. Focus leaving a live glide paused
the simulation. Touch release, new-physics workshop playtests, specific spike
feedback, mobile result-panel bounds, and saved completion counts were checked.
Numbered-label textures and geometry counts stayed constant across five rebuilds.

## Tracker verification

`node --test tests/tasks.test.ts` covers the local Markdown tool independently
of gameplay. Temporary fixtures exercise JSON front matter, required sections,
approval/assignment rules, dependency and parent deadlocks, scope conflicts,
completion evidence, deterministic index generation, stale-index rejection,
JSON output and CLI exit codes. Examples/comments are not acceptance evidence.

The orchestrator and worker profiles are configuration/instructions, not a
background queue service. Their presence does not prove that a worker was
launched. Real worktree dispatch additionally requires a committed baseline,
appropriate tool permissions and an explicitly approved task.

Rendering quality and subjective movement feel are not proven by unit tests.
Chrome desktop/headless checks do not certify Safari, Firefox or real mobile GPU
performance. Reduced motion removes decorative motion, not gameplay hazards.

Development discipline from the original template remains: write a regression
test before a physics fix, use immutable inputs, keep the suite green, and
verify in the browser rather than equating a build with a playable game.
