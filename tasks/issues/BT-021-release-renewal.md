---
{
  "id": "BT-021",
  "title": "Replace the prototype with an original release candidate",
  "type": "epic",
  "status": "in_progress",
  "priority": "P1",
  "depends_on": [],
  "parent": null,
  "scope": ["."],
  "approval": "2026-10-09 user authorizes entirely new levels inspired by StarCraft bounds and Warcraft III escape maps, creative redesign, autonomous implementation and reviewed local commits without pushing; initial specialist audit and up to five implementation/review rounds. Browser first; Steam Very Positive is a benchmark, not a promised rating. Human validation remains outstanding.",
  "assignment": null,
  "blocked_reason": null
}
---
# BT-021: Replace the prototype with an original release candidate

## Problem

The current game is a mechanically sound prototype, not an accepted indie
release. The user explicitly rejects retaining, renaming or lightly modifying
the current campaign. Assess player experience with specialist perspectives,
replace the campaign, then improve and reassess within five bounded rounds.

## Scope

Entirely original campaign of at most ten courses using the four existing
movement surfaces and existing hazard systems. Original procedural presentation,
player-facing progression and release verification are in scope. No copied
maps/assets, new backend, accounts, telemetry, purchases, publication or pushes.
This approval supersedes the previous requirement to preserve prototype lessons
and Pocket wave. Existing movement physics and custom level compatibility stay.

## Acceptance criteria

- [ ] Every shipped course has a new layout, identity and authored replay.
- [ ] Specialist gameplay, UX/art and QA findings inform bounded improvements.
- [ ] Integrated campaign and player journey pass automated and browser checks.
- [ ] Documentation and local commits describe the actual release candidate.
- [ ] Final assessment identifies unresolved quality risks and human playtesting.

## Implementation context

Baseline e9a1eaa; clean master. All 20 existing tracker issues are done.
Baseline npm test passes 181 tests. Read-only specialist agents:
gameplay 674ea1f3-a6f7-4b0f-81a2-2f69c7469f33,
UX/art 1e8e1d8e-d00f-4bdf-9a52-83e1f331b731,
QA 2db45663-0bc6-4565-b937-f01d3b851b63.
Initial browser inspection at 1440x900 confirms the prototype entry screen,
full-board view and procedural visuals; it does not establish player enjoyment.

## Verification

Use failing tests before implementation, npm test, npm run build,
npm run test:browser and relevant readability/recovery checks. Review before
each commit. Browser checks must exercise the actual replacement campaign,
not retain assertions against the obsolete prototype.

## Handoff

Orchestrator-owned epic. Specialist audits are read-only; implementation issues
will own bounded scopes and evidence. Local Vite review server owned by this
session uses shell 10, port 4321; isolated browser context release-review.

## Result

Pending. No claim of release readiness or likely Steam rating.
