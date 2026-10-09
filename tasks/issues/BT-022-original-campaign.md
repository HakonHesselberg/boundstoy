---
{
  "id": "BT-022",
  "title": "Author a wholly original bounds and escape campaign",
  "type": "feature",
  "status": "in_progress",
  "priority": "P1",
  "depends_on": [],
  "parent": "BT-021",
  "scope": ["data/levels.ts", "data/replays.ts", "tests/courses.test.ts", "tests/recovery.test.ts", "tests/guidance.test.ts", "tests/hazard-visuals.test.ts", "tests/mobile-readability.test.ts", "tests/browser/scenarios.ts", "README.md", "CLAUDE.md", "docs/GAME_SYSTEMS.md", "docs/ARCHITECTURE.md", "docs/TESTING.md"],
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

- [ ] Every shipped level is new, rather than a renamed or transformed old map.
- [ ] A cohesive progression teaches and practices existing movement and timing.
- [ ] Each level has an exact deathless replay and safe checkpoint recovery.
- [ ] Tests demonstrate meaningful route decisions and forgiving opening timing.
- [ ] All tests and build pass; browser fixtures target the new courses.
- [ ] Documentation removes obsolete preservation/prototype campaign claims.

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

Pending. Worker may edit only declared scope, must not write task records,
must not commit or push. Orchestrator reviews and integrates the scoped diff.
No browser server unless needed for verification; report and stop owned resources.

## Result

Pending.
