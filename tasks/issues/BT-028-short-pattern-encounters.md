---
{
  "id": "BT-028",
  "title": "Replace rejected encounters with three short pattern variations",
  "type": "feature",
  "status": "done",
  "priority": "P1",
  "depends_on": ["BT-026", "BT-027"],
  "parent": "BT-024",
  "scope": ["data/aftershock.ts", "data/aftershock-replays.ts", "tests/aftershock.test.ts", "tests/fixtures/aftershock-failures.ts"],
  "approval": "2026-10-10 user rejected repetitive Slipstream, implausible Borrowed Ground and The Cut; explicitly selected replacing all three with short Borrowed Ground, wider sequential corridor and alternating checkerboard encounters.",
  "assignment": {"owner": "short-pattern-designer", "run": "32c852ff-9435-4faa-a550-d64b040c343a", "branch": "task/bt-028", "worktree": ".worktrees/BT-028"},
  "blocked_reason": null
}
---
# BT-028: Replace rejected encounters with three short pattern variations

## Problem

Legal witnesses did not produce convincing gameplay. Reduce commitment length
and make the three encounters differ in spatial/timing decisions, not repeated
three-tile simultaneous gates.

## Scope

Replace all three active definitions: Borrowed Ground, Crosscurrent, Checkerboard.
Short Borrowed Ground uses a travelling sequence and temporary refuge; wide
Crosscurrent lets lateral movement interact with sequential detonations;
Checkerboard alternates all even and all odd coordinate-parity cells.
Only normal ground, walls/void and existing one-tick pulses. New record IDs.
User subsequently requires a checkpoint after every completed puzzle. Place
wide safe checkpoint pads after each sequence, with explicit trigger radius.
No physics, UI or renderer changes by the worker.

## Acceptance criteria

- [x] Three compact distinct maps, with Borrowed Ground substantially shorter than 1912 ticks.
- [x] Sequential patterns visibly travel, rather than firing a whole field at once.
- [x] Corridor width creates meaningful lateral options; checkerboard groups match coordinate parity.
- [x] Exact clear/mastery and real failure witnesses pass with measured timing/spatial tolerances.
- [x] No new movement systems, inaccessible goal, permanent hazard-free bypass or fabricated mastery padding.
- [x] Each completed sequence earns a reliably triggered checkpoint and a viable downstream retry.

## Implementation context

Baseline cefca79. Keep existing exports and 3-array ordering. The orchestrator
handles subtle alternating ground material and pulse plate presentation, plus
browser integration. Prefer 5-9 second witnessed clears, not long repeated rooms.
Test human-scale margins instead of optimizing for frame-perfect witnesses;
report any limitations without claiming replay value.

## Verification

TDD then node --test tests/aftershock.test.ts. Measure exact finish/death ticks,
full launch-cycle windows, independent transfer/turn tolerances, shorter-route
advantage where applicable. Supply input-driven failure witnesses, not teleports.

## Handoff

- Summary: Three short, distinct pattern encounters delivered; one completed hazardous puzzle and a checkpoint/safe exit per map.
- Changes: data/aftershock.ts, data/aftershock-replays.ts, tests/aftershock.test.ts and tests/fixtures/aftershock-failures.ts only.
- Verification: Author TDD initially 3 failures/1 pass, then 19/19 tests pass. Clear/mastery ticks: 752/613, 620/561, 711/503; targets 690/590/540. Complete launch windows around zero: 45/44, 142/115, 38/35 ticks. Local probes have >=25 contiguous valid delay choices. Separate checkpoint funnel test first failed before geometry correction.
- Risks: Automated solutions do not establish fun. Post-checkpoint deaths deliberately backtrack into the completed field because each map ends with a safe exit.
- Commit: Uncommitted four-file delivery from .worktrees/BT-028 at cefca79; copied into primary by orchestrator.
- Resources: Worker idle; no servers, dependencies, child agents or browser contexts created. Worktree retained with documented parent-owned checkpoint engine support.
- Decisions: User checkpoint rule applied with radius1.4 landings, >=3 tiles from every pulse. One hazardous phrase per map preserves the requested short scope. Player-facing coordinate-math copy was simplified without changing schedules.

## Result

- Summary: Accepted as the approved short pattern iteration after scoped handoff review, integrated tests and visual inspection; human replay-value acceptance remains open.
- Verification: Final npm run release:check passes 230/230 portable tests and all five production runners. New maps/checkpoints run-p60kZI; readability run-x6eEl0. Full evidence artifacts/aftershock/pattern-release-check.log and named pattern/quiet/landing screenshots.
- Integration: Four delivered files and the reviewed one-line hint revision integrated in primary based on cefca79. The worker branch/worktree remain retained; no push.
