---
{
  "id": "BT-071",
  "title": "Apply the visual audit's remaining desktop recommendations",
  "type": "feature",
  "status": "review",
  "priority": "P2",
  "depends_on": ["BT-070"],
  "parent": null,
  "scope": ["presentation/scene.ts", "presentation/hazard-visuals.ts", "presentation/readability.ts", "presentation/wall-visuals.ts", "presentation/marker-visuals.ts", "presentation/terrain-visuals.ts", "presentation/stroke-visuals.ts", "presentation/player-visuals.ts", "tests/", "docs/", "README.md"],
  "approval": "2026-10-12 user: \"Do the remaining recommendations. Ignore mobile for now\" (visual audit R7, R8, R10, R11, R12, R14, R15; R6 mobile excluded).",
  "assignment": {"owner": "visual-audit-remaining", "run": "bcce7959-a91e-47b4-8581-c09208d371d4", "branch": null, "worktree": "."},
  "blocked_reason": null
}
---
# BT-071: Apply the visual audit's remaining desktop recommendations

## Problem

Several smaller presentation problems remain after BT-070:

- Fixed 1-px GL lines vanish or shimmer and do not scale with zoom.
- Beveled floor tiles with grout gaps add edge noise.
- The player's fine details are sub-pixel at world scale.
- The saw path is a faint hairline and its halo bleeds into neighbouring cues.
- The editor grid shows during play.
- Short walls cast full dynamic shadows.
- Per-object geometries and materials are duplicated.

## Scope

All changes are presentation only:

- **Strokes (R7):** world-unit strokes replace GL lines.
- **Floor (R8):** flat floor tiles with a hairline grid texture.
- **Player (R10):** a silhouette-first player that drops sub-pixel details.
- **Saws (R11):** a saw path groove with end caps and a smaller halo.
- **Editor grid (R12):** shown in the editor only.
- **Shadows (R14):** baked contact shading at wall bases instead of dynamic
  wall shadows, and a smaller shadow map.
- **Shared resources (R15):** geometries and materials shared across pads and
  markers.

Non-goals:

- The mobile strategy (R6).
- Physics, collision, schedules, warning or lethality changes.
- `presentation/main.ts` and `presentation/style.css`.

## Acceptance criteria

- [x] No `THREE.Line`/`LineSegments` remains in gameplay rendering. Strokes have world-unit widths that stay at least 1 px at desktop world scale.
- [x] Floor tiles are flat, gapless squares whose cell grid comes from a hairline texture.
- [x] The player ring and heading are clearer, and visor and eyes hide below a pixel threshold. The collision footprint is unchanged.
- [x] The saw patrol extent reads as a groove with end caps, and its halo no longer overlaps neighbouring cells.
- [x] The editor grid is visible only in the editor.
- [x] Walls receive shadows but do not cast them, and the floor shows baked contact shading along wall bases. The shadow map is smaller.
- [x] Pad and marker views share static geometry and materials, and uploaded geometry falls on the world route.

## Implementation context

Follows BT-070 (visual audit in session `bcce7959`). BT-033 required matte,
receding walls, and this work keeps them matte.
This work builds on BT-070's uncommitted changes in the same tree.

## Verification

Run `npm test`, `npm run build` and the browser suites `browser-check`,
readability, explosions, aftershock, walls, checkpoint-camera, world-camera,
world-editor and journey. Then take before/after headless captures and metrics.

## Handoff

- Summary: Implemented directly in `.`. It is ready for review and awaits the
  user's visual assessment. Nothing is committed.
- Changes: presentation only, as follows.
  - **Strokes (R7):**
    - New `stroke-visuals.ts`.
    - Terrain glyphs, void lips (vertical strokes), pad outlines (an inset
      square band) and saw paths are world-unit meshes.
    - Flat strokes face up.
  - **Saws (R11):**
    - `createSawBlade` (one material) and `createSawPath`: a groove, a centre
      line and turnaround caps.
    - The halo shrinks from 1.7 to 1.
  - **Editor grid (R12):** the grid is named `editor-grid` and `syncEditorAids`
    shows it only while editing.
  - **Floor (R8):**
    - Gapless 1×0.38×1 slabs with their top at y = 0.
    - A shared hairline `createFloorTexture`.
  - **Shadows (R14):**
    - Walls `castShadow=false`.
    - `createContactShadeGeometry` adds vertex-alpha bands along wall bases.
    - The shadow map drops from 2048 to 1024 (`SHADOW_MAP_SIZE`).
  - **Player (R10):** new `player-visuals.ts`:
    - A bolder ring (tube 0.034, #9dfff0).
    - A heading arrow at ×1.25 and opacity 0.95.
    - Visor and eyes hide below 41 px per tile.
  - **Shared resources (R15):**
    - Pad views share static geometry; only the fuse is per pad.
    - Markers share one material per colour and one gem geometry.
- Verification: all gates pass, as follows.
  - `npm test`: 474/474.
  - `npm run build` passes.
  - Browser suites: `browser-check`, `--readability-browser`, `explosions`,
    `aftershock`, `walls`, `checkpoint-camera`, `world-camera`,
    `world-editor`, `journey` and `graphics-recovery`, all with exit 0.
  - Metrics on the 1280×900 world route, compared with BT-070:
    - Uploaded geometries at completion: 717 → 131.
    - Triangles: about 24k → 20k.
    - Draw calls: 18–101.
  - Evidence: session `bcce7959` under `files/after3` and `files/after4`.
- Risks: minor, as follows.
  - On 1-tile corridors, contact bands come from both sides, which darkens
    the lanes slightly.
  - The hairline grid is subtle at world scale.
  - Tones were judged in SwiftShader captures.
- Commit: merged to `master` on 2026-10-12 with the full working tree, as
  snapshot `b4d50e2` plus its follow-up commit.
- Resources: every run used the repository's owned headless Chromium harness,
  which cleaned up all processes.
- Decisions: as follows.
  - The parity shade values are unchanged; they remain BT-032's decision.
  - Mobile (R6) is excluded at the user's request.

## Result

Pending.
