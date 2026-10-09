---
{
  "id": "BT-021",
  "title": "Replace the prototype with an original release candidate",
  "type": "epic",
  "status": "done",
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

- [x] Every shipped course has a new layout, identity and authored replay.
- [x] Specialist gameplay, UX/art and QA findings inform bounded improvements.
- [x] Integrated campaign and player journey pass automated and browser checks.
- [x] Documentation and local commits describe the actual release candidate.
- [x] Final assessment identifies unresolved quality risks and human playtesting.

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

- Summary: Bounded renewal effort completed with an original eight-course Relay
  campaign and player-facing polish, not a promised commercial reception.
- Changes: Five rounds covered original campaign authoring; onboarding/progress/
  sound; review-driven focus and audio-start corrections; observation/approach
  hazard readability; integrated browser, touch, visual and embedding acceptance.
- Verification: 187 portable tests, 11048 phase-specific recovery runs, eight
  exact deathless witnesses, full production browser journey, 60 real-pixel
  cases and both real Astro bases passed. Evidence in child issue records.
- Review: Gameplay research emphasized original route composition, safe
  observation and cheap retries. QA separated technical checks from human fun.
  Independent code reviews found three concrete issues and drove tested fixes.
  Final UX/art review of all eight boards plus portrait/landscape entry returned
  GO for visual presentation of a polished free browser microgame, with small/
  wordy hints and similar player/checkpoint rings classified as minor polish.
- Commit: 568660c contains player journey changes; original campaign and
  acceptance records committed together in the final local implementation commit.
- Resources: Isolated automated browser/preview resources cleaned; development
  review server and owned review tabs stopped at handoff. Worker worktree retained.
- Risks: Human comprehension, enjoyment, repeat-play value, physical touch,
  Firefox/WebKit and broad hardware/audio comfort remain unverified.
- Decisions: Browser-first, free microgame assessment; no purchases, copied maps,
  new mechanics, dependencies, backend, publication or pushes.

## Result

- Summary: Technical and visual GO for a controlled browser release-candidate
  playtest. NO certification that the game would receive Very Positive on Steam.
  This closes the agreed bounded implementation/review effort, not external
  human validation or a commercial release decision.
- Verification: Combined release gate and independent final visual review pass.
  One local Intel/Mesa 1440x900 sample measured 16.7 ms median / 16.8 ms p95 RAF,
  with a 133.4 ms maximum hitch; this is not an input-latency or device guarantee.
- Integration: BT-022 and BT-023 accepted in primary; reviewed local commits,
  nothing pushed. Durable evidence and limitations are in docs/TESTING.md.
- Remaining release gates: Recruit first-time players to test unaided controls/
  hazard comprehension, fair-feeling difficulty and desire to replay. Validate
  real touch devices, Firefox/WebKit and the intended audio/hardware range.
  Do not reinterpret automation or specialist opinion as measured player sentiment.
