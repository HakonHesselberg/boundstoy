---
{
  "id": "BT-060",
  "title": "Verify the frozen complete release candidate reproducibly",
  "type": "chore",
  "status": "ready",
  "priority": "P1",
  "depends_on": ["BT-059", "BT-062"],
  "parent": "BT-038",
  "scope": ["package.json", "scripts/", "tests/", "docs/TESTING.md", "docs/BROWSER_CHECKS.md", "tasks/issues/"],
  "approval": "2026-10-10 user approved executing BT-038; preserve actual human acceptance, launch-size and content prerequisites.",
  "assignment": null,
  "blocked_reason": null
}
---
# BT-060: Verify the frozen complete release candidate reproducibly

## Problem

Separately passing feature tests do not certify their combined behavior, and
the old release command does not yet cover resumable continuous-world flows.

## Scope

Integrate the new world, continuation, storage, graphics and editor scenarios
into a reproducible release gate. Verify the frozen launch candidate and record
its exact identity. Diagnose intermittent failures; fixes outside the harness
need bounded follow-ups and a new candidate run.

## Acceptance criteria

- [ ] The release gate exercises the actual launched world(s), not just retired course fixtures.
- [ ] Portable tests, typecheck/build and all required browser scenarios pass without silent skips.
- [ ] Exact full-world routes, all checkpoint recoveries, saved/deathless completion, two-tab safety and graphics recovery pass together.
- [ ] Console/network errors, asset failures, cleanup failures and false-save outcomes cause explicit failures.
- [ ] Candidate hash/revision, commands, hardware/manual evidence and any unsupported cases are recorded.
- [ ] Required user acceptance, release-size choice and any additional-world/rework dependencies are satisfied.
- [ ] BT-062 verifies working gameplay, persistence and recovery on every selected launch platform; missing platform evidence blocks certification.
- [ ] Evidence is regenerated after relevant content/code changes rather than reused from a different candidate.

## Implementation context

Planning only; BT-038 is the definition of done. The earlier journey timeout
passed on retry but was not root-caused, so treat flakiness honestly.
Full tests and typechecking run sequentially because Astro subprocess fixtures
can otherwise leak into typechecking. CI is not mandatory.
If BT-054 adds launch worlds, add their acceptance as direct prerequisites here.

## Verification

Run `npm run tasks:check`, the updated `npm run release:check`,
`npm run test:motion`, and `npm run test:astro` when applicable.
Verify saved evidence and owned-resource cleanup; require current user Brave
results from BT-058. No deployment or release approval is implied by a green gate.

## Handoff

Pending.

## Result

Pending.
