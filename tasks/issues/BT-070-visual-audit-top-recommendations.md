---
{
  "id": "BT-070",
  "title": "Apply the visual audit's top readability recommendations",
  "type": "feature",
  "status": "done",
  "priority": "P2",
  "depends_on": [],
  "parent": null,
  "scope": ["presentation/scene.ts", "presentation/hazard-visuals.ts", "presentation/readability.ts", "presentation/wall-visuals.ts", "presentation/world-camera.ts", "presentation/marker-visuals.ts", "data/terrain.ts", "tests/", "docs/"],
  "approval": "2026-10-12 user: \"Fix all of your top recommendations. Once done, let us return to remaining recommendations\" (visual audit R1, R2, R3, R4, R5, R9, R13; mobile R6 excluded pending a user decision).",
  "assignment": {"owner": "visual-audit-orchestrator", "run": "bcce7959-a91e-47b4-8581-c09208d371d4", "branch": null, "worktree": "."},
  "blocked_reason": null
}
---
# BT-070: Apply the visual audit's top readability recommendations

## Problem

The world reads poorly. The board is small, and the wall fill is a large flat
slab. Dormant explosive pads fill the screen with amber. Walls clip checkpoint
rings into "( )" fragments, and the exit portal cuts through the EXIT label.
Hard ice is a blue that can be mistaken for normal ground. Every idle pad also
costs several draw calls.

## Scope

All changes are presentation only:

- **Route labels:** always drawn on top, in the UI sans font.
- **Dormant pads:** a neutral mark instead of amber.
- **Checkpoint triggers:** shown as a floor zone clipped to walkable cells.
- **Wall fill:** fades away from the playable floor.
- **World camera:** less padding at the same constant scale.
- **Terrain identity:** pale hard ice with streaks, and mud with pebbles.
- **Idle pads:** drawn with instancing.

Non-goals:

- Changes to physics, collision, schedules, the 27-tick warning or one-tick
  lethality.
- Zoom changes or a mobile camera strategy (R6).
- `presentation/main.ts` and `presentation/style.css`, which a concurrent
  session is editing.

## Acceptance criteria

- [x] START, checkpoint and EXIT labels are never occluded by markers or the portal, and use the UI font.
- [x] Dormant (inactive-section) pads use a neutral, non-amber identity. The active idle, warning, flash and aftermath cues are unchanged.
- [x] The checkpoint trigger area is drawn only on walkable cells connected to the checkpoint, never on or through walls.
- [x] The wall mass far from the floor recedes toward the background, while the curbs beside the floor keep the BT-033 matte look. Collision is unchanged.
- [x] The world camera keeps one constant scale and whole-puzzle visibility, with larger tiles than before.
- [x] Hard ice is clearly distinct from normal ground and soft ice, and mud has its own texture. Editor swatches follow the data.
- [x] Idle pads render with a constant number of draw calls regardless of pad count. Per-pad inspection stays exact.

## Implementation context

The source is the visual audit in session `bcce7959`. Related issues:

- BT-031 (labels)
- BT-032 (parity shades)
- BT-033 (matte walls)
- BT-036/037 (pad cues, motion)
- BT-063 (constant camera scale)

## Verification

Run `npm test`, `npm run build` and `npm run test:readability`. Then take
headless captures of the world at 1280×900 and 390×844 with the legal route,
and record draw calls from `__BOUNDSTOY__.metrics()` before and after.

## Handoff

- Summary: Implemented directly in `.`. It is ready for review and awaits
  the user's visual assessment. Nothing is committed.
- Changes: presentation-only, as follows.
  - **Route signs:** `readability.ts` gains `createRouteSign`, with
    `depthTest:false`, renderOrder 1 and a rounded plate in the Inter/sans
    stack.
  - **Pads** (`hazard-visuals.ts`):
    - Dormant pads get a neutral pilot (#6f7d88) and outline (#66737d).
    - `pulseFieldMode` decides which renderer owns each pad.
    - `createPulseField` draws all idle pads as instanced plates and pilots
      plus one vertex-coloured outline batch. A pad's own `PulseView` is shown
      only while it is charging or bursting.
  - **Checkpoint zones** (new `marker-visuals.ts`): a floor zone covering
    walkable cells inside the radius, flood-filled from the checkpoint so it
    never crosses a wall, with a radial texture. It fades to 0.3 opacity once
    collected.
  - **Walls** (`wall-visuals.ts`): a per-vertex tone ramp `[1, 0.5, 0.28]` by
    Chebyshev distance from open cells. Topology is unchanged; uniform runs
    still coalesce.
  - **Camera** (`world-camera.ts`): `fitWorldFrame` uses the exact projected
    depth scale (0.827), +1.5 vertical and +2 horizontal padding. Legacy V1
    framing is unchanged.
  - **Terrain:** hard ice is now #b4c6dc with diagonal streaks. Mud gets
    deterministic instanced pebbles (new `terrain-visuals.ts`).
  - **Docs:** README, GAME_SYSTEMS, ARCHITECTURE and ANIMATION are updated.
- Verification: all gates pass, as follows.
  - `npm test`: 461/461 pass.
  - `npm run build` passes.
  - Browser suites, all passing: `browser-check`, `--readability-browser`,
    `explosions`, `aftershock`, `walls`, `checkpoint-camera`, `world-camera`,
    `world-editor` and `journey`.
  - Draw calls on the 1280×900 world route went from 85–319 to 24–104. On
    390×844 the finish went from 408 to 26.
  - Evidence: before/after captures in session
    `bcce7959-a91e-47b4-8581-c09208d371d4`, under `files/{before,after,after2}`.
- Risks: minor, as follows.
  - The batched idle field draws off-screen pads too: about 24k triangles,
    up from 14k, which is negligible here.
  - Pad geometries still upload per pad on first charge (R15 follow-up).
  - The tone of the fill was judged by eye in SwiftShader captures; hardware
    GPUs may differ slightly.
- Commit: merged to `master` on 2026-10-12 with the full working tree, as
  snapshot `b4d50e2` plus its follow-up commit.
- Resources: every browser run used the repository's owned headless Chromium
  harness. All processes, ports and profiles were cleaned up by the harness.
- Decisions: as follows.
  - Horizontal padding stays at 2 tiles so mobile signs are unaffected.
  - Mobile scale (R6) needs a user decision.
  - The remaining recommendations follow on user request.
## Result

- Summary: Accepted on 2026-10-12. The user reviewed the outcome and directed
  the follow-on work in BT-071 ("Do the remaining recommendations"). The
  pending human visual sign-off is carried by BT-071's review.
- Verification: every acceptance criterion is verified by `npm run evaluate`
  and nine production browser suites, all with exit 0.
- Integration: the changes are in the main working tree and are not
  committed. BT-071 builds on them in the same tree.
