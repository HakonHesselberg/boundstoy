---
{
  "id": "BT-025",
  "title": "Replace sustained flames with one-tick explosions",
  "type": "feature",
  "status": "done",
  "priority": "P1",
  "depends_on": [],
  "parent": "BT-024",
  "scope": ["core/", "data/", "presentation/", "application/guidance.ts", "tests/", "docs/", "README.md", "CLAUDE.md", "package.json"],
  "approval": "In session 6faada62-ebbe-4b03-aceb-bb5fab9de659 the user explicitly requests that explosions kill in one frame and the tile be safe afterwards even while a visual effect remains.",
  "assignment": {
    "owner": "explosion-orchestrator",
    "run": "6faada62-ebbe-4b03-aceb-bb5fab9de659",
    "branch": null,
    "worktree": "."
  },
  "blocked_reason": null
}
---
# BT-025: Replace sustained flames with one-tick explosions

## Problem

Current pulse pads remain lethal and look like continuous flames throughout
their authored on duration. The requested mechanic is an instantaneous
detonation followed by a safe, short visual aftermath.

## Scope

One 120 Hz simulation tick per detonation, independent of rendered frame rate.
Keep footprint, periods, phases and advance warnings. Replace looping flame
with a one-shot flash, expanding shock ring and fading ballistic debris.
Effects remain simulation-clock-driven, including pause and reduced motion.
Existing version-1 pulse on values are explicitly normalized to one on import;
do not leave a hidden sustained-damage mode. Update editor, guidance and docs.
Old course layout design is not being retuned or claimed as the new world.

## Acceptance criteria

- [x] Only the exact detonation tick is lethal, including legacy pulse input.
- [x] A player entering on the next tick survives while aftermath is visible.
- [x] Rendering after a skipped ignition frame still shows the recent explosion.
- [x] Burst dissipates without looping flame; pause and reduced motion work.
- [x] Editor/import/export and instructions describe instantaneous danger.
- [x] Tests/build and production visual/gameplay checks pass.

## Implementation context

Baseline 32e9192, clean primary. 187 tests passed before changes.
Use RULES for the fixed burst lifetime. The legacy on field remains in v1 JSON
for readable backwards import, but canonical exports use on: 1.
Pulse-course IDs must not reuse sustained-flame time records.

## Verification

TDD: exact tick/phase and collision tests, harmless aftermath entry, one-shot
geometry/opacity lifecycle, skipped rendered ignition, repeated/pause snapshots,
reduced motion, legacy import normalization, and frame batching at several Hz.
Full portable suite and targeted production-browser explosion captures.

## Handoff

- Summary: Instantaneous detonation with a six-tick flash and 36-tick harmless
  aftermath. The plate returns to safe immediately; sparks do not loop.
- Changes: Pure collision sampling, tick-driven burst rendering, normalized
  legacy imports, one-tick editor defaults, honest help/notifications, and
  versioned pulse-course IDs to separate incompatible time records.
- Verification: TDD baseline 187 passing; eight expected new-contract failures
  before implementation. Final `npm run release:check` passed 196 portable tests,
  typecheck/build, eight exact browser replays, editor/offline/input/resource
  scenarios, sound/progress journey, explosion-specific checks and 60 actual
  pixel readability cases. Log: `artifacts/explosions/release-check.log`.
- Verification: Browser explosion runner `run-fSoQ0M` shows ignition at tick 45,
  safe footprint entry at tick 46, visible harmless aftermath at tick 49, clear
  ground at tick 81 and next detonation death at tick 285. Full and reduced
  motion, identical paused pixels, skipped ignition renders, disclosed legacy
  draft conversion and bounded resources all passed. Screenshots inspected at
  1060x800 in `artifacts/explosions/`.
- Risks: No new Aftershock levels here. Current Relay is easier under this rule;
  its continued solvability is regression evidence, not gameplay acceptance.
  Initial concurrent build/test hit a temporary Astro fixture; sequential
  release checks pass. GPU comparison primes the separately uploaded first
  death geometry rather than conflating it with explosion allocation.
- Commit: This reviewed local changeset; not pushed. No owned browser/server
  processes remain from the completed runners.

## Result

- Summary: Orchestrator reviewed the integrated collision, rendering, import,
  score identity and test changes after evaluation. No unresolved blocking
  findings. Movement rules, collision footprint, warning length, periods and
  phases remain unchanged; only danger duration and burst presentation change.
- Verification: `npm run release:check`, exact tick assertions, full/reduced
  motion browser captures and resource cleanup evidence accepted. Gameplay,
  journey and readability reports are `run-aWG4dO`, `run-1EuLXq`, `run-3J8zeW`.
- Integration: Present in the primary working tree and included in this local
  commit. BT-024 remains in progress; this is the explosion prerequisite only.
