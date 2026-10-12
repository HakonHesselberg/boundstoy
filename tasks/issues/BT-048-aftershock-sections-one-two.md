---
{
  "id": "BT-048",
  "title": "Author the sequential-wake and temporary-refuge sections",
  "type": "feature",
  "status": "done",
  "priority": "P1",
  "depends_on": ["BT-040"],
  "parent": "BT-024",
  "scope": ["data/aftershock-world.ts", "data/aftershock-world-replays.ts", "tests/aftershock-world-sections.test.ts", "tests/fixtures/aftershock-world-failures.ts"],
  "approval": "2026-10-10 user approved implementation of the entire BT-038 plan with bounded subagents where helpful.",
  "assignment": {
    "owner": "orchestrator",
    "run": "183b57e8-2976-4cc3-88cc-7f7536f244de",
    "branch": null,
    "worktree": "."
  },
  "blocked_reason": null
}
---
# BT-048: Author the sequential-wake and temporary-refuge sections

## Problem

The full world needs an accessible but meaningful opening that teaches reading
an explosion sequence and leaving temporary safety, not repetitive tiny gates.

## Scope

Author sections one and two in the agreed global-section contract: follow a
sequential explosion wake, then traverse a longer chain with refuge pockets
that subsequently detonate. Include safe observation and completion landings.
Do not reuse the rejected layouts or register a partial world as the campaign.

## Acceptance criteria

- [x] Each section has a distinct A-to-B decision and an exact legal ordinary input witness.
- [x] Spent visual aftermath is harmless, warning remains 27 ticks and each explosion is lethal for one tick only.
- [x] Interior refuge pockets expire; intentional stationary and mistimed strategies fail for the intended reasons.
- [x] Each completion checkpoint is safely beyond the solved puzzle, covers intended routes and remains safe across all local phases.
- [x] Launch and in-field decision margins, waiting opportunities and actual death-to-recovery paths are measured over the full local cycle.
- [x] At least one worthwhile faster strategy across the pair saves real travel or waiting rather than exploiting padded comparison routes.

## Implementation context

Implementation approved; BT-038's section concepts and timing targets are hypotheses.
Use BT-039 assembly conventions and BT-040 continuous clocks. Entry phase must
not be assumed zero after a death. Successful normal routes should tolerate
real human inputs; exact replays do not prove enjoyment.
This issue shares data/test files with other content batches: do not run their
writers concurrently, despite independent prerequisites.

## Verification

TDD in `tests/aftershock-world-sections.test.ts` with input-only failure and
recovery fixtures; record exact route ticks, contiguous launch bands, local
decision delays and maximum safe-entry waits. Run that targeted test,
`npm test` and `npm run build`. Final production-camera and whole-world
acceptance belongs to BT-052; no intermediate user gate is required here.

## Handoff

Worker 96db83f9-9aee-4489-af86-62fcf6aaede7 returned its implementation and
durable evidence in `artifacts/bt048/handoff.json`. Parent scope review found
only the four allowed new source/test files. Parent then reproduced a joined
necessity failure: holding right from the real start wins at tick 1220, faster
than either proposed route, avoiding both refuge decisions at actual arrival
phase 153. Local phase-zero failure tests missed this. Initial acceptance was withheld.
The synchronous worker cannot receive follow-ups; it is stopped/idle and no
replacement was launched. The orchestrator owns direct correction and review.

Assigned one serial-primary worker, 96db83f9-9aee-4489-af86-62fcf6aaede7.
Baseline: master d069ba5aecedb3dab027f08d4ccecc65bd9233ff plus
accepted BT-037/039/040/041/042/043/044/045/046/047 and preserved rendering.
340 tests and production build pass. Snapshot inventory/hashes and tracked
patch are in session `files/pre-bt048-hashes.json` and `files/pre-bt048.patch`.
Only this worker writes code; orchestrator retains tracker ownership.
No commits, production registry changes, new mechanics or concurrent content
writers are authorized. Stop after the opening pair and return actual evidence,
not a gameplay-enjoyment claim.

- Summary: Opening fragments accepted after parent correction of joined
  necessity. The shelter's authored phase now matches actual continuous arrival,
  without changing clocks, physics, geometry or adding comparison waits.
- Changes: Four scoped data/test files; exact ordinary/faster inputs, expiring
  pockets, safe landings, all-cycle measurements and input-driven failures.
  Parent added joined omission and full-cycle in-field margin regressions.
- Verification: Parent passed 16/16 targeted tests, 356/356 full tests and
  production build. Logs: session `files/bt048-targeted.log` and
  `files/bt048-integration.log`. Initial joined-bypass regression failed before
  the correction; blind forward now dies at tick 853 after checkpoint one.
- Risks: No human enjoyment/readability or final-world camera acceptance.
  Both bounded fixture goals are test boundaries, not campaign exits.
  The original worker handoff/exploration predates phase correction; final
  parent logs and `artifacts/bt048/parent-exploration.json` supersede those
  timing/failure expectations. Later composition must recheck actual arrival.
- Commit: None; four new untracked files in the serial-primary dirty tree.
- Resources: No owned processes, previews, browser contexts or workers remain
  running; all parent checks completed synchronously.
- Decisions: Preserve both fragment checkpoint completions when appending
  section three. Outgoing floor is (40,3), facing east. Fields use global
  coordinates with rows local to section bounds. Do not register partial worlds.

### Accepted measurements

All pulses use a 480-tick cycle. Local ordinary routes remain 520 / 718 ticks;
the shelter faster route is 614. Joined routes are 1352 / 1247 ticks, saving
105 movement ticks and 3.15 tiles without waiting padding. The first checkpoint
is collected at tick 507; shelter entry is reached at tick 633, phase 153.
Blind forward and omission of the ordinary upper transfer now actually fail
at that joined arrival; the faster diagonal earns an earlier return.

Inclusive joined ordinary launch bands modulo 480:
`[0,35], [92,382], [475,479]`; fast:
`[0,23], [109,392], [475,479]`. Maximum next-entry waits are 92 / 85 ticks.
Actual joined in-field ordinary decision bands contain at least 36 consecutive
delay choices; faster decisions at least 24. Full bands and reached positions
are emitted by the targeted tests.

Standalone shelter launch bands are `[0,55], [128,188], [245,479]` ordinary,
`[0,69], [146,176], [263,479]` fast; maximum waits 72 / 86 ticks.
Wake bands are `[0,392], [475,479]`, maximum wait 82 ticks.
All 480 initial phases produce actual death-respawn-success paths per section.
All 36 pulse sites have legal stationary deaths and recovery, including all
possible detonation/respawn residues and actual joined checkpoint recovery.
Continuous-radius seam coverage and landing safety remain verified.

## Result

- Summary: Accepted as unregistered opening content, not a complete game/world.
- Verification: 356 passing tests, build, exact legal routes, joined necessity
  failures, complete phase/margin exploration and checkpoint recovery.
- Integration: Existing accepted sources/rendering preserved. Production bundle
  remains unchanged and does not include these authoring fixtures. BT-052 owns
  final assembly, registration and production-camera evidence.
