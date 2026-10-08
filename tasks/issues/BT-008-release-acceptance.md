---
{
  "id": "BT-008",
  "title": "Verify and document the integrated consumer release",
  "type": "chore",
  "status": "blocked",
  "priority": "P1",
  "depends_on": ["BT-006", "BT-007", "BT-009"],
  "parent": "BT-005",
  "scope": ["README.md", "docs/", "package.json", "package-lock.json", "CLAUDE.md", "tasks/", ".github/agents/"],
  "approval": "Approved as release integration and acceptance under the user's 2026-10-08 shippable-game request in BT-005.",
  "assignment": null,
  "blocked_reason": "Production QA reproduced a walking-level void message that teaches green-ice rules. BT-009 fixes this small feedback defect before release acceptance."
}
---
# BT-008: Verify and document the integrated consumer release

## Problem

Worker results need combined acceptance before the game can be called ready to
ship. Existing documentation still describes the old two-course slice.

## Scope

Review worker scope/handoffs, update release documentation and version, verify
the six-course player flow in a real browser, and close accepted local issues.
The orchestrator owns this integration task directly. Record a scoped bug child
or reopen the relevant child for defects rather than silently expanding scope.

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

- Summary: Release verification is paused for BT-009; the six witnesses, next/final flow, menu layouts, editor round-trip and offline completion already passed in the production browser.
- Changes: Release documentation and version 0.3.0 are prepared in the main working tree and preserved while the small feedback fix is active.
- Verification: npm run evaluate passed 87 tests/typecheck/build. Real browser void death in First steps displayed "Over the edge. Turn earlier; green ice has no brakes.", which is inappropriate for the walking lesson.
- Risks: Accept the final build only after BT-009 and the remaining resource cleanup.
- Commit: UI 4d45f66 and curriculum 21a270a are integrated; release docs/version are not yet committed.
- Resources: Orchestrator-owned release previews on 4321 and temporary embedding host 4322 remain active for verification; they will be stopped before final acceptance.
- Decisions: Released the orchestrator-release assignment on master/. to permit the single-writer BT-009 fix. Original run: ae1df791-ee88-45da-87ca-bc2da2630c7d. No worker is currently writing.

## Result

Pending.
