---
{
  "id": "BT-050",
  "title": "Author combined-hazard and meaningful route-choice sections",
  "type": "feature",
  "status": "done",
  "priority": "P1",
  "depends_on": ["BT-048", "BT-049"],
  "parent": "BT-024",
  "scope": ["data/aftershock-world.ts", "data/aftershock-world-replays.ts", "tests/aftershock-world-sections.test.ts", "tests/fixtures/aftershock-world-failures.ts"],
  "approval": "2026-10-10 user approved implementation of the entire BT-038 plan with bounded subagents where helpful.",
  "assignment": {
    "owner": "bt050-combined-content",
    "run": "2b19774d-1475-4403-a81e-d3b0fed6bd1e",
    "branch": null,
    "worktree": "."
  },
  "blocked_reason": null
}
---
# BT-050: Author combined-hazard and meaningful route-choice sections

## Problem

Middle sections should combine taught ideas and reward route/phase judgment,
not add redundant detours or unexplained mechanics.

## Scope

Author sections five and six using the pulse/saw vocabulary established by
BT-048/049. Combine a crossing with a temporary opportunity, then offer route
commitment with a real difference in exposure, distance or waiting.
Keys, switches and new hazard types are not mandatory and are not implemented
under this data-only issue.

## Acceptance criteria

- [x] Combined threats require coordination of already introduced behaviors rather than an unexplained new rule.
- [x] Route alternatives have measured tradeoffs and at least one worthwhile time-saving technique.
- [x] Ordinary and faster witnesses use legal input and survive the continuously running patterns.
- [x] Deliberate wrong route/phase decisions fail for understandable reasons.
- [x] Every intended landing/route collects the correct checkpoint without early collection or bypass.
- [x] Full-cycle recovery and measured launch/local-input margins cover the more demanding combinations.

## Implementation context

Implementation approved; BT-038's section-six interaction idea is conditional. If existing
hazards cannot produce a worthwhile decision, document the evidence and request
a bounded experimental issue specifying activation, reset, checkpoint and save
semantics before introducing a new mechanic. Do not make optional experiments
automatic dependencies or delay the whole rough map for an inventory system.

## Verification

TDD in `tests/aftershock-world-sections.test.ts` and its input failure fixtures.
Compare actual travel, waiting and route outcomes, not padded reference times.
Run the targeted test, `npm test` and `npm run build`.
BT-052 verifies production visibility, mixed cues and global arrival phases.

## Handoff

Assigned one serial-primary worker, 2b19774d-1475-4403-a81e-d3b0fed6bd1e.
Baseline: master d069ba5aecedb3dab027f08d4ccecc65bd9233ff plus
accepted foundations and first four content sections, including the parent's
BT-048 necessity correction. 368 tests and production build pass.
Exact four-file baseline is in session `files/bt050-baseline/`; inventory hashes
in `files/pre-bt050-hashes.json`. No other code writer, commits, new mechanics,
partial production registry or publication authorized. Parent owns tracker.

- Summary: Combined saw/pulse appointment and short/long arc commitment are
  implemented as unregistered fragments with a bounded six-section fixture.
- Changes: Four scoped files; optional cycle parameters preserve earlier data;
  actual-arrival routes, failure fixtures, timing tradeoffs and recovery tests.
- Verification: Durable handoff and issue-only diff in `artifacts/bt050/`.
  Parent reviewed both and independently passed 41 targeted and 381 full tests,
  then production build. Session logs `files/bt050-targeted.log` and
  `files/bt050-integration.log`. Earlier source/data/test bodies preserved.
- Risks: No human enjoyment, visual clarity or production-camera certification.
  Fixed all-fast six-section script has a 422-tick launch gap; it is optional,
  not mandatory entry/recovery waiting. Local useful waits are at most 224;
  comfortable recovery at most 246. Default full suite is about 74 seconds.
- Commit: None; primary dirty-tree changes, `artifacts/bt050/changes.diff`.
- Resources: All owned commands complete; no servers, browser contexts,
  previews or running workers.
- Decisions: Keep both completion checkpoints when appending. Outgoing floor
  (22,17), west-facing; next observation may meet (21,17). Board is 65x22.
  Cycles 480/720, combined 1440. No new mechanic or clock reset.

### Accepted measurements

Joined ordinary/faster witnesses finish at 4085 / 3564 ticks, all real movement,
saving 521 ticks and 15.63 tiles. Section-five entries are 2665 / 2343;
section-six entries 3398 / 3010. Both saw and pulse matter at the actual
arrivals, verified by named real failures plus isolated hazard counterfactuals.

At ordinary section-six arrival, the long arc takes 687 movement ticks versus
553 travel plus 175 required waiting for the tested short route, winning by
41 ticks. At faster arrival, the short arc is immediately available and saves
134 movement ticks. Advantage exchanges across the full 720-tick cycle;
neither route is an always-better untimed replacement. Cardinal forward/wait/
reverse exploration supplements the witnesses, not a claim of global optimality.

All local decision delays retain at least 24 forward choices; unblocked
early/late moving-turn bands contain at least 20 choices, above the later
12-tick hypothesis but below the early 24-tick aspiration. Complete local,
1440-tick joined launch and tradeoff bands are emitted by executable tests.
Actual checkpoint recovery covers every local incoming and checkpoint-release
phase, with comfortable launch windows. Every named pulse/saw failure also
recovers independently. All-phase trigger/neighbor safety and intended edge
approaches pass. The sixth landing is still only a bounded fixture goal.

## Result

- Summary: Accepted as unregistered sections five/six; complete world still pending.
- Verification: Parent independently passed 381 tests and production build after
  reading the scoped diff, tradeoffs, failure and continuous-clock recovery evidence.
- Integration: First-four content/foundations/rendering preserved, no production
  registration or publication. BT-052/053 retain camera/human acceptance gates.
