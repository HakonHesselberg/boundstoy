---
{
  "id": "BT-002",
  "title": "Automate production browser smoke checks",
  "type": "chore",
  "status": "backlog",
  "priority": "P1",
  "depends_on": [],
  "parent": null,
  "scope": ["tests/browser/", "scripts/browser-check.ts", "package.json", "docs/TESTING.md"],
  "approval": null,
  "assignment": null,
  "blocked_reason": null
}
---
# BT-002: Automate production browser smoke checks

## Problem

The game has deterministic Node tests, but the browser verification performed
during development is not yet a repeatable checked-in command. Input, DOM and
rendering regressions can therefore escape the headless simulation tests.
This is a proposed follow-up, not currently approved work.

## Scope

Create a minimal local production-browser smoke harness using existing
capabilities where practical. Cover input, progression, editor round-tripping
and the static/offline requirement. Add only development tooling if justified.

No new runtime dependencies, game mechanics, remote browser service, telemetry,
or broad visual redesign. Do not replace the existing core tests.

## Acceptance criteria

- [ ] One documented command builds/serves the production bundle and returns a nonzero exit code on failed assertions.
- [ ] Real input confirms normal-ground release, continuous soft-ice speed through reversal, and pause/resume.
- [ ] Both current reference courses finish at their expected simulation ticks without deaths using the shared replay data, not copied magic timestamps.
- [ ] Editor export/import preserves a draft and invalid input leaves it intact with a visible error.
- [ ] Requests during play stay local; no external resources or telemetry are introduced.
- [ ] Browser context and owned server processes are cleaned up on success and failure without touching existing sessions.

## Implementation context

See `data/replays.ts`, `tests/courses.test.ts`, `presentation/main.ts` and the
opt-in `window.__BOUNDSTOY__` interface. Use production preview, not Vite's
development websocket, for network assertions. The two profiles must not share
browser storage or a preview port with another worker.

## Verification

Run the new command against a production build. Demonstrate one deliberately
failing assertion exits nonzero in a disposable fixture, then restore it and
run the passing suite. Run `npm run evaluate`. Document host/browser prerequisites
and any behaviour that remains a manual visual check.

## Handoff

Pending.

## Result

Pending.
