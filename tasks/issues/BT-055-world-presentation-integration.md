---
{
  "id": "BT-055",
  "title": "Accept the existing presentation work in the complete world",
  "type": "feature",
  "status": "ready",
  "priority": "P2",
  "depends_on": ["BT-053", "BT-031", "BT-032", "BT-033", "BT-034", "BT-035", "BT-037"],
  "parent": "BT-038",
  "scope": ["presentation/", "tests/hazard-visuals.test.ts", "tests/motion.test.ts", "tests/mobile-readability.test.ts", "tests/browser/aftershock.ts", "tests/browser/journey.ts", "tests/browser/motion-clips.ts", "docs/ANIMATION.md", "docs/BROWSER_CHECKS.md"],
  "approval": "2026-10-10 user approved implementation of BT-038, conditional on its explicit gameplay acceptance prerequisites.",
  "assignment": null,
  "blocked_reason": null
}
---
# BT-055: Accept the existing presentation work in the complete world

## Problem

Visual fixes accepted on three small courses may not remain clear in a connected
world with camera changes and mixed saw/pulse patterns.

## Scope

Integrate and accept BT-031/032/033/034/035/037 against the user-accepted full
world. Fix integration-specific overlaps, label visibility, transition/cue
conflicts and completion feedback. Reuse the existing twelve-principle motion
system; do not create a duplicate animation overhaul or change physics.

## Acceptance criteria

- [ ] Player, start/exit/checkpoint labels and next decisions remain readable throughout section views and transitions.
- [ ] Walls/background objects recede while cosmetic floor groups remain distinguishable where required.
- [ ] Idle hazards, charge-up, detonation and harmless aftermath stay distinct in mixed/dense patterns and actual gameplay clips.
- [ ] Accepted animation preserves collision footprints, immediate controls and approved clock behavior.
- [ ] World navigation/results and copy changes remain coherent with exact continuation and no checkpoint skipping.
- [ ] Full/reduced-motion evidence and user feedback support the integrated treatment; no new playability regression is left unresolved.

## Implementation context

Planning only; BT-053 gates major final polish. BT-036 is a completed evaluation,
not proof that every player understands the redesign. BT-037 was in review at
decomposition and must be accepted by its owner/reviewer separately.
This issue verifies the combined world; it does not reassign another agent's work.

## Verification

Run `npm test`, `npm run build`, `npm run test:motion`,
`npm run test:aftershock`, `npm run test:journey` and `npm run test:readability`.
Inspect named full-world/transition clips at 1280x900, 390x844 and 844x390 in
full/reduced motion, including dense mixed phases, retries and completion.
Record actual observations and any bounded follow-up needed before acceptance.

## Handoff

Pending.

## Result

Pending.
