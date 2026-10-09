# Real Astro consumer verification

This optional integration check compiles the supplied `astro/Boundstoy.astro`
with **Astro 7.3.8**, using the exact fixture lockfile. It is not a raw iframe
mock or a source-text-only assertion. Astro is test/build tooling, never a
Boundstoy runtime or root dependency.

## Commands

From the Boundstoy repository root, with its normal dependencies installed:

```sh
npm run evaluate
npm run build && node scripts/check-astro.ts --timeout 180000
```

The second command needs an installed, sandbox-capable Linux Chromium and
network access to the npm registry for the isolated fixture installation.
It defaults to `/usr/bin/chromium`; an alternative must be an absolute path:

```sh
node scripts/check-astro.ts --browser /absolute/path/to/chromium --timeout 180000
```

The timeout includes fixture installation, both builds and browser checks.
Its default is 90000 ms; supported values are 100–600000 ms. Missing Chromium,
unsupported platforms, invalid flags, build errors, unsupported fullscreen,
browser errors and expired deadlines **fail**, never silently skip.
Individual CDP commands have a 15000 ms cap (also bounded by the whole-run
deadline), allowing for software-WebGL work on a shared machine.
No sandbox-disabling option is accepted.

`npm run evaluate` remains portable and does not install Astro, build this
consumer or launch a browser. Its eight native Astro tests only read the
tracked fixture, exercise staging/audits with synthetic files, and run bounded
Node CLI/process regressions. They cover execution even when
`import.meta.main` is absent. The process-group test is POSIX-only, like the
existing browser-harness tests.

An optional root script can be added by the release orchestrator:

```json
"test:astro": "npm run build && node scripts/check-astro.ts"
```

Then use `npm run test:astro -- --timeout 180000`. Do not add this integration
command to the portable `evaluate` pipeline.

## Reproducible copy/build workflow

Source lives under `tests/astro-consumer/`. The private fixture manifest pins
Astro exactly; its npm lockfile pins the transitive build dependencies and
integrities. There is no adapter, SSR service, hydration framework or browser
automation dependency.

Each run creates a new, ignored
`tests/astro-consumer/artifacts/run-<uuid>/`:

1. Copy the fixture manifest, lockfile, config and pages into `consumer/`.
2. Copy the **unaltered supplied wrapper** into `consumer/src/components/`.
3. Copy **all** production `dist/` bytes, including `THIRD_PARTY_NOTICES.txt`,
   into `consumer/public/games/boundstoy/`.
4. Run `npm ci --no-audit --no-fund` in that isolated consumer. No shared or
   symlinked `node_modules` is used. The npm cache, Astro cache/config and
   generated declarations also stay in the run artifact directory. Astro
   telemetry and update checks are disabled.
5. Run real `astro build` through the fixture's `npm run build`, first with
   `BOUNDSTOY_ASTRO_BASE=/`, then with
   `BOUNDSTOY_ASTRO_BASE=/showcase/arcade/`.
6. Audit each build, then mount its output at that exact URL prefix using the
   existing native static preview server. Astro's output directory itself
   does not contain a base-named subdirectory; the runner supplies the mount.
7. Launch a fresh owned Chromium/profile for each mount and verify the
   Astro-emitted default page and custom-prop debug page.

Do not run an install/build directly in the tracked fixture: the wrapper and
game are deliberately supplied by staging, not duplicated in fixture source.
When updating Astro, change only the fixture manifest, generate its lockfile
in an isolated artifact copy, copy back the lockfile, and rerun both checks.

## What is exercised

- `/index.html` and `/showcase/arcade/index.html` use `<Boundstoy />`.
  Astro must emit the default title, `1100px` height, lazy iframe, fullscreen
  permission, and correctly based game URL.
- Each `debug/index.html` imports the same wrapper with custom title, `900px`
  height and an explicitly base-aware `src` ending in `?debug`. Custom `src`
  remains the caller's responsibility; the wrapper does not rewrite it.
- All copied game files have matching SHA-256 hashes both on disk and over
  HTTP, including the notices. Actual game JS/CSS and Astro's compiled host
  stylesheet must load. Requests escaping the origin or nested prefix are
  blocked and fail the check; console errors, exceptions, failed HTTP,
  WebSockets and workers also fail.
- Native CDP keyboard/mouse events enter the iframe with Tab, start with
  Enter, move with arrows/WASD, release, pause, leave to a host control and
  resume. Position changes are measured in the production debug snapshot.
  Host keys cannot move/restart the game; game keys neither bubble to host
  shortcuts nor scroll the host. Blur clears held input.
- The real fullscreen menu button enters and exits fullscreen. Both host
  iframe and child fullscreen state, completed UI events and absence of an
  error notice are asserted. This is more than checking `allowfullscreen`.
- After loading, networking is forced offline for ordinary non-debug play
  and, separately, for input/fullscreen and all nine exact production witness
  finishes. No additional requests are permitted. Witnesses use the existing
  production debug API, not synthetic saved records; each ends on its exact
  winning tick with zero deaths and ordered checkpoints.
- A fresh origin starts with no progress. The game's actual finishes write
  all nine records, and a subsequent ordinary iframe load hydrates them.
  Only the progress storage key remains; no cookie, session storage, service
  worker or ordinary-page debug API is present.

## Evidence and cleanup

The printed run directory contains:

- `inputs.json`: Node/Astro versions, source-wrapper/page hashes and complete
  production-file hashes.
- `install.log`, `root/build.log`, `nested/build.log`: actual tooling output.
- `root/site/`, `nested/site/`: real emitted static sites, mounted correctly.
- Per base, `browser.json`, `chromium.log`, `ordinary.png` and
  `campaign-complete.png`: request URLs, scenario assertions, browser version,
  owned PID/process group, preview/debug ports and cleanup result.
- `report.json`: overall pass/failure and the bases actually completed.
  Browser failures also attempt `failure.jpg`; an exited browser may prevent
  capture without concealing the original failure.

No manual server or shared browser context is used. Browser isolation,
sandbox-preserving arguments, CDP transport, static serving, finite waits and
POSIX process-group teardown reuse `tests/browser/runtime.ts`. The standalone
`scripts/browser-check.ts` entry point always boots the standalone game, so
the consumer runner composes those primitives instead of modifying it.
Chromium's relative `TMPDIR=.` points into its owned profile/cwd to avoid Unix
socket path-length limits in deep worktrees.

Success, browser failure, deadline and SIGINT/SIGTERM paths close owned
processes, sockets and preview listeners; disposable profiles are removed.
Tool-command deadlines also reap owned build/install descendants. Generated
consumer installations, output, caches and evidence are intentionally retained
under ignored artifacts for inspection. Remove only the relevant printed run
directories when no longer needed; never touch another run's live profile.

## Verified scope

BT-004 was exercised with Node **24.19.0**, npm **11.17.0**, Astro **7.3.8**
and sandboxed Chromium **151.0.7922.137** on Linux, at **1280×1400** with
headless software WebGL. Both bases passed in:

`tests/astro-consumer/artifacts/run-4e7e287a-0fff-4f03-ae26-61998ea48637/`

`npm run evaluate` passed all **144** tests, typechecking, tracker validation
and the production build; the existing large-bundle warning remains.
`tests/astro-consumer/artifacts/deliberate-wrong-title/browser.json` records
an intentionally corrupted emitted title being rejected with
`passed: false, cleaned: true`; its process group and preview listener were
also independently checked gone. Earlier debugging failures and their
reports are retained, not relabeled as passes.
One later shared-load run timed out a simple CDP evaluation at the original
5000 ms cap without page/network errors; cleanup succeeded. The consumer cap
was raised to 15000 ms without changing shared helpers or assertion criteria.
An existing browser-harness test also once missed its 1000 ms process-start
deadline, then passed both a targeted rerun and the unchanged full evaluation.
These diagnostic failures remain in the artifacts, including
`evaluate-contention.log`.
The final `evaluate-final.log` is green.
`tests/astro-consumer/artifacts/cleanup.json` independently checks all ten
browser attempts' PIDs/process groups, profiles, preview ports and CDP ports
are absent. Obsolete private installations/caches were pruned; final tooling,
emitted sites, failure reports and screenshots were retained.

The existing wrapper required **no production change**.

This verifies the static same-origin copying workflow, not every Astro
version, deployment adapter, CSP/Permissions-Policy configuration, cross-origin
embedding, storage partitioning, Safari/Firefox, mobile hardware or human
playability. Iframes isolate document styles/key events, **not** same-origin
host access to game data. Local progress is origin-scoped, not base-path-scoped.
Fullscreen policy restrictions on a real website still require site-specific
checking. Offline-after-load does not imply offline navigation/reload: no
service worker or installable offline cache is introduced.
