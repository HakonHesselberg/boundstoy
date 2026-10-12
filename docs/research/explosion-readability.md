# Explosive tile and charge-up readability

Evaluation for **BT-036**, 2026-10-10. Recommendations below were approved by
the user on the same day and implemented by **BT-037**; this document records
the baseline evidence and the acceptance method, not proof that players now
read the hazards correctly.

## Method and evidence labels

- **O (observed by a player):** the user reported that they cannot tell which
  tiles explode or what the charge-up looks like. This is the only human
  observation available; no additional observers were recruited.
- **C (capture):** deterministic production captures from the pre-change build
  (`tests/browser/motion-clips.ts`, 60 fps, two 120 Hz ticks per frame) at
  1280x900 and 390x844 in full and reduced motion:
  `artifacts/motion/before/hazards-*.mp4` and named phase stills `-idle-t10`,
  `-warning-t30`, `-preflash-t44`, `-flash-t46`, `-aftermath-t56`, `-death-t166`.
  Earlier BT-030 captures (`artifacts/aftershock/visual-grid-*`,
  `aftershock-checkerboard-v1-board.png`) cover both ground shades and the dense
  mixed-phase Checkerboard.
- **S (source inspection):** `presentation/hazard-visuals.ts`, `data/terrain.ts`.
- **H (hypothesis):** design inference not yet confirmed by observers.

## Findings (pre-change)

1. **Idle explosive tiles are not recognisable (O, C, S).** Safe pads are drawn
   in the ordinary ground parity colour. Their only mark is a 1 px outline
   `#536579` on `#486578` (later `#425a6c`) ground: almost no contrast. In the
   Checkerboard idle frame the explosive columns 2-9 are indistinguishable from
   the safe columns 10-14 at both viewports. BT-030 removed the raised vents and
   pad edges that previously carried this identity.
2. **The charge-up loses salience as ignition approaches (C, S).** The single
   ring shrinks from 0.27 to 0.11 tile radius, so the last warning frames show a
   dot (`-preflash-t44`). Warning colours are *darker* than the ground (luma
   about 83 vs 96 light and 50 vs 62 dark); the emissive ramp is linear 0.3-0.7.
   At 225 ms, about human reaction time, there is no "about to blow" peak (H).
3. **Detonation often does not show its footprint (C, S).** The hot full-tile
   plate exists for the single lethal tick only. At 60 Hz a frame lands on that
   tick about half the time; `-flash-t46` shows only a small sphere of radius
   0.2 while the lethal area is the 0.86-tile square plus the 0.20 player radius.
4. **Inverted salience (C, S, H).** The harmless 300 ms aftermath, a warm
   `#ffdb6a` shock ring at 0.9 opacity plus yellow shards, is the longest and
   most visible phase. Warm, bright colour reads as fire, which teaches players
   to avoid tiles exactly when they are safe.
5. **Reduced motion keeps only a faint countdown (C, S).** The ring is frozen at
   full size, so the 0.3-0.7 emissive ramp is the only progress signal.
6. **Mixed phases (C).** Adjacent pads in different phases stay spatially
   separate (BT-030), but because idle pads look like floor, a viewer sees
   unexplained brown squares appear in the floor rather than a field of armed
   pads taking turns (H).

## Recommendations (approved, implemented in BT-037)

Timing, footprint and lethality stay unchanged: 27-tick warning, one lethal
tick, harmless 36-tick aftermath. No whole-cycle cue is added because it would
effectively lengthen the warning.

| Phase | Change | Reason |
| --- | --- | --- |
| Idle | A flat amber pilot light at the pad centre and an amber footprint outline, over the unchanged parity floor colour | Categorical "armed pad" identity without raised clutter; outline is the danger footprint |
| Charge-up | A fuse band fills the pad perimeter clockwise over the 27 ticks; brightness rises with an ease-in curve and the pilot swells and whitens | Monotonic salience peaking at ignition; progress remains legible without motion |
| Pre-flash | Last 4 ticks: complete fuse plus white-hot pilot and plate glow | Anticipation immediately before the flash |
| Detonation | A full-footprint flash sheet fades over the existing 6-tick flash window; the small sphere is removed | Every 60 Hz frame sequence shows the full danger square; plate colour still returns to safe immediately after the lethal tick |
| Aftermath | Shock ring and shards cool from warm to grey-blue, lower opacity, ease-out expansion | Reads as spent debris, not fire |
| Reduced motion | No expansion or particle travel; fuse fill, colour and brightness ramps, and flash fade remain | Essential state without decorative movement |

## Follow-up acceptance method

1. **Automated (implemented in `tests/hazard-visuals.test.ts`):** idle pilot
   contrast against both ground shades, monotonic warning salience across all
   27 ticks, a pre-flash peak, full-footprint flash on every frame within the
   6-tick window, cool low-opacity aftermath and unchanged footprint/timing.
2. **Captures:** `npm run build && node tests/browser/motion-clips.ts` writes
   after clips to `artifacts/motion/after/` for comparison with the baseline.
3. **Human (still required):** show the after clips or live Checkerboard to at
   least three observers who have not seen this document. Ask them to: point at
   every explosive tile in the idle frame; say "now" when a tile is about to
   explode; say when it is safe to re-enter. Record verbatim answers, the
   number of misidentified tiles and any "safe/unsafe" reversals. Accept when
   all observers identify every idle pad and none treat the aftermath as
   dangerous; otherwise iterate on the visuals, not the timing.
