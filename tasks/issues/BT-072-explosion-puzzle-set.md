---
{
  "id": "BT-072",
  "title": "Replace surface comparisons with six explosion puzzles",
  "type": "feature",
  "status": "done",
  "priority": "P1",
  "depends_on": [],
  "parent": null,
  "scope": ["data/explosion-puzzles.ts", "data/explosion-replays.ts", "presentation/main.ts", "presentation/style.css", "index.html", "tests/explosion-puzzles.test.ts", "tests/browser/benchmarks.ts", "tests/browser/explosion-puzzles.ts", "tests/run-continuation.test.ts", "docs/ARCHITECTURE.md", "docs/GAME_SYSTEMS.md", "tasks/issues/BT-072-explosion-puzzle-set.md"],
  "approval": "2026-10-12 user approved the six normal-ground explosion-puzzle plan and requested removing 'test the ground' and creating the puzzles.",
  "assignment": {"owner": "orchestrator", "run": "183b57e8-2976-4cc3-88cc-7f7536f244de", "branch": null, "worktree": "."},
  "blocked_reason": null
}
---
# BT-072: Replace surface comparisons with six explosion puzzles

## Problem

Human review rejected surface substitution as a level-design method. Author
readable explosion decisions, not mud walking or precision ice timing.

## Scope

Six original normal-ground V2 playtest levels: Follow the wave, Alternating
bands, Changing refuges, Checker crossing, Crossing waves, Short combination.
The final level combines two introduced patterns with one safe between-puzzle
checkpoint. All others have no checkpoints. Keep Aftershock and the archived
24 benchmark definitions unchanged. Replace the surface-comparison menu with
a six-level Explosion puzzles selector using the existing isolated trial flow.
Interpret 'test the ground' as that surface comparison (no literal UI string
exists). No engine/movement changes, saws, mud, ice, new mechanics or publication.
Keep 27-tick warnings, one-tick blasts, ready reveals and safe start/exit landings.
Keep the user's preview stopped; temporary browser verification cleans up.

## Acceptance criteria

- [x] Six immutable parsed levels with normal ground and pulse hazards only.
- [x] Distinct wave, alternating, temporary-refuge, grid and crossing decisions.
- [x] Every level has an exact deathless input route, measured input margins
  and a failure route that finishes when hazards are removed.
- [x] Refuges actually explode; waiting indefinitely is not safe. Crossing
  waves require a direction change; combination checkpoint precedes the final
  puzzle and supports death/restart recovery without waking future hazards early.
- [x] Menu offers the six puzzles, not the old ground comparison; selection,
  finish, retry, section hints and return-to-world/editor preserve save isolation.
- [x] Complete reveals and controls verified in native browser; full portable
  tests, build and production browser regression pass.
- [x] Documentation and tracker updated; game preview remains stopped.

## Implementation context

Reuse the existing V2 parser, checkpoint clocks, rendering and playtest storage
suppression. Data lives in `data/explosion-puzzles.ts`; evidence in
`data/explosion-replays.ts`. Archive `data/benchmarks.ts` and its evidence intact.
Target at least 12 ticks of independent late-input tolerance per route decision;
measure actual margins rather than inventing precision claims. Human playtest
acceptance is a later gate, not implied by route verification.

## Verification

TDD data and menu checks. Exact input replays, hazard-removal comparisons,
temporary refuge and checkpoint recovery probes. `npm test`, `npm run build`,
`node tests/browser/explosion-puzzles.ts --browser /usr/lib/chromium/chromium`,
and production `scripts/browser-check.ts`. Inspect actual screenshots.

## Handoff

- Summary: Six-level explosion playtest set implemented and verified directly
  in the primary worktree, replacing the surface-comparison selector.
- Changes: Added `data/explosion-puzzles.ts`, `data/explosion-replays.ts` and
  `tests/explosion-puzzles.test.ts`. Replaced the native benchmark scenario with
  `tests/browser/explosion-puzzles.ts`. Reworked `presentation/main.ts`,
  `presentation/style.css` and `index.html` to show six named puzzles rather
  than a family/surface selector. Updated the continuation source-wiring guard,
  architecture and game-system documentation. No production data, renderer,
  movement, dependencies or save-format changes.
- Verification: Baseline `npm test` passed 474/474. Final `npm test` passed
  **480/480**, no failures/skips, 156.992 seconds. Targeted puzzle/continuation
  tests passed 13/13. `npm run build` passed type checking and production build.
  `git diff --check` passed.
- Risks: Human gameplay acceptance remains open. Positive input margins and
  exact routes are not proof of fun, optimality or combined-error tolerance.
  Native browser evidence is Chromium, not all-launch-platform qualification.
  Existing nonfatal JavaScript bundle-size warning remains.
- Commit: Uncommitted changes in `/home/hhh/pri/boundstoy`, based on the clean
  `fe210407c1fb10f5a1ffde4b3516ad9ef8c0029c` baseline. No commits or publication.
- Resources: All native-test browsers, profiles and temporary preview servers
  cleaned by their harness. Port 4400 has no listener; the user's preview was
  not restarted. Authoring scripts/evidence remain in the session `files/`
  directory, not the runtime.
- Decisions: The accepted wave and alternating-band layouts anchor the set.
  Refuges are wider, use temporary pockets, and permit a simple cardinal route
  rather than a tight diagonal sequence. Checker groups use 2x2 regions and an
  exit that requires upward progress. Crossing waves turn through two axes.
  The combination has a 1.4-tile checkpoint trigger before the final grid.
  BT-071's completed assignment was released with its visual acceptance still
  pending; its committed rendering changes were preserved.

### Concrete evidence

| ID | Exact finish ticks | Minimum independent late-input margin |
| --- | --- | --- |
| `puzzle-wave` | 542 | 24+ |
| `puzzle-bands` | 613 | 18 |
| `puzzle-refuges` | 796 | 13 |
| `puzzle-checker` | 616 | 24+ |
| `puzzle-crossing` | 757 | 14 |
| `puzzle-combination` | 1015 | 24+ |

Every failure probe dies with hazards but finishes when hazards are removed.
The refuge straight dash fails at every one of its 360 initial phases; the
witness enters both pockets. Pockets detonate for exactly one tick, 180 ticks
apart from the spine. This does not assert that every possible winning route
must use both pockets.

The combination collects its checkpoint at tick 410. An input-only downstream
death occurs at tick 750; Restart preserves totals, moves to the safe landing
and resets the active grid. Its recovery route finishes in another 605 ticks
with no additional death. Tests cover the full approach width, two idle cycles
on the landing, dormant future hazards and disabled completed hazards.

TDD RED cases included missing data/evidence, the absent six-puzzle menu and
misleading "checkpoint saved" text inside an unsaved trial. Corrected the trial
feedback to "reached". Route iteration discarded edge-hugging waits and widened
refuges until every published decision exceeded the 12-tick minimum.

Native commands:

- `node tests/browser/explosion-puzzles.ts --browser /usr/lib/chromium/chromium`
  passed: `artifacts/browser-check/run-h6z0qS`. All six exact selections and
  finishes, unobstructed ready reveals, real keyboard input, 44px menu controls,
  New trial, cost-preserving Restart, combination death/recovery, active-only
  hazards and second-puzzle camera projection; nonempty editor draft,
  parked Aftershock state, records and reload remain isolated.
- `node scripts/browser-check.ts --browser /usr/lib/chromium/chromium`
  passed: `artifacts/browser-check/run-hGO1Ha`. Production controls, save
  boundaries, checkpoint reload, continued finish, records and offline play.
- Both scenarios cover 1280x900, 390x844 and 844x390 layouts. Screenshots:
  `artifacts/explosion-puzzles/run-QD0rpN`. Inspected changing-refuges portrait,
  crossing-waves landscape and combination desktop, plus earlier desktop
  captures of refuges, checker and crossing waves in `run-CyPlIU`.
- Built HTML includes "Explosion puzzles · 6 levels"; the bundle excludes
  archived `bench-travelling-wave` IDs and the old family selector. Final
  assets: `index-B1GeSF7u.js`, `index-D1R6zBrF.css`.

Session logs: `bt072-baseline.log`, `bt072-red.log`, `bt072-data-red.log`,
`bt072-browser-red.log`, `bt072-checkpoint-red.log`, `bt072-build.log`,
`bt072-full.log`, `bt072-browser-final.log`, `bt072-production.log`.

## Result

- Summary: Accepted as an implemented playtest set after direct code/data
  review, native browser scenarios, screenshot inspection and full regressions.
  The ground-comparison menu is gone; Menu > Explosion puzzles contains the six
  approved normal-ground explosion levels. Human assessment remains separate.
- Verification: 480/480 portable tests, successful typechecked production
  build, both native scenarios, actual checkpoint recovery and bundle check.
- Integration: Changes are integrated in the primary working tree and built
  to `dist`; Aftershock and the archived 24 comparisons are unchanged.
  No commit/publication; game preview remains stopped.
