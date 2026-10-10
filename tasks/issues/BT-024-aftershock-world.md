---
{
  "id": "BT-024",
  "title": "Prove and finish one world of explosion timing",
  "type": "epic",
  "status": "in_progress",
  "priority": "P1",
  "depends_on": [],
  "parent": null,
  "scope": ["."],
  "approval": "In session 6faada62-ebbe-4b03-aceb-bb5fab9de659 the user approved the Aftershock world plan, with the explicit prerequisite that explosions kill for one frame and their lingering effects are harmless. Gameplay depth, challenge and replay value take priority over onboarding.",
  "assignment": null,
  "blocked_reason": null
}
---
# BT-024: Prove and finish one world of explosion timing

## Problem

The user rejected Relay as another easy prototype with no meaningful replay
value. A world must develop one mechanic into genuinely different decisions,
not merely replace layouts or improve onboarding.

## Scope

Eight-stage pulse-only world on normal ground. First establish one-tick
detonations, then prove three greyboxes (moving sequences, temporary refuge,
route choice) before building the finale or introductory progression.
Revise all timing designs for discrete explosions, not sustained lethal windows.
No new movement abilities, backend, leaderboard or onboarding redesign.

## Acceptance criteria

- [x] Detonation is lethal for one simulation tick, followed by harmless aftermath.
- [ ] Three greyboxes demonstrate distinct clear/mastery routes worth replaying.
- [ ] User gameplay feedback accepts the depth before campaign expansion.
- [ ] Finale combines route and timing decisions without introducing a new rule.
- [ ] Finished progression, clean records, mastery targets and reliable practice follow the proven encounters.

## Implementation context

Approved plan: The Gap, Closing Time, Slipstream, Borrowed Ground, Counterpoint,
The Cut, Broken Cadence, The Engine. These are design hypotheses, not an
instruction to build eight untested rooms sequentially. Long-burning fields
and their old safe-duration arithmetic are superseded by instantaneous blasts.
Do not simulate continuous damage by stacking nominally one-tick explosions
on consecutive ticks. Controls already work; prove gameplay before polish.

Build order and gates:

1. BT-025 establishes instantaneous explosions without movement changes.
2. Prove Slipstream (moving sequences), Borrowed Ground (temporary refuge) and
   The Cut (a meaningful faster, riskier route). Each needs clear/mastery
   witnesses, deliberately failing strategies, measured timing and short retries.
   Get user feedback: at least two must be worth replaying before expansion.
   Feedback on this first set was negative: Slipstream repeats its puzzle,
   Borrowed Ground is too long/implausible to the player, and The Cut's side
   route feels pointless. BT-028 replaces all three with short travelling,
   wide-corridor and checkerboard patterns; BT-029 supports readable ground and
   guaranteed puzzle-end checkpoints. This explicit user-approved iteration
   supersedes the original no-checkpoint greybox direction.
3. Prove The Engine as interacting route/arrival-phase decisions, not a stitched
   sequence of lessons. Then build the early progression around the proven skills.
4. Finish the eight-stage progression: entry opportunity, distance-to-ignition,
   moving sequences, temporary refuge, coupled rhythms, shortcuts, phase offsets,
   combined mastery. Counterpoint's proposed rhythms are 240/360 ticks (LCM 720).
5. Add Clear/Clean/Mastered outcomes with authored, technique-dependent clean
   targets. Keep checkpoint-assisted records separate from zero-death stage runs.
   Repeatable checkpoint practice must reset an authored pattern clock, never
   erase elapsed run time/deaths; separate the two clocks across all consumers.

The proposed 30-60 minute first clear, 3-5 minute practiced world execution and
8-20 seconds of lost execution per failure are hypotheses to test, not evidence
or promised balance. Avoid filler walking and mandatory idle waiting.
No ghosts, daily challenges or marathon mode until intrinsic replay value works.

## Verification

Exact collision/aftermath and frame-rate checks for the prerequisite.
For each greybox: distinct first-clear/mastery solutions, deliberate failure
cases, measured timing opportunities and a player-feedback gate.
Automated solvability and visual approval are not proof that the world is fun.

## Handoff

Orchestrator-owned staged work. BT-025 is integrated and verified. BT-026 authored
Slipstream, Borrowed Ground and The Cut; BT-027 integrates them as the only
playable levels, with repeatable retries and independent clean/mastery records.
All six first-iteration witnesses finish in the production browser, but user
feedback rejected that gameplay. BT-028/029 deliver the approved next iteration:
shorter Borrowed Ground, wide sequential movement, alternating checkerboard,
and generous checkpoints after every finished puzzle. The remaining world
progression is not built; do not expand it before gameplay feedback.

## Result

The short replacement set and puzzle-end checkpoints are integrated and verified
under BT-028/029, not a finished eight-stage world. Their measured route
differences and timing windows prove legal strategies, not fun or a Steam
reception prediction. The replay-value acceptance box stays open for user feedback.
