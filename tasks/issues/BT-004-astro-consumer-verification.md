---
{
  "id": "BT-004",
  "title": "Verify the Astro wrapper in a real consumer build",
  "type": "chore",
  "status": "in_progress",
  "priority": "P2",
  "depends_on": [],
  "parent": null,
  "scope": ["astro/Boundstoy.astro", "tests/astro-consumer/", "tests/astro-consumer.test.ts", "scripts/check-astro.ts", "docs/ASTRO_CHECKS.md"],
  "approval": "User directed autonomous implementation of the proposed pre-playtest reliability, readability, Astro and performance batch on 2026-10-09. An isolated pinned Astro test consumer is approved; no game runtime dependency.",
  "assignment": {
    "owner": "astro-consumer-worker",
    "run": "dispatching",
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

- [ ] A documented command compiles an Astro consumer using the copied wrapper and built game assets.
- [ ] Root and nested base paths produce a working, titled iframe without missing assets or paths escaping the intended base.
- [ ] Keyboard focus, local progress, and fullscreen permissions work within the iframe.
- [ ] The host and game remain fully static after loading, without new runtime external requests.
- [ ] The fixture leaves no owned background processes running and does not alter a real website.

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

Pending.

## Result

Pending.
