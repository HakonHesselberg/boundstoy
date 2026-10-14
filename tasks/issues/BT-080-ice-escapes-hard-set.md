---
{
  "id": "BT-080",
  "title": "Add a hard soft-ice set inspired by Warcraft III ice escapes",
  "type": "feature",
  "status": "done",
  "priority": "P2",
  "depends_on": ["BT-076"],
  "parent": null,
  "scope": ["data/ice-escapes.ts", "data/ice-escape-replays.ts", "tests/ice-escapes.test.ts", "presentation/main.ts", "index.html", "tests/browser/explosion-puzzles.ts", "docs/GAME_SYSTEMS.md", "docs/ARCHITECTURE.md", "tasks/issues/BT-080-ice-escapes-hard-set.md"],
  "approval": "2026-10-13 user request: create a set of soft ice levels taking inspiration from Warcraft 3 maps; they should also be hard.",
  "assignment": {"owner": "copilot", "run": "ad09c82a-30e5-4d54-9c5e-24e71265994b", "branch": null, "worktree": "."},
  "blocked_reason": null
}
---
# BT-080: Add a hard soft-ice set inspired by Warcraft III ice escapes

## Problem

Soft ice has no demanding content. BT-069 feedback found cramped,
explosion-timed soft ice frustrating and asked for room to steer. The user wants
hard soft-ice levels inspired by Warcraft III maps.

## Scope

Six isolated V2 trials, mainly soft ice, with normal-ground stopping pads,
reflecting walls, void off the track and saws as patrolling creeps. No pulses,
hard ice, mud or spikes. Existing movement rules and engine unchanged. Credits
use only documented facts: Ice Escape Template (IcemanBo, archive text: slide on
ice, creeps and snow kill), Slide Kitty Slide v0.1 instructions (avoid dogs,
safe points) and the Warden Ice Escape thread (Rufus: arrow-key sliding,
frequent checkpoints; feedback favouring creative turns). No third-party data.
Shown as a third group in the trials panel with the same isolated flow.

## Acceptance criteria

- [x] Six immutable levels: soft ice is the main surface; only `~ . #` and void tiles; saws only.
- [x] Each level credits its reference idea and adaptation.
- [x] Exact deathless witnesses with switch-model windows; tightest switch 4-8 ticks per side.
- [x] Creeps matter: other start ticks survive for under half of a cycle; the reverse-U-turn rule is tested.
- [x] Multi-puzzle course has wide safe checkpoints, dormant future creeps and verified recovery.
- [x] Menu lists the set; selection, finish and trial results stay out of saves; browser replays pass.
- [x] Full tests, typecheck and build pass; docs updated.

## Implementation context

`data/ice-escapes.ts` builds worlds from ASCII maps (`S`/`G` markers) and
creep tuples; multi-puzzle courses declare section bounds, entries and
checkpoints. Authoring tools (session files `ice/`): risk-aware beam search,
position-triggered driving plans, clearance tuning and wait centring.

## Verification

`node --test tests/ice-escapes.test.ts`, `npm test`, `npm run typecheck`,
`npm run build`, `node tests/browser/explosion-puzzles.ts --browser <chromium>`,
`node scripts/browser-check.ts --browser <chromium>`, `npm run tasks:check`.

## Handoff

- Summary: Implemented and verified directly in the primary worktree.
- Changes: New ice data, evidence and tests; third "Ice escapes" list in the
  renamed **Puzzle trials** panel (`ICE ESCAPE n / 6` header, credited cards);
  browser scenario covers all eighteen trials; GAME_SYSTEMS/ARCHITECTURE.
- Verification: See Result; screenshots `artifacts/explosion-puzzles/run-8QNoPX`.
- Risks: Windows describe witness routes under a fixed-timing switch model;
  humans steer by position, so real tolerance may differ. Human difficulty and
  fun are unverified. Snow Line and Warden's Run have fewer tight switches (2-3).
- Commit: None; uncommitted, interleaved with other sessions' UI edits.
- Resources: All browsers/previews cleaned up.
- Decisions: Creeps patrol void-to-void (a creep crossing only a two-wide lane
  covers it permanently). Checkpoint radius 1.5 covers the whole two-row lane.

### Witness evidence (early/late per switch, cap 16)

| ID | Ticks | Windows |
| --- | --- | --- |
| `ice-snow-line` | 1675 | 12/13 6/6 6/6 16/14 13/16 12/16 16/12 |
| `ice-wolf-lanes` | 957 | 16/16 10/5 5/10 6/7 7/6 7/6 6/7 5/9 9/5 |
| `ice-safe-zones` | 1457 | 9/9 6/6 7/6 6/7 6/6 6/6 6/7 7/6 9/9 |
| `ice-bumper-alley` | 1696 | 8/8 8/16 16/14 4/6 6/5 16/16 14/16 16/4 |
| `ice-spiral` | 2231 | 12/12 5/16 11/15 6/5 15/11 5/15 11/15 16/5 16/11 5/16 16/11 |
| `ice-wardens-run` | 1973 | 16/16 8/8 16/11 16/16 11/11 11/11 11/11 11/11 11/16 16/11 11/8 16/16 8/16 |

Start-tick sensitivity (survivors over one creep cycle): 42/120, 194/960,
19/180, 17/120, 42/160, 50/120.

## Result

- Summary: Accepted as an implemented hard soft-ice playtest set; human playtesting remains separate.
- Verification: `node --test tests/ice-escapes.test.ts` 6/6; `npm test` 518/518; typecheck and build pass; explosion-puzzles browser scenario (18 trials, ice witnesses replayed) and production browser check pass.
- Integration: Working-tree changes only; no commit or publication.
