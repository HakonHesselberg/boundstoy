---
{
  "id": "BT-002",
  "title": "Automate production browser smoke checks",
  "type": "chore",
  "status": "done",
  "priority": "P1",
  "depends_on": [],
  "parent": "BT-010",
  "scope": ["tests/browser/", "tests/browser-check.test.ts", "scripts/browser-check.ts", "package.json", "docs/BROWSER_CHECKS.md"],
  "approval": "User asked for another bounded issue-fixing agent batch on 2026-10-08. Approved as the reproducible browser acceptance gap selected under BT-010.",
  "assignment": {
    "owner": "orchestrator-browser-review",
    "run": "ae1df791-ee88-45da-87ca-bc2da2630c7d",
    "branch": "master",
    "worktree": "."
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

- [x] One documented command builds/serves the production bundle and returns a nonzero exit code on failed assertions.
- [x] Real input confirms normal-ground release, continuous soft-ice speed through reversal, and pause/resume.
- [x] Every current reference level finishes at its expected simulation ticks without deaths using shared LEVELS/REPLAYS data, not copied magic timestamps or a fixed course count.
- [x] Editor export/import preserves a draft and invalid input leaves it intact with a visible error.
- [x] Requests during play stay local; no external resources or telemetry are introduced.
- [x] Browser context and owned server processes are cleaned up on success and failure without touching existing sessions.
- [x] Missing browser, startup timeout, failed assertions and protocol errors fail clearly; no silent skip or success-shaped fallback.
- [x] Browser user data is isolated; Chrome's sandbox stays enabled and the runner never attaches to a user's existing browser.

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

- Summary: Worker delivered a passing dependency-free browser runner; combined acceptance and entrypoint hardening are complete.
- Changes: Eight scoped files: entrypoint, private runtime/scenarios, portable tests, two fixtures, command hook and dedicated documentation.
- Verification: Worker passed its real browser suite, intentional failure and cleanup probes; 100 portable tests/typecheck/build passed in its branch. Combined master passed 116 tests and the actual browser suite twice, covering all six witnesses, real constant-speed reversal, editor persistence/isolation and offline operation. A new regression proved the old entrypoint could silently skip when import.meta.main is absent; the established argv/URL guard now executes and fails explicitly instead.
- Risks: Browser command is verified on Linux with software WebGL; mobile/hardware rendering, audio/fullscreen remain manual. It requires an installed Chromium and cannot guarantee cleanup after uncatchable SIGKILL or machine failure.
- Commit: a5d9d7a5154aec9fdd47479a7dfa0b3fc7182ad2 from worker 19ce1f31-6bb8-4f36-86c2-d3f3a863ad87 is integrated. The small same-scope entrypoint regression/fix is recorded in the orchestrator's acceptance commit.
- Resources: Worker and orchestrator runs reported cleaned profiles/process groups/listeners. Root passing runs: artifacts/browser-check/run-qvdut4 and run-8E8hHR; intentional failure: run-biOwvF. Exact profile/PID/group/port cleanup was checked, not just the report's boolean.
- Decisions: No new dependency, AI/MCP requirement, sandbox bypass or user profile. The sync worker cannot receive follow-up turns, so the orchestrator handled the few-line review adjustment directly rather than relaunching an agent.

## Result

- Summary: Accepted the repeatable local production-browser command and its failure/cleanup contract.
- Verification: npm run test:browser passed on the combined idle-aware renderer. The intentional assertion fixture exited 1 with passed=false/cleaned=true, then the real suite passed again. Missing-metadata entrypoint regression, full tests/typecheck/build and scope checks passed.
- Integration: Integrated worker commit a5d9d7a plus the reviewed argv/URL entrypoint guard in master. npm run evaluate remains browser-independent; npm run test:browser is opt-in.
