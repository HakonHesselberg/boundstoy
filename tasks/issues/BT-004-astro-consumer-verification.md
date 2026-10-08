---
{
  "id": "BT-004",
  "title": "Verify the Astro wrapper in a real consumer build",
  "type": "chore",
  "status": "backlog",
  "priority": "P2",
  "depends_on": [],
  "parent": null,
  "scope": ["astro/Boundstoy.astro", "tests/astro-consumer/", "scripts/check-astro.ts", "package.json", "README.md", "docs/PLATFORM.md", "docs/TESTING.md"],
  "approval": null,
  "assignment": null,
  "blocked_reason": null
}
---
# BT-004: Verify the Astro wrapper in a real consumer build

## Problem

The nested static iframe was checked in a browser, but `Boundstoy.astro` has not
been compiled in an actual Astro project. A small consumer fixture would make
the documented copying workflow reproducible before a website integration.
This candidate has not been approved for implementation.

## Scope

Add a disposable/minimal Astro consumer fixture that copies the production
game and imports the supplied wrapper. Check root and non-root base paths.
Any Astro dependency belongs only to the test consumer, not the game runtime.

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

## Verification

Build both consumer configurations and open the emitted static pages locally.
Confirm iframe title, resource URLs and actual input. Run `npm run evaluate`
for Boundstoy. Record exact fixture commands and remaining browser limitations.

## Handoff

Pending.

## Result

Pending.
