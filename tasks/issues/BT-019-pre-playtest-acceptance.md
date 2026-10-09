---
{
  "id": "BT-019",
  "title": "Integrate and accept the pre-playtest hardening batch",
  "type": "chore",
  "status": "done",
  "priority": "P1",
  "depends_on": ["BT-003", "BT-004", "BT-017", "BT-018"],
  "parent": null,
  "scope": ["README.md", "CLAUDE.md", "docs/", "package.json", "package-lock.json", "tasks/"],
  "approval": "User directed autonomous completion of the proposed four-part pre-playtest batch on 2026-10-09.",
  "assignment": {
    "owner": "preplay-orchestrator",
    "run": "ae1df791-ee88-45da-87ca-bc2da2630c7d",
    "branch": "master",
    "worktree": "."
  },
  "blocked_reason": null
}
---
# BT-019: Integrate and accept the pre-playtest hardening batch

## Problem

Independent readability, integration and robustness work must remain compatible
and be documented without implying that automated checks prove enjoyment.

## Scope

Integrate reviewed scoped changes, wire the optional Astro check into root npm
scripts, update related release/verification documents, and close accepted issues.
Keep the game static and dependency-light, with nine unchanged course definitions
and no difficulty changes. Do not expand into more levels or unrelated features.

## Acceptance criteria

- [x] The four accepted issues are integrated with no conflicting changes or lost existing behaviour.
- [x] All exact course witnesses, full evaluation, production browser stress checks and real Astro consumer checks pass.
- [x] Readability evidence includes actual screen-space measurements and desktop/mobile inspection.
- [x] Documentation distinguishes verified integration/robustness from remaining human and physical-device questions.
- [x] Owned resources are stopped, commits are clean, tracker evidence is complete and no remote deployment is performed.

## Implementation context

Baseline is release 0.4.0 at cd2b04a. Use at most two isolated workers, with
direct orchestrator work on the primary tree. Only the orchestrator changes
canonical tasks. Version/scripts changes do not authorize new runtime dependencies.

## Verification

Review scoped diffs and actual evidence, run combined checks and inspect the
rendered result. Verify cleanup using recorded process/profile/port identities.

## Handoff

- Summary: Integrated the complete four-part pre-playtest batch as 0.4.1, with nine unchanged courses and no new runtime dependency.
- Changes: Accepted measured mobile locators/signs, isolated real Astro consumer checks, all-phase recovery regressions, and two reproduced frame/input fixes. Added npm test:readability and test:astro commands, aligned release/architecture/testing/platform documents and closed canonical issues.
- Verification: Final npm run evaluate passed 179 checks/typecheck/build. npm run test:browser passed 23 groups; test:readability passed 36 actual-pixel cases; test:astro compiled both root and nested consumers with all nine exact offline finishes, actual fullscreen, keyboard isolation and persistence. Logs: artifacts/preplay-evaluate-final.log, preplay-browser-final.log, preplay-readability-final.log and preplay-astro-final.log.
- Risks: No human fun/difficulty or physical-device certification. Other browsers, arbitrary dense custom layouts, cross-origin embedding and host-specific policy remain outside verified scope. Existing bundle warning remains; production JS is approximately 167 KB gzip.
- Commit: Recovery 75b522f, timing/input 7364b6d, Astro merge 3cefc54 and readability merge d68ad9b, followed by the orchestrator's 0.4.1 release/evidence commit.
- Resources: Independently checked identities in 23 final/worker browser reports plus manual preview ports 4337/4339; no owned browser group/profile/listener remains. Final reports: artifacts/browser-check/run-Mcq4xa, run-lK6Rf9, and tests/astro-consumer/artifacts/run-b56ced70-49e9-4e3a-b308-2506851de5e0/. Worktrees and ignored evidence remain for traceability.
- Decisions: Keep the physical robot/collider and full-board camera; add distinct locator cues instead. Keep Astro pinned only in its private test fixture. Require fresh movement presses after clearing input, fix floating-point tick loss, preserve actual partial time and the existing stall cap. No level tuning, extra content, telemetry or deployment.

## Result

- Summary: Accepted. All four proposed pre-playtest tasks are implemented and verified in the combined release.
- Verification: Parent reviewed both scoped worker deliveries, requested and accepted Astro error-reporting/startup-race hardening, inspected integrated desktop/phone screenshots, reran all final commands sequentially, and verified cleanup from concrete resource identities. Recovery covers 4575 phase runs across all 25 spawn/checkpoint sites. Scene rebuild counts remain stable after the one-geometry locator addition.
- Integration: All changes and closures are committed on master as 0.4.1; original level/replay/terrain/core simulation files remain unchanged from cd2b04a. No remote push or deployment was performed.
