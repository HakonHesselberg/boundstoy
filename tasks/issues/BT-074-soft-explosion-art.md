---
{
  "id": "BT-074",
  "title": "Restyle explosion pads to the soft-lit diorama art",
  "type": "feature",
  "status": "done",
  "priority": "P2",
  "depends_on": ["BT-073"],
  "parent": null,
  "scope": ["presentation/hazard-visuals.ts", "presentation/glow-textures.ts", "data/explosion-styles.ts", "tests/", "docs/", "README.md"],
  "approval": "2026-10-12 user: review found explosion pads straying into pixel art; user chose option A (restyle explosions to match the rest of the art): \"Yes. Plan it, then do it\".",
  "assignment": {"owner": "soft-explosions", "run": "bcce7959-a91e-47b4-8581-c09208d371d4", "branch": null, "worktree": "."},
  "blocked_reason": null
}
---
# BT-074: Restyle explosion pads to the soft-lit diorama art

## Problem

Explosive pads read as pixel art, while the rest of the scene is a soft-lit
3D diorama. The pixel-art cues are:

- stepped corner brackets and a dark keyline,
- flat unlit fills,
- a solid white ignition square and a flat tint wash,
- icon-like low-poly bursts.

## Scope

All changes are presentation only:

- **Idle pads:** a rounded thin groove with a soft inner edge glow.
- **Charge-up:** a ribbon fuse with a glowing spark head, and an edge tint.
- **Ignition and aftermath:** a soft rounded flash and a radial scorch decal.
- **Bursts:** smooth gradient motifs and glowing ember spheres.

The style colours, colour groups, editor, schema, timing, lethality and
footprint envelope are unchanged.

## Acceptance criteria

- [x] No keyline or stepped brackets. The idle groove is thin and rounded, with a soft glow, and the ground stays visible.
- [x] Every visible pad mesh is shaded by a linear-filtered texture or a vertex gradient. Motif geometry is smooth.
- [x] The charge-up still rises every tick and peaks below the white-hot ignition. Every mesh stays inside the projected footprint for every style and tick.
- [x] The idle field still uses two draws and matches the per-pad view.

## Implementation context

The art direction review and the plan are in session `bcce7959`. This builds
on BT-073.

## Verification

Run `npm run evaluate` and the browser suites: explosions, readability,
aftershock, checkpoint-camera, world-editor, explosion-puzzles and
graphics-recovery. Take before/after captures with the style gallery and the
world.

## Handoff

- Summary: Implemented and committed on `master`. The user reviewed the
  captures ("this is looking a lot better") and asked to commit.
- Changes: as follows.
  - **Textures:** new `presentation/glow-textures.ts`, which builds the
    radial, edge, flash, ring and scorch masks as linear-filtered
    DataTextures.
  - **Pad renderer** (`presentation/hazard-visuals.ts`):
    - The keyline and stepped brackets are replaced by a thin rounded groove
      ribbon and an additive edge glow; the instanced field draws these as
      grooves and glows.
    - The fuse ribbon follows the groove, led by a glowing spark, and the edge
      tint rises during the charge.
    - The flash is a soft rounded mask. The shockwave becomes a ring mask, and
      the glow and scorch become radial decals.
    - Motifs use smooth geometry with per-style vertex gradients (white-hot
      core to saturated tips), and orbs replace the tetrahedra. Embers are
      glowing spheres.
  - **Registry:** `FRAME_KEYLINE` is removed from `data/explosion-styles.ts`.
  - **Docs:** README, GAME_SYSTEMS, ARCHITECTURE, ANIMATION, and the
    art-direction rule in CLAUDE.md.
- Verification: as follows.
  - `npm run evaluate` passes: 491/491 tests, build and tracker check.
  - New tests: `glow-textures`, plus the soft-shading, rounded and thin-groove
    and spark checks in `hazard-visuals`.
  - The envelope check (every mesh, style and tick inside the projected tile)
    passes.
  - Browser suites with exit 0: explosions (passed on retry after a load
    timeout), readability, graphics-recovery, world-editor and
    explosion-puzzles. browser-check and checkpoint-camera passed after the
    commit.
  - Evidence: session `bcce7959` under `files/soft2`.
- Risks: as follows.
  - Idle triangles rise because of the rounded groove ribbons. Tessellation is
    reduced to 6 steps per corner and 4 per side.
  - The machine load (35–48 from unrelated Puppeteer and devtools-MCP
    browsers) causes intermittent 5 s CDP timeouts in the browser suites.
- Commit: `master` (see `git log`); this record is committed with the change.
- Resources: owned headless Chromium only. Other users' browsers were left
  untouched.
- Decisions: thin parts (the groove, fuse and embers) may be solid colour;
  every larger surface is a soft mask or a gradient.

## Result

- Summary: Accepted on 2026-10-12. The user said "This is looking a lot
  better" and asked for the work to be committed.
- Verification: `npm run evaluate` passes (491/491), and seven browser suites
  have exit 0: explosions, readability, graphics-recovery, world-editor,
  explosion-puzzles, browser-check and checkpoint-camera.
- Integration: on `master` as `26acaab`.
