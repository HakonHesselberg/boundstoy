---
{
  "id": "BT-020",
  "title": "Slightly shrink the player hitbox and halve blast durations",
  "type": "feature",
  "status": "done",
  "priority": "P1",
  "depends_on": [],
  "parent": null,
  "scope": ["data/terrain.ts", "data/levels.ts", "data/replays.ts", "core/editor.ts", "presentation/main.ts", "tests/physics.test.ts", "tests/editor.test.ts", "tests/courses.test.ts", "README.md", "docs/GAME_SYSTEMS.md", "docs/TESTING.md", "package.json", "package-lock.json", "tasks/"],
  "approval": "User playtest feedback on 2026-10-09: player hitbox should be slightly smaller and explosions should last half the time.",
  "assignment": {
    "owner": "playtest-tuning-orchestrator",
    "run": "ae1df791-ee88-45da-87ca-bc2da2630c7d",
    "branch": "master",
    "worktree": "."
  },
  "blocked_reason": null
}
---
# BT-020: Slightly shrink the player hitbox and halve blast durations

## Problem

The user requests a little more collision clearance and shorter explosions
after playing the current release.

## Scope

Reduce the collision radius from 0.22 to 0.20 tiles without shrinking the art.
Halve every built-in pulse active duration and the editor's new-pulse default.
Keep periods, activation offsets, warning lead, movement and level geometry.
Explicit imported/draft JSON durations remain literal simulation ticks, not a
hidden global multiplier. Update affected timing characterizations and docs.
Leave the game available on the existing local preview after rebuilding.

## Acceptance criteria

- [x] Wall/pulse/saw collisions use a 0.20-tile player radius; art and other movement rules are unchanged.
- [x] All 30 built-in pulses have exactly half their previous active ticks, with unchanged periods and phases.
- [x] New editor pulses use 45 active ticks; editor guidance and JSON roundtrip semantics agree.
- [x] Exact witnesses, recovery and visual/hazard checks pass; changed safe windows are measured rather than retaining obsolete difficulty assertions.
- [x] Documentation and release evidence describe the tuning accurately, including any newly viable routes.
- [x] The rebuilt game responds at the existing local URL and the changes are committed.

## Implementation context

This explicit feedback supersedes earlier difficulty/fixture preservation only
for the requested tuning. Do not silently compensate with faster cycles, moved
hazards or harder geometry. Record wider safe windows if halving blasts makes
old mandatory-wait/hide assumptions untrue.

## Verification

Add exact collision-boundary, duration and editor regressions, run targeted and
full checks, then production-browser acceptance. Restart only the owned
boundstoy-game preview if needed and verify the new static assets are served.

## Handoff

- Summary: Implemented the requested tuning as 0.4.2: radius 0.22 to 0.20 and all built-in/new-editor blast durations halved.
- Changes: Updated terrain radius, pulse active ticks, editor default/help, collision/editor/timing regressions and related docs. An inverse-duration hash protects every other course field, including phases, layout, lessons and the unchanged nine reference inputs.
- Verification: New tuning regressions failed before changes. Full evaluation passes 181 tests/typecheck/build; production browser acceptance passes all 23 groups and nine exact zero-death finishes. All 36 real-pixel cases pass. Logs: artifacts/bt020-before.log, bt020-evaluate.log, bt020-browser.log and bt020-readability.log.
- Risks: Shorter blasts intentionally make initial pulse/mud crossings possible without waiting and open narrow straight-through Pocket wave windows. Existing custom JSON/drafts retain literal authored durations rather than being silently rescaled.
- Commit: Direct master changes in the orchestrator's 0.4.2 tuning commit.
- Resources: Browser reports artifacts/browser-check/run-nnuc15 and run-kFjjTA are clean; PIDs/groups/profiles/ports were independently checked. The owned boundstoy-game preview was restarted on 4321 and intentionally remains running.
- Decisions: Choose a modest 0.02-tile radius reduction, leave art and movement alone, halve active durations only, and preserve periods/start times/warnings rather than counteracting the user's requested easier timing.

## Result

- Summary: Accepted and available in the running local game.
- Verification: Pocket dwell windows are now 43-112, 42-116 and 43-107 ticks. Straight-through launch delays have narrow safe intervals 173-193, 172-187 and 172-197 relative to the reference section starts; every other phase fails. Camping still dies at the same pocket ignition. Live HTML and JS hashes match the verified production build.
- Integration: Committed on master as 0.4.2. The preview at http://127.0.0.1:4321/ serves assets/index-C6LsaL40.js; existing players need to reload. No push or deployment.
