---
{
  "id": "BT-016",
  "title": "Accept and document the nine-level practice expansion",
  "type": "chore",
  "status": "done",
  "priority": "P1",
  "depends_on": ["BT-015"],
  "parent": null,
  "scope": ["README.md", "docs/", "CLAUDE.md", "package.json", "package-lock.json", "tasks/"],
  "approval": "Approved as integration/verification for the user's 2026-10-09 request for more interesting playtest levels.",
  "assignment": {
    "owner": "boundstoy-orchestrator",
    "run": "ae1df791-ee88-45da-87ca-bc2da2630c7d",
    "branch": "master",
    "worktree": "."
  },
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

- [x] Original six maps/replays are unchanged and the new courses have demonstrably more route/timing decisions.
- [x] Advanced pulse practice visibly sends a wave down the path and then detonates the pockets, with verified hide/leave windows and failure for never hiding or camping.
- [x] All nine courses finish through the production browser with exact witness results and valid progression.
- [x] New layouts, hazard phases, safe checkpoints and nine-entry menus are inspected at desktop and mobile sizes.
- [x] Documents/version and local issue evidence accurately describe the expansion without claiming unperformed human playtests.
- [x] Full evaluation/browser checks pass, commits are clean and owned test servers/browser pages are stopped.

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

- Summary: Accepted the nine-course expansion and documented release 0.4.0. The six lessons remain unchanged; three practices add repeated decisions using existing mechanics.
- Changes: README, mechanics, testing, architecture, platform and project guidance now distinguish lessons from practices. Package and lockfile version changed only; no dependencies were added or updated. Canonical BT-015/BT-016 records and generated index carry the handoff and acceptance.
- Verification: Parent evaluation passed 136 tests, typecheck and production build. Production browser report artifacts/browser-check/run-3IiDC7/report.json contains 20 passing scenario groups with all nine exact finishes, real input, three viewport layouts, direct navigation, idle behaviour, editor/saves and offline checks. Rebuilding as 0.4.0 produced the same tested JS/CSS assets.
- Risks: Human enjoyment, lane interpretation and precision on physical touchscreens remain unverified. Mobile board markers are small, particularly on the larger ice maps. The existing bundle warning, non-Chromium coverage and actual Astro-consumer compilation remain unchanged limitations.
- Commit: Curriculum 294c63e4a52fad88caae5a2afae108f63da70cd3, integrated by 56e1a31. Documentation/version/closures are in the orchestrator's following release commit on master.
- Resources: Browser report PID/process group 2835414, profile artifacts/p-yennlo and ports 33653/45989 were independently confirmed absent/stopped. Manual preview practice-visual-preview on 4336 was stopped and its port confirmed closed; isolated inspection page 18 in boundstoy-practice-acceptance was closed. Worker worktree and ignored evidence are retained.
- Decisions: No tenth level, new mechanic, per-level popup or original-lesson research tuning. Precision is intentional in Pocket wave; human play should inform subsequent tuning.

## Result

- Summary: Accepted for the requested practice-level expansion, without claiming subjective fun or complete device certification.
- Verification: Inspected each new board at desktop 1280x800 and portrait 390x844; the runner also covered landscape 844x390 and nine-entry menus. Observed the player hidden safely at tick 230, then outside pockets igniting at 333, 873 and 1371; finished at exactly 1593 with three ordered checkpoints and zero deaths. Only the pause overlay was temporarily hidden for deterministic visual inspection, not hazards or collision; normal UI checks ran separately.
- Integration: Nine-course data and replays are on master, with release 0.4.0 documentation and both approved issues closed. Existing six-course records and drafts retain their IDs/schema. Owned previews/browser pages are stopped; no push or deployment was performed.
