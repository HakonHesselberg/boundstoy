---
{
  "id": "BT-012",
  "title": "Accept the combined browser hardening batch",
  "type": "chore",
  "status": "ready",
  "priority": "P1",
  "depends_on": ["BT-002", "BT-011"],
  "parent": "BT-010",
  "scope": ["README.md", "docs/TESTING.md", "docs/ARCHITECTURE.md", "tasks/"],
  "approval": "Approved as bounded integration/acceptance of BT-010 under the user's follow-up issue-fixing request.",
  "assignment": null,
  "blocked_reason": null
}
---
# BT-012: Accept the combined browser hardening batch

## Problem

The new browser runner and idle-aware render loop must work together, not merely
pass separately in their worktrees. Their acceptance and usage need durable
documentation and issue evidence.

## Scope

The orchestrator reviews scoped commits, integrates them, runs the new browser
command against the combined production build, verifies idle/wake-up behaviour,
updates README/testing/architecture guidance, and closes accepted issues.

Do not expand into other backlog candidates or change gameplay. Reopen the
relevant worker issue for any integration defect rather than silently widening
this documentation/integration scope.

## Acceptance criteria

- [ ] The actual browser command succeeds against the integrated build and surfaces a real failing assertion as a nonzero failure.
- [ ] All current level witnesses and input/editor/save behaviour remain valid.
- [ ] Settled pause/hidden states stop drawing, and resize/resume/debug stepping redraw correctly without simulation drift.
- [ ] Commands, prerequisites, cleanup guarantees and untested limitations are documented accurately.
- [ ] Full evaluation passes, the tree is clean after authorized commits, and no owned test server/browser is left running.

## Implementation context

Native Node tests remain the default portable evaluation path. The browser
command may require an installed compatible Chromium executable; absence must
be an explicit error, not a silent pass. No global browser/profile may be reused.

## Verification

Run each worker's documented checks and npm run evaluate on master after
integration. Inspect real browser output/artifacts and compare the paused-frame
measurement with the recorded baseline. Record commit IDs and cleanup evidence.

## Handoff

Pending.

## Result

Pending.
