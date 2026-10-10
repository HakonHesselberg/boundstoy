---
{
  "id": "BT-030",
  "title": "Declutter explosions and remove redundant exit checkpoints",
  "type": "feature",
  "status": "done",
  "priority": "P1",
  "depends_on": ["BT-028", "BT-029"],
  "parent": "BT-024",
  "scope": ["data/", "presentation/hazard-visuals.ts", "presentation/main.ts", "index.html", "tests/", "docs/", "README.md", "CLAUDE.md"],
  "approval": "2026-10-10 user explicitly selected removing redundant final checkpoints while keeping maps short; then said these levels are better and requested reduced explosion-tile clutter/overlap and at least halved buildup.",
  "assignment": {"owner": "aftershock-orchestrator", "run": "6faada62-ebbe-4b03-aceb-bb5fab9de659", "branch": null, "worktree": "."},
  "blocked_reason": null
}
---
# BT-030: Declutter explosions and remove redundant exit checkpoints

## Problem

The user accepts the direction of the short levels but finds explosive tiles
cluttered, effects overlapping and warnings too long. Checkpoints on the final
safe exit walk do not separate puzzles and must be removed.

## Scope

Remove the three final checkpoints and their misleading hints. Keep geometry,
movement, detonation phases, targets and successful replays unchanged.
Retain checkpoint support for multi-puzzle maps/editor. Cut warning duration
from 54 to 27 ticks (450 to 225 ms). Simplify idle pads, warning graphics and
blast layers; constrain effect geometry in the actual game camera so it does
not spill over neighboring tile signals. Keep harmless aftermath and one-tick
lethality. No new stages, dependencies or persistent servers.

## Acceptance criteria

- [x] Single-puzzle maps have no final checkpoints or save-point promises.
- [x] Existing clear/mastery timings, schedules and movement remain unchanged.
- [x] Warning lasts exactly 27 ticks; no damage duration change.
- [x] Idle explosive floor has no raised vent clutter; buildup has one clear cue.
- [x] Adjacent effects stay separate in projected geometry and production captures.
- [x] Full/reduced motion, next-tick safety, mobile readability and editor checkpoints work.

## Implementation context

Direct implementation based on 1bef244. Existing floor parity remains useful.
Observed renderer has raised plates/vents, 3 warning meshes, two overlapping
blast shells, a ring and eight high-flying shards per tile. Reduce redundant
layers rather than hiding the actual danger footprint.

## Verification

TDD for checkpoint removal, fixed warning duration, visible mesh counts and
projected bounds throughout effect lifetime. Production dense-pattern captures,
exact six replays, real retries, explosion tests and full release gate.

## Handoff

- Summary: Implemented directly and ready for review. Removed final checkpoint data and stale hints, replacing
map-specific saved-landing checks with actual backtrack death -> start -> full
replay. Generic checkpoint physics/editor tests remain. Retained all six input
witnesses and IDs because clean paths/timing are unchanged.

- Changes: Removed raised vents, warning bars, three-dimensional pad edges and expanding
smoke shells. Lowered pad and blast geometry, reduced shards from eight to four,
and shortened warning from 54 to 27 ticks. No changes to ignition or damage.

- Verification: Baseline 230/230. RED checkpoint assertion rejected existing marker; three RED
visual regressions rejected 54-tick warning, idle clutter and projected spill.
Final release gate: 233/233 portable tests, typecheck/build and all five
production runners. Log: `artifacts/aftershock/visual-release-check.log`.
Runs: `run-gjOnNw`, `run-9CZUrr`, `run-KlOa9I`, `run-zKDFWv`, `run-tqh0s6`.

Visual inspection caught the pause overlay masking new dense-field captures;
fixed capture ordering after debug advance and reran successfully (`run-Fh7MiQ`,
`artifacts/aftershock/visual-captures-check.log`). Inspected unobscured grid
warning/aftermath at 1280x900, aftermath at 390x844, reduced-motion ignition and
mixed-phase corridor. Captures: `artifacts/aftershock/visual-grid-*.png` and
`visual-corridor-*.png`. Owned browser resources cleaned up after each run.

- Risks: Warning intentionally gives less advance notice; gameplay schedules are unchanged. This is not full-world release acceptance.
- Commit: Integrated working-tree changes on master at repository root; local commit pending.
- Resources: All runner-owned browsers, origins and profiles cleaned up. Pre-existing development server untouched.
- Decisions: Retained map IDs and clean records because winning paths/timings are unchanged; retained generic between-puzzle checkpoint support.

## Result

- Summary: Direct code review approved: core layers and movement untouched, deterministic
retained effects, generic checkpoint compatibility preserved, no new dependency.
Evidence and detailed evaluation/review: `artifacts/aftershock/visual-review.txt`.
This completes the requested visual pass and checkpoint clarification, not the
entire eight-stage world or its human replay-value gate.

- Verification: 233/233 tests, build/typecheck and all five production runners passed; unobscured visual capture rerun passed as run-Fh7MiQ.
- Integration: Explicitly integrated working-tree changes in the main worktree on master; no push.
