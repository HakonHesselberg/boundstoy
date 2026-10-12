---
{
  "id": "BT-037",
  "title": "Overhaul animation using the 12 principles of animation",
  "type": "feature",
  "status": "done",
  "priority": "P2",
  "depends_on": [
    "BT-036"
  ],
  "parent": null,
  "scope": [
    "presentation/",
    "tests/",
    "docs/"
  ],
  "approval": "2026-10-10 user approved the BT-036/BT-037 investigation plan (\"approved, implement it\"): idle explosive marking, monotonic perimeter charge-up, full-footprint flash, cool harmless aftermath, then BT-037 frame interpolation, player feel, death/respawn/checkpoint/win beats and UI transitions. Warning stays 27 ticks; no whole-cycle cue.",
  "assignment": null,
  "blocked_reason": null
}
---
# BT-037: Overhaul animation using the 12 principles of animation

## Problem

The user requests an animation overhaul guided by the 12 principles of
animation, to make movement, feedback and transitions clearer and more polished.

## Scope

Audit player presentation, hazards, retries, completion and UI transitions.
Define a coherent motion treatment, then implement the approved treatment.
Apply principles where useful rather than forcing every principle into every
effect. Keep changes presentation-only; do not alter physics, input response,
collision geometry, routes, schedules or deterministic headless execution.

## Acceptance criteria

- [x] Document application or a reasoned non-application of all 12 principles: squash and stretch, anticipation, staging, straight-ahead action and pose-to-pose, follow-through and overlapping action, slow in and slow out, arcs, secondary action, timing, exaggeration, solid drawing and appeal.
- [x] Before/after clips demonstrate the approved treatment across movement, hazards, retry, completion and UI transitions.
- [x] Animation preserves immediate input response and accurately communicates gameplay state and collision footprints.
- [x] Reduced-motion equivalents retain essential information without unnecessary motion.
- [x] Hazard effects stay compact; warning remains 27 ticks and lethality remains exactly one tick with harmless aftermath.
- [x] Existing pause/hidden-page idle rendering and frame-pacing expectations remain satisfied.

## Implementation context

Requested on 2026-10-10 as issue creation, not implementation approval.
Review `presentation/scene.ts`, `presentation/hazard-visuals.ts`,
`presentation/main.ts` and CSS transitions. The existing four movement rules,
including full-speed soft-ice gliding and direction-locked hard ice, are fixed.
Coordinate hazard recommendations with BT-036; add a dependency if the selected
treatment actually requires its findings. This does not authorize new systems.

## Verification

Run `npm test`, `npm run build`, `npm run test:browser`,
`npm run test:journey` and `npm run test:explosions`.
Record named before/after real-time clips at 1280x900 and 390x844 in full and
reduced motion. Verify movement/turning, wall contacts, warnings, detonation,
aftermath, death/retry, completion, menu transitions and pause/hidden states.
Compare frame pacing with baseline and record human feedback on clarity and feel.

## Handoff

Integration resumed by the current orchestrator on 2026-10-10 after the user
confirmed the original author had finished and approved the complete release
plan. The original handoff below is preserved. Fresh `npm run release:check`
passes; read-only integration review identified one correction: respawn body
pop also shrinks the live footprint ring. Fixing that regression precedes code
acceptance. Human feel and hardware acceptance remain BT-053/055/057/058.

- Summary: Implemented the approved BT-036 hazard treatment and a presentation-only
motion pass. Pulses: flat amber pilot light + amber footprint outline when idle, a
clockwise perimeter fuse and ease-in glow peaking in a 4-tick white-hot pre-flash,
a full-footprint flash sheet fading over the existing 6-tick flash window (replacing
the small sphere), and aftermath that cools to subdued grey-blue. Motion: player/saw
interpolation between ticks (snaps over deaths/respawns), frame-rate-independent yaw
damping, speed stretch, impact squash spring on uncommanded velocity changes, lean in
turns, antenna follow-through, respawn pop, eased death ring/shrink, arcing void fall,
checkpoint gem pop, victory squash/hop/spin into the portal with delayed results card,
and CSS entry animations (overlay, pause/results card, menu fade, notice, feedback with
death shake, button press). Reduced motion disables all decorative motion and CSS
animation while keeping fuse/glow/flash/fade information.
- Changes: `presentation/motion.ts` (new), `presentation/hazard-visuals.ts`,
`presentation/scene.ts` (rig, record(), draw), `presentation/main.ts` (record per tick,
alpha, `won` overlay class, debug `animate()` and a pinned debug visual clock),
`presentation/style.css`, `tests/motion.test.ts` (new), `tests/hazard-visuals.test.ts`,
`tests/ground-visuals.test.ts` (scene fake), `tests/browser/motion-clips.ts`,
`package.json` (`test:motion`), `docs/ANIMATION.md` (12 principles),
`docs/research/explosion-readability.md`, GAME_SYSTEMS/ARCHITECTURE/TESTING/BROWSER_CHECKS/README.
- Verification: RED then GREEN for new hazard (4) and motion (7) tests; `npm test`
244/244; `npm run build` (typecheck) clean; `scripts/browser-check.ts`,
`tests/browser/journey.ts`, `tests/browser/explosions.ts`, `tests/browser/aftershock.ts`
and the readability browser runner all PASS (`artifacts/motion/after-browser-suites.log`).
Projected-footprint test passes for every tick, full and reduced motion.
Clips (deterministic 60 fps, two ticks/frame): `artifacts/motion/before/` vs
`artifacts/motion/after/`: hazards and Checkerboard (movement, dense warnings, death/retry,
completion) at 1280x900 and 390x844 in full and reduced motion, soft/hard ice turning,
wall contacts and void death at 1280x900, UI (menu, pause) in all four configurations,
plus named phase stills. Frame pacing (software renderer, three alternating samples):
before 87.3 ms mean, after 91.2 ms mean (+4%, overlapping ranges);
`artifacts/motion/frame-pacing-summary.json`.
- Risks: Display delay of at most one 8.3 ms tick from interpolation (input/physics
unchanged). One extra draw call per pulse pad (pilot). Before clips from the pre-change
working tree; baseline completion frames ran on a real-time clock. Human feedback on
clarity and feel has NOT been collected.
- Commit: Not committed; the working tree also contains another session's uncommitted
BT-031/032/034 edits in `presentation/scene.ts`, `presentation/style.css` and data files.
- Resources: All runner-owned Chromium/preview processes closed; baseline snapshot in
`/tmp/boundstoy-before` (disposable).
- Decisions: No whole-cycle cue. The menu uses an opacity-only fade (a transform would
re-anchor the fixed notice moved into the dialog), and entry animations do not scale,
so touch targets are never measured below 44 px mid-animation.

## Result

- Summary: Integrated and code-reviewed by the orchestrator in session
183b57e8-2976-4cc3-88cc-7f7536f244de, retaining the original uncommitted work.
The read-only review found a live respawn-footprint scaling bug. A new
`SceneDraw_RespawnPop_KeepsLiveFootprintAtFullWorldScale` regression failed on
the inherited code, then passed after restricting the pop to the body rig.
It checks every pop tick, alpha 0/0.5/1 and full/reduced motion.

- Verification: Fresh baseline `npm run release:check` passed; after the correction,
`node --test tests/motion.test.ts`, `npm test`, and `npm run build` passed.
`CLIP_SCENARIOS=checkerboard` browser verification passed in desktop/portrait,
full/reduced motion; evidence is `artifacts/motion/integration-correction/`
and `artifacts/browser-check/run-m4011i`. Runner-owned processes were cleaned up.
- Integration: Accepted working-tree changes, no commit. Human comprehension/feel and physical hardware acceptance remain
explicitly unclaimed and are tracked by BT-053/055/057/058.
