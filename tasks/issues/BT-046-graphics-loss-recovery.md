---
{
  "id": "BT-046",
  "title": "Prevent gameplay while graphics are lost and provide recovery",
  "type": "bug",
  "status": "done",
  "priority": "P1",
  "depends_on": ["BT-037"],
  "parent": "BT-038",
  "scope": ["presentation/main.ts", "presentation/scene.ts", "presentation/graphics-recovery.ts", "index.html", "tests/graphics-recovery.test.ts", "tests/browser/graphics-recovery.ts", "docs/BROWSER_CHECKS.md"],
  "approval": "2026-10-10 user approved implementation of the entire BT-038 plan with bounded subagents where helpful.",
  "assignment": null,
  "blocked_reason": null
}
---
# BT-046: Prevent gameplay while graphics are lost and provide recovery

## Problem

The review reproduced Resume advancing simulation while WebGL remained lost.
A notification alone does not prevent invisible play or further deaths.

## Scope

Introduce an explicit graphics-unavailable gate across Resume, restart, keyboard,
touch, navigation and editor playtest. Restore resources and remain paused,
or offer reload if recovery fails. Provide the lifecycle hook BT-045 will use
for saving; do not build a second persistence implementation.

## Acceptance criteria

- [x] Context loss clears input and freezes simulation/hazard clocks regardless of the active mode or input source.
- [x] No normal action resumes gameplay while graphics are unavailable.
- [x] Successful restoration redraws correct state and still requires explicit resume.
- [x] Failed restoration and unsupported startup show actionable controls rather than a playable blank screen.
- [x] Repeated loss/restoration does not accumulate renderer/listener resources or duplicate audio.
- [x] Existing pause, hidden-page and disposal behavior remains intact.

## Implementation context

Implementation approved; reproduction is recorded in `artifacts/browser-check/run-j4Shej`.
BT-037 is now code-accepted, including its live-footprint correction.
Core movement and timing rules are unchanged. BT-045 separately verifies
snapshot persistence at this gate.

## Verification

TDD for the graphics gate; run `node --test tests/graphics-recovery.test.ts`,
`npm test` and `npm run build`. In the new
`node tests/browser/graphics-recovery.ts`, inject `WEBGL_lose_context`,
try every play entry, verify exact frozen state, restore and repeat.
Check startup failure independently from recoverable context loss.

## Handoff

Assigned for serial-primary implementation under the current orchestrator.
Master base d069ba5aecedb3dab027f08d4ccecc65bd9233ff plus accepted uncommitted
BT-037/039/040/041/042/043/044. One code writer; no commits or tracker edits delegated.

The first worker (1e23c0d7-016d-4dd0-b127-26787b846d1d) wrote the implementation
and completed checks, then failed with a tool server error before returning
its handoff. A retry worker made no changes and correctly requested ownership
reconciliation. Runtime inspection confirmed the first worker failed and all
its commands exited; no competing writer remains. The orchestrator reviewed
and verified the preserved work directly, without overwriting unknown edits.

- Summary: Graphics loss closes the play gate until successful redraw and explicit resume.
- Changes: Added presentation/graphics-recovery.ts and unit/native browser regressions; integrated guards, recovery dialog and GPU-only target rebuilds in main.ts, scene.ts and index.html; documented the runner in docs/BROWSER_CHECKS.md.
- Verification: Parent ran the graphics unit regression, full npm test (326/326), npm run build, and independent native graphics, general browser and journey checks. Graphics evidence: artifacts/graphics-recovery/run-zrG6IF and artifacts/browser-check/run-CjQ28a. Existing journeys: artifacts/browser-check/run-E660Ox and run-EIfaKU. No failures.
- Risks: Real browser/driver launch qualification remains BT-062. Loss snapshot scheduling belongs to BT-045; reload currently warns about unsaved play.
- Commit: Uncommitted in the serial-primary tree at master d069ba5aecedb3dab027f08d4ccecc65bd9233ff; inherited rendering/foundation changes preserved.
- Resources: All three parent browser checks closed their owned browsers, sockets, temporary profiles and preview servers.
- Decisions: Freeze before notifying persistence; Three restores CPU-backed caches, the existing Scene rebuilds GPU-only environment/shadow targets, and no renderer/audio instance or event listener is recreated.

## Result

- Summary: Accepted after direct orchestrator integration review, not on the failed worker's unavailable handoff.
- Verification: Native loss/restoration covers exact state, clocks, input, fresh resume, same canvas, stable resources, hidden deferral and actionable startup/restoration failure. Existing keyboard/touch/editor/audio preference journeys still pass; full tests and typechecked production build pass.
- Integration: Reviewed main guards and Scene resource lifecycle, corrected a misplaced lifecycle comment and added missing runner documentation. BT-045 may now consume the once-per-loss hook; the full world and release remain incomplete.
