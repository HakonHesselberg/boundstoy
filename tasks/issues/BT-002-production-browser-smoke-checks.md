---
{
  "id": "BT-002",
  "title": "Automate production browser smoke checks",
  "type": "chore",
  "status": "in_progress",
  "priority": "P1",
  "depends_on": [],
  "parent": "BT-010",
  "scope": ["tests/browser/", "tests/browser-check.test.ts", "scripts/browser-check.ts", "package.json", "docs/BROWSER_CHECKS.md"],
  "approval": "User asked for another bounded issue-fixing agent batch on 2026-10-08. Approved as the reproducible browser acceptance gap selected under BT-010.",
  "assignment": {
    "owner": "browser-smoke-worker",
    "run": "dispatching-sync; runtime agent ID will be recorded when returned",
    "branch": "task/bt-002",
    "worktree": ".worktrees/BT-002"
  },
  "blocked_reason": null
}
---
# BT-002: Automate production browser smoke checks

## Problem

The game has deterministic Node tests, but the browser verification performed
during development is not yet a repeatable checked-in command. Input, DOM and
rendering regressions can therefore escape the headless simulation tests.
The manual checks performed for v0.3 need a repeatable local command before
further tuning can be accepted reliably.

## Scope

Create a minimal local production-browser smoke harness using installed Chromium
and Node 24's built-in fetch/WebSocket APIs where practical. Cover input,
progression, editor round-tripping and the static/offline requirement.
The host already has /usr/bin/chromium. No new dependency or browser download.

No game/UI/physics changes, remote browser service, telemetry, Playwright/Puppeteer
package, or broad visual redesign. Do not replace the existing core tests.
Keep a browser-specific command separate from the fast portable Node suite.
Only edit the declared helper/test/entrypoint/script/documentation paths.

## Acceptance criteria

- [ ] One documented command builds/serves the production bundle and returns a nonzero exit code on failed assertions.
- [ ] Real input confirms normal-ground release, continuous soft-ice speed through reversal, and pause/resume.
- [ ] Every current reference level finishes at its expected simulation ticks without deaths using shared LEVELS/REPLAYS data, not copied magic timestamps or a fixed course count.
- [ ] Editor export/import preserves a draft and invalid input leaves it intact with a visible error.
- [ ] Requests during play stay local; no external resources or telemetry are introduced.
- [ ] Browser context and owned server processes are cleaned up on success and failure without touching existing sessions.
- [ ] Missing browser, startup timeout, failed assertions and protocol errors fail clearly; no silent skip or success-shaped fallback.
- [ ] Browser user data is isolated; Chrome's sandbox stays enabled and the runner never attaches to a user's existing browser.

## Implementation context

See `data/replays.ts`, `tests/courses.test.ts`, `presentation/main.ts` and the
opt-in `window.__BOUNDSTOY__` interface. Use production preview, not Vite's
development websocket, for network assertions. The two profiles must not share
browser storage or a preview port with another worker.
The parallel rendering worker changes only main.ts/scene.ts and a small
render-loop module/test. Keep this harness independent of that implementation.
You may expose/reuse a small private CDP helper under tests/browser, but do not
build a general browser automation framework.

## Verification

Run the new command against a production build. Demonstrate one deliberately
failing assertion exits nonzero in a disposable fixture, then restore it and
run the passing suite. Run `npm run evaluate`. Document host/browser prerequisites
and any behaviour that remains a manual visual check.
Use an owned ephemeral local server or port 4332, never attach to a pre-existing
preview. Chromium executable override must be explicit and safely spawned without
shell interpolation. Do not disable the sandbox, install extensions, or use the
default user profile. Close browser/server and remove owned temporary profiles.

## Handoff

Pending.

## Result

Pending.
