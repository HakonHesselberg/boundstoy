---
{
  "id": "BT-094",
  "title": "Compare other game sounds on a dedicated sound board",
  "type": "feature",
  "status": "done",
  "priority": "P1",
  "depends_on": ["BT-093"],
  "parent": null,
  "scope": ["data/sound-board.ts", "scripts/prepare-sound-board.ts", "public/audio/sound-board/", "public/audio/explosion-candidates/index.html", "index.html", "tests/sound-board.test.ts", "tests/audio.test.ts", "tests/browser/sound-board.ts", "docs/AUDIO.md", "docs/ARCHITECTURE.md", "public/THIRD_PARTY_NOTICES.txt", "tasks/issues/BT-094-other-sounds-board.md"],
  "approval": "User requests a board like the explosion comparison for other sounds. Proceeding with current references, two softer alternatives per remaining one-shot role, and existing ice choices; no gameplay replacement.",
  "assignment": null,
  "blocked_reason": null
}
---
# BT-094: Compare other game sounds on a dedicated sound board

## Problem

The user wants an explosion-style sound board for the other game sounds.

## Scope

Standalone board with eight one-shot groups (steps, mud, wall, warning, retry,
checkpoint, exit, button), each with its current cue and two softer original
CC0 alternatives. An ice group reuses the twelve existing tonal options and
current soft/hard cues. Reuse finite playback and shared output. Include
single/repeated previews, comparison with the approved puff, volume, mono,
Stop, downloads, explicit loading failures and responsive category controls.
No gameplay substitutions, new runtime dependency or automatic audible playback.

## Acceptance criteria

- [x] Nine groups, 38 choices, and sixteen new reproducible CC0 one-shots.
- [x] Alternatives are loudness-matched per role against current gameplay gain.
- [x] Warnings retain 225 ms; approved explosion and existing assets are unchanged.
- [x] At most four sources per repeat, finite ice previews, opt-in lazy loading and complete lifecycle cancellation.
- [x] Responsive keyboard/pointer controls, downloads and links from existing demos.
- [x] Native suite, build and muted browser checks pass; no speaker playback.

## Implementation context

The user was unavailable for a scope clarification. Use the proposed comparison
default, following the earlier explosion board, and leave all selection open.
Current references retain gameplay gains; tonal ice source previews use fades
but no movement-dependent filters. AuditionPlayer provides shared cancellation
and +12 dB protected output.

## Verification

TDD on registry, synthesis, manifest, levels and provenance. Actual browser
decoding/scheduling, per-group filtering, rapid replacement, cancellation,
errors/retry, zero volume, mono, visibility/page lifecycle, mobile hit targets,
storage isolation and rendered mixed peaks.

- RED: `node --test tests/sound-board.test.ts` failed before the board registry
  and builder existed. Final native suite: `npm test`, 546/546 passed.
- `npm run build`: passed, retaining only the existing chunk-size warning.
- New sixteen WAVs total 853,184 bytes. All WAVs and the manifest reproduce
  byte-identically in a separate output directory, removed after comparison.
  All sixteen existing explosion WAV hashes remain unchanged.
- Role targets measured with actual gameplay gains/fades; new assets are within
  0.1 LU of their reference in the delivered run. Raw new peaks 0.0090-0.0572.
- `node tests/browser/sound-board.ts`: all 102 controls, 39 lazy cached assets,
  exact context/repeat scheduling, finite ice expiry, group cancellation,
  Stop/mute/blur/hidden/pagehide, restored-page playback, failure/retry,
  unchanged storage, mono and keyboard Enter passed.
- 128 repeated/context output renders at 44.1/48 kHz passed, maximum peak
  0.498104811, with mono energy ratio above 0.65.
  Evidence: `artifacts/browser-check/run-fWNKsa/report.json` and
  `artifacts/sound-board/run-xWVbbD/` (mixes and three viewport screenshots).
- Responsive pointer targets verified at 1280x900, 390x844 and 844x390;
  desktop and portrait captures visually inspected.
- `node tests/browser/explosion-candidates.ts`: existing board passed.
  Evidence: `artifacts/browser-check/run-L18uTK/report.json`.
- Both final browser reports verified `--mute-audio`, success and owned-resource
  cleanup. Live `/audio/sound-board/index.html` returns HTTP 200 with 38 entries.
- Initial browser fixtures were corrected: Enter needs CDP text as in the
  existing keyboard helper; the intentional HTTP-failure pair now supplies
  its companion buffer locally so its expected abort cannot look like an
  unrelated network failure. No production checks were disabled.

## Handoff

- Summary: Standalone comparison board delivered; no new gameplay selection.
- Changes: Frozen design registry, deterministic builder, sixteen CC0 WAVs and
  provenance, category board reusing shared playback, demo links, tests and docs.
- Verification: Full native suite, build, browser interaction/output and
  reproducible asset checks above all passed.
- Risks: Technical delivery does not establish subjective sonic acceptance;
  quieter role references intentionally stay quieter than status feedback.
- Commit: Uncommitted primary-tree changes; no workers or commits.
- Resources: Test browsers/profiles/preview servers and duplicate generation
  directory cleaned. Existing user server remains running. No audible playback.
- Decisions: Keep existing/current references and softer alternatives together;
  preserve the approved explosion and all game state. Direct assignment was
  `copilot-audio`, run `22313679-7a79-4454-8d26-620ceffba984`, branch null,
  worktree `.`.

## Result

- Summary: Accepted the requested sound board with current cues and alternatives.
- Verification: 546 native tests, production build, all preview/lifecycle
  controls and 128 rendered output comparisons passed.
- Integration: Board and links integrated in the existing tree and live server;
  sound selection remains opt-in human feedback, not an automatic replacement.
