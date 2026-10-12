---
{
  "id": "BT-056",
  "title": "Polish relevant world audio without making sound mandatory",
  "type": "feature",
  "status": "ready",
  "priority": "P2",
  "depends_on": ["BT-053", "BT-041"],
  "parent": "BT-038",
  "scope": ["presentation/audio.ts", "presentation/main.ts", "application/preferences.ts", "tests/audio.test.ts", "tests/preferences.test.ts", "tests/browser/journey.ts", "docs/ANIMATION.md"],
  "approval": "2026-10-10 user approved implementation of BT-038, conditional on its explicit gameplay acceptance prerequisites.",
  "assignment": null,
  "blocked_reason": null
}
---
# BT-056: Polish relevant world audio without making sound mandatory

## Problem

A continuous world must not play unrelated off-screen detonations or let dense
hazards overwhelm checkpoint, death and completion feedback.

## Scope

Polish existing synthesized effects and their relevance/priority across section
views, backtracking, pause and recovery. Keep useful silent play and existing
sound opt-in/volume preferences. No mandatory soundtrack, paid assets or
audio-only advance warning.

## Acceptance criteria

- [ ] Detonation/patrol cues describe the player's relevant puzzle rather than all eight off-screen patterns.
- [ ] Checkpoint, death/respawn and completion feedback remain distinct under dense hazard activity.
- [ ] Voice count and gain remain bounded, with no repeated cue storm after resume, reload or context restoration.
- [ ] Pause, hidden state, mute and graphics loss silence or suspend misleading cues.
- [ ] Muted play retains all essential timing information; sound does not lengthen the 27-tick warning.
- [ ] Actual listening feedback on clarity/comfort is recorded; lack of another listener is explicit.

## Implementation context

Planning only; BT-052 supplies functional relevant audio before the main playtest.
This issue refines the accepted world, not the gameplay rules. BT-041's camera
location may differ from highest completed checkpoint during backtracking;
relevance must follow the player, not blindly the progress counter.
Music/ambience is optional future scope if it adds value at zero cost.

## Verification

TDD in existing audio/preferences tests; run
`node --test tests/audio.test.ts tests/preferences.test.ts`, `npm test`,
`npm run build` and `npm run test:journey`. Exercise dense hazards, two section
views, backtracking, mute/reload, hidden state and graphics recovery, then listen
in the user's Brave browser. Record voice-budget and listening evidence separately.

## Handoff

Pending.

## Result

Pending.
