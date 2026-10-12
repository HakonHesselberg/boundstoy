---
{
  "id": "BT-047",
  "title": "Round-trip and inspect worlds without expanding the editor into a new product",
  "type": "feature",
  "status": "done",
  "priority": "P1",
  "depends_on": ["BT-040", "BT-041"],
  "parent": "BT-024",
  "scope": ["core/editor.ts", "presentation/main.ts", "index.html", "presentation/style.css", "scripts/inspect.ts", "tests/editor.test.ts", "tests/world-editor.test.ts", "tests/browser/world-editor.ts", "docs/GAME_SYSTEMS.md", "docs/BROWSER_CHECKS.md"],
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
# BT-047: Round-trip and inspect worlds without expanding the editor into a new product

## Problem

Registering a world without updating import, editing, playtest and inspection
would leave existing secondary tools broken or falsely writing campaign scores.

## Scope

Support v2 validated JSON import/export, section-focused ordinary brushes,
playtest/return and headless/debug world inspection. Advanced section/camera
metadata can remain JSON-authored. Preserve v1 editing and draft behavior.
No general world-builder, public checkpoint-skip menu or new puzzle systems.

## Acceptance criteria

- [x] V1 drafts and v2 worlds round-trip with their IDs, revisions, hazards and section metadata preserved.
- [x] Painting/undo and picking remain correct in shifted section views; invalid metadata edits fail visibly without destroying the draft.
- [x] World playtest returns to the same draft and cannot alter built-in records or resumable campaign progress.
- [x] Headless inspection and the opt-in debug API expose section/progression and continuous-clock state accurately.
- [x] Developer recovery/replay helpers cannot appear as ordinary player checkpoint skipping.
- [x] New bounds/metadata do not permit importing unbounded or executable content.

## Implementation context

Implementation approved; use BT-039/040 contracts and BT-041 camera coordinates.
Keep the editor secondary and reuse existing brush/validation helpers. Authoring
the complete rough world does not authorize a separate editor redesign.

## Verification

TDD in `tests/world-editor.test.ts` plus existing editor regressions.
Run `node --test tests/world-editor.test.ts tests/editor.test.ts`, `npm test`,
`npm run build`, and the new `node tests/browser/world-editor.ts`.
Exercise import failures, edit/undo/export/playtest/return at desktop and portrait
sizes, exact record isolation and the updated `npm run inspect -- 0 --replay`.

## Handoff

Worker 17116d90-edfc-4cbd-8725-9fcbe5a3410f failed while returning its
handoff (400 internal server error), after preserving implementation and test
evidence. All its commands are complete; no replacement worker was launched.
The orchestrator has taken over direct review and integration, preserving the
exact diff against the pre-BT-047 baseline. Native editor verification passed
independently at 1280x900 and 390x844 in
`artifacts/bt047/native-clhyn2` / `artifacts/browser-check/run-kkBwpU`.
A direct regression exposed blocking FIFO open before regular-file validation
in headless inspection. The orchestrator added a failing persistent regression,
fixed the open flags, and reran integration before acceptance.

Assigned one serial-primary worker, 17116d90-edfc-4cbd-8725-9fcbe5a3410f;
no other code writer and no commits.
Baseline is master d069ba5aecedb3dab027f08d4ccecc65bd9233ff plus accepted
BT-037/039/040/041/042/043/044/045/046 and preserved rendering edits.
The markup/style write surface is included only for the minimal section-focus
editor control already required by this issue, not a general editor redesign.
Baseline: 333 passing tests, production build, actual continuation/storage,
graphics, legacy browser journeys and world camera regressions.

- Summary: V2 editor round-trip, section-focused ordinary editing, isolated
  playtests and bounded headless/debug inspection are integrated.
- Changes: Structural world markers require validated JSON; section focus
  changes only presentation; undo survives playtest return. Added unit/native
  regressions and user/developer documentation.
- Verification: Parent independently passed 340/340 tests and production build;
  16 targeted editor/inspection tests; legacy `inspect 0 --replay`; native editor,
  continuation, general browser and world-camera checks. Full test/build log:
  session `files/bt047-integration.log`.
- Risks: Chromium software-rendered browser evidence does not certify real
  launch devices, native quota exhaustion or actual BFCache retention (BT-062).
  No world content or general metadata-builder UI is included.
- Commit: None; preserved serial-primary dirty-tree diff, no broad baseline commit.
- Resources: All verification runners reported owned browser, sockets, profile
  and preview cleanup. No worker or replacement remains running.
- Decisions: Keep advanced section/camera metadata JSON-authored. Require
  nonblocking file open before rejecting non-regular headless inputs.

## Result

- Summary: Accepted by the orchestrator after direct diff review and correction
  of the named-pipe validation hang; failed worker transport is not treated as
  successful handoff evidence.
- Verification: Native editor `artifacts/bt047/native-clhyn2` and
  `artifacts/browser-check/run-kkBwpU`; desktop/portrait captures reviewed.
  Exact continuation `artifacts/continuation/run-0Jzrgt` /
  `artifacts/browser-check/run-K0K2hQ`; general browser `run-Q9OfUr`;
  world camera `artifacts/world-camera/run-zxr5D9` /
  `artifacts/browser-check/run-1HHCN7`.
- Integration: Accepted foundations and inherited rendering preserved.
  Native editor playtests preserve campaign records and active save bytes.
  Production still contains the three prototypes, not a partial world.
