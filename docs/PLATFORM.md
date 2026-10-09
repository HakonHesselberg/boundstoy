# Platform

- Browser: ES modules, WebGL2, WebAudio, Pointer Events, ResizeObserver.
- Tooling: Node.js 24+, npm.
- Runtime: Three.js 0.186.1, bundled locally; zero production transitive packages.
- Development: Vite, TypeScript and Node/Three type declarations.
- Tests: Node's native test runner and TypeScript stripping.
- Art: local procedural geometry, a generated glow texture and studio
  environment map. System fonts; no CDN or asset store.
- Audio: synthesized effects created only after explicit user interaction.

`npm ci` installs locked dependencies. `npm run dev` serves port 4321.
`npm run build` type-checks and writes the static `dist/`; `npm run preview`
serves that build on 4321. Stop one server before starting the other.

Deploy the entire output, not the source tree or `node_modules`. Relative asset
paths permit nested hosting. Preserve `THIRD_PARTY_NOTICES.txt`.

No network calls are made by game logic. The dev server has Vite's development
connection, so privacy/network checks must use the **production preview**.
No service worker, remote font, telemetry, external asset, API, or online
leaderboard is included. Loaded sessions keep working when offline; a fresh
offline navigation depends on the browser's ordinary cache.

See the README for copying into Astro. The supplied wrapper is a plain iframe;
it deliberately avoids assuming a host site's styling, router or hydration
framework. If the host applies CSP, allow same-origin scripts/styles/images.
Fullscreen remains subject to the embedding site's permissions.
The consumer interface fits its own viewport; for an iframe, prefer an explicit
height such as `min(900px, 100dvh)` so the host page does not place touch controls
far below the visible screen. The unmodified wrapper has been compiled and
browser-checked with Astro 7.3.8 at root and nested bases, including keyboard
isolation, actual fullscreen and offline play. `npm run test:astro` repeats this
using a private pinned fixture install, not a root/runtime dependency; see
ASTRO_CHECKS.md for remaining host-policy and browser limitations.

Progress keys: `boundstoy.progress.v1`, `boundstoy.draft.v1`.
Clear those keys to reset local data. Storage permission/quota failures are
visible and do not prevent play; export JSON to preserve drafts manually.

Release scope: six teaching levels plus three focused practice courses using
existing mechanics only, no more than ten levels without a new scope decision.
The editor is a secondary menu action.
Desktop Chromium and emulated mobile viewports are checked; real Safari/Firefox
and physical mobile GPU/device behaviour are not certified by those checks.
