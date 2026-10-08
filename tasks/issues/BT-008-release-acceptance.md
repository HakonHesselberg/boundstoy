---
{
  "id": "BT-008",
  "title": "Verify and document the integrated consumer release",
  "type": "chore",
  "status": "ready",
  "priority": "P1",
  "depends_on": ["BT-006", "BT-007"],
  "parent": "BT-005",
  "scope": ["README.md", "docs/", "package.json", "package-lock.json", "CLAUDE.md", "tasks/", ".github/agents/"],
  "approval": "Approved as release integration and acceptance under the user's 2026-10-08 shippable-game request in BT-005.",
  "assignment": null,
  "blocked_reason": null
}
---
# BT-008: Verify and document the integrated consumer release

## Problem

Worker results need combined acceptance before the game can be called ready to
ship. Existing documentation still describes the old two-course slice.

## Scope

Review worker scope/handoffs, update release documentation and version, verify
the six-course player flow in a real browser, and close accepted local issues.
The orchestrator owns this integration task directly. Reopen a child issue for
any code defect found rather than silently changing a worker's scope.

No external deployment, remote push, new dependencies, new game mechanics or
automatic execution of the earlier unapproved backlog. Local commits and
integration are authorized by the user's follow-up.

## Acceptance criteria

- [ ] Every current level finishes through the production browser with the same result as its Node witness.
- [ ] Consumer menus, campaign completion/retry, saved progress, keyboard/touch, focus/pause, mobile overlays and secondary editor flow work together.
- [ ] Browser console has no application errors; requests stay local and loaded play works offline.
- [ ] README, mechanics/testing/platform docs and version describe the actual release and remaining limitations.
- [ ] The static build retains notices and relative paths suitable for standalone or Astro iframe hosting.
- [ ] npm run evaluate passes, owned preview servers are stopped and all child issues have honest integration evidence.

## Implementation context

Use the optional ?debug API for reproducible input replays, not teleporting or
disabling hazards. Also exercise actual inputs and inspect screenshots; a Node
pass alone is insufficient for the consumer UI. Preserve existing user drafts
and older records. Do not claim an actual Astro compile unless it is performed.

## Verification

`npm run evaluate`, all six `npm run inspect -- N --replay` checks, real browser
smoke scenarios and desktop/mobile screenshots. Confirm no runtime dependency
was added and no worker/server remains active at the end.

## Handoff

Pending.

## Result

Pending.
