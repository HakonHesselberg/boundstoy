---
{
  "id": "BT-036",
  "title": "Evaluate explosive tile and charge-up readability",
  "type": "chore",
  "status": "done",
  "priority": "P2",
  "depends_on": [],
  "parent": null,
  "scope": [
    "docs/",
    "tests/"
  ],
  "approval": "2026-10-10 user approved the BT-036/BT-037 investigation plan (\"approved, implement it\"): idle explosive marking, monotonic perimeter charge-up, full-footprint flash, cool harmless aftermath, then BT-037 frame interpolation, player feel, death/respawn/checkpoint/win beats and UI transitions. Warning stays 27 ticks; no whole-cycle cue.",
  "assignment": {
    "owner": "copilot-orchestrator",
    "run": "b3482200-3c8f-4210-884c-efbceab479c2",
    "branch": null,
    "worktree": "."
  },
  "blocked_reason": null
}
---
# BT-036: Evaluate explosive tile and charge-up readability

## Problem

The user cannot clearly tell which tiles have explosions or what the charge-up
looks like. Evaluate whether players can distinguish explosive tiles, imminent
detonation, the explosion itself and harmless aftermath during actual play.

## Scope

Evaluate the current presentation and document evidence-backed recommendations.
Use captures and human observation, not only isolated stills or legal replays.
Implementation of a chosen redesign needs separate approval.
Do not change warning duration, damage windows, schedules or movement.

## Acceptance criteria

- [x] Document how explosive and ordinary tiles are recognized before a warning.
- [x] Evaluate idle, charge-up, detonation and harmless aftermath at gameplay speed.
- [x] Cover both ground shades, adjacent mixed-phase tiles and reduced motion on desktop/mobile.
- [x] Record player misunderstandings and distinguish observed findings from hypotheses.
- [x] Recommend concrete visual changes and a follow-up acceptance method, or explain why no change is warranted.

## Implementation context

Requested on 2026-10-10 as issue creation, not implementation approval.
BT-030 reduced clutter and warning duration, but its technical acceptance does
not establish human readability. Inspect `presentation/hazard-visuals.ts`,
`presentation/scene.ts` and the existing explosion/Aftershock browser scenarios.
Warnings remain 27 ticks (225 ms); explosions are lethal for exactly one tick.
Lingering effects are harmless and must stay inside projected tile footprints.

## Verification

Run `npm run test:explosions` and `npm run test:aftershock` for baseline evidence.
Capture named real-time clips and phase frames at 1280x900 and 390x844 in full
and reduced motion. Ask observers to identify explosive tiles and describe when
to avoid/re-enter them. Record actual responses and unresolved uncertainty;
do not substitute automated phase checks for human comprehension.

## Handoff

- Summary: Evaluation and approved recommendations in `docs/research/explosion-readability.md`.
Idle pads are indistinguishable from floor, charge-up salience falls toward ignition,
60 Hz frames often miss the full-tile flash, and the harmless aftermath is the most
salient phase. Recommendations keep 27-tick warnings and one-tick lethality.
- Changes: Added the evaluation document and `tests/browser/motion-clips.ts`
(deterministic 60 fps clips/phase stills; `CLIP_DIR`, `CLIP_SCENARIOS`).
- Verification: Baseline `npm test` 233/233. Baseline build passed
`tests/browser/explosions.ts` and `tests/browser/aftershock.ts`
(`artifacts/motion/bt036-baseline-browser.log`). Before clips/stills at 1280x900 and
390x844, full and reduced motion: `artifacts/motion/before/hazards-*`.
- Risks: The only human observation is the user's report. No additional observers
were recruited; the observer protocol is the follow-up acceptance method for BT-037.
- Commit: Working tree on master; see BT-037 for integration.
- Resources: Owned Chromium/preview servers closed by the runner.
- Decisions: No whole-cycle cue (would effectively lengthen warnings).

## Result

- Summary: Accepted as an evaluation with evidence labels separating the single player
observation from captures and hypotheses. Human comprehension of the redesign remains open
in BT-037 and is not claimed here.
- Verification: Evidence files above inspected; baseline runners passed.
- Integration: Documentation and capture script in the main worktree (master).
