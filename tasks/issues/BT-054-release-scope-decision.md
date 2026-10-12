---
{
  "id": "BT-054",
  "title": "Choose the launch scope after the Aftershock proof",
  "type": "chore",
  "status": "ready",
  "priority": "P1",
  "depends_on": ["BT-024"],
  "parent": "BT-038",
  "scope": ["tasks/issues/"],
  "approval": "2026-10-10 user approved executing BT-038; obtain the actual launch-size and destination decision after the proof, do not invent it.",
  "assignment": null,
  "blocked_reason": null
}
---
# BT-054: Choose the launch scope after the Aftershock proof

## Problem

The user deliberately deferred whether the first public release contains only
Aftershock or additional complete worlds. Planning cannot silently decide it.

## Scope

Ask for the launch-world decision after the accepted proof, and identify the
available website destination and feedback route. Record any newly required
worlds as bounded approved scope and release prerequisites before continuing.
Choose the actual launch browser/OS/device matrix and persistence expectations
for BT-062; do not assume all mobile devices or browser engines are supported.
No additional worlds, accounts, hosting setup or deployment under this issue.

## Acceptance criteria

- [ ] The user explicitly chooses whether Aftershock alone is the first release.
- [ ] If more content is required, its issues are recorded and its acceptance is added as a BT-060 prerequisite before calling the release scope complete.
- [ ] The existing/zero-cost website destination and a feasible feedback route are identified, or an explicit unresolved blocker is recorded.
- [ ] The user confirms intended launch platforms and required support tiers, including saving/continuation expectations, for BT-062 qualification.
- [ ] The decision distinguishes planning approval from permission to create accounts, spend money or publish.

## Implementation context

Execution approved; see BT-038's interview decisions and the 2026-10-11
platform-qualification request. The user has no deadline and
zero spending allowance. Do not pre-create mandatory optional-world tickets
that would prevent closing an intentionally single-world release.

## Verification

Record the user's actual decision and its scope, then run `npm run tasks:check`
after any dependency changes. Silence is not acceptance; stop and wait if the
user has not answered.

## Handoff

Pending.

## Result

Pending.
