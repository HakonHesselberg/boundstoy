---
{
  "id": "BT-064",
  "title": "Diagnose the native continuation fixture reload stall",
  "type": "bug",
  "status": "backlog",
  "priority": "P1",
  "depends_on": ["BT-045"],
  "parent": "BT-038",
  "scope": ["tests/browser/continuation.ts", "tests/browser/runtime.ts", "application/indexeddb.ts", "application/run-storage.ts", "application/run-continuation.ts", "tasks/issues/"],
  "approval": null,
  "assignment": null,
  "blocked_reason": null
}
---
# BT-064: Diagnose the native continuation fixture reload stall

## Problem

During BT-063 regression checks, the isolated `constructor` world fixture
repeatedly stalled at its mid-respawn reload (`continuation.ts:104`).
The same failure reproduces with the accepted pre-change Scene, so this is
not evidence of a checkpoint-pan regression. It nevertheless blocks a fresh
all-green native continuation/platform qualification claim.

## Scope

Determine whether the stall comes from the native harness, Chromium lifecycle,
or application persistence. Diagnose before proposing a bounded fix. Preserve
IndexedDB authority and ownership semantics; do not mask failed reloads with
longer timeouts, skipped scenarios or memory-only fallback.

## Acceptance criteria

- [ ] Identify the blocked operation with native evidence, distinguishing navigation completion, document lifetime, lock ownership and IndexedDB activity.
- [ ] A justified correction has a failing regression first and passes the complete native continuation suite.
- [ ] Recheck production-world checkpoint death/reload recovery and storage ownership.
- [ ] Record actual browser/version and remaining platform limitations without claiming untested compatibility.

## Implementation context

Chrome 151.0.7922.137, isolated profiles, sandbox enabled, SwiftShader.
Earlier moving reload, cancelled replacement, editor isolation, periodic saves,
and continued deathless completion all passed. The next dying-state reload
timed out after 15 seconds. One failure image showed the initial world with
"Loading save..."; other attempts could not capture an attached page.
No application console error established a cause.

The production world independently passed all seven checkpoint
death/reload/respawn/downstream recoveries and exact final-puzzle reloads at
three viewports under both motion preferences. Do not generalize the fixture
failure to every production reload, or dismiss it because those checks pass.

## Verification

Run `node tests/browser/continuation.ts --timeout 600000` in an owned isolated
profile. Current failure evidence: `artifacts/browser-check/run-MghqYv` and
`run-k2bJww`. The pre-change Scene control also failed at the same point:
`artifacts/browser-check/run-bDXw3u`, fixture
`artifacts/continuation/run-SY65BE`.

Session logs are `files/bt063-continuation.log`,
`files/bt063-continuation-retry.log`, and
`files/bt063-continuation-control.log` under session
`183b57e8-2976-4cc3-88cc-7f7536f244de`. The control used the preserved
`bt052-baseline/presentation/scene.ts` via a test-only Vite override; it did
not revert the checkout or alter the production build.

## Handoff

Discovered during camera verification; not executed as an unapproved
persistence implementation change. BT-062 must resolve this qualification
gap before claiming fresh native continuation acceptance.

## Result

Pending investigation and approval.
