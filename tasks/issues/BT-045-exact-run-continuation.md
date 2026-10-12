---
{
  "id": "BT-045",
  "title": "Save and resume exact gameplay through browser lifecycle changes",
  "type": "feature",
  "status": "done",
  "priority": "P1",
  "depends_on": ["BT-044", "BT-041", "BT-046"],
  "parent": "BT-024",
  "scope": ["application/run-storage.ts", "application/run-continuation.ts", "presentation/main.ts", "presentation/scene.ts", "presentation/style.css", "index.html", "tests/run-continuation.test.ts", "tests/run-storage.test.ts", "tests/browser/", "scripts/browser-check.ts", "docs/ARCHITECTURE.md", "docs/GAME_SYSTEMS.md", "docs/BROWSER_CHECKS.md"],
  "approval": "2026-10-10 user approved implementation of the entire BT-038 plan with bounded subagents where helpful.",
  "assignment": null,
  "blocked_reason": null
}
---
# BT-045: Save and resume exact gameplay through browser lifecycle changes

## Problem

The user needs to close and continue a world without resetting hazard phase,
losing deaths or escaping back to a checkpoint for free.

## Scope

Wire the accepted snapshot/storage APIs into play, pause, death, checkpoint,
completion, menu, visibility and page lifecycle. Restore a paused exact run,
clear inputs and rebuild its section/motion presentation without phantom events.
Include functional Continue and explicit replacement/error choices; selector
polish remains BT-035 and whole-world integration is BT-052.

## Acceptance criteria

- [x] Reload during movement and respawn restores the exact committed state and waits for explicit resume with no time catch-up.
- [x] Death/respawn keep advancing both clocks; pause/menu/hidden/closed states freeze both.
- [x] Meaningful boundaries save promptly; periodic saving targets 120 ticks without claiming guaranteed crash durability.
- [x] Saving/saved/failure state follows IndexedDB transaction completion; queued writes are ordered and cannot outlive ownership or erase newer progress.
- [x] New run confirms unfinished-run replacement, and old record paths use the race-safe API rather than stale startup snapshots.
- [x] Content mismatch, corrupt/denied storage and another owning tab are visibly explained without silently discarding data.
- [x] Graphics loss persists a safe snapshot and blocks continuation until the accepted recovery flow is usable.
- [x] Continued zero-death completion retains eligibility; completion cannot resurrect an active save.

## Implementation context

Implementation approved; BT-038 records the user's exact-position decision.
The 2026-10-11 IndexedDB approval permits asynchronous commits. Enqueue saves
at meaningful boundaries, but show success only on transaction completion;
normal gameplay must not wait on storage every simulation tick. Final page
exit is best effort, never the only persistence path.
Never redirect ordinary Continue to a checkpoint. A process crash can recover
only the latest committed snapshot; preserve data and explain limitations.
Respect BT-037 interpolation interfaces: reset decorative history on restore
without modifying physics. Keep old editor drafts and records intact.

## Verification

TDD for lifecycle decisions in `tests/run-continuation.test.ts`, then
`npm test`, `npm run build` and the new `node tests/browser/continuation.ts`.
Exercise real reload, tab hiding, pointer/key clearing, BFCache where available,
mid-respawn recovery, new-run cancellation, storage failure and context loss.
Compare exact before/after state and continued replay results, not just UI text.

## Handoff

Assigned one serial-primary worker in the existing tree, with no other code
writer and no commits. Baseline: master d069ba5aecedb3dab027f08d4ccecc65bd9233ff
plus preserved rendering and accepted BT-037/039/040/041/042/043/044/046.
The write surface includes a testable application lifecycle coordinator,
tightly coupled storage-reset regressions, UI styles, and migrating existing
browser consumers of legacy localStorage to the accepted IndexedDB authority.
This implements the existing approved persistence scope, not a new product
feature or a second storage authority.

Worker d51016c7-8b31-4e75-8a27-1fa999a42c02 failed with a tool server error
after creating a partial queue/reset implementation. Runtime confirmed failure;
the orchestrator stopped its hanging test shell 447 and continued directly.
The initial retry test waited on the wrong promise, and the reset test attempted
to read while its abort injector was still enabled. After fixing those test
drivers, a new RED test exposed retry/save overtaking; the queue was corrected.
No replacement worker or competing code writer was launched.

The orchestrator implemented the actual UI/lifecycle integration and migrated
legacy browser consumers. Native RED tests caught missing periodic wiring and
inherited-property handling for the valid world ID `constructor`; both were
corrected rather than substituting codec-only checks. The general browser
runner also exposed a DOMRect rounding difference (43.999969482421875 for a
44px target, no scale/active animation); its minimum-target comparison now
tolerates only 0.001 CSSpx of numerical rounding and retains size diagnostics.

- Summary: Exact V2 continuation and transactional legacy consumers are implemented and verified in the actual application.
- Changes: Added application/run-continuation.ts, tests/run-continuation.test.ts, tests/browser/continuation.ts and tests/browser/persistence.ts. Updated run-storage/reset tests, main UI/lifecycle, index.html, status styling, browser harness/affected journeys and architecture/game/browser documentation. No production content registry or movement changes.
- Verification: Full npm test 333/333; npm run build and git diff --check pass. Native continuation: artifacts/continuation/run-rfphfI and artifacts/browser-check/run-TVyQWD. Graphics: run-PoAEb6. Final general/journey/explosions/Aftershock: run-EGkFSX, run-QL6Dmp, run-U3XlJy, run-MpOohz under artifacts/browser-check. Native storage: artifacts/run-storage/run-EGHuPP. Camera: artifacts/world-camera/run-82Y6dN and artifacts/browser-check/run-VgWX9e.
- Risks: Chromium did not retain the document in native BFCache; explicit persisted lifecycle event handlers and history reload passed. Native quota exhaustion remains unverified; injected write denial and native transaction abort passed. Both gaps remain explicit BT-062 obligations, not launch-platform certification.
- Commit: None; integrated in the existing serial-primary tree at master d069ba5aecedb3dab027f08d4ccecc65bd9233ff. Preserved inherited source/rendering changes; baseline path hashes and validation logs remain in the orchestrator session files.
- Resources: All owned browsers, auxiliary tabs/CDP sockets, profiles and ephemeral previews closed. The failed worker's hanging shell was explicitly stopped before parent implementation.
- Decisions: New-run resume waits for commit and checks focus/graphics intent. Save failure freezes visibly and retains retry operations; explicit memory-only play is never labeled saved. Reset archives stored world bytes atomically and preserves legacy records/drafts. Tests use a separate Vite fixture registry, not a shipped debug setter.

## Result

- Summary: Accepted after direct orchestrator implementation, review and full/native verification.
- Verification: Exact movement/respawn reload, checkpoint/death/120-tick saves, confirmed/cancelled replacement, async focus loss, zero-death continuation/completion, editor isolation, context loss, real two-tab handoff, corrupt/incompatible/denied paths and archive/reset all have passing evidence. Existing input, rendering, camera, audio preferences, records and import/export regressions pass.
- Integration: The real UI now uses IndexedDB authority for progress/drafts and supports registered V2 worlds without resetting their clocks or deaths on Continue. Current production content is still the three V1 prototypes; this does not complete the eight-section world, human acceptance or release.
