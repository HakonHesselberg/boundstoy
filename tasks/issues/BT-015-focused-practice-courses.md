---
{
  "id": "BT-015",
  "title": "Add three substantial single-mechanic practice courses",
  "type": "feature",
  "status": "in_progress",
  "priority": "P1",
  "depends_on": [],
  "parent": null,
  "scope": ["data/levels.ts", "data/replays.ts", "tests/courses.test.ts", "tests/guidance.test.ts"],
  "approval": "User requested more interesting levels for proper playtesting on 2026-10-09. The orchestrator selected three focused practice levels after the six existing lessons, staying below the prior ten-level cap and using existing mechanics only.",
  "assignment": {
    "owner": "practice-course-worker",
    "run": "dispatching-sync; runtime agent ID will be recorded when returned",
    "branch": "task/bt-015",
    "worktree": ".worktrees/BT-015"
  },
  "blocked_reason": null
}
---
# BT-015: Add three substantial single-mechanic practice courses

## Problem

The six existing maps are useful short lessons, but each offers only one small
application of its mechanic. The user wants more interesting courses that can
support meaningful movement/timing playtests, not just a basic capability check.

## Scope

Preserve all six current lesson definitions, IDs, replays and difficulty.
Append three compact but substantial practice levels, for nine levels total:

1. Soft ice: a continuous slalom/switchback with several distinct steering
   decisions, generous curves and safe checkpoint landings.
2. Hard ice: a routing/alignment course with several curb stops and deliberate
   relaunch directions, rather than one straight slide.
3. Pulse timing: staggered gates/crossings, readable safe staging areas and
   multiple timing decisions rather than one long gate or padded wait.

Each new level focuses on its named mechanic. Normal ground and established
static boundaries/spikes/void are allowed; no mixed soft/hard/saw/mud gauntlet.
Use only existing mechanics, renderer, controls and data interfaces.

Do not change simulation, terrain speeds/turn radius, collision, hazard rules,
respawn delay, score schema, UI, dependencies or original lesson maps.
Worker write scope is the four listed data/test files only. The orchestrator
handles documentation/version/acceptance separately.

## Acceptance criteria

- [ ] Exactly nine levels are available: the original six unchanged, plus three distinct named practice courses.
- [ ] Soft-ice practice requires at least three meaningful direction changes while gliding at full speed; a simple held direction cannot bypass it.
- [ ] Hard-ice practice requires at least three deliberate curb stops/relaunch decisions, with visible alignment choices.
- [ ] Pulse practice contains at least three unavoidable crossings with differing phases or spatial approaches; one initial wait followed by a straight walk is insufficient.
- [ ] New courses have safe checkpoints between substantial sections, clear route continuity and distinct geometry instead of repetitive hazard density.
- [ ] Every new course has a legal keyboard-only, exact-final-tick, zero-death witness visiting checkpoints in order.
- [ ] Relevant turn/alignment and timing tolerance checks show the courses are not frame-perfect; incorrect strategies test the actual lesson rather than only counting tiles.
- [ ] Native course/guidance tests, inspection for all levels, type checking/build and full production-browser acceptance pass.

## Implementation context

Use the design principles in docs/research/bounds-escape-design.md: movement
and geometry must agree; create readable decisions, not just more hazards;
checkpoint solved sections and let players observe timed gates from safety.
The old lesson witnesses last roughly 3-7 simulated seconds. The new courses
should offer substantially more decisions and space, but do not pad waiting,
repeat identical sections or chase an arbitrary duration target.

Keep maps visually manageable at phone sizes: compact routed spaces are better
than a huge board. Existing bounds allow 8-40 columns and 6-32 rows, but use
modest dimensions unless a larger layout is necessary. Soft ice turns at 3.2
radians/second at 4.4 tiles/second (minimum radius about 1.38 tiles), never
brakes, and reflects from walls. Hard ice locks its line and stops at curbs.
No per-level tutorial popup is available; checkpoint hints must be short and
route markers/layout should do most of the teaching.

## Verification

Add failing curriculum/practice assertions, author layouts and legal witnesses,
then iterate. Preserve existing concept and timing regressions. Run targeted
course/guidance tests, npm run evaluate, all inspect witnesses and
npm run test:browser. If a specific manual visual review helps, use only an owned
preview on 4335 and isolated browser context boundstoy-bt015; stop it afterward.
No untrusted game/map installation or solver dependency.

## Handoff

Pending.

## Result

Pending.
