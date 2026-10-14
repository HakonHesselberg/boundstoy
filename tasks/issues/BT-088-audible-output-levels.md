---
{
  "id": "BT-088",
  "title": "Raise usable audio output across gameplay and listening rooms",
  "type": "bug",
  "status": "done",
  "priority": "P1",
  "depends_on": [],
  "parent": null,
  "scope": ["public/audio/output.js", "public/audio/output.d.ts", "public/audio/audition-player.js", "presentation/audio.ts", "tests/audio-output.test.ts", "tests/audio.test.ts", "tests/ice-audio.test.ts", "tests/browser/audio-output.ts", "docs/AUDIO.md", "docs/ARCHITECTURE.md", "tasks/issues/BT-079-soft-expressive-ice-candidates.md"],
  "approval": "2026-10-14 user: sounds are generally too low, and cannot be heard over other room sounds even at maximum volume. Correct the usable playback range without changing sound character or system volume.",
  "assignment": {"owner": "audio-output", "run": "22313679-7a79-4454-8d26-620ceffba984", "branch": null, "worktree": "."},
  "blocked_reason": null
}
---
# BT-088: Raise usable audio output across gameplay and listening rooms

## Problem

Earlier mixes deliberately kept large amounts of headroom. Ice masters sit at
-30 LUFS, explosion event trains at -33 LUFS, and physical cues receive small
individual gains plus a 0.5 premix gain. Even a 100% slider did not offer an
adequate listening level for the user. Soft timbre was conflated with low output.

## Scope

One shared +12 dB playback calibration for normal gameplay, Sound garden and
both standalone listening rooms. Preserve source masters, relative balances,
movement, timings, routes, saves, slider defaults and saved preferences.
Add a bounded soft peak ceiling for unusually dense overlaps, with user volume
after the ceiling. Never change system volume or play through user speakers.

The implementation is shared public JavaScript for native listening pages and
the Vite gameplay bundle, with a typed declaration for the TypeScript adapter.
No runtime dependency, asset remaster, production sound selection or UI rewrite.

## Acceptance criteria

- [x] Actual output graph in gameplay and both listening pages uses the same calibration.
- [x] All 42 individual sounds gain 12 dB within 0.2 dB at full volume.
- [x] Eight aligned blasts and all ice crossfade/six-blast combinations retain measured headroom at 44.1/48 kHz.
- [x] Ordinary signal range stays linear; volume operates after peak control and zero is silent.
- [x] Preview expiry, loading/retry/cancellation, mono, mute, pause/blur/hidden/pagehide and disposal retain behavior.
- [x] Full native suite, build and muted browser checks pass; source assets and persistent preferences stay unchanged.

## Implementation context

`public/audio/output.js` freezes the output settings. Input gain is
10^(12/20), approximately 3.981. The WaveShaper curve is linear through
absolute amplitude 0.7 and smoothly flattens to 0.85 at unit input, with
matching slope at the linear boundary. Inputs beyond unit magnitude remain
at the endpoint. The final GainNode applies user volume, so reducing volume
does not alter peak-ceiling drive.

Native dynamics compression was investigated but rejected: its startup
envelope/makeup gain changed relative levels between sharp and sustained
sounds, and the aligned-blast probe still reached 1.001. Fourfold shaper
oversampling was also rejected because its output filtering overshot to 1.054.
The delivered memoryless, non-oversampled ceiling retains ordinary timbre
and catches only large overlaps; it is not described as transparent when
actually limiting an overload.

The dormant BT-079 assignment was reconciled: its technical delivery is
preserved, but final human selection is pending. It is now blocked without
an active worker/reservation rather than conflicting with BT-086's UI review.
No BT-086 implementation or other shared-tree work was reverted.

## Verification

- TDD: the new output-stage regression failed before implementation.
  Native coverage checks gain, exact linear region, monotonic bounded curve,
  zero DC, post-ceiling volume routing and output-node disposal.
- `node --test tests/audio-output.test.ts tests/audio.test.ts tests/ice-audio.test.ts`:
  14/14 passed. Existing test doubles and explicit public-audio inventory
  were updated for the shared stage; all per-source limits remain intact.
- `npm test`: 537/537 passed, no skipped/cancelled tests.
  Session log: `files/loudness-tests.log`.
- `npm run build`: type-check and production build passed; existing
  large-chunk warning only. Both live Vite module URLs also return HTTP 200.
- `node tests/browser/audio-output.ts`: 110 before/after measurements:
  42 individual sounds at two rates plus thirteen dense scenarios at two
  rates. Individual RMS gains range from 11.99999967 to 12.00000024 dB.
  Maximum output peak is 0.850000024, also after fourfold reconstruction.
  Quarter-volume output is linear and zero-volume output is exactly zero.
  Actual runtime graph inspections cover gameplay and both listening pages.
  Report: `artifacts/browser-check/run-MuXmJV/report.json`.
  Measurements: `artifacts/audio-output/run-ctwHRb/measurements.json`.
- Existing browser lifecycle suites passed with the new shared stage:
  explosion room `artifacts/browser-check/run-lzsiPD/report.json`;
  archived ice room `artifacts/browser-check/run-ekRTKx/report.json`;
  Sound garden `artifacts/browser-check/run-UWNglI/report.json`.
  Their historical offline source/reference measurements remain pre-output;
  the new output check is the authoritative playback-level evidence.
- All owned browsers used the asserted `--mute-audio` flag and were cleaned,
  along with their isolated profiles/sockets/preview servers. No sound was
  auditioned on user speakers and no system-volume setting was changed.
- No layout or mechanics changed. Human audibility on the user's specific
  speakers in their room remains listening feedback, not a claimed measurement.

## Handoff

- Summary: Playback is substantially louder at the same slider position,
  with a shared peak ceiling rather than quieter/retuned sound assets.
- Changes: Shared output module and declaration, two adapter integrations,
  output/mix regressions, audio documentation and the stale BT-079 reservation.
- Verification: Full native suite, build, real graph inspections, 110 measured
  output cases and all existing sound lifecycle flows pass.
- Risks: Large overloads are intentionally softened. Source WAV downloads
  retain their original levels; the change is playback calibration.
- Commit: None requested or made; unrelated shared changes preserved.
- Resources: Only retained evidence remains. The existing development server
  was not launched or stopped by this task.

## Result

- Summary: The requested usable loudness increase is delivered across all
  game/listening surfaces without changing system volume or source sounds.
- Verification: 537/537 native tests, production build and four muted browser
  suites pass; ordinary sounds gain 12 dB and tested overloads stay below full scale.
- Integration: Refresh the game or listening room to load the new stage.
  Start below maximum because existing slider values are deliberately retained.
  This does not declare final sonic selection or human room-acoustics acceptance.
