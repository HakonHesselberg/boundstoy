---
{
  "id": "BT-063",
  "title": "Replace puzzle zoom changes with checkpoint camera pans",
  "type": "bug",
  "status": "done",
  "priority": "P1",
  "depends_on": ["BT-052"],
  "parent": "BT-024",
  "scope": ["presentation/world-camera.ts", "presentation/scene.ts", "tests/", "docs/", "README.md", "tasks/issues/"],
  "approval": "User stopped the BT-053 playtest and requested checkpoint-triggered panning, backtracking without zoom, and the entire puzzle visible at least when revealed.",
  "assignment": null,
  "blocked_reason": null
}
---
# BT-063: Replace puzzle zoom changes with checkpoint camera pans

## Problem

Position-selected unions of adjacent rooms change zoom repeatedly. The user
stopped the initial full-world playtest because this is distracting.

## Scope

Presentation-only correction. Reveal the next whole puzzle on checkpoint
collection; pan back as needed to retain the player without zooming. Preserve
terrain, hazards, checkpoints, clocks, exact continuation and legacy V1 framing.
Editor framing and positional audio locality remain separate from progression.

## Acceptance criteria

- [x] Gameplay scale remains constant at a given viewport across all eight sections and backtracking.
- [x] Checkpoint acquisition, not proximity to room edges, triggers the next reveal.
- [x] Reveals fit the complete puzzle, all threatening hazard sweeps and incoming checkpoint collection footprint.
- [x] Full-motion transitions pan smoothly; reduced motion snaps without zoom.
- [x] Backtracking retains the player without changing progression; pause/hidden states freeze presentation.
- [x] Reload, graphics recovery, resize, editor focus and global project/pick remain correct without level rebuilds.
- [x] Portable and native checks cover actual production routes and intermediate transition frames.
- [x] Verified production preview is refreshed for renewed human feedback, not declared gameplay acceptance.

## Implementation context

Use a presentation-only camera controller with precomputed reveal bounds:
union section frame, required hazard sweeps and incoming checkpoint disk plus
player clearance. Use the maximum reveal width and height for every gameplay
view; fit that common rectangle to the current viewport using existing tilt and
padding. Forward checkpoint changes interpolate only the center over 0.7 seconds
with cubic ease-in/out. Outside reveals, move the center only enough to retain
the player with 0.75-tile clearance. Initial/restored views snap. No camera
state is persisted and no transition pauses or resets simulation.

## Verification

TDD: camera baseline, failing controller/production-route tests, implementation,
targeted native camera and full-world reveal/readability checks, lifecycle
regressions, full portable suite and production build. Capture full/reduced
motion and portrait/landscape, including intermediate pan positions.

## Handoff

- Summary: Replaced gameplay zoom switches with checkpoint-driven whole-puzzle pans.
- Changes: Presentation camera/controller, focused native and portable coverage, related documentation.
- Verification: 402 portable tests, build, native camera/reveal/readability/journey/graphics/editor checks passed; evidence and the separate continuation limitation are below.
- Risks: Human camera/gameplay acceptance remains outstanding; BT-064 blocks a fresh all-green native continuation claim.
- Commit: None; primary worktree changes remain uncommitted alongside preserved inherited work.

Direct orchestrator implementation. Existing dirty-tree work is preserved.
BT-052 remains the accepted rough integration baseline, not human acceptance.
Session: `183b57e8-2976-4cc3-88cc-7f7536f244de`.

The new common production rectangle is 25.05 by 20.05 tiles. Only its center
moves. Scene initializes at this same scale before its first draw; a native
regression caught and corrected an initial legacy-frame fit. Restored runs
snap to the current puzzle without replaying old checkpoint pans.

Verification evidence:

- `npm test`: 402/402 portable tests passed, including both complete legal
  routes under both motion preferences; final typecheck and production build
  passed. Session logs: `bt063-tests-final.log`, `bt063-build.log`.
- All seven production reveals, halfway frames, player footprint, complete
  puzzle/hazard/landing visibility, projection/picking, frozen pause and exact
  reload passed at 1280x900, 390x844 and 844x390, full/reduced motion:
  `artifacts/checkpoint-camera/run-oFo0wv`,
  `artifacts/browser-check/run-w8hcRo`.
- Native held forward/backtracking, fixed zoom, resize, hidden-tab idleness and
  repeated resource checks passed at all six combinations:
  `artifacts/world-camera/run-Ny0xDV`,
  `artifacts/browser-check/run-gIUzN0`.
- Actual opaque locator pixel/readability checks passed at all four
  viewport/DPR combinations (`bt063-readability.log`).
- Full production journey passed, including all seven exact
  death/reload/respawn/downstream recoveries:
  `artifacts/browser-check/run-v66xk9`.
- Graphics lifecycle/pixels/resources passed on an isolated retry:
  `artifacts/graphics-recovery/run-gk2c10`,
  `artifacts/browser-check/run-zBUhgw`. The first attempt timed out on a native
  reload probe; it is retained in `bt063-graphics.log`, not presented as a pass.
- Native editor focus/picking, invalid-edit isolation, playtest and committed
  campaign isolation passed: `artifacts/bt047/native-0Hli5j`,
  `artifacts/browser-check/run-Z0j0z1`.

Separate regression limitation: the broader `constructor` continuation fixture
failed at mid-respawn reload twice, and failed identically with the accepted
pre-change Scene. BT-064 preserves that qualification blocker. No all-green
native continuation suite or full release acceptance is claimed.

## Result

- Summary: The bounded camera correction is verified and available for continued human
playtesting at `http://127.0.0.1:4400/`; no gameplay geometry, hazards, clocks,
persistence or saved-world revision changed. The owned attached preview serves
the verified build, not a publication:

- `index-DotRgueI.js` SHA-256:
  `83b8b8a53ff7bc5675a2aa5573555eba48999103793200403774a6235dc2a939`.
- `dist/index.html` and served HTML SHA-256:
  `e491307e5397db8d57ba4d64671e2b79d438c71d3909cbac5df84a3dc3844826`.

- Verification: The scoped portable and native evidence above verifies camera behavior and production reload/recovery. The separate fixture failure reproduces with the pre-change camera and remains tracked in BT-064, not counted as a pass.
- Integration: Reviewed directly in the primary worktree; the verified camera build is served by the existing attached preview. Gameplay data and persistence implementations are unchanged.

BT-053 still requires the user's actual progression/finale feedback. Busy
walls, hardware performance and overall release qualification remain separate
open gates. No commits or publication were made.
