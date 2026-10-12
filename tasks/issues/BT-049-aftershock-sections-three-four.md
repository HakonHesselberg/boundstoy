---
{
  "id": "BT-049",
  "title": "Author saw-patrol introduction and lateral-transfer sections",
  "type": "feature",
  "status": "done",
  "priority": "P1",
  "depends_on": ["BT-040"],
  "parent": "BT-024",
  "scope": ["data/aftershock-world.ts", "data/aftershock-world-replays.ts", "tests/aftershock-world-sections.test.ts", "tests/fixtures/aftershock-world-failures.ts"],
  "approval": "2026-10-10 user approved implementation of the entire BT-038 plan with bounded subagents where helpful.",
  "assignment": {
    "owner": "bt049-middle-content",
    "run": "cb1c1294-e564-4146-adb5-299b50de28cb",
    "branch": null,
    "worktree": "."
  },
  "blocked_reason": null
}
---
# BT-049: Author saw-patrol introduction and lateral-transfer sections

## Problem

The world must develop spatial decisions and introduce saws before requiring
combined threats. More pulse tiles alone would not add depth.

## Scope

Author sections three and four: a readable moving-saw crossing without complex
simultaneous pulse demands, then lateral movement through offset travelling
explosions. Use new geometry rather than preserving Crosscurrent. Keep the
normal-ground movement contract and safe checkpoint boundaries.

## Acceptance criteria

- [x] Saw travel and crossing choices are observable from the entry before commitment.
- [x] The lateral section requires a meaningful lane/position decision, not merely more forward travel.
- [x] Each section has exact ordinary input routes and deliberate wrong-timing/position failures.
- [x] Faster technique across the pair has a measurable, legible benefit.
- [x] Checkpoint safety, all-phase recovery, launch margins and local decision margins are measured with continuous clocks.
- [x] No hazard-free bypass, checkpoint shortcut or required unseen off-screen threat is introduced.

## Implementation context

Implementation approved; BT-038 and BT-039/040 define the world rules. BT-048 is not a
technical prerequisite for these independently authored sections. Shared
data/test paths still require sequential writers and a common entry/exit
contract. Whole-world order and transitions are accepted in BT-052.

## Verification

TDD in `tests/aftershock-world-sections.test.ts`, with full local-cycle saw/pulse
phase exploration, input-driven failures and real checkpoint recovery. Record
route savings, launch/decision bands and safe-entry waits. Run the targeted
test, `npm test` and `npm run build`; BT-052 adds production captures and the
joined-world witness before the user's complete-map playtest.

## Handoff

Assigned one serial-primary worker, cb1c1294-e564-4146-adb5-299b50de28cb.
Baseline: master d069ba5aecedb3dab027f08d4ccecc65bd9233ff plus
accepted foundations through BT-047, corrected BT-048 opening content and
preserved inherited rendering. 356 tests and production build pass.
Exact copies of all four shared files are in session `files/bt049-baseline/`;
full inventory hashes in `files/pre-bt049-hashes.json`. No other code writer,
commits, publication, new mechanics or partial campaign registration authorized.
Parent alone updates canonical tracker state.

- Summary: Added saw-only patrol crossing and a south-turning lateral pulse fan;
  unregistered four-section fixture retains three real checkpoints.
- Changes: Four scoped files; minimally generalized fragment hazards/vertical
  bounds, exact ordinary/faster approaches, failures and complete-phase checks.
  Accepted opening data and original test bodies are preserved.
- Verification: Worker handoff `artifacts/bt049/handoff.json`; RED and final logs
  alongside it. Parent independently passed 28 targeted and 368 full tests plus
  production build, in session `files/bt049-targeted.log` and
  `files/bt049-integration.log`. Scope compared against saved baseline.
- Risks: Human readability/enjoyment and production camera acceptance remain
  BT-052/053. Saw endpoints extend into enclosing walls; inspect their final
  rendering. Compact middle traversal durations were not padded to targets.
- Commit: None; exact issue diff `artifacts/bt049/changes.diff`, primary dirty tree.
- Resources: All owned synchronous commands completed; no servers, previews,
  browser contexts or running workers.
- Decisions: Retain both new checkpoint completions when appending section five.
  Bounds (41,0,14,7) and (55,0,10,14); outgoing floor (58,13), facing south.
  Next observation can begin at (58,14); current map uses 65x14 tiles.

### Accepted measurements

Joined ordinary/faster routes finish at 2551 / 2229 ticks, saving 322 real
movement ticks and 9.66 tiles, with no idle or wall padding. Patrol entries
are tick 1465 / 1361; fan entries 1998 / 1828. Ordinary direct patrol and
closed inner fan choices actually die; the faster arrival supports those
shorter routes. Omitted fan transfers and blind headings die at both arrivals.

All local cycles are 480 ticks. Ordinary fan turn perturbations are [-18,9]
(28 choices); patrol [-30,30] and fast fan [-26,30] within the tested range.
Every actual-arrival local decision has at least 24 contiguous delay choices.
Full four-section launch bands: ordinary [0,35], [92,230], [301,335], [475,479];
fast [0,23], [145,151], [194,202], [285,308], [379,392], [475,479].
Maximum next useful waits are 139 / 121 ticks. Full measured local bands are
in the handoff and executable diagnostics.

Recovery covers 480 incoming phases and all 480 legal release phases from
actual checkpoints (38,3) and (52,3). Preferred recovery windows retain at
least 24 launch choices; maximum waits 93 / 142 ticks. All 32 fan sites have
input-driven stationary deaths and recovery, covering every pulse death residue.
Swept hazard/continuous-radius coverage and all-phase landing safety pass.

## Result

- Summary: Accepted as unregistered middle content, not a complete world.
- Verification: Parent reviewed the issue-only diff and handoff and independently
  passed all 368 tests and production build; no additional correction required.
- Integration: Existing opening/foundations/rendering preserved. No production
  registry change or publication. Final visible playability is still a human
  and production-camera gate, not a conclusion from these replay results.
