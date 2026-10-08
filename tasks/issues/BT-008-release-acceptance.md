---
{
  "id": "BT-008",
  "title": "Verify and document the integrated consumer release",
  "type": "chore",
  "status": "done",
  "priority": "P1",
  "depends_on": ["BT-006", "BT-007", "BT-009"],
  "parent": "BT-005",
  "scope": ["README.md", "docs/", "package.json", "package-lock.json", "CLAUDE.md", "tasks/", ".github/agents/"],
  "approval": "Approved as release integration and acceptance under the user's 2026-10-08 shippable-game request in BT-005.",
  "assignment": {
    "owner": "orchestrator-release",
    "run": "ae1df791-ee88-45da-87ca-bc2da2630c7d",
    "branch": "master",
    "worktree": "."
  },
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
The orchestrator owns this integration task directly. Record a scoped bug child
or reopen the relevant child for defects rather than silently expanding scope.

No external deployment, remote push, new dependencies, new game mechanics or
automatic execution of the earlier unapproved backlog. Local commits and
integration are authorized by the user's follow-up.

## Acceptance criteria

- [x] Every current level finishes through the production browser with the same result as its Node witness.
- [x] Consumer menus, campaign completion/retry, saved progress, keyboard/touch, focus/pause, mobile overlays and secondary editor flow work together.
- [x] Browser console has no application errors; requests stay local and loaded play works offline.
- [x] README, mechanics/testing/platform docs and version describe the actual release and remaining limitations.
- [x] The static build retains notices and relative paths suitable for standalone or Astro iframe hosting.
- [x] npm run evaluate passes, owned preview servers are stopped and all child issues have honest integration evidence.

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

- Summary: Version 0.3.0 is accepted as a six-level static consumer release.
- Changes: Integrated both worker deliveries, corrected the BT-009 feedback defect, updated README/architecture/mechanics/platform/testing documentation and package version, and recorded the completed issue workflow.
- Verification: npm run evaluate passed 88 tests, tracker checks, TypeScript and production build. Chromium completed all six legal witnesses at 484/435/575/520/440/806 ticks with no deaths and all checkpoints, through real next-level intros and campaign completion. Keyboard movement/release/pause, native directional pointers, menu selection, saved six-level progress, portrait/landscape bounds, editor painting/undo/JSON rejection+round-trip/playtest isolation, and offline completion passed. No application console errors; normal play exposes no debug API and only local resources. The exact built output loaded under a nested path in an iframe with working keyboard input.
- Risks: Physical mobile hardware and real Safari/Firefox are not certified. Actual Astro consumer compilation remains the separate unapproved BT-004 candidate. Existing bundle-size and headless software-WebGL warnings remain documented. Further difficulty/feel tuning is expected.
- Commit: Integrated UI 4d45f66, curriculum 21a270a and feedback e1fe4fe; release docs/version and closure are recorded by the following release commit.
- Resources: Owned previews on 4321/4322 stopped; worker preview 4323 stopped and 4324 unused. All four ports were checked non-responsive. Owned browser tabs closed; temporary embedding fixture removed. Worker branches/worktrees retained for traceability, with no worker still implementing.
- Decisions: Six focused lessons rather than ten or a mixed gauntlet. No new mechanics, runtime dependencies, remote push, deployment or execution of unrelated backlog candidates.

## Result

- Summary: All release acceptance criteria passed; the approved release epic can close.
- Verification: Combined production-browser evidence and the full repository checks support the result; this does not claim unperformed cross-browser or Astro compilation checks.
- Integration: Version 0.3.0, the static dist output and all accepted source changes are present on master. Existing records/drafts are preserved and prior combined-course scores stay separate.
