---
{
  "id": "BT-078",
  "title": "Prototype sustained wind and pad ice audio in Sound garden",
  "type": "feature",
  "status": "done",
  "priority": "P2",
  "depends_on": ["BT-077"],
  "parent": null,
  "scope": ["data/ice-audio.ts", "data/sound-demo.ts", "scripts/prepare-ice-audio.ts", "scripts/prepare-audio.ts", "public/audio/", "public/THIRD_PARTY_NOTICES.txt", "presentation/audio.ts", "presentation/main.ts", "presentation/style.css", "index.html", "tests/ice-audio.test.ts", "tests/audio.test.ts", "tests/sound-demo.test.ts", "tests/browser/sound-demo.ts", "docs/AUDIO.md", "docs/ARCHITECTURE.md", "docs/GAME_SYSTEMS.md", "docs/PLATFORM.md"],
  "approval": "2026-10-13 user: Go for it, approving wind-only versus wind plus restrained pad prototypes for sustained ice movement before replacing the remaining palette.",
  "assignment": {"owner": "ice-audio-comparison", "run": "22313679-7a79-4454-8d26-620ceffba984", "branch": null, "worktree": "."},
  "blocked_reason": null
}
---
# BT-078: Prototype sustained wind and pad ice audio in Sound garden

## Problem

Physical v2 is an improvement, but not final. The user wants expressive,
potentially musical movement audio, not a constraint to realistic foley.
Repeated 250 ms ice events cannot provide a smoothly sustained wind/pad.

## Scope

Prototype only in the isolated Sound garden: A/B wind versus wind plus a
restrained open-fifth/add-nine pad, preserving other cues and normal gameplay
audio. Add an optional roomy ice audition area with both surfaces, wall contact
and nearby pulses; retain the original materials walk and exact replay.
No new gameplay mechanics, dependencies, records, persistent settings or
production levels. Existing dev server stays off unless requested.

## Acceptance criteria

- [x] Sustained movement uses bounded looping voices rather than periodic attacks.
- [x] A/B and soft/hard transitions change timbre without restarting the wind.
- [x] Actual motion drives sound, including no-key ice gliding and wall behavior.
- [x] Finite solo previews auto-end; stop, pause, mute, navigation and disposal clean up.
- [x] Room supports long glides and danger overlap, with a verified safe exit route.
- [x] Original demo replay, world/editor isolation and non-demo audio are preserved.
- [x] Seamless deterministic CC0 loops and optional Strudel comparison are documented.
- [x] Targeted/full tests, build and browser comparison pass.

## Implementation context

Data owns loop paths, mix, envelopes and synthesis settings. Presentation owns
loop nodes and observes immutable state. A pair of four-second periodic PCM
loops is shared between both surfaces; filtered wind and a faint D/A/E pad.
Main updates sustained sound only for the two Sound garden scenes, retaining
the physical palette elsewhere. Shared voice budget remains eight.

## Verification

Baseline audio/demo tests: 13/13 passed. TDD for loop lifecycle, real-motion
selection, seam continuity, A/B identity, voice bounds and the optional room.
Run full tests, production build and browser Sound garden scenario; listen-fit
acceptance remains with the user.

## Handoff

- Summary: Implemented and verified directly; no workers or commits. Ice-only
  comparison remains gated to Sound garden pending human listening feedback.
- Changes: Two original four-second CC0 loops; shared eight-voice accounting,
  motion-driven sustain, 280 ms transitions and 240 ms releases. A/B changes
  only the pad envelope, even during wind attack. Eight-second previews have
  audio-clock expiry; lifecycle shutdown is immediate. Added the optional
  single-section ice room without changing the original materials route.
- Verification: Baseline 13/13; RED reproduced missing ice module/API.
  Final targeted audio/ice/demo tests 17/17; full `npm test` 510/510; production
  typecheck/build passed, with only the existing bundle-size warning.
  `node tests/browser/sound-demo.ts --browser /usr/bin/chromium` passed:
  `artifacts/browser-check/run-nZawcn/report.json`;
  screenshots/mix data `artifacts/sound-demo/run-16RnFo/`.
  Earlier UI-equivalent screenshots in `run-HXn8ZW` were directly inspected at
  1280x900, 390x844 and 844x390.
- Evidence: Room supports over eight seconds of released-key gliding and
  reflection, with nearby warnings/blasts. Safe exit is 820 ticks, zero deaths,
  independently tolerant to +/-10 ticks at its turn. Original 769-tick walk
  and checkpoint recovery remain unchanged. Combined six-blast/two-loop peaks:
  0.539856 at 44.1 kHz and 0.518979 at 48 kHz. Pad RMS is about 47% of wind;
  wind cycle difference across A/B is zero in the offline render.
- Risks: These are technically verified prototypes, not final aesthetic
  acceptance. The safe exit intentionally avoids hazards; this is an audition
  space, not a new necessity-tested production puzzle. Interactive Strudel
  listening was not performed; its recipe was executed against a local API
  fixture, confirming names, timing, filter and game-relative gains.
- Commit: Uncommitted integrated changes in the primary worktree.
- Resources: Both verification browser runs cleaned up their owned Chromium,
  preview servers, profiles and sockets. User's dev server was not restarted.
- Decisions: Keep physical v2 elsewhere and all other cues unchanged. Do not
  select the final direction on the user's behalf. Synthesis is offline,
  seeded and dependency-free; Strudel remains optional.

## Result

- Summary: Sustained wind versus wind-plus-pad prototype delivered, with A/B
  controls, finite previews and a playable ice room.
- Verification: 510/510 tests, build and final browser scenario passed. Direct
  review confirmed bounded/faded voice ownership, immutable simulation
  observation, prototype gating, original route preservation and no new
  dependencies or persistent preferences.
- Integration: Integrated working-tree changes, no commit. Source licenses,
  exact reproduction, use instructions and listening limitations are recorded
  in docs/AUDIO.md and shipped notices.
