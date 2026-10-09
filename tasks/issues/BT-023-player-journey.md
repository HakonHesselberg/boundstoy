---
{
  "id": "BT-023",
  "title": "Make onboarding and campaign progress clear and rewarding",
  "type": "feature",
  "status": "done",
  "priority": "P1",
  "depends_on": [],
  "parent": "BT-021",
  "scope": ["application/campaign.ts", "application/preferences.ts", "tests/campaign.test.ts", "tests/preferences.test.ts", "tests/audio.test.ts", "tests/browser/journey.ts", "presentation/main.ts", "presentation/audio.ts", "presentation/style.css", "presentation/tokens.css", "index.html", "package.json", "docs/BROWSER_CHECKS.md"],
  "approval": "2026-10-09 BT-021 autonomous polish approval includes player journey improvements within five rounds and reviewed local commits without pushing.",
  "assignment": {
    "owner": "release-orchestrator",
    "run": "6faada62-ebbe-4b03-aceb-bb5fab9de659",
    "branch": null,
    "worktree": "."
  },
  "blocked_reason": null
}
---
# BT-023: Make onboarding and campaign progress clear and rewarding

## Problem

The specialist UX audit found generic entry copy, no continue target, no truthful
personal-best comparison, completion tied to last-index order and an editor
return label that conceals restarting. These obscure the new campaign's value.

## Scope

Tested pure campaign selection/results helpers; visible entry controls and goal;
continue to first uncleared course; correct out-of-order completion; meaningful
best-run feedback; explicit editor restart label; persistent last-cause pause
feedback; explicit entry sound opt-in, remembered volume and bounded sound mix.
Preserve immediate next/retry, optional editor, all-level access,
existing local records and cleared input on transitions.

## Acceptance criteria

- [x] Fresh entry explains controls, goal and automatic checkpoint retries.
- [x] Reload targets the first uncleared current course, ignoring legacy IDs.
- [x] Results truthfully distinguish first clear, better, equal and slower runs.
- [x] Clearing the last missing course celebrates completion in any order.
- [x] Editor return explicitly says it restarts; pause retains last death cause.
- [x] Sound remains opt-in, remembers volume and has bounded concurrent voices.
- [x] Unit and browser verification cover the integrated journey.

## Implementation context

Read-only UX/art report from 1e8e1d8e-d00f-4bdf-9a52-83e1f331b731.
BT-022 authors new campaign data in isolation; this issue does not edit that
scope. Runtime helpers accept generic course IDs and work with either campaign.

## Verification

Node built-in tests for selection, old records, ties and result deltas.
Production browser checks: start, clear, retry, reload, out-of-order completion,
editor return, keyboard-only menu navigation and small viewport overlays.

## Handoff

- Summary: Player journey and bounded opt-in sound implemented; integration with
  the replacement campaign remains to be accepted.
- Changes: Pure campaign/results and preference helpers, visible entry guidance,
  truthful results, first-uncleared continuation, explicit editor restart,
  saved sound/volume, eight-voice cap and production journey harness.
- Verification: Initial helper/audio tests failed before implementation; 190
  Node tests and build passed. Production journey run-jyIDbC passed controls,
  legacy retention, out-of-order completion, PB comparison, real sound activation,
  keyboard-focus retention and responsive entry checks. Course screenshots were
  generated against the pre-integration campaign and are not replacement evidence.
- Review: Independent code review found skipped saved sound on direct restart
  and keyboard focus lost by disabling sound buttons. Added a failing browser
  regression, moved activation to shared play-entry loading, and retained
  focus with aria-disabled plus the existing busy guard. Rerun passed.
- Resources: Journey runners cleaned their owned profiles, process groups and
  loopback servers. Persistent development review server remains epic-owned.
- Risks: Hardware audio comfort and human comprehension remain unverified.
- Commit: Reviewed scoped diff in primary working tree; local commit pending.
- Decisions: Preserve all-course access and automatic retries; no account,
  medal system or required sound. Final acceptance waits for BT-022 integration.

## Result

- Summary: Accepted the player journey on the fully replaced campaign.
- Verification: release:check passes 187 tests, full offline browser gameplay,
  journey run-ScC8VT and 60 real-pixel cases. Journey includes simultaneous
  two-finger plus keyboard input and restart clearing; results and saved sound
  retain truthful state. Astro root/nested integration also passes.
- Integration: Runtime implemented in 568660c; combined campaign and final
  touch-input evidence accepted in primary. No public release certification.
