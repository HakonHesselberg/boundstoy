---
{
  "id": "BT-039",
  "title": "Define versioned continuous-world and section data",
  "type": "feature",
  "status": "done",
  "priority": "P1",
  "depends_on": [],
  "parent": "BT-024",
  "scope": ["core/level.ts", "core/world.ts", "data/", "tests/world-level.test.ts", "tests/editor.test.ts", "docs/ARCHITECTURE.md", "docs/GAME_SYSTEMS.md"],
  "approval": "2026-10-10 user approved implementation of the entire BT-038 plan with bounded subagents where helpful.",
  "assignment": null,
  "blocked_reason": null
}
---
# BT-039: Define versioned continuous-world and section data

## Problem

The current level format describes independent small courses, not one continuous
world with ordered puzzle sections and section-specific camera metadata.

## Scope

Define a typed, frozen version-2 world contract and narrow authoring/assembly
helpers. Keep global terrain coordinates, one spawn/exit, content ID/revision,
section bounds, observation areas and seven intermediate checkpoint references.
Separate presentation framing metadata from simulation progression.
Retain version-1 parsing, limits, exports and retry behavior. No runtime
dependencies, generic scripting system or actual eight-section content here.

## Acceptance criteria

- [x] A connected multi-section fixture parses, freezes and round-trips without changing global coordinates or content identity.
- [x] Duplicate IDs, invalid section/checkpoint references, bounds, incompatible overlaps and malformed metadata fail explicitly.
- [x] Version-1 limits and behavior remain compatible; version-2 size/hazard/import limits are explicit and tested at their boundaries.
- [x] The proposed 160x128/640-hazard/1-MB ceilings are evaluated, not silently adopted as user requirements.
- [x] Shared section-entry/completion conventions are documented so content batches can join without a separate run per section.
- [x] The complete repository still typechecks; no unsafe casts hide incompatible level versions.

## Implementation context

Implementation approved under BT-038. Start from `core/level.ts` and the existing data-driven
Aftershock authoring. One world is not eight `loadCourse` calls. The player-facing
proof has eight sections, but avoid baking that number into generic physics.
Structural validation does not claim solvability; content evidence belongs to
BT-048 through BT-052. Proposed new files are optional if existing helpers suffice.

## Verification

TDD in `tests/world-level.test.ts` for valid/invalid v2 and legacy roundtrips,
including translated sections, connectors and exact limit boundaries.
Run `node --test tests/world-level.test.ts tests/editor.test.ts`, then
`npm test` and `npm run build`.

## Handoff

- Summary: Synchronous boundstoy-worker completed the V2 contract in serial-primary mode.
- Changes: `core/level.ts`, new `core/world.ts` and `data/level-limits.ts`,
  new `tests/world-level.test.ts`, `tests/editor.test.ts`, architecture/mechanics docs.
- Verification: Initial targeted RED 9/15; final targeted 19/19, full tests
  256/256 and build/typecheck passed. Exact nested and size boundaries covered.
- Risks: Cardinal connectivity is not gameplay solvability. Observation
  clearance uses a conservative swept saw AABB. V2 caps are defensive provisional
  budgets (160x128, 640 hazards, 64 sections, 63 checkpoints, 1 MB UTF-8),
  not hardware certification or a mandate to author more than eight sections.
- Commit: None; integrated uncommitted on master at base
  d069ba5aecedb3dab027f08d4ccecc65bd9233ff, preserving prior edits.
- Resources: No server/browser/process left running.
- Decisions: `Level` discriminates V1/World. Section completion names a
  checkpoint ID or the final goal; checkpoint lives in preceding section,
  next entry in its own safe observation area. Generic parser has no eight-room
  physics constant. Worker ID unavailable; orchestrator run
  183b57e8-2976-4cc3-88cc-7f7536f244de owns the synchronous assignment.

## Result

- Summary: Accepted after direct review of parser, metadata validation and limits.
- Verification: Orchestrator independently reran world/editor tests (19/19)
  and diff whitespace checks; worker full tests/build evidence reviewed.
- Integration: Accepted primary-working-tree changes without commit. World
  progression, rendering, content and persistence are not implied by this contract.
