---
{
  "id": "BT-026",
  "title": "Author three playable Aftershock encounters",
  "type": "feature",
  "status": "done",
  "priority": "P1",
  "depends_on": ["BT-025"],
  "parent": "BT-024",
  "scope": ["data/aftershock.ts", "data/aftershock-replays.ts", "tests/aftershock.test.ts"],
  "approval": "2026-10-10 user explicitly says to stop the game and implement the new levels, following approval of Slipstream, Borrowed Ground and The Cut as the first gameplay gate.",
  "assignment": {"owner": "aftershock-level-designer", "run": "16c76d63-e65b-4eb2-a5b5-95a7ae2889e0", "branch": "task/bt-026", "worktree": ".worktrees/BT-026"},
  "blocked_reason": null
}
---
# BT-026: Author three playable Aftershock encounters

## Problem

The user rejected easy Relay routes. Deliver three genuinely new, challenging
encounters with distinct techniques and faster routes, not another tutorial.

## Scope

Slipstream, Borrowed Ground, The Cut. Normal ground, walls, void and one-tick
pulses only. New IDs. No more than 80 hazards per map. Clear and mastery
witnesses, meaningful bad strategies, measurable time/timing differences.
No UI edits or changes to movement/collision. Output three isolated data/test files.

## Acceptance criteria

- [x] Three frozen valid new maps, with short execution and safe start/finish pads.
- [x] Slipstream has meaningful moving-sequence decisions, not a single straight hold.
- [x] Borrowed Ground requires leaving temporary refuge at the right moment.
- [x] The Cut offers a materially faster riskier route, not just reduced waiting.
- [x] Legal clear/mastery witnesses, authored mastery targets and failure cases pass.

## Implementation context

Baseline d617eb8. Worker exports AFTERSHOCK_LEVELS, AFTERSHOCK_LESSONS and
AFTERSHOCK_TARGETS from data/aftershock.ts; AFTERSHOCK_REPLAYS and
AFTERSHOCK_MASTERY_REPLAYS from data/aftershock-replays.ts.
The orchestrator integrates these as the only playable campaign.
Prefer no checkpoints in these short standalone encounters; each retry should
practice the whole compact decision. The orchestrator adds opt-in pattern reset
on retry independently; raw definitions may include resetPatternOnRetry: true.

## Verification

TDD, exact keyboard replays, launch-margin measurements, actual hazard deaths
for named bad strategies, shortcut time advantage. First-clear/mastery execution
should be distinct, with no claim that automated solvability proves fun.

## Handoff

- Summary: Worker 16c76d63-e65b-4eb2-a5b5-95a7ae2889e0 delivered three authored encounters for review.
- Changes: Exactly data/aftershock.ts, data/aftershock-replays.ts and tests/aftershock.test.ts.
- Verification: Eighteen authored tests pass. Six winners, bad strategies, complete phase windows and shortcut geometry. Clear/mastery ticks 1664/1401, 1912/1672, 1587/1231; The Cut removes 11.88 tiles and 22.4% of time against a no-wait route. Mastery zero-launch windows are 13, 11 and 23 ticks.
- Risks: Automated routes do not establish human replay value or global optimality.
- Commit: Uncommitted delivery from .worktrees/BT-026, copied into primary for integration.
- Resources: Worker is idle; no persistent worker servers. Worktree and branch retained.
- Decisions: No checkpoints; normal-ground pulse-only encounters, opt-in repeatable pattern. UI integration remains orchestrator-owned.

## Result

- Summary: Accepted as three implemented encounters, not proof of replay value or a finished world. Reviewed against scoped handoff and measured authoring evidence.
- Verification: npm run release:check passes 222/222 portable tests, production gameplay, journey, explosions, six Aftershock witnesses/retries and 48 readability scenarios. Final new-level browser run-vCTrqH; artifacts/aftershock/release-check.log and board/result captures.
- Integration: All three delivered files integrated in primary working tree based on d617eb8. BT-027 owns runtime registration/UI; BT-024 remains open for human feedback.
