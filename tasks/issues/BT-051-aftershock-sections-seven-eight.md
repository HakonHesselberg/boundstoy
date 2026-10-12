---
{
  "id": "BT-051",
  "title": "Author coupled rhythms and the Aftershock finale",
  "type": "feature",
  "status": "done",
  "priority": "P1",
  "depends_on": ["BT-048", "BT-049", "BT-050"],
  "parent": "BT-024",
  "scope": ["data/aftershock-world.ts", "data/aftershock-world-replays.ts", "tests/aftershock-world-sections.test.ts", "tests/fixtures/aftershock-world-failures.ts"],
  "approval": "2026-10-10 user approved implementation of the entire BT-038 plan with bounded subagents where helpful.",
  "assignment": {
    "owner": "bt051-finale-content",
    "run": "17038fd8-fe60-403d-be55-84d316d7a831",
    "branch": null,
    "worktree": "."
  },
  "blocked_reason": null
}
---
# BT-051: Author coupled rhythms and the Aftershock finale

## Problem

The world needs a satisfying escalation and ending, not a stitched replay of
previous rooms or an unrelated final mechanic.

## Scope

Author section seven around interacting familiar rhythms and section eight as
a coherent final A-to-B challenge using a restrained selection of proven ideas.
Section seven leads to the last safe checkpoint; section eight ends directly
at the world exit. Preserve existing movement and one-tick pulses.

## Acceptance criteria

- [x] The pair escalates route/timing decisions without requiring an unexplained mechanic or a single exact input tick.
- [x] Temporary interior positions expire where intended; normal recovery remains possible from every local arrival phase.
- [x] Ordinary and faster legal witnesses show genuine technique/route benefit rather than extra filler.
- [x] Section seven collects checkpoint seven only after its puzzle; no checkpoint exists on the final exit approach.
- [x] The finale is one coherent candidate puzzle, with measured execution length and decision margins, not a concatenation of solved sections; human worthwhileness remains BT-053.
- [x] All intended failures, bypass checks and checkpoint/exit interactions have executable evidence.

## Implementation context

Implementation approved; build from the actual earlier sections rather than locking in
BT-038's working names. Its 15-25-second finale execution range is a starting
hypothesis, not an approved minimum. Do not extend a good short finale merely
to meet a duration. Human acceptance waits for BT-053's full-world playtest.

## Verification

TDD in `tests/aftershock-world-sections.test.ts`, including all local phases,
decision-delay margins, input-driven death/recovery, final checkpoint/exit
ordering and omitted-technique failures. Run the targeted test,
`npm test` and `npm run build`. BT-052 owns the end-to-end joined witness.

## Handoff

Assigned one serial-primary worker, 17038fd8-fe60-403d-be55-84d316d7a831.
Baseline master d069ba5aecedb3dab027f08d4ccecc65bd9233ff plus
accepted foundations and six unregistered sections, with 381 tests and
production build passing. Exact shared-file copies: session
`files/bt051-baseline/`; inventory: `files/pre-bt051-hashes.json`.
Only this worker writes code; parent owns tracker. No commits, new mechanics,
production registration or publication authorized.

- Summary: Added coupled crossing and a single turning-current finale; complete
  unregistered world has eight sections, seven checkpoints and explicit final goal.
- Changes: Four scoped files; goal-only final fragment, complete-world witnesses,
  exact failure fixtures, full-cycle margins/tradeoffs and recovery evidence.
  Earlier exported data, witnesses and test bodies are preserved.
- Verification: Worker handoff/diff and RED/final logs in `artifacts/bt051/`.
  Parent independently passed 55 targeted tests, all 395 tests and production
  build after reading the scoped diff. Session logs `files/bt051-targeted.log`
  and `files/bt051-integration.log`. All seven checkpoint recoveries run in the
  full composition; last goal contact freezes both clocks exactly.
- Risks: Acceptance here covers authored structure and executable evidence, NOT
  human worthwhileness. The coherent single-basin finale is about seven seconds,
  below the duration hypothesis; no filler was added. Human/camera acceptance
  stays BT-052/053. Fixed all-fast script has an 835-tick global launch gap;
  local useful waits are at most 160 and comfortable recovery at most 301.
- Commit: None; `artifacts/bt051/changes.diff` against the saved primary baseline.
- Resources: All owned commands complete; no servers, browser contexts,
  previews or running workers.
- Decisions: `completeEight` is still an authoring identity, 65x46 tiles,
  226 hazards, combined cycle 1440. BT-052 chooses production identity and
  registers only the complete world. Last goal is (29,44); last checkpoint
  (17,27), beyond puzzle seven and outside puzzle eight.

### Accepted measurements

Whole-world ordinary/faster witnesses: 5752 / 5038 ticks (47.93 / 41.98 seconds),
714 ticks and 21.42 tiles saved with every nominal tick moving. Section-seven
entries are 4199 / 3678; finale entries 4899 / 4244. Last checkpoint is collected
at 4773 / 4118, with the body clear of the last section-seven pulse.

At ordinary arrival, west crossing beats waiting for the inside crossing by
20 ticks; the finale bank route beats waiting for the diagonal by 27 ticks.
At faster arrivals the shorter alternatives are available. Both advantages
exchange across the local cycle, and copied wrong-phase alternatives really die.
All moving-turn bands contain at least 20 contiguous early/late choices, with
wall stalls excluded; nominal local-delay bands contain at least 24.

Both new sections cover every local incoming and real checkpoint-release phase,
all 20 named failures and all 117 new pulse-site expiry/recovery approaches.
The saw may kill first at crossing-row sites; full pulse-footprint coverage
independently establishes eventual pulse exposure there. Seven complete-world
checkpoint disks remain separated from all neighboring hazard sweeps.
Detailed inclusive bands and exact reached states are in the handoff and tests.

## Result

- Summary: Accepted as complete unregistered content, not a production game or
  a substitute for the user's full-map gameplay acceptance.
- Verification: Parent independently passed 395 tests and production build;
  reviewed actual arrivals, route tradeoffs, geometry, recovery and goal ordering.
- Integration: No production registry changes. Earlier foundations/content and
  inherited rendering preserved. BT-052 must integrate, capture and exercise
  the real application before requesting the user's complete-map playtest.
