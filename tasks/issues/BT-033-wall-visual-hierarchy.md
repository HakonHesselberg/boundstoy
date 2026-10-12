---
{
  "id": "BT-033",
  "title": "Make walls recognizable as background architecture",
  "type": "feature",
  "status": "done",
  "priority": "P2",
  "depends_on": [],
  "parent": "BT-038",
  "scope": ["presentation/scene.ts", "presentation/wall-visuals.ts", "data/terrain.ts", "tests/", "docs/"],
  "approval": "2026-10-10 user approved BT-038; 2026-10-11 explicitly requested a complete wall rework because the current walls are too shiny and eye catching.",
  "assignment": null,
  "blocked_reason": null
}
---
# BT-033: Make walls recognizable as background architecture

## Problem

Walls should look more like walls and more like background objects, rather
than competing with the playable floor and active gameplay cues.

## Scope

Improve wall shape, material and visual hierarchy so solid boundaries are clear
but visually subordinate to play. Keep collision geometry, camera behavior,
routes and hard-/soft-ice wall responses unchanged.

## Acceptance criteria

- [x] Walls read as solid architectural boundaries rather than playable tiles.
- [x] Walls visually recede relative to the player, markers and active hazards.
- [x] Wall treatments do not hide adjacent floor, labels or hazard footprints.
- [x] Collision boundaries and both ice wall-contact behaviors remain unchanged.

## Implementation context

The user rejected the current bright, separately beveled, hatched wall tiles.
Replace them with continuous dark matte architecture: coalesced top surfaces,
vertical faces only at exposed boundaries, no per-tile trim, hatching, tint
noise, metallic response or environment reflections. Retain the 0.24-tile
barrier height so adjacent lanes, markers and warning footprints remain clear.
Use the exact wall-cell footprint for the mesh, without changing collision.
Match the editor wall swatch to the new material. Keep instanced floor surfaces,
the checkpoint camera, lighting for all other objects and hazard timing intact.

TDD covers exact wall topology (holes, corners, islands, outer edges), face
normals, matte material constraints, batching and Scene disposal. Native
before/after captures use identical legal replay positions and camera settings
in narrow lanes and mixed-room/perimeter views. Inspect hierarchy in pixels,
not just material parameter values.

## Verification

Run `npm test`, `npm run build` and `npm run test:readability`.
Capture before/after narrow passages, corners and perimeter walls at 1280x900
and 390x844. Check editor wall placement and ice contacts; record named
screenshots and human assessment of wall recognition and visual hierarchy.

## Handoff

- Summary: Completely replaced the bright tiled walls with continuous dark matte architecture.
- Changes: New batched wall geometry, separate quiet top/side materials, removal of per-tile wall decoration, matching editor swatch, geometry/material/disposal tests, pixel-based native comparison and related documentation.
- Verification: 406/406 portable tests and production build passed. Native wall hierarchy, readability, editor and final graphics recovery checks passed; exact evidence follows.
- Risks: The user's assessment of the revised art direction is still outstanding. This is an implemented visual correction, not acceptance of overall gameplay or all launch platforms.
- Commit: None; changes remain in the primary worktree with inherited work preserved.

Direct orchestrator implementation in session
`183b57e8-2976-4cc3-88cc-7f7536f244de`.

One mesh contains horizontal-run caps and exposed vertical faces only, with
two material groups. Top color is `#1b2630`; side color is `#273744`.
Roughness is 1, metalness and environment intensity are 0. Wall height remains
0.24 tiles and all mesh boundaries match the original solid cells. There are
no bright outlines, hatch marks, per-tile seams, bevels or color noise.
Floor materials, camera policy, hazards, collisions and save formats are unchanged.

Evidence:

- `npm test`: 406/406 pass; `npm run build` and final typecheck pass.
  Logs: `files/bt033-tests.log`, `bt033-typecheck-final.log`.
- Before: `artifacts/walls/before-H5GDI6`; after:
  `artifacts/walls/after-Em2frS`. Four exact legal-route positions (ticks
  0, 591, 3356, 4857), each at 1280x900, 390x844 and 844x390.
  These show narrow shelters, corners, perimeter and final-puzzle boundaries.
- Rendered mean linear wall-cap luminance dropped from approximately
  0.327-0.401 to 0.033-0.036 across those captures. Every after view passes
  the wall/playfield luminance ratio threshold of 0.45. This measures sampled
  rendered pixels, not just configured material colors.
- Native actual-pixel locator/readability and complete camera-frame checks:
  `artifacts/browser-check/run-Nm25qA`, `files/bt033-readability.log`.
- Native editor global picking, brushes/undo/export, invalid-edit isolation,
  playtest recovery and campaign isolation:
  `artifacts/bt047/native-3fEoZc`,
  `artifacts/browser-check/run-mhHjYd`.
- Native graphics restoration, exact paused pixels/state, repeated resource
  ownership, hidden restoration and startup failure recovery:
  `artifacts/graphics-recovery/run-SOaAgc`,
  `artifacts/browser-check/run-c40DSH`.

The initial graphics attempts hit the already observed post-reload evaluation
timeout. The harness now waits for a new `Page.loadEventFired` before probing
the replacement document, matching the established continuation/world-driver
pattern. The corrected full graphics suite passed without increasing timeouts
or changing production lifecycle behavior. Failed attempts remain in
`bt033-graphics.log` and `bt033-graphics-retry.log`; final evidence is
`bt033-graphics-final.log`.

## Result

- Summary: Reviewed the before/after desktop, portrait and landscape images directly. The old wall grid no longer dominates the view; continuous dark masses and boundary faces leave the route, hazards and markers prominent. Awaiting the user's own visual assessment.
- Verification: The portable, native pixel, editor and corrected graphics checks above pass. Existing ice-contact and exact-world replays remain unchanged. No physics, route, camera or persistence change was made.
- Integration: The owned attached preview at `http://127.0.0.1:4400/` serves the verified wall build. No deployment or publication occurred.

Served/build fingerprints:

- `index-oooKdqTE.js` SHA-256:
  `f1502df9a733303424a7bd28819d7802b0f79fedf3ad975be3cf0781f43f632c`.
- `dist/index.html` and served HTML SHA-256:
  `0d9688c77510ffa7131ca951071bbb7e0b5ad87e9b60ba4c5e055955f3436067`.

BT-053 remains the human gameplay/visual-feedback gate. BT-064 remains a
separate unresolved continuation-fixture qualification issue, not addressed
or counted as passing by this wall change.
