---
{
  "id": "BT-016",
  "title": "Accept and document the nine-level practice expansion",
  "type": "chore",
  "status": "ready",
  "priority": "P1",
  "depends_on": ["BT-015"],
  "parent": null,
  "scope": ["README.md", "docs/", "CLAUDE.md", "package.json", "package-lock.json", "tasks/"],
  "approval": "Approved as integration/verification for the user's 2026-10-09 request for more interesting playtest levels.",
  "assignment": null,
  "blocked_reason": null
}
---
# BT-016: Accept and document the nine-level practice expansion

## Problem

More involved practice levels need combined browser and readability acceptance,
not just a longer legal input script. Documentation must distinguish quick
lessons from the new practice courses and preserve truthful test limitations.

## Scope

Review the scoped curriculum commit, inspect the three new layouts, run all
nine production-browser witnesses and progression/menu checks, update release
documentation/version and close the accepted issue. Do not silently fix unrelated
backlog items or introduce new mechanics.

Reopen BT-015 for a level defect; keep the orchestrator's work limited to
integration, evidence and documentation. Retain the generic initial Play gate,
non-blocking hints and direct level-to-level flow.

## Acceptance criteria

- [ ] Original six maps/replays are unchanged and the new courses have demonstrably more route/timing decisions.
- [ ] Advanced pulse practice visibly sends a wave down the path and then detonates the pockets, with verified hide/leave windows and failure for never hiding or camping.
- [ ] All nine courses finish through the production browser with exact witness results and valid progression.
- [ ] New layouts, hazard phases, safe checkpoints and nine-entry menus are inspected at desktop and mobile sizes.
- [ ] Documents/version and local issue evidence accurately describe the expansion without claiming unperformed human playtests.
- [ ] Full evaluation/browser checks pass, commits are clean and owned test servers/browser pages are stopped.

## Implementation context

No requirement to fill the ten-level cap. Nine is enough for this batch; future
content or tuning should be informed by playing these courses. References and
experiments from BT-014 remain recommendations unless included explicitly here.
The user's precise wave-and-pocket request is explicitly included: keep the
early lessons forgiving, but do not dilute the new advanced pulse challenge
into another broad single-gate timing lesson.

## Verification

Run npm run evaluate and npm run test:browser, inspect new-course screenshots
and actual flow, verify the accepted file scope/commit, and check cleanup using
owned process identities. Update docs with course IDs, focus and witness times.

## Handoff

Pending.

## Result

Pending.
