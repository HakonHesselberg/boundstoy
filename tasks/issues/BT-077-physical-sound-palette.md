---
{
  "id": "BT-077",
  "title": "Replace rejected Kenney sounds with a physical custom palette",
  "type": "feature",
  "status": "done",
  "priority": "P2",
  "depends_on": ["BT-075"],
  "parent": null,
  "scope": ["data/sounds.ts", "data/sound-demo.ts", "scripts/prepare-audio.ts", "public/audio/", "public/THIRD_PARTY_NOTICES.txt", "presentation/main.ts", "index.html", "tests/audio.test.ts", "tests/browser/sound-demo.ts", "docs/AUDIO.md", "docs/PLATFORM.md", "README.md", "tasks/issues/BT-075-sound-garden.md"],
  "approval": "2026-10-13 user rejected every Kenney sound and requested a different approach and sounds, then explicitly suggested Strudel.",
  "assignment": {"owner": "physical-sound-palette", "run": "22313679-7a79-4454-8d26-620ceffba984", "branch": null, "worktree": "."},
  "blocked_reason": null
}
---
# BT-077: Replace rejected Kenney sounds with a physical custom palette

## Problem

The user auditioned the entire BT-075 palette and rejected its tonal fit.
Technical mix safety did not imply aesthetic acceptance. Do not retain the
glass arpeggios, interface-pack scratches or Kenney assets.

## Scope

Replace all eleven cues: independent CC0 recorded stone/sand footsteps and
mechanical contacts, plus deterministic custom friction, fuse, explosion and
status sound design. Retain the existing playable demo, physics and playback
lifecycle. Supply a Strudel local-folder audition pattern without adding a
runtime dependency or sending samples to a service.

BT-076 is concurrently editing puzzle/menu surfaces. Only touch sound-specific
copy in shared files; do not alter its levels, selectors or canonical record.

## Acceptance criteria

- [x] No Kenney sample or notice remains in shipped audio; all cue paths change.
- [x] Independent recordings have verified CC0 provenance; custom DSP is reproducible.
- [x] Status cues no longer use a shared glass sample or a note arpeggio.
- [x] Demo identifies the replacement palette and still supports all cue auditions.
- [x] Strudel recipe uses the replacement local samples, not stock drums or network URLs.
- [x] Peak headroom, finite PCM, audible output and bounded asset size are measured.
- [x] Audio tests, full suite, build and browser demo pass.

## Implementation context

Fantozzi's CC0 footsteps, edited by qubodup:
https://opengameart.org/content/fantozzis-footsteps-grasssand-stone
rubberduck's CC0 recorded foley:
https://opengameart.org/content/100-cc0-sfx
Freesound ice/explosion candidates were researched, but public preview downloads
returned HTTP 403. Do not claim those recordings are included.
Strudel local folder import:
https://strudel.cc/learn/samples/#from-disk-via-import-sounds-folder

## Verification

Baseline `node --test tests/audio.test.ts tests/sound-demo.test.ts`: 10/10 pass.
Red: missing custom renderer failed import; after adding the renderer, the
old-asset exclusion test failed on all seven Kenney WAVs and both notices.
Green targeted audio/demo tests: 13/13. Full `npm test`: 501/501, zero failures.
`npm run build`: passed type checking and production build; existing bundle-size
warning remains. `node tests/browser/sound-demo.ts --browser /usr/bin/chromium`:
passed; report `artifacts/browser-check/run-3Qqbwf/report.json`.
Screenshots and offline rendering: `artifacts/sound-demo/run-eWfviG/`.
All eleven final masters reproduce byte-for-byte on a second generator run.
Human listening remains the acceptance gate for this new direction.

## Handoff

- Summary: Direct implementation; no workers or commits. Replaced every sample
  path and all eleven cue mappings, without changing simulation, replay geometry
  or playback lifecycle. No package or runtime dependency added.
- Changes: Four independently recorded CC0 contacts plus seven custom seeded
  DSP textures. Mono 32 kHz PCM16, 230,564 bytes, 120-650 ms durations, -3 dBFS
  sample peaks. Shared filtering/compression and restrained per-cue gains.
- Verification: Targeted audio/demo tests 13/13, full `npm test` 501/501,
  `npm run build` and Chromium sound-demo scenario passed. Exact commands,
  artifact paths and reproduction evidence are recorded above.
- Evidence: Real browser gesture unlock and eleven audible offline-rendered
  cues; strongest eight-aligned-blast render peak 0.694531918 at 48 kHz.
  Mute, zero volume, blur, live movement, exact 769-tick route, checkpoint
  recovery, mobile controls and production save/draft isolation all passed.
  Portrait and landscape screenshots inspected.
- Strudel: Local-folder import recipe with matching gains and all eleven names.
  JavaScript/schema fixture verified; no claim of live Strudel execution or of
  Strudel generating the WAVs.
- Resources: Test-owned Chromium, preview server, sockets and temporary profile
  cleaned up. Existing user-requested dev server remains responsive at
  http://127.0.0.1:4321/ and serves the v2 demo.
- Risks: New tonal direction awaits the user's listening feedback. Technical
  verification is not approval of sonic fit. BT-076 work is preserved.
- Commit: Uncommitted integrated changes in the primary working tree.
- Decisions: Independent CC0 recordings plus custom offline DSP rather than a
  second interface pack. Strudel is an optional local audition tool, not a
  runtime dependency. Human tonal acceptance is still needed.

## Result

- Summary: Replacement palette and updated Sound garden are technically
  delivered. Old audio/licensing files removed, source licenses/hashes recorded,
  processing and Strudel import documented. Human tonal acceptance remains open.
- Verification: 501/501 tests, production build, real browser scenario and
  byte-for-byte asset regeneration passed. Direct review found no core layer or
  movement changes, runtime randomness, extra dependencies or changed routes.
- Integration: Integrated uncommitted working-tree changes. The user's rejection
  of BT-075 is retained in its history rather than erased.
