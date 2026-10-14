---
{
  "id": "BT-095",
  "title": "Adopt retry and button approvals and revise remaining sound choices",
  "type": "feature",
  "status": "done",
  "priority": "P1",
  "depends_on": ["BT-094"],
  "parent": null,
  "scope": ["data/sounds.ts", "data/sound-board.ts", "scripts/prepare-sound-board.ts", "public/audio/sound-board/", "public/audio/physical-v2/audition.strudel.js", "public/THIRD_PARTY_NOTICES.txt", "tests/audio.test.ts", "tests/sound-board.test.ts", "tests/browser/sound-board.ts", "tests/browser/sound-demo.ts", "docs/AUDIO.md", "docs/ARCHITECTURE.md", "tasks/issues/BT-095-sound-approvals-and-jingles.md"],
  "approval": "User approves Falling feather for retry and Soft tick for buttons; requests warmer checkpoint jingles, triumphant exit jingles, and different footsteps, mud and wall-contact sounds.",
  "assignment": null,
  "blocked_reason": null
}
---
# BT-095: Adopt retry and button approvals and revise remaining sound choices

## Problem

Two choices are approved, while five sound roles need a new direction.

## Scope

Promote exact Falling feather and Soft tick assets at their auditioned levels,
without changing cadence or priority. Show approvals clearly on the board
without duplicate copies of the same choice. Replace the ten rejected board
options with six fresh tactile alternatives and four original note-sequence
jingles: two warm checkpoint arrivals and two short triumphant exits.
Other gameplay cues remain unchanged pending approval.

## Acceptance criteria

- [x] Retry and button assets remain byte-identical and work in gameplay at the approved mix levels.
- [x] Current/approved board choices are accurately labelled with no duplicate approved option.
- [x] New step/mud/wall alternatives differ from the rejected choices.
- [x] Checkpoint and exit alternatives contain actual timed note sequences and finite non-overlapping repeats.
- [x] Mastering is reproducible from fixed references, never normalized against its own previous output.
- [x] Full native suite, build and silent browser checks pass; no speaker playback.

## Implementation context

Approved hashes: Falling feather
`21ee31246dd0934cebe759ea5375e0d6ec67785bebbb171e657441b3544127ee`;
Soft tick `9fa8473fde48c50eea5925ac5300744073255c963abb6f3f7281fa649e6a2e4e`.
Cue gain 2 cancels the existing 0.5 premix for these already role-mastered files.
Authoring must retain fixed physical-palette reference levels so approval
cannot introduce a circular mastering dependency. Longer jingles require
measurement intervals long enough to include their complete tails.

## Verification

- RED: targeted suite failed four approval/selection/redesign assertions before
  implementation. GREEN: final targeted suite 16/16; full `npm test` 549/549,
  zero failures/skips. `npm run build` passed type checking and production build.
- A stricter note-tail regression found floating-point boundary residues;
  note scheduling now uses integer sample boundaries. Tests check each note's
  actual onset, silence outside its lifetime and reconstruction of the phrase.
- Re-rendered all sixteen WAVs and manifest into a fresh directory: byte-identical.
  All six retained warning/retry/button waveforms match the pre-feedback hashes.
  Total authored bank: 1,444,544 bytes. Temporary reproduction directory removed.
- Board browser report: `artifacts/browser-check/run-DVCtQM/report.json`;
  captures and 120 offline mixes: `artifacts/sound-board/run-X1lwd4/`.
  All 96 preview controls, 37 lazy/cached files, approval badges, timing, finite
  expiry, cancellation, failures/retry, keyboard/mobile and storage isolation passed.
  Maximum repeated/context output peak: 0.498105 at 44.1/48 kHz.
- Gameplay report: `artifacts/browser-check/run-xDMBxE/report.json`;
  evidence: `artifacts/sound-demo/run-4v95FO/`. Exactly two approved board assets
  enter the gameplay bank; actual retry/button sources are stereo, rate 1,
  0.34/0.09 seconds. Existing route, recovery, movement and audio lifecycle passed.
- Output report: `artifacts/browser-check/run-bKe9uN/report.json`;
  measurements: `artifacts/audio-output/run-yew75L/`. All 110 output cases passed,
  maximum peak 0.850000024; calibration and mute/volume behavior unchanged.
- Every owned browser verified `--mute-audio` and cleaned its resources.
  Existing server was left running. HTTP checks confirmed the live board's
  current manifest and all sixteen authored assets match their expected hashes.

## Handoff

- Summary: Approved retry/button cues integrated; ten redesigned alternatives
  delivered without selecting unapproved gameplay sounds.
- Changes: Gameplay selection, immutable timbre/note definitions, reproducible
  mastering, assets, board approval labels, tests, licenses and documentation.
- Verification: Full native suite, production build and all three muted-browser
  scenarios passed; waveform preservation, regeneration and live HTTP verified.
- Risks: Subjective acceptance of the ten new suggestions remains a human gate.
- Commit: Uncommitted direct primary-tree work; no workers or commits.
- Resources: Owned browsers, profiles, preview servers and reproduction scratch
  directory cleaned. Existing user server remains running.
- Decisions: Keep exact approved WAVs and compensate premix, use fixed historical
  mastering references, and retain all unapproved gameplay cues unchanged.

## Result

- Summary: Falling feather and Soft tick now play at their approved levels.
  Board choices are deduplicated (36 total), with explicit approval badges.
  Soft shoe/Wooden patter, Damp tread/Sticky release, Rubber nudge/Fabric catch,
  Hearth notes/Coming home and Little fanfare/Victory flourish replace the ten
  rejected suggestions. The four jingles contain real timed note sequences,
  with warm lower-register checkpoint voices and rounded triumphant exit voices.
- Verification: 549/549 native tests, production build, three muted-browser
  scenarios, 120 board mixes, 110 output cases and byte-identical reproduction.
- Integration: Live game and board serve the new selections and assets.
  The ten new choices remain audition-only pending human listening approval.
  Airy puff, current warning, all other gameplay cues and deterministic mechanics
  remain unchanged. No commits, dependencies or system-volume changes.
