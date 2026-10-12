---
{
  "id": "BT-053",
  "title": "Playtest and accept the complete Aftershock gameplay",
  "type": "chore",
  "status": "ready",
  "priority": "P1",
  "depends_on": ["BT-052", "BT-063", "BT-033", "BT-067"],
  "parent": "BT-024",
  "scope": ["tasks/issues/", "docs/TESTING.md"],
  "approval": "2026-10-10 user approved executing BT-038; this authorizes presenting the complete map for feedback, not supplying acceptance on the user's behalf.",
  "assignment": null,
  "blocked_reason": null
}
---
# BT-053: Playtest and accept the complete Aftershock gameplay

## Problem

Legal routes, screenshots and automated checks cannot decide whether the world
is understandable, interesting or worth replaying.

## Scope

Present the complete rough build to the user in Brave, gather actual feedback
and record the acceptance decision. Offer a second run for improvement without
requiring memorized scripts. Record bounded rework issues for rejected sections;
do not turn this acceptance ticket into an unlimited code-writing assignment.

## Acceptance criteria

- [ ] The user has played the complete rough world or explicitly identified where a blocker prevented completion.
- [ ] Section-level confusion, waits, unfair deaths, route discoverability, camera issues and replay interest are recorded as observations, not invented metrics.
- [ ] Necessary rework is represented by approved bounded issues and added as actual prerequisites before acceptance.
- [ ] The revised full map and affected downstream recovery/timing have been rechecked after rework.
- [ ] The user explicitly accepts the world progression and finale as worthwhile bounds/escape gameplay.
- [ ] Any lack of newcomer/other-device feedback is stated plainly.

## Implementation context

Execution approved; BT-038 M2 remains a human gate. The user asked to build as much as
possible first, which BT-052 does. Additional worlds and final presentation
lock must wait for this acceptance. If the user is slow to answer, wait; never
infer approval from silence or a passed replay.

## Verification

Record the exact candidate revision/build, browser, user comments and acceptance
decision in this issue. Use `npm run tasks:check` after adding any rework
dependencies. Require current full-world regression evidence from BT-052 and
follow-ups; no new observer study or telemetry is mandatory.

## Handoff

The BT-052 candidate is served locally at `http://127.0.0.1:4400/` by the
attached session process `aftershock-playtest`. HTTP response was verified to
serve `index-Byi1kkgy.js`; exact asset fingerprints and all automated evidence
are recorded in BT-052. This is world `aftershock`, revision 1, not a published
release. The preview remains attached to this session, not a detached service.

The user has just started and is **not ready to judge** the gameplay. They
stopped because zooming in and out between puzzles is very distracting.
They requested a pan to the next puzzle once a checkpoint is reached, confirmed
backtracking should pan as needed to keep the player visible without zoom, and
clarified: "Actually, all the puzzle must be visible, at least when revealing it."
BT-063 is the approved bounded blocker correction. Full-map/finale acceptance,
browser/device details and newcomer feedback remain outstanding. Busy walls and
poor SwiftShader pacing remain limitations, not hardware acceptance evidence.

BT-063 is now verified and served at the same URL. Refresh to load
`index-DotRgueI.js`; exact fingerprints and camera evidence are in BT-063.
This uses checkpoint-triggered fixed-scale whole-puzzle reveals with
player-retaining backtracking. Awaiting renewed user feedback, not treating
automated camera checks as gameplay acceptance. A separate native continuation
fixture failure is recorded in BT-064 and remains a release qualification gap.

## Result

Pending.

## Further user feedback

After the checkpoint-camera correction, the user said: "The walls need
improvement, they are too shiny and eye catching. Rework them completely."
BT-033 now owns that approved visual rework. No full-world gameplay acceptance
has been supplied.

BT-033 is now implemented and verified: continuous dark matte walls replace
the reflective, hatched tile grid. The same local preview now serves
`index-oooKdqTE.js`; refresh to load it. Exact fingerprints and before/after
captures are recorded in BT-033. Awaiting the user's assessment, without
assuming approval from automated checks.

The next feedback changed the gameplay loop: future puzzles must not start
until the previous puzzle is complete; completed hazards deactivate; ordinary
death/respawn preserves the active clock. The user additionally requested
checkpoint-position saves, Restart returning to the checkpoint and restarting
its pattern, with no periodic saves. They explicitly allowed totals to be saved
on death and when pausing/leaving, preventing reload from erasing known deaths.
BT-065/066/067 own this approved change.

BT-065/066/067 are now implemented and verified in revision 2. The preview at
http://127.0.0.1:4400/ serves `index-TW6drP_8.js`. Reload deletes the obsolete
revision-1 active save as the user explicitly requested, without deleting
older records or drafts. Only the active puzzle runs; R returns to its checkpoint
and resets its pattern; ordinary death preserves the clock; durable continuation
uses checkpoint position and boundary-saved totals. The full portable suite,
seven native death/reload recoveries, whole-puzzle visual reveals, graphics
recovery and pixel readability passed. This is not human acceptance; resume
the user's playtest on the revised rules before continuing release polish.

2026-10-12: Assignment released while the orchestrator implements the separately
requested BT-069 benchmark collection. Aftershock acceptance remains pending;
the benchmark experiments do not replace the production world or count as
acceptance of it.
