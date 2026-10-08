# Production browser checks

```sh
npm ci
npm run test:browser
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
npm run test:browser -- --browser /absolute/path/to/chromium --timeout 120000
```

Only `--browser` and `--timeout` are accepted. The executable is spawned directly
with an argument array, never interpolated into a shell. The timeout is an
integer in **milliseconds**, from 100 to 600000; default **90000**. It covers
the browser runner, not the preceding `npm run build`. Browser startup/document
load has a 15-second deadline; CDP commands/connections and UI waits have
5-second deadlines. Increasing the whole-run timeout does not mask a stalled
individual command. Missing browsers, broken builds, protocol errors, console
errors/assertions, unavailable controls and failed checks all exit nonzero.
There are no browser-related skips or success fallbacks.

To rerun against an already built bundle:

```sh
node scripts/browser-check.ts
```

Prefer the npm command for acceptance so stale assets cannot pass.

## What is checked

- Real CDP keyboard and pointer events: normal-ground movement/release,
  Space/button pause and resume, menu keys, focus leaving via Tab, cleared held
  input, and unchanged simulation state while paused. No dependence on a
  continuously running paused render loop.
- A large isolated soft-ice room is imported through the editor UI and
  playtested. Live state samples verify constant terrain-defined speed through
  a keyboard U-turn and after release. No player teleport/state mutation API.
- **All** actual `LEVELS` and `REPLAYS` imported from this checkout: legal
  keyboard axes, exact command/final tick counts, no padded wins, zero deaths,
  ordered checkpoints, next-level intro screens and campaign completion.
  Deterministic replay uses the opt-in `?debug` API; course count/timestamps
  are not duplicated in the harness.
- Editor export/import roundtrip, invalid JSON with a visible error preserving
  both live and saved draft, and a winning imported playtest using a built-in
  level ID that must not overwrite its betterable campaign record.
- Saved progress survives a real reload and hydrates the level menu. A separate
  ordinary navigation verifies `window.__BOUNDSTOY__` is absent.
- Initial production JS/CSS and real WebGL rendering. Page requests must stay
  on the owned origin; non-local HTTP requests are blocked before dispatch and
  fail the suite. HTTP failures, page WebSockets and browser console errors
  also fail. All input/editor/replay checks run **offline after initial load**,
  with no additional requests; ordinary non-debug offline play is checked too.

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
Touch/pointer capture, mobile layouts, audio,
fullscreen, download-dialog behavior, reduced motion, context loss and visual
quality/readability remain manual checks. Software WebGL is not a hardware-GPU
performance benchmark. Live keyboard tests sample rendered simulation states,
not every physics substep (the portable physics tests cover those). Offline
means **after loading**, not offline navigation/reload or a service-worker cache.
Network checks concern the game page, not Chromium's own OS/background services.
Uncatchable SIGKILL, machine failure or an OS unable to terminate a process
cannot guarantee cleanup; use the recorded identities to inspect only that run.

The private transport uses the documented [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/):
`Input` for real events, `Runtime` for readback/replays, `Network`/`Fetch` for
network checks, and `Page`/`Browser` for navigation and owned-browser diagnostics.
