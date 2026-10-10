---
{
  "id": "BT-029",
  "title": "Make ground pattern groups readable and integrate the short encounters",
  "type": "feature",
  "status": "done",
  "priority": "P1",
  "depends_on": ["BT-027", "BT-028"],
  "parent": "BT-024",
  "scope": ["core/level.ts", "core/simulation.ts", "core/editor.ts", "data/terrain.ts", "presentation/main.ts", "presentation/scene.ts", "presentation/hazard-visuals.ts", "index.html", "tests/ground-visuals.test.ts", "tests/hazard-visuals.test.ts", "tests/physics.test.ts", "tests/editor.test.ts", "tests/aftershock-integration.test.ts", "tests/browser/aftershock.ts", "tests/browser/journey.ts", "tests/mobile-readability.test.ts", "tests/render-loop.test.ts", "README.md", "CLAUDE.md", "docs/"],
  "approval": "2026-10-10 user explicitly selected replacing all three with short sequential/wide/checkerboard encounters and muted ground variations, then required a checkpoint after every finished puzzle with a generous trigger.",
  "assignment": {"owner": "aftershock-orchestrator", "run": "6faada62-ebbe-4b03-aceb-bb5fab9de659", "branch": null, "worktree": "."},
  "blocked_reason": null
}
---
# BT-029: Make ground pattern groups readable and integrate the short encounters

## Problem

The next gameplay iteration needs visible grouping without disguising ordinary
ground as ice, mud, void or persistent danger.

## Scope

Two muted alternating normal-ground shades, same geometry/material/movement.
Pulse floor plates retain group identity underneath warnings/harmless effects.
Integrate BT-028 delivery once available, update actual selection/records and
production checks, preserve all four editor movement surfaces.
User subsequently requires a checkpoint after each puzzle, with a generous
trigger. Add optional checkpoint radius, preserving old JSON defaults, render
the actual trigger extent and verify recovery from completed puzzle landings.

## Acceptance criteria

- [x] Ground parity remains legible as one material and does not change physics.
- [x] Warning/detonation signals still dominate the decorative shading.
- [x] All three new playable maps and six witnesses work in production.
- [x] Mobile readability, retry clocks and saved clean records remain correct.
- [x] Rejected versions remain isolated by record IDs; no persistent game server.
- [x] Generous checkpoint triggers work at corridor edges without activating through walls; goal radius is unchanged.

## Implementation context

Presentation work is independent of BT-028's authoring; integration waits for its
delivery. Use existing terrain constants, instancing and pulse render helpers.
Ground shading needs no level schema change. The user-requested checkpoint
radius is an optional, backwards-compatible addition; no runtime dependency.

## Verification

TDD for actual instanced ground colors and safe/warning pulse plate states.
Full portable tests and production release gate; screenshot alternating phases
and sequential patterns, not only spawn boards.

## Handoff

- Summary: Pattern presentation, backwards-compatible generous checkpoints and playable integration implemented in primary.
- Changes: Normal-ground instance palette, pulse plate grouping, actual-radius checkpoint rings, optional validated checkpoint radius, wall-separated collection, editor persistence, browser integration and docs.
- Verification: RED tests caught arbitrary ground shading, indistinguishable safe plate groups, missing visible radius, small checkpoint triggers and ignored radius validation. GREEN support and integrated portable tests pass (230 total); production run-nNT0pm completes all witnesses/checkpoint recoveries and real pixel group contrast. Full/reduced explosion run-uz5mdZ and all 48 readability scenarios pass.
- Risks: Room checkpoints lead to safe exits, not second puzzles. Human replay-value feedback remains outstanding.
- Commit: Primary working-tree changes based on cefca79; not yet committed.
- Resources: All isolated browser runners clean up their owned processes/origins. No dev server restarted.
- Decisions: No new movement surface or dependency. Only checkpoint radius extends JSON; missing values preserve legacy .42 collection, goal unchanged. Clear floor segment prevents cross-wall/void collection.

## Result

- Summary: Accepted after complete release gate and direct review of engine, rendering, editor, test and documentation changes.
- Verification: npm run release:check passes 230/230 portable tests, typecheck/build, gameplay run-2nkXIM, journey run-rfi6Du, explosions run-R1HOij, patterns/checkpoints run-p60kZI, readability run-x6eEl0. Evidence artifacts/aftershock/pattern-release-check.log; 36 mobile pixel scenarios and 12 desktop scenarios pass. Actual quiet grid pixels retain contrast.
- Integration: Primary working tree based on cefca79 integrates BT-028 delivery. Presentation support began independently; final integration required BT-028 acceptance. No new runtime dependencies, persistent server or movement changes.
