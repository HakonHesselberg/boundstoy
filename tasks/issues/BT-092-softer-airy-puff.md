---
{
  "id": "BT-092",
  "title": "Soften Airy puff for frequent explosions",
  "type": "feature",
  "status": "done",
  "priority": "P1",
  "depends_on": [],
  "parent": null,
  "scope": ["data/explosion-palette.ts", "scripts/prepare-explosion-palette.ts", "public/audio/explosion-candidates/", "tests/explosion-candidates.test.ts", "tests/browser/explosion-candidates.ts", "docs/AUDIO.md", "tasks/issues/BT-086-consumer-screen-flow.md", "tasks/issues/BT-092-softer-airy-puff.md"],
  "approval": "User selects Airy puff as the best direction and requests softer sound for several explosions per second.",
  "assignment": null,
  "blocked_reason": null
}
---
# BT-092: Soften Airy puff for frequent explosions

## Problem

Airy puff is the preferred direction, but needs less bite and accumulation when
several explosions occur per second.

## Scope

Revise the existing listening-page candidate, not production audio. Round the
attack, reduce treble, shorten the tail to 200 ms and lower both components by
3 dB. Preserve the shared output gain and other candidates. Add eight finite
blast-only repeats at four per second for comparison; no automatic playback.

## Acceptance criteria

- [x] Airy puff has a rounded onset, under 3% spectral energy above 3 kHz and a short tail.
- [x] Its delivered event-train targets are -43 LUFS warning and -36 LUFS blast.
- [x] Other candidate WAVs remain byte-identical; warnings stay exactly 225 ms.
- [x] Rapid previews schedule eight finite blasts 250 ms apart with existing stop/mute/lifecycle protections.
- [x] Native suite, build and muted browser checks pass; no sounds played through speakers.

## Implementation context

Reuse the seeded synthesis, static mastering, shared output and finite
eight-source AuditionPlayer. Softer timbre is not a global volume rollback.

## Verification

Native asset/envelope/spectrum tests, deterministic regeneration, WAV hash
comparison, browser scheduling/lifecycle and actual calibrated output checks.
Subjective acceptance remains the user's decision.

- RED: new native tests failed on the original duration and mastering level;
  browser run `artifacts/browser-check/run-zeWlAV` failed at the missing rapid button.
- GREEN: `node --test tests/explosion-candidates.test.ts` passed 3/3.
- `npm test` passed 543/543; `npm run build` passed with the existing chunk-size warning.
- `node tests/browser/explosion-candidates.ts` passed all 40 preview controls,
  16 cached decodes, exact scheduling, finite expiry, cancellation, mono and
  clickable 44px controls at 1280x900, 390x844 and 844x390.
  Evidence: `artifacts/browser-check/run-G239uK/report.json` and
  `artifacts/explosion-candidates/run-zMGjMl/`.
- Sixteen raw paired patterns and sixteen calibrated rapid patterns passed at
  44.1/48 kHz. Maximum rapid output peak 0.594360352; no stereo/mono difference.
- `node tests/browser/audio-output.ts` passed 110 output measurements, unchanged
  +12 dB individual calibration and peak ceiling.
  Evidence: `artifacts/browser-check/run-3cr0bQ/report.json` and
  `artifacts/audio-output/run-14DB8j/`.
  The initial attempt `run-KpjcJF` failed with `net::ERR_NETWORK_CHANGED`;
  the unchanged rerun passed without weakening network checks.
- All 14 non-puff WAV hashes match the before snapshot. All 16 WAVs and the
  manifest reproduce byte-identically from a separate output directory; that
  temporary duplicate directory was removed. Delivered WAV total: 956,864 bytes.
- Live port 4321 serves the new 200 ms puff and rapid-preview manifest.

## Handoff

- Summary: Softer listening candidate and rapid-repeat comparison delivered.
- Changes: Data-owned puff filter/envelope/level settings, regenerated puff
  assets and provenance, finite rapid controls, native and browser regressions,
  related audio documentation.
- Verification: Commands and evidence above; all final checks passed.
- Risks: Silent checks cannot establish subjective comfort. Gameplay audio
  selection is deliberately unchanged.
- Commit: Uncommitted primary-tree changes; no workers or commits.
- Resources: Both final browser checks cleaned their owned processes, profiles
  and preview servers. Existing user server remains running. No audible previews.
- Decisions: On the user's explicit request to continue, reconciled BT-086's
  returned handoff and stale reservation, preserving its UI implementation and
  unresolved verification. Assignment for this direct work was `copilot-audio`,
  run `22313679-7a79-4454-8d26-620ceffba984`, branch null, worktree `.`.

## Result

- Summary: Accepted the implemented and verified softer Airy puff revision.
- Verification: Full native suite, build, actual browser lifecycle/output,
  deterministic regeneration and unchanged alternative assets.
- Integration: Changes integrated directly in the existing working tree;
  final sonic selection remains with the user.
