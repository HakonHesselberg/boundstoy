---
{
  "id": "BT-032",
  "title": "Make black and white ground tiles more visually similar",
  "type": "feature",
  "status": "ready",
  "priority": "P2",
  "depends_on": [],
  "parent": "BT-038",
  "scope": ["presentation/scene.ts", "presentation/hazard-visuals.ts", "data/terrain.ts", "tests/", "docs/"],
  "approval": "2026-10-10 user approved implementation of the entire BT-038 plan, including reused presentation issues.",
  "assignment": null,
  "blocked_reason": null
}
---
# BT-032: Make black and white ground tiles more visually similar

## Problem

The user wants black and white tiles to look more similar. The current contrast
can make cosmetic ground groups appear to be different movement surfaces.

## Scope

Bring the two normal-ground shades closer together while retaining enough
distinction to read alternating pattern groups. Do not change the four movement
surfaces, tile assignments, hazard schedules or level routes.

## Acceptance criteria

- [ ] Both shades read as the same normal-ground material.
- [ ] Alternating groups remain distinguishable, especially in Checkerboard.
- [ ] Player, marker, warning and explosion cues remain clear on both shades.
- [ ] The selected palette has before/after visual evidence and user feedback.

## Implementation context

Requested on 2026-10-10 as issue creation, not implementation approval.
BT-029 introduced cosmetic parity shading; it must never imply another movement
surface. Coordinate visual changes with BT-036 without assuming a dependency.

## Verification

Run `npm test`, `npm run build` and `npm run test:readability`.
Capture idle, warning and aftermath frames on both shades at 1280x900 and
390x844, including Checkerboard. Record palette values, named screenshots and
human feedback; a passing build alone does not establish visual similarity.

## Handoff

Pending.

## Result

Pending.
