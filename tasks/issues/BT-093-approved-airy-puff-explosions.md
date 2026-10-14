---
{
  "id": "BT-093",
  "title": "Use approved Airy puff for gameplay explosions",
  "type": "feature",
  "status": "done",
  "priority": "P1",
  "depends_on": ["BT-092"],
  "parent": null,
  "scope": ["data/sounds.ts", "data/explosion-palette.ts", "scripts/prepare-explosion-palette.ts", "public/audio/explosion-candidates/", "public/audio/ice-candidates/manifest.json", "public/audio/physical-v2/audition.strudel.js", "public/THIRD_PARTY_NOTICES.txt", "tests/audio.test.ts", "tests/explosion-candidates.test.ts", "tests/browser/sound-demo.ts", "docs/AUDIO.md", "tasks/issues/BT-093-approved-airy-puff-explosions.md"],
  "approval": "2026-10-14 user: airy puff is approved for explosion sounds.",
  "assignment": null,
  "blocked_reason": null
}
---
# BT-093: Use approved Airy puff for gameplay explosions

## Problem

The softened Airy puff is approved, but gameplay still uses the pressure-crack
explosion from the older physical palette.

## Scope

Select the exact approved 200 ms impact in the shared gameplay sound registry.
Retain the existing buildup, other cues, output calibration, cooldowns,
priorities, voice limits and all gameplay behavior. Reuse the approved asset
without remastering or duplicating it. Update selection metadata and credits.

## Acceptance criteria

- [x] Gameplay and Sound garden load and play the exact approved puff, not the old blast.
- [x] The quieter source master is gain-compensated while eight aligned voices retain the existing premix headroom.
- [x] Warning and all other cues and playback/lifecycle rules remain unchanged.
- [x] Selection metadata, listening-page copy and licensing identify approval as impact-only.
- [x] Native tests, build and muted browser checks pass; no audible automation.

## Implementation context

The approved WAV SHA-256 is
`de5a2d70ebfab6ee40a315a2e707ed6a8c2e2c19776edb75417a2094e635cec2`.
Use cue gain 1.2 with the existing 0.5 premix: this compensates for its low-level
master and keeps single-cue peak near the old explosion's peak, without the
old crack or a global gain change. The listening page keeps its own volume.

## Verification

Asset hash and selection regressions first, actual bank/voice inspection,
dense and rapid output measurements, full native suite and production build.

- RED: registry and manifest tests failed with the old blast and no selection.
- `node --test tests/audio.test.ts tests/explosion-candidates.test.ts tests/ice-candidates.test.ts`: 16/16 passed.
- `npm test`: final run 544/544 passed. The first full run caught the archived
  ice comparison's stale gameplay-reference metadata; updated that reference,
  matching its existing generator, without changing its ice assets.
- `npm run build`: passed; only the existing chunk-size warning.
- `node tests/browser/sound-demo.ts`: passed actual approved-asset fetch and
  200 ms stereo voice inspection, no old-blast fetch, all cue buttons, lifecycle,
  gameplay, recovery and save isolation. Eight aligned blasts peak at 0.648213208
  before the output boost; all ice crossfades with six blasts stay below 0.512694.
  Evidence: `artifacts/browser-check/run-ucqZ9w/report.json` and
  `artifacts/sound-demo/run-1OybCD/`.
  The first concurrent run `run-i4fbis` passed sound checks but timed out waiting
  for real-time wall reflection; the unchanged scenario passed when rerun alone.
- `node tests/browser/audio-output.ts`: 110 calibrated output measurements
  passed; +12 dB lift and 0.85 peak ceiling retained.
  Evidence: `artifacts/browser-check/run-TveUrd/report.json` and
  `artifacts/audio-output/run-ed7R18/`.
- `node tests/browser/explosion-candidates.ts`: all 40 controls and rapid
  repeats passed. Evidence: `artifacts/browser-check/run-Ks50vC/report.json`.
- `node tests/browser/ice-candidates.ts`: updated gameplay-reference mix and
  lifecycle passed. Evidence: `artifacts/browser-check/run-aO3e8T/report.json`.
- All sixteen explosion candidate WAV hashes are unchanged after regeneration.
  Live port 4321 serves the updated registry, selection and approved WAV.

## Handoff

- Summary: Approved impact adopted across the shared gameplay registry and
  Sound garden; other candidate components are not promoted.
- Changes: Shared selection, blast sample/gain, asset/voice/headroom regressions,
  manifest selection and archived ice-page reference, documentation and credits.
  The historical physical-palette Strudel recipe is clearly marked as archived.
- Verification: Final commands and evidence above; full suite and all final
  browser checks passed. Browser automation retained `--mute-audio`.
- Risks: No new sonic design or warning selection inferred from the approval.
- Commit: Uncommitted primary-tree changes; no workers or commits.
- Resources: Owned test browsers, profiles and preview servers cleaned; existing
  user server left running. No speaker playback or system-volume changes.
- Decisions: Reuse the approved WAV rather than making a copy or remaster.
  Preserve original-rate playback, 55 ms cooldown, priority 2 and eight voices.
  Direct assignment was `copilot-audio`, run
  `22313679-7a79-4454-8d26-620ceffba984`, branch null, worktree `.`.

## Result

- Summary: User-approved softened Airy puff is the gameplay explosion.
- Verification: Exact approved asset, real player playback and bounded output
  verified; current native suite passed 544/544.
- Integration: Registry, metadata, tests and documentation integrated directly.
