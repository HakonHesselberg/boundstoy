---
{
  "id": "BT-022",
  "title": "Author a wholly original bounds and escape campaign",
  "type": "feature",
  "status": "done",
  "priority": "P1",
  "depends_on": [],
  "parent": "BT-021",
  "scope": ["data/levels.ts", "data/replays.ts", "presentation/readability.ts", "tests/courses.test.ts", "tests/recovery.test.ts", "tests/guidance.test.ts", "tests/hazards.test.ts", "tests/render-loop.test.ts", "tests/hazard-visuals.test.ts", "tests/mobile-readability.test.ts", "tests/browser/scenarios.ts", "README.md", "CLAUDE.md", "docs/GAME_SYSTEMS.md", "docs/ARCHITECTURE.md", "docs/TESTING.md"],
  "approval": "2026-10-09 user explicitly requests completely new sets of levels, not the existing campaign; authorizes up to five rounds and reviewed local commits without pushing under BT-021.",
  "assignment": {
    "owner": "original-campaign-worker",
    "run": "dc8834a3-0822-4581-a4a9-814be1680b8d",
    "branch": "task/bt-022",
    "worktree": ".worktrees/BT-022"
  },
  "blocked_reason": null
}
---
# BT-022: Author a wholly original bounds and escape campaign

## Problem

The user rejects the prototype campaign in its entirety. Nine old lessons and
practices must give way to a cohesive original short skill game, informed by
the readable rhythm and safe observation areas of bounds and escape maps.

## Scope

Create eight to ten wholly original levels with new stable IDs, names, layouts,
challenge compositions, lessons and deterministic replays. Preserve four
movement surfaces and hazard mechanics, custom imports and old stored records.
Replace old course-specific acceptance tests, retaining engine coverage.
Update browser/readability references and the directly related campaign docs.
No runtime physics, UI or storage changes, no new dependency, no copied maps.

## Acceptance criteria

- [x] Every shipped level is new, rather than a renamed or transformed old map.
- [x] A cohesive progression teaches and practices existing movement and timing.
- [x] Each level has an exact deathless replay and safe checkpoint recovery.
- [x] Tests demonstrate meaningful route decisions and forgiving opening timing.
- [x] All tests and build pass; browser fixtures target the new courses.
- [x] Documentation removes obsolete preservation/prototype campaign claims.

## Implementation context

Baseline e9a1eaa, isolated worktree .worktrees/BT-022, branch task/bt-022.
Use original visual route motifs and purposeful sections, not one unchanged
bridge repeated. New campaign may combine already-taught mechanics; no new
simulation branches. Target short readable routes with unlimited automatic
retries and safe places to observe. Keep boards compact for phone readability.
Read docs/research/bounds-escape-design.md as existing source-grounded research;
additional specialist findings will be supplied if available.

## Verification

First replace/add campaign acceptance tests and observe failure against baseline.
Then implement and run npm test and npm run build. Exact witness completion,
new/disjoint IDs and layouts, checkpoint order, recovery and timing margins are
required. Update course-specific browser/readability tests without weakening
the relevant safety properties. Return all command results and known limits.

## Handoff

- Summary: Eight wholly original Relay courses delivered and integrated into
  primary for release verification. Worker did not commit or change physics.
- Changes: New course IDs, layouts, lessons, replays, course-specific tests,
  browser fixtures and campaign documentation; retired fixed-index tests migrated.
- Verification: Worker baseline 181/181; replacement RED 27 pass/5 fail;
  final isolated suite 178/178 and build passed. Eight exact deathless replays,
  11048 phase-specific recovery runs, 60 real-pixel cases and 16 offline browser
  replays passed. Intro timed crossings tolerate +/-24 ticks.
- Review: Independent review found the finale spawn locator obscured the first
  signal while observing. Orchestrator reproduced this with additional spawn
  and checkpoint tests; approach/departure samples revealed a second open-pad
  overlap. Locator now points away from nearby signals on open pads while
  preserving narrow-lane orientation. All observation/approach/center/departure
  geometry tests pass without changing the authored layouts, replays or physics.
- Commit: Scoped uncommitted diff integrated from .worktrees/BT-022 into primary;
  campaign commit waits for combined verification.
- Resources: Worker browser groups/profiles/servers cleaned. Three named
  exploration scripts removed; screenshots retained as evidence.
- Risks: Human comprehension, fun and touchscreen precision remain unverified.
- Decisions: Two stale-fixture files and the review-discovered locator fix are
  tightly coupled campaign-replacement work under the user's existing approval.

## Result

- Summary: Accepted original campaign and review-driven locator correction.
- Verification: Combined release gate passed 187 tests, production browser
  run-TTZaRp, journey run-ScC8VT and 60-pixel-case run-Nv0Cm6. Both real Astro
  bases passed all eight exact offline witnesses in run-f744701b-71af-4b5c-ad20-ef25af82d1a4.
  Desktop screenshots confirm new route geometries; human enjoyment is not certified.
- Integration: Scoped worker changes and orchestrator review fixes integrated
  into primary, committed with this acceptance record. Worker worktree retained.
