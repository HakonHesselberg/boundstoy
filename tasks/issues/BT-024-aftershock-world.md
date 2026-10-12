---
{
  "id": "BT-024",
  "title": "Build and prove a continuous eight-section Aftershock world",
  "type": "epic",
  "status": "in_progress",
  "priority": "P1",
  "depends_on": [],
  "parent": "BT-038",
  "scope": ["."],
  "approval": "2026-10-10 user: Implement the entire plan, using subagent where it is helpful to do so. Execute local implementation; preserve the explicit human acceptance and deployment gates in BT-038.",
  "assignment": null,
  "blocked_reason": null
}
---
# BT-024: Build and prove a continuous eight-section Aftershock world

## Problem

The user wants one complete bounds/escape map rather than another set of small
demonstrations. The three current Aftershock encounters are disposable.
Eight connected A-to-B sections must offer escalating, worthwhile play with
safe checkpoints between puzzles and an exit completing the finale.

## Scope

Follow the reviewed plan in [BT-038](BT-038-finished-game-release.md).
Build one continuous eight-section world on normal ground using themed
explosions and saws, with seven intermediate checkpoints. Hazards and elapsed
time continue through death/respawn and freeze together during pause/closure.
Only the active puzzle's hazards run; checkpoints activate the next pattern
and deactivate completed hazards. Restart/reload return to the checkpoint and
reset its pattern, preserving saved totals. Time is the primary record and deathless
completion is separate. No preset targets or player checkpoint skipping.

Build the complete rough world before the main user playtest. Optional new
hazards or local interactions need a concrete design and separate bounded scope;
they are not prerequisites. Existing movement and one-tick explosion behavior
remain unchanged. Release polish and publication belong to BT-038.

## Acceptance criteria

- [ ] Eight distinct escalating sections form one continuous world without run resets at section boundaries.
- [ ] Seven ordered safe checkpoints have all-phase safety and verified downstream recovery; the final puzzle ends at the exit.
- [ ] Pulse/saw patterns continue through death and respawn with unchanged movement and one-tick pulse lethality.
- [ ] Exact continuation, time-first records and saved-run deathless eligibility work.
- [ ] Camera, minimal navigation, relevant cues and secondary editor compatibility support full-world play.
- [ ] Full-world legal routes, failure cases, timing margins and save/recovery browser evidence are recorded.
- [ ] The user accepts the complete rough world after any necessary bounded rework; silence is not approval.

## Implementation context

The 2026-10-10 interview and request to review/split the plan supersede the
historical direction below. The materially changed epic was initially returned
to backlog. The user's subsequent "Implement the entire plan" request approved
execution; the epic is now in progress, with human acceptance still required.
BT-039 through BT-045 and BT-047 through BT-053 are the new world-proof
children. BT-046 is a shared release reliability prerequisite under BT-038.
Completed BT-025 through BT-030 remain historical evidence, not constraints
requiring preservation of their layouts, retry mode or target times.

### Historical plan and approval (superseded, retained for provenance)

Original approval: "In session 6faada62-ebbe-4b03-aceb-bb5fab9de659 the user
approved the Aftershock world plan, with the explicit prerequisite that
explosions kill for one frame and their lingering effects are harmless.
Gameplay depth, challenge and replay value take priority over onboarding."

Historical proposed plan: The Gap, Closing Time, Slipstream, Borrowed Ground, Counterpoint,
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

Run the owning issues' deterministic and browser checks, then `npm test`,
`npm run build` and the updated `npm run release:check` against the integrated
world. Require a full-world input witness, all seven checkpoint recoveries,
continuous-phase and measured decision-margin evidence, exact save/continue,
editor isolation and real Brave playtesting. BT-053 records explicit human
acceptance after bounded rework; passed replays cannot supply that decision.

### Historical verification (superseded)

Exact collision/aftermath and frame-rate checks for the prerequisite.
For each greybox: distinct first-clear/mastery solutions, deliberate failure
cases, measured timing opportunities and a player-feedback gate.
Automated solvability and visual approval are not proof that the world is fun.

## Handoff

New continuous-world work is pending. The following is the historical handoff,
not acceptance of the revised scope.

Orchestrator-owned staged work. BT-025 is integrated and verified. BT-026 authored
Slipstream, Borrowed Ground and The Cut; BT-027 integrates them as the only
playable levels, with repeatable retries and independent clean/mastery records.
All six first-iteration witnesses finish in the production browser, but user
feedback rejected that gameplay. BT-028/029 deliver the approved next iteration:
shorter Borrowed Ground, wide sequential movement, alternating checkerboard,
and generous checkpoints after every finished puzzle. The remaining world
progression is not built; do not expand it before gameplay feedback.

The user subsequently clarified that checkpoints belong between puzzles,
never next to the exit, and explicitly chose to keep these maps short rather
than extend them. BT-030 removes their final checkpoints and misleading hints.
The next feedback was "these levels are better"; the user requested a visual
pass for clutter/overlap and at least halved buildup. This supports the current
direction but does not assert a finished world or independently establish
replay-value acceptance.

## Result

Revised scope: pending implementation and human acceptance under BT-053.
Historical result:

The short replacement set and puzzle-end checkpoints are integrated and verified
under BT-028/029, not a finished eight-stage world. Their measured route
differences and timing windows prove legal strategies, not fun or a Steam
reception prediction. The replay-value acceptance box stays open for user feedback.
