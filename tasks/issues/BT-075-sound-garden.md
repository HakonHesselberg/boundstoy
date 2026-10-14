---
{
  "id": "BT-075",
  "title": "Add a cohesive CC0 sound palette and playable sound garden",
  "type": "feature",
  "status": "done",
  "priority": "P2",
  "depends_on": [],
  "parent": null,
  "scope": ["data/sounds.ts", "data/sound-demo.ts", "presentation/audio.ts", "presentation/main.ts", "presentation/style.css", "index.html", "public/audio/", "public/THIRD_PARTY_NOTICES.txt", "scripts/prepare-audio.ts", "tests/audio.test.ts", "tests/sound-demo.test.ts", "tests/browser/sound-demo.ts", "docs/AUDIO.md", "docs/ARCHITECTURE.md", "docs/GAME_SYSTEMS.md", "docs/PLATFORM.md", "README.md"],
  "approval": "User request 2026-10-12: find fitting preferably CC0 sounds, tune them together and make a demo level.",
  "assignment": {"owner": "copilot", "run": "22313679-7a79-4454-8d26-620ceffba984", "branch": null, "worktree": "."},
  "blocked_reason": null
}
---
# BT-075: Add a cohesive CC0 sound palette and playable sound garden

## Problem

The four oscillator placeholders do not express movement or give a coherent
material sound palette. Players need a playable place to audition actual cues.

## Scope

Curate CC0 Kenney foley, master short mono samples, use a shared musical reward
voice, and add bounded opt-in playback. Build a separate sound garden using only
existing surfaces, pulses and a between-puzzle checkpoint. Preserve Aftershock,
editor drafts, saved preferences and all movement rules. No music or new systems.

## Acceptance criteria

- [x] Local audio assets have verified source/license provenance and reproducible processing.
- [x] Movement, impact, warning, blast, retry, checkpoint and finish cues share a bounded mix.
- [x] Menu opens a playable demo with all four surfaces and individual audition buttons.
- [x] Demo has an exact legal replay and downstream checkpoint recovery evidence.
- [x] Mute, pause, hidden page, failed loading and disposal are handled without queued stale sounds.
- [x] Demo does not replace production records, saved runs or editor drafts.
- [x] Full tests, build and browser demo checks pass.

## Implementation context

Data owns cue definitions. Presentation selects cues from immutable simulation
transitions; core is unchanged. Use the existing isolated puzzle playtest path,
without adding the demo to either production or explosion puzzle registries.
CC0 source pages: https://kenney.nl/assets/impact-sounds and
https://kenney.nl/assets/interface-sounds.

## Verification

Baseline: `npm test` passed 491/491.
Targeted: `node --test tests/audio.test.ts tests/sound-demo.test.ts`.
Final: `npm test`, `npm run build`, `npm run tasks:check`.
Browser: `node tests/browser/sound-demo.ts --browser /usr/bin/chromium`.
Inspect desktop/mobile presentation, sample decoding, actual WebAudio output,
cue controls, legal replay, pause/mute and save isolation.

## Handoff

- Summary: Implemented directly in the primary tree; no workers or commits.
- Changes: Seven CC0 masters (85,268 bytes), eleven data-owned cues, bounded
  sample playback, pure transition selection and a separately selectable sound
  garden. Existing production sound preference remains opt-in.
- Verification: Red tests reproduced missing selection/demo behavior. A later
  regression reproduced false wall cues during free ice turns and is now green.
  Full `npm test`: 498/498 passed; `npm run build` passed.
  `node tests/browser/sound-demo.ts --browser /usr/bin/chromium` passed;
  report `artifacts/browser-check/run-I7Emtp/report.json`, screenshots and mix
  measurements `artifacts/sound-demo/run-arrUN8/`.
  Existing explosion-puzzle browser suite also passed; report
  `artifacts/browser-check/run-DaJCHD/report.json`.
- Evidence: Full route 769 ticks, zero deaths. Post-death checkpoint recovery
  waits 48 ticks then moves right for 286; wait errors from -24 through +24
  ticks all remain deathless. Real browser sample/source playback and offline
  rendering are verified; eight aligned blast voices peak at 0.679525.
- Risks: Final subjective tonal/loudness acceptance requires human listening
  on speakers/headphones. No claim of human puzzle acceptance or publication.
- Commit: Uncommitted integrated changes in the primary working tree.
- Resources: All browser profiles, sockets and preview processes created by
  the test runners were closed by their verified cleanup.
- Decisions: Used CC0 Impact/Interface packs instead of sci-fi laser effects;
  shared source/pitch family for rewards; no new core mechanics or save schema.

## Result

- Human feedback after implementation: the user listened to every cue and
  rejected the entire Kenney palette. Its technical delivery remains recorded
  below, but its sound direction was not accepted. BT-077 replaces all assets
  and the musical feedback while retaining the functioning demo and lifecycle.
- Summary: Accepted as a functioning audio showcase and integrated in the
  primary working tree. Production routes and movement rules are unchanged.
- Verification: 498/498 unit/regression tests, production build, sound-demo
  browser suite, existing six-puzzle browser suite and diff whitespace check
  passed. Desktop, portrait and landscape screenshots inspected. Fixed an
  expanded-panel landscape overflow found by browser verification.
- Integration: Working-tree changes, no commit. Sources, archive hashes,
  processing recipe, mix constraints and human-listening limitation documented
  in `docs/AUDIO.md`; upstream license notices ship with the audio.
