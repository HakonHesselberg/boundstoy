---
{
  "id": "BT-027",
  "title": "Support repeatable retries and independent clean records",
  "type": "feature",
  "status": "done",
  "priority": "P1",
  "depends_on": ["BT-025"],
  "parent": "BT-024",
  "scope": ["core/level.ts", "core/simulation.ts", "application/storage.ts", "application/campaign.ts", "presentation/", "data/levels.ts", "data/replays.ts", "index.html", "package.json", "tests/physics.test.ts", "tests/storage.test.ts", "tests/campaign.test.ts", "tests/browser/", "tests/aftershock-integration.test.ts", "tests/fixtures/", "tests/courses.test.ts", "tests/relay-courses.test.ts", "tests/guidance.test.ts", "tests/hazard-visuals.test.ts", "tests/hazards.test.ts", "tests/mobile-readability.test.ts", "tests/recovery.test.ts", "tests/render-loop.test.ts", "docs/", "README.md", "CLAUDE.md"],
  "approval": "Approved Aftershock plan specifies repeatable encounter practice, retained elapsed time/deaths and clean records distinct from assisted clears; 2026-10-10 user requests implementation.",
  "assignment": {"owner": "aftershock-orchestrator", "run": "6faada62-ebbe-4b03-aceb-bb5fab9de659", "branch": null, "worktree": "."},
  "blocked_reason": null
}
---
# BT-027: Support repeatable retries and independent clean records

## Problem

Precision encounters need repeatable retry timing without erasing run time or
deaths. A faster assisted finish must not overwrite a previous clean record.

## Scope

Opt-in resetPatternOnRetry for new maps; legacy maps retain their current clocks.
Use a pattern offset so existing tick-based fixtures remain valid. Rendering,
audio and collision sample the same pattern clock. Retain a best clean time
when the overall fastest run is assisted; existing saved records still load.
Orchestrator also owns the approved playable integration: replace the runtime
registry with BT-026's delivered encounters, retire Relay to test fixtures,
display authored targets/ranks and validate the new real-browser routes.

## Acceptance criteria

- [x] Opted-in retries reset pattern timing but retain elapsed time/deaths.
- [x] Collision, rendering and sound use the same hazard clock.
- [x] Existing maps and JSON retain their prior retry behavior by default.
- [x] Clean best survives faster assisted finishes and persists through reload.
- [x] Selector, Continue, results and inspection use the three new encounters only.
- [x] Mobile outcomes remain accessible and the locator stays legible during new crossings.

## Implementation context

Independent of authored level data. No change to movement or single-tick blasts.
UI targets and campaign replacement are integrated after both support and maps
are verified.

## Verification

TDD covering retry boundary, old behavior, deterministic repeated encounters,
malformed opt-in values, clean/assisted record ordering and save compatibility.

## Handoff

- Summary: Direct orchestrator implementation integrated with BT-026's delivered data.
- Changes: Pattern clock, independent clean storage/results, active registry replacement, retired fixtures, target UI, production scenarios and docs.
- Verification: TDD for retry boundaries, malformed flags, clean/assisted ordering, ranks and registry. 222 portable tests passed. Production run-Pm4FsV passes six witnesses/retries; run-euJr0S passes generic gameplay. All 36 mobile pixel samples retain >=12px; 12 desktop samples retain the original body without a locator.
- Risks: Human challenge/replay assessment remains open. No full eight-stage world yet.
- Commit: Integrated uncommitted primary worktree based on d617eb8.
- Resources: game-dev stopped at user request; isolated browser runners clean up their owned origins/processes.
- Decisions: Legacy clocks remain continuous by default. Transparent explosions exposed an 11px locator footprint; the opaque pointer now queues after effects. Landscape outcomes are checked against the actual scroll clip.

## Result

- Summary: Accepted after direct code review and full integrated evaluation. No remaining implementation blockers; no movement changes or new dependencies.
- Verification: npm run release:check passes 222/222 portable tests and production checks. Gameplay run-IQTSDz; journey run-aIqvC1; explosions run-baGJ5d; new encounters run-vCTrqH; readability run-k0Ja2g. Evidence: artifacts/aftershock/release-check.log. Mobile result captures checked against scroll clipping; 36 mobile locator measurements meet 12px and 12 desktop cases retain original presentation.
- Integration: Primary working-tree changes based on d617eb8 integrate BT-026's data as the sole playable set. No additional stages or persistent servers; game-dev remains stopped.
