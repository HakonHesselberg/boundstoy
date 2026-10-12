---
{
  "id": "BT-073",
  "title": "Add explosion styles, edge identity and bolder detonations",
  "type": "feature",
  "status": "review",
  "priority": "P2",
  "depends_on": [],
  "parent": null,
  "scope": ["data/explosion-styles.ts", "data/aftershock-world.ts", "core/level.ts", "core/editor.ts", "presentation/hazard-visuals.ts", "presentation/scene.ts", "presentation/main.ts", "presentation/style.css", "tests/", "docs/", "README.md"],
  "approval": "2026-10-12 user approved the explosion plan (\"approved\"): remove the pad dot in favour of a border edge that keeps the ground visible, styles chosen per puzzle and pad, a much bolder detonation that stays inside its tile, and a restyled Aftershock world.",
  "assignment": {"owner": "explosion-styles", "run": "bcce7959-a91e-47b4-8581-c09208d371d4", "branch": "task/bt-073", "worktree": ".worktrees/BT-073"},
  "blocked_reason": null
}
---
# BT-073: Add explosion styles, edge identity and bolder detonations

## Problem

- An idle pad hides its terrain behind an opaque plate with an amber dot, so a
  pad on ice reads as normal ground.
- Every explosion looks the same, so puzzles cannot colour their rhythm groups
  differently.
- The charge-up is more noticeable than the detonation.

## Scope

The registry, schema, rendering and editor changes are presentation only:

- **Styles:** a registry of explosion styles (Ember, Plasma, Toxic and
  Psionic) and an optional per-pulse `style` field that defaults to Ember and
  is omitted on export.
- **Idle frame:** a hazard frame over visible ground, which then burns as the
  charge-up fuse.
- **Detonation:** layered and bold, staying inside the projected tile footprint.
- **Motifs:** one per style.
- **Editor:** style chips for the Pulse brush.
- **World:** Aftershock pads restyled by rhythm group.

Non-goals:

- Changes to timing, lethality, footprint, movement, collision or replays.
- Per-style audio.
- A red style.

## Acceptance criteria

- [x] Idle pads show their real terrain beneath a style-coloured frame with corner brackets. The pilot dot is gone.
- [x] The frame burns monotonically as the fuse. The charge-up peaks clearly below detonation salience.
- [x] Detonation is white-hot, then shows a burst crown, a shockwave and a scorch with cooling embers. Every visible mesh stays inside the projected footprint, the aftermath is harmless, and reduced motion keeps the essentials.
- [x] Four styles validate, round-trip and pass contrast checks on every floor. Missing `style` defaults to Ember and existing exports are unchanged.
- [x] The editor selects and repaints styles while keeping period and phase.
- [x] Aftershock uses one style per rhythm group. Replays, timing and saves are unchanged.

## Implementation context

The plan is in session `bcce7959`. This work runs in an isolated worktree
because another session holds the primary tree (BT-072). It respects BT-030,
BT-036 and BT-037: compact effects, a 27-tick warning and one lethal tick.

## Verification

Run `npm run evaluate` and the browser suites: explosions, readability,
aftershock, checkpoint-camera, world-editor, journey and graphics-recovery.
Take per-style headless captures at 1280×900.

## Handoff

- Summary: Implemented on `task/bt-073` in `.worktrees/BT-073`. It is ready
  for review and needs the user's visual assessment.
- Changes: as follows.
  - **Registry:** new `data/explosion-styles.ts` with Ember, Plasma, Toxic and
    Psionic. Each style has frame, hot, core, burst, scorch and debris colours
    plus a motif.
  - **Schema:** an optional `pulse.style`, validated in `core/level.ts`. The
    default is omitted on export.
  - **Editor painting:** `paint(..., style)` restyles an existing pad and keeps
    its timing and ownership.
  - **Renderer** (`presentation/hazard-visuals.ts`):
    - No idle plate and no dot.
    - A keyline, a style frame with corner brackets, and a frame-following fuse
      with a rising tint.
    - Detonation: a two-tick opaque white-hot sheet, then a motif (petals,
      rings with bolts, cloud, or swirl) peaking at 0.5, glow, shockwave,
      scorch and cooling embers.
    - The instanced field now has two draws. Geometry is shared.
  - **Editor UI:** style chips shown only with the Pulse brush (`index.html`,
    `presentation/main.ts`, `style.css`), with colour-neutral legend and help
    text.
  - **Aftershock:** pads are styled by rhythm group through
    `AFTERSHOCK_PAD_GROUPS`. Timing, ownership and revision 2 are unchanged.
  - **Docs:** README, GAME_SYSTEMS, ARCHITECTURE, ANIMATION and CLAUDE.md.
- Verification: as follows.
  - `npm run evaluate` passes (see the Result below).
  - New tests: `explosion-styles` and `aftershock-styles`.
  - Rewritten tests: `hazard-visuals`, plus footprint checks for every style
    and tick in `mobile-readability`.
  - Browser suites, all with exit 0: `browser-check`, readability, explosions,
    checkpoint-camera, world-camera, world-editor (which asserts style chips
    and styled painting), journey, graphics-recovery and walls.
  - `aftershock`: its Checkerboard ground-pixel check passes after sampling
    pad centres instead of the old plate position. The suite then times out
    (5 s Runtime.evaluate on the `?debug&journey=3` reload) in its legacy
    journey section. An untouched `fe21040` checkout fails identically under
    the same load (load average about 20–30, about 150 Chromium processes
    from other sessions), so this is environmental and not caused by BT-073.
  - Evidence: session `bcce7959` under `files/styles2` and
    `files/styles-world`.
- Risks: as follows.
  - About 5,100 meshes and 2,450 materials exist across 223 per-pad views,
    but they are hidden while idle. View construction takes about 117 ms in
    Node, and per-frame updates take 0.55 ms for all pads.
  - The motif look and the world colour mapping need human taste review.
- Commit: on branch `task/bt-073` (see `git log task/bt-073`). Not merged to
  `master`, because the primary tree has another session's uncommitted BT-072
  edits to `main.ts`, `index.html` and `style.css`.
- Resources: owned headless Chromium runs only, plus a temporary baseline
  worktree at `/tmp/bt-base`, which has been removed.
- Decisions: as follows.
  - Colour groups are allocated by role. Section 2's two shelter pockets share
    Plasma. Section 4's inner cut covers rows 6–9.
  - Repainting a pad now keeps its timing; it previously reset to 360/0.

## Result

Pending.
