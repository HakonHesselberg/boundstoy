---
{
  "id": "BT-004",
  "title": "Verify the Astro wrapper in a real consumer build",
  "type": "chore",
  "status": "done",
  "priority": "P2",
  "depends_on": [],
  "parent": null,
  "scope": ["astro/Boundstoy.astro", "tests/astro-consumer/", "tests/astro-consumer.test.ts", "scripts/check-astro.ts", "docs/ASTRO_CHECKS.md"],
  "approval": "User directed autonomous implementation of the proposed pre-playtest reliability, readability, Astro and performance batch on 2026-10-09. An isolated pinned Astro test consumer is approved; no game runtime dependency.",
  "assignment": {
    "owner": "astro-consumer-worker",
    "run": "8bd867d2-7bdf-4be9-9899-d142a1b20ef3",
    "branch": "task/bt-004",
    "worktree": ".worktrees/BT-004"
  },
  "blocked_reason": null
}
---
# BT-004: Verify the Astro wrapper in a real consumer build

## Problem

The nested static iframe was checked in a browser, but `Boundstoy.astro` has not
been compiled in an actual Astro project. A small consumer fixture would make
the documented copying workflow reproducible before a website integration.
The user approved this integration verification before human playtesting.

## Scope

Add a disposable/minimal Astro consumer fixture that copies the production
game and imports the supplied wrapper. Check root and non-root base paths.
Any Astro dependency belongs only to the test consumer, not the game runtime.
Keep fixture source and a pinned lockfile reproducible; generated output,
installation and browser evidence belong in ignored artifacts. Reuse the native
browser harness where practical, without editing shared browser helpers. The
orchestrator handles root package scripts and existing release documentation.

No production hosting changes, deployment, SSR backend, analytics, remote assets,
package publishing, or new frontend framework.

## Acceptance criteria

- [x] A documented command compiles an Astro consumer using the copied wrapper and built game assets.
- [x] Root and nested base paths produce a working, titled iframe without missing assets or paths escaping the intended base.
- [x] Keyboard focus, local progress, and fullscreen permissions work within the iframe.
- [x] The host and game remain fully static after loading, without new runtime external requests.
- [x] The fixture leaves no owned background processes running and does not alter a real website.

## Implementation context

See `astro/Boundstoy.astro`, Vite's relative `base`, README's copying steps, and
`docs/TESTING.md` for the current limitation. Pin test tooling reproducibly and
retain open-source notices when copying `dist/`.
Do not disable Chromium's sandbox or attach to a user profile. Use an owned
ephemeral origin or port 4338 and isolated context boundstoy-bt004 for manual
checks. Use the fixture's manifest before installing its isolated dependencies.

## Verification

Build both consumer configurations and open the emitted static pages locally.
Confirm iframe title, resource URLs and actual input. Run `npm run evaluate`
for Boundstoy. Record exact fixture commands and remaining browser limitations.

## Handoff

- Summary: Real Astro 7.3.8 static consumers compile and run at / and /showcase/arcade/ with the unchanged supplied wrapper.
- Changes: Added scripts/check-astro.ts, isolated fixture/lockfile under tests/astro-consumer/, nine portable native tests, and docs/ASTRO_CHECKS.md. Root/game dependencies and the wrapper are unchanged.
- Verification: Worker built both configurations and verified every production asset/notice byte, native keyboard focus/isolation, actual fullscreen, offline play, all nine exact finishes and persisted progress. A deliberately wrong title failed with cleanup. Initial evaluation passed 144 tests; the requested logging/startup-race follow-up passed nine targeted and 145 total native tests with typecheck.
- Risks: Verified Linux Chromium, desktop and same-origin mounting only; not arbitrary host CSP/Permissions-Policy, cross-origin storage, all Astro versions or mobile hardware. Installs need registry access; runtime play does not.
- Commit: dfed4cf4f2f3dc38e5e623a6ea90927d86ef443a plus d6b0aea10ae700ead2cc3aa898bd4a4680ab289e, integrated by 3cefc54.
- Resources: Worker evidence tests/astro-consumer/artifacts/run-4e7e287a-0fff-4f03-ae26-61998ea48637/ and cleanup.json records ten stopped browser attempts. Private final installations/evidence remain ignored. Follow-up native children were reaped; no manual browser/server was started.
- Decisions: Astro stays pinned test tooling, not a runtime/root dependency. Telemetry/update checks are disabled. Reuse existing CDP/isolation/cleanup primitives; keep optional integration out of evaluate. Parent adds the npm command and updates the shared 180-second default in documentation.

## Result

- Summary: Accepted after reviewing the fixture, lockfile checks, browser assertions and actual root/nested screenshots.
- Verification: Parent integrated evaluation passed 174 tests/typecheck/build before readability integration. Review requested explicit secondary screenshot-error logging and readiness-based child abort instead of a 500 ms startup race; both fixes are included and tested.
- Integration: Both worker commits are on master. BT-019 runs the optional consumer command against the final combined production build and records its resource cleanup.
