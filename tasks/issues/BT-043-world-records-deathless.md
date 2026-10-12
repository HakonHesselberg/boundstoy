---
{
  "id": "BT-043",
  "title": "Record fastest world completions and separate deathless achievement",
  "type": "feature",
  "status": "done",
  "priority": "P1",
  "depends_on": ["BT-040"],
  "parent": "BT-024",
  "scope": ["application/storage.ts", "application/campaign.ts", "tests/world-records.test.ts", "tests/storage.test.ts", "tests/campaign.test.ts", "docs/GAME_SYSTEMS.md"],
  "approval": "2026-10-10 user approved implementation of the entire BT-038 plan with bounded subagents where helpful.",
  "assignment": null,
  "blocked_reason": null
}
---
# BT-043: Record fastest world completions and separate deathless achievement

## Problem

The prototype's clean-only comparisons and authored mastery targets do not
represent the user's time-first world-completion goal.

## Scope

Implement pure world-record selection, revision isolation and comparison rules.
Completion time wins; fewer deaths break equal-time ties. Deathless completion
is a separate sticky achievement, including legitimate saved continuation.
Preserve old records without counting them as new-world achievements.
Storage coordination and final UI belong to BT-044/045/052/035.

## Acceptance criteria

- [x] Faster completions beat slower ones regardless of deaths; equal-time ties prefer fewer deaths.
- [x] A later assisted personal best cannot erase a previously earned deathless achievement.
- [x] A resumed zero-death run can earn the achievement, while a run with any recorded death cannot.
- [x] Comparisons isolate content revisions and preserve old v1 progress/drafts.
- [x] The new world model requires no preset target times or checkpoint medals.
- [x] Merge operations retain independent best/deathless facts and are deterministic and idempotent.

## Implementation context

Implementation approved; BT-038 supersedes the three-course mastery direction.
Reuse `recordFinish`, `bestClean` and `finishResult` patterns where their semantics
still fit. Do not break legacy readers merely to simplify the new model.
Local records are personal data, not an anti-cheat authority.

## Verification

TDD covering clean/assisted ordering, ties, sticky achievements, old/revised
content, repeated merge and resumed-run outcomes. Run
`node --test tests/world-records.test.ts tests/storage.test.ts tests/campaign.test.ts`,
then `npm test` and `npm run build`.

## Handoff

- Summary: Pure V2 records and time-first feedback completed by synchronous worker.
- Changes: Storage/campaign APIs, new world-record tests, legacy record/campaign
  regressions and mechanics docs; valid constructor IDs no longer read prototypes.
- Verification: Baseline 12/12; new API RED; final targeted 23/23, full
  294/294 and build/typecheck passed. Saved continuation tested with zero/one deaths.
- Risks: Personal-record API trusts completed totals, not an anti-cheat proof.
  No browser writes or ownership yet; BT-044 integrates those.
- Commit: None; primary master working-tree changes.
- Resources: All commands exited; no servers/browser resources created.
- Decisions: Canonical frozen worldId/revision records reuse Run/bestClean.
  Independent best and deathless facts merge commutatively, associatively and
  idempotently; legacy clean-only finish comparison remains unchanged.

## Result

- Summary: Accepted after direct review of record validation, merge and result APIs.
- Verification: Orchestrator reran targeted 23/23 tests and diff checks; reviewed
  full 294/294 and build evidence. Revision isolation and sticky deathless hold.
- Integration: Accepted uncommitted changes, preserving earlier work. BT-044
  will share the duplicate-JSON-key parser across storage and snapshot codecs
  rather than adding a third copy.
