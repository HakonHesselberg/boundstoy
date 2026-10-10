# Production browser checks

```sh
npm ci
npm run test:browser
npm run test:journey
npm run test:explosions
npm run test:aftershock
# Combined release gate: portable + game + journey + explosions + Aftershock + readability
npm run release:check
```

Run from your checkout/worktree. This builds with the existing production build
(including typechecking), serves `dist/` with a small Node static server on an
**owned ephemeral loopback port**,
and launches an isolated, headless Chromium. No AI session, MCP connection,
browser download, Playwright/Puppeteer, or additional dependency is needed.
`npm run evaluate` remains portable: its Node tests test the harness's arguments,
protocol errors/timeouts and cleanup without requiring Chromium.

## Prerequisites and options

- Node **24+**, locked project dependencies, and an installed Chromium.
- The entrypoint uses the repository's argv/URL guard rather than requiring
  `import.meta.main`; absence of that metadata cannot turn a run into a silent pass.
- Default executable: `/usr/bin/chromium`. Linux is the verified host platform.
- Chromium must run as a non-root user with its normal sandbox available
  (including supported user namespaces). The runner never uses `--no-sandbox`,
  an existing browser, extensions, or your default browser profile.
- HOME and XDG configuration/cache/data directories are isolated too, so host
  launcher preferences cannot inject user flags/extensions. The actual browser
  command line is checked for sandbox bypasses, extensions and profile identity.
- Headless rendering uses Chromium's bundled SwiftShader via
  `--use-angle=swiftshader --enable-unsafe-swiftshader`. This enables software
  WebGL for this isolated, local test page; it does **not** disable the sandbox.
  Do not use the test browser to browse untrusted sites.

```sh
npm run test:browser -- --browser /absolute/path/to/chromium --timeout 300000
```

Only `--browser` and `--timeout` are accepted. The executable is spawned directly
with an argument array, never interpolated into a shell. The timeout is an
integer in **milliseconds**, from 100 to 600000; default **180000**. It covers
the browser runner, not the preceding `npm run build`. Browser startup/document
load has a 15-second deadline; CDP commands/connections and UI waits have
5-second deadlines. Increasing the whole-run timeout does not mask a stalled
individual command. Missing browsers, broken builds, protocol errors, console
errors/assertions, unavailable controls and failed checks all exit nonzero.
There are no browser-related skips or success fallbacks.
The expanded stress suite took 112-167 seconds on the shared test machine;
the whole-run budget includes repeated scene rebuilds, not just a smoke load.

To rerun against an already built bundle:

```sh
node scripts/browser-check.ts
```

Prefer the npm command for acceptance so stale assets cannot pass.

## What is checked

- Aftershock checks the actual selector contains only Slipstream, Borrowed
  Ground and The Cut, six ordinary/mastery witnesses, visible target outcomes,
  retained clean records, repeatable real retries and desktop/mobile captures.
  The readability runner samples each active encounter at spawn and 25/50/75%
  of its ordinary witness, across four viewport/DPR combinations.
- The dedicated explosion check imports a legacy pulse and verifies disclosed
  `on: 1` normalization, exact detonation collision, safe entry one tick later,
  the next distinct detonation and a render batch that skips ignition.
  Full/reduced-motion captures at 1060x800 show warning, flash, harmless
  aftermath and cleared ground. Paused screenshots must be identical.
  Repeated effects must not grow GPU geometry after initial death-effect upload.
  Captures are under `artifacts/explosions/`; runner logs and cleanup evidence
  use the usual per-run browser directory.
- A single generic initial Play waits for intent and accepts Enter. Level
  selection (including before initial Play), Next, Retry and Restart game level
  start immediately with viewport focus and no tutorial overlay. Completed
  campaigns offer level selection; returning visitors continue at the first
  uncleared course. Sound is opt-in, with remembered preferences activated only
  by a play gesture; hints and optional Help remain.
- Real CDP keyboard and pointer events: normal-ground movement/release,
  Space/button pause and resume, menu keys, focus leaving via Tab, cleared held
  input, and unchanged simulation state and frame counts while paused.
  Switching to another owned blank tab verifies hidden-page idleness and
  explicit resume on return. No dependence on a continuously running paused
  render loop; one-shot pause/resize invalidations drain before measurement.
- Restart/selection while a direction remains held, including real key
  auto-repeat; continued touch contact after restart cannot restore cleared
  movement. A 4x CPU throttle and 200 ms main-thread stall exercise bounded
  frame recovery and clean pause.
- **1280×800 desktop, 390×844 portrait and 844×390 landscape**: required
  navigation controls fit on screen (scrolling menus/editor panels as needed),
  have at least 44×44 CSS-pixel targets and are not obscured. Selection,
  next/retry/final transitions, pause/resume, Help and editor playtest/return
  run in each layout. Portrait/landscape use real CDP touch events, including
  held movement and cancellation; desktop also checks Enter/Tab activation and
  menu focus trapping. Covered movement controls must be disabled.
- A large isolated soft-ice room is imported through the editor UI and
  playtested. Live state samples verify constant terrain-defined speed through
  a keyboard U-turn and after release. No player teleport/state mutation API.
- **All** actual `LEVELS` and `REPLAYS` imported from this checkout: legal
  keyboard axes, exact command/final tick counts, no padded wins, zero deaths,
  ordered checkpoints and campaign completion. Each witness explicitly uses
  `debug.load(index)` and verifies a paused tick-zero reset before advancing.
  Normal Next/Retry transitions are separately verified to run live, including
  on `?debug` pages; no replay ticks are padded to hide elapsed live time.
  Course count/timestamps are not duplicated in the harness.
- Editor export/import roundtrip, invalid JSON with a visible error preserving
  both live and saved draft, and a winning imported playtest using a built-in
  level ID that must not overwrite its betterable campaign record. Both completed
  and unfinished playtests return directly to the same editor draft.
- Four full passes through all levels compare per-scene
  geometry/texture counts, followed by four editor/playtest returns. Each
  rebuild is an individually bounded command, not one long blocking batch.
- Saved progress survives a real reload and hydrates the level menu. A separate
  ordinary navigation verifies `window.__BOUNDSTOY__` is absent and level
  selection/retry also start without a second Play in the non-debug game.
- Initial production JS/CSS and real WebGL rendering. Page requests must stay
  on the owned origin; non-local HTTP requests are blocked before dispatch and
  fail the suite. HTTP failures, page WebSockets and browser console errors
  also fail. All input/editor/replay checks run **offline after initial load**,
  with no additional requests; ordinary non-debug offline play is checked too.

## Player journey acceptance

`npm run test:journey` reuses the same isolated production browser harness.
It verifies visible first-run controls and goal, legacy record retention,
Continue selection, out-of-order campaign completion, first-clear and
faster/equal/slower personal-best feedback. Real pointer activation verifies
sound opt-in, retained keyboard focus, remembered volume and restart-triggered
audio initialization without autoplay on reload. Unit tests bound synthesized
sound to eight simultaneous voices and verify mute/disposal cleanup.
Real two-finger direction input is combined with an opposing keyboard direction,
then restarted while held; all input sources must clear without stuck movement.

The journey captures every course at 1440x900 and entry overlays at 390x844,
844x390 and 720x450 in `artifacts/release/`, after waiting for a rendered frame.
The last viewport approximates the available layout space at 200% desktop zoom;
it does not certify browser zoom or physical touch accuracy. Screenshots support
visual review; capture success alone does not prove legibility or enjoyment.

`npm run release:check` fails at the first unsuccessful portable, browser,
journey or real-pixel readability check. The unchanged Astro integration has a
separate `npm run test:astro` gate when distributing that wrapper. Hardware GPU
performance, Firefox/WebKit, physical devices, listening comfort and independent
human playtesting remain explicit release-assessment limitations.

## Failure evidence and cleanup

Every launched run prints its unique `artifacts/browser-check/run-*` directory,
Chromium PID, preview URL and profile path. The ignored directory contains:

- `report.json`: pass/fail, cleanup result, exact resource identities, scenarios,
  requests and browser errors. Logs are capped at 200 entries, problems at 50,
  requests at 200, and each recorded entry at 2000 characters.
- `chromium.log`: the last 16 KiB of browser process output.
- `failure.jpg`: one viewport JPEG on failure, if CDP still responds, capped at
  2 MB. Screenshot failure never replaces the original error.

Only profiles created by this run (`artifacts/p-*`) are removed. The short
profile path also contains Chromium's temporary files (`TMPDIR`); system temp
and global Chrome profile paths are not used. Very long checkout paths may
exceed Chromium's Unix socket path limit; use a shorter checkout path if the
startup log reports `Socket path too long`.

On success, failure, SIGINT or SIGTERM, the runner closes its CDP socket, stops
its owned browser **process group including descendants** (SIGTERM, then SIGKILL
after 3 seconds if necessary, with a 2-second exit wait), removes its profile
and closes the preview's connections and listener. The separate POSIX group
stays referenced/awaited by the runner, never `unref()`'d; it is not a surviving
background job. Waiting for the entire group prevents late startup children
from recreating a deleted profile. The Node preview installs no competing
process-exiting signal handlers.

The runner neither attaches to nor kills an existing user browser/server.
Check `cleaned: true` in the report, verify its profile no longer exists, its PID
and process group are absent, and its preview/debugging ports refuse connections.
For example, using the **exact identities from that report**, `test ! -e
<profile>`, `ps -p <pid>` and `curl --max-time 1 <preview-url>` should find no
profile/process/listener. Do not kill a process if an old PID/port has since
been reused. Retained evidence directories can be deleted after review; they
contain no player profile.

## Controlled failure verification

After a production build, this fixture boots a **disposable isolated browser**
and deliberately asserts the wrong document title:

```sh
node tests/browser/fixtures/assertion-failure.ts
echo $? # expected: 1, not 0
npm run test:browser # the real suite must still pass
```

It does not alter production source/assets or change the normal suite, so
there is nothing to restore. Its report must say `passed: false, cleaned: true`;
inspect the assertion and screenshot, not merely the exit code.

Additional failure probes (each must exit 1, never skip):

```sh
node scripts/browser-check.ts --browser /not-an-installed-browser/bt-002
node scripts/browser-check.ts --browser /usr/bin/false # Linux: immediate startup exit
node scripts/browser-check.ts --timeout 100           # deliberately too short
node --test tests/browser-check.test.ts                # portable protocol/cleanup tests
```

## Limitations

This is a focused Chromium smoke check, not a general automation framework or
cross-browser certification. The browser command requires POSIX process groups
(verified on Linux) and fails explicitly on Windows rather than risking orphaned
children. Windows explicitly skips only the POSIX-group portable unit test.
Physical-device touch behavior, layouts beyond the checked sizes, audible
sound output, download-dialog behavior and context loss remain manual checks.
`npm run test:readability` separately measures opaque locator pixels at phone
sizes/DPR 1 and 2 and checks the unchanged desktop view; native tests check
exact pulse visibility with reduced motion. `npm run test:astro` additionally
checks actual same-origin iframe fullscreen. Subjective visual quality and
human playability are not certified by these commands. Emulated touch verifies
capture release and cancellation, not every physical input device.
Software WebGL is not a hardware-GPU
performance benchmark. Live keyboard tests sample rendered simulation states,
not every physics substep (the portable physics tests cover those). Offline
means **after loading**, not offline navigation/reload or a service-worker cache.
Network checks concern the game page, not Chromium's own OS/background services.
Uncatchable SIGKILL, machine failure or an OS unable to terminate a process
cannot guarantee cleanup; use the recorded identities to inspect only that run.

The private transport uses the documented [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/):
`Input` for real events, `Runtime` for readback/replays, `Network`/`Fetch` for
network checks, and `Page`/`Browser` for navigation and owned-browser diagnostics.
