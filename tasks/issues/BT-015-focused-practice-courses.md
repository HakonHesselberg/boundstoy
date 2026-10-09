---
{
  "id": "BT-015",
  "title": "Add three substantial single-mechanic practice courses",
  "type": "feature",
  "status": "done",
  "priority": "P1",
  "depends_on": [],
  "parent": null,
  "scope": ["data/levels.ts", "data/replays.ts", "tests/courses.test.ts", "tests/guidance.test.ts"],
  "approval": "User requested more interesting practice levels on 2026-10-09, then explicitly requested a hard precise bounds-style path wave followed by delayed pocket explosions. Keep six lessons plus three focused practice levels, below ten total, using existing mechanics only.",
  "assignment": {
    "owner": "practice-course-worker",
    "run": "75768603-f360-4cf6-a1d9-dba0063209f2",
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
3. Pulse timing: a hard bounds-style tight path with side pockets. An explosion
   wave travels along the path, then the pockets detonate after a short delay.
   Players must enter pockets to avoid the wave and leave before the pocket
   blasts. Multiple enter/leave decisions, not a single gate or padded wait.

Each new level focuses on its named mechanic. Normal ground and established
static boundaries/spikes/void are allowed; no mixed soft/hard/saw/mud gauntlet.
Use only existing mechanics, renderer, controls and data interfaces.

Do not change simulation, terrain speeds/turn radius, collision, hazard rules,
respawn delay, score schema, UI, dependencies or original lesson maps.
Worker write scope is the four listed data/test files only. The orchestrator
handles documentation/version/acceptance separately.

## Acceptance criteria

- [x] Exactly nine levels are available: the original six unchanged, plus three distinct named practice courses.
- [x] Soft-ice practice requires at least three meaningful direction changes while gliding at full speed; a simple held direction cannot bypass it.
- [x] Hard-ice practice requires at least three deliberate curb stops/relaunch decisions, with visible alignment choices.
- [x] Pulse practice has a visibly ordered path wave and delayed pocket explosions, requiring at least three precise hide/leave decisions.
- [x] Behavioural tests demonstrate that staying on the path fails, camping in a pocket fails after its delay, and correctly timed pocket entry/exit survives.
- [x] New courses have safe checkpoints between substantial sections, clear route continuity and distinct geometry instead of repetitive hazard density.
- [x] Every new course has a legal keyboard-only, exact-final-tick, zero-death witness visiting checkpoints in order.
- [x] Turn/alignment margins remain practical in the ice courses. The advanced pulse course intentionally has tighter movement/timing windows; tests establish a finite feasible window and report its exact margins instead of enforcing the beginner-level generosity.
- [x] Native course/guidance tests, inspection for all levels, type checking/build and full production-browser acceptance pass.

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

The user's follow-up explicitly requests hard, precisely timed explosions in
the StarCraft bounds style. This supersedes the earlier generic forgiving-gates
direction for the pulse practice course only. Implement the travelling wave and
delayed pocket blasts using existing pulse period/on/phase offsets, not a new
hazard type. Preserve clear warning/footprints and safe checkpoint staging;
precision should arise from timing and movement, not invisible collisions.
The active worker received this amendment through its recorded agent ID.

## Verification

Add failing curriculum/practice assertions, author layouts and legal witnesses,
then iterate. Preserve existing concept and timing regressions. Run targeted
course/guidance tests, npm run evaluate, all inspect witnesses and
npm run test:browser. If a specific manual visual review helps, use only an owned
preview on 4335 and isolated browser context boundstoy-bt015; stop it afterward.
No untrusted game/map installation or solver dependency.

## Handoff

- Summary: Worker delivered three focused practice courses; the original six definitions, lessons and replays are unchanged.
- Changes: Only data/levels.ts, data/replays.ts, tests/courses.test.ts and tests/guidance.test.ts. Switchback sweep is 22x19 with seven witness steering arcs and two checkpoints; Three curb route is 19x18 with three curb relaunches/checkpoints; Pocket wave is 16x16 with three lane/pocket sequences and three checkpoints.
- Verification: Worker evaluation passed 136 tests, typecheck/build, all nine inspect witnesses and production browser acceptance. New exact finishes are 1277, 1580 and 1593 ticks with no deaths. Soft turn boundaries tolerate +/-10 ticks; hard alignment tolerates +/-10 and combined curb arrivals +/-18. Pulse launch/dwell windows contain 19 legal tick choices per section; all 240 straight-launch phases and camping fail. Evidence: worker artifacts/bt015-evaluate.log, artifacts/bt015-inspect-*.txt and artifacts/browser-check/run-kh5afs/report.json.
- Risks: Synthetic solutions do not establish enjoyment. Mobile route markers are small, especially on the larger ice maps; hard-ice lane interpretation and intentionally demanding pulse timing need human play.
- Commit: 294c63e4a52fad88caae5a2afae108f63da70cd3 on task/bt-015, based on b1c2c75aeb05777cb224e91c54d0aa377ae3c311. The user amendment recorded in dcd983f was sent to the same worker.
- Resources: Worker reported its preview/context stopped and isolated browser runs cleaned. Its worktree remains for traceability. Orchestrator visual resources belong to BT-016.
- Decisions: Existing 240-tick pulse cycles, 12-tick travelling offsets and pocket ignition 28 ticks after the adjacent lane clears implement the hard challenge without new mechanics. Original lessons retain their generous timing.

## Result

- Summary: Accepted after scoped code/test review, integration and independent production-browser verification.
- Verification: Parent npm run evaluate passed all 136 tests and the static build. Parent npm run test:browser passed all nine exact finishes, ordered checkpoints, progression, desktop/portrait/landscape controls, editor, saves and offline checks; report artifacts/browser-check/run-3IiDC7/report.json. Deterministic visual inspection confirmed safe hiding at tick 230 and successful exits as pockets ignite at 333, 873 and 1371, followed by the 1593-tick finish.
- Integration: Worker commit 294c63e is integrated into master by merge 56e1a31. Physics, renderer, UI, dependencies and original lesson data are unchanged. Release documentation and resource-cleanup acceptance continue in BT-016.
