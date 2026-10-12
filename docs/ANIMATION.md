# Animation

Motion in Boundstoy is presentation only. `core/` and the fixed 120 Hz `step`
never read animation state; `presentation/motion.ts` observes ticks and derives
poses. Input, collision, schedules, the 27-tick warning and the single lethal
pulse tick are unchanged. While the player is live, its base ring remains at
full scale: the respawn pop scales only the body rig. Pulse footprints never
squash or grow.

## The twelve principles

| Principle | Application | Where |
| --- | --- | --- |
| Squash and stretch | The body stretches along its heading with speed and squashes on uncommanded velocity changes (curb stops, soft-ice reflections, wall hits). Deliberate walking starts/stops only settle (no squash). The base ring stays rigid so the footprint is never misrepresented. | `Scene.draw` rig scale, `PlayerMotion.squash` |
| Anticipation | Player input cannot be delayed, so anticipation lives in hazards: the pulse fuse fills the pad perimeter over the 27 warning ticks, glow rises on an ease-in curve and the pilot swells to a white-hot pre-flash in the final 4 ticks. The victory hop starts with a short squash. | `updatePulse`, victory beat |
| Staging | Idle explosive pads in the running puzzle carry one amber pilot light and an amber footprint outline, so armed tiles read before any warning; dormant pads elsewhere fall back to a neutral grey mark. The aftermath cools to grey-blue so the next real threat stays the most salient thing on screen. The camera never shakes. | `hazard-visuals.ts` |
| Straight-ahead and pose-to-pose | Pose-to-pose throughout: every effect is a pure function of ticks or the visual clock, so pause, debug stepping and captures are deterministic. Straight-ahead simulation (particles with their own physics) is deliberately not used. | `updatePulse`, `PlayerMotion` |
| Follow-through and overlapping action | The antenna trails the body while moving and whips forward on impact; the impact spring overshoots into a stretch before settling; flash, shock ring and shards finish at different times. | `spring`, antenna offset |
| Slow in and slow out | Shock ring, shards, death ring and checkpoint collection ease out; void falls ease in (gravity); the victory spin eases in and out; UI cards ease out on entry. Hazard glow eases in toward ignition. | `motion.ts` easing helpers |
| Arcs | Shards fly on parabolic arcs; a void fall continues the pre-death drift while gravity pulls it down; the victory hop is a sine arc. | `updatePulse`, `Scene.draw` |
| Secondary action | Lean into soft-ice turns (from smoothed yaw rate), forward tilt with speed, idle bob, antenna lag, checkpoint zone fade on collection, portal flare on victory. None of these occlude a hazard footprint. | `Scene.draw` |
| Timing | Sim-tick-timed cues (impacts, respawn pop, checkpoint pop) freeze with pause and replay identically. Yaw smoothing uses `1 - exp(-rate·dt)`, so turning feels the same at 60, 120 or 144 Hz. Player and saws are interpolated between ticks (at most one 8.3 ms tick of display delay) to remove judder on non-120 Hz displays; pulses always show exact ticks. | `interpolate`, `damp`, `main.ts` frame |
| Exaggeration | Applied only where it carries information: the full-tile flash on every frame of the 6-tick flash window, the pre-flash peak, the death-feedback shake and the respawn overshoot. Normal movement remains understated. | CSS `feedback-shake`, `updatePulse` |
| Solid drawing | Squash preserves approximate volume (wider when shorter) and pivots at the feet, so the robot stays grounded. Below about 41 px per tile the visor and eyes hide, leaving a clean body, bold footprint ring and heading arrow. Flat hazard marks are flush with the floor (≤ 0.03 tile) and stay inside the projected footprint in every tick (tested). | `tests/mobile-readability.test.ts` |
| Appeal | A short respawn pop (ease-out-back), a hop and spin into the exit portal before the results card, and the menu/overlay/notice entry animations give the robot and UI a coherent, friendly character without slowing play. | `Scene.draw`, `style.css` |

## Reduced motion

With `prefers-reduced-motion: reduce` the visual clock is frozen for
decorations, squash/stretch, lean, respawn pop and the victory hop are disabled,
pulse shards do not travel and the shock ring does not expand, and all CSS
transitions/animations are removed. Essential information remains: the fuse
fill, glow and pilot colour ramps, the full-tile flash fade, the death ring fade
and saw positions.

## Verification

- `npm test`: `tests/motion.test.ts` (refresh-rate independence, interpolation
  snapping, impact classification, tick-timed cues, unchanged `step` results) and
  `tests/hazard-visuals.test.ts` (idle contrast, monotonic charge-up, flash
  coverage, cool aftermath, timing and footprint).
- `npm run build && node tests/browser/motion-clips.ts --timeout 600000` writes
  deterministic 60 fps clips (two ticks per frame) and phase stills to
  `artifacts/motion/after/`; `CLIP_DIR` and `CLIP_SCENARIOS`
  (`hazards,checkerboard,soft,hard,ui,pacing`) select output and subset. The
  debug-only `animate(seconds)` hook advances the visual clock for the victory
  beat; CSS animations are seeked through the Web Animations API.
- Human feedback on clarity and feel is still required; see
  `docs/research/explosion-readability.md` for the hazard observer protocol.
