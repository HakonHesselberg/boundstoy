---
{
  "id": "BT-014",
  "title": "Research what makes bounds and escape maps fun",
  "type": "chore",
  "status": "backlog",
  "priority": "P2",
  "depends_on": [],
  "parent": null,
  "scope": ["docs/research/bounds-escape-design.md"],
  "approval": null,
  "assignment": null,
  "blocked_reason": null
}
---
# BT-014: Research what makes bounds and escape maps fun

## Problem

Boundstoy needs design lessons grounded in successful existing maps, not only
mechanically solvable courses. The user requested investigation of StarCraft
bounds, Warcraft III escape/sliding maps and similar games to identify what
makes them good and fun.

This is a research issue; neither research nor implementation has started.

## Scope

Study a small representative sample, aiming for five to eight identifiable
examples across StarCraft bounds, Warcraft III escape/sliding maps and at least
one adjacent movement/obstacle game. Include the original Slide Kitty Slide
inspiration if verifiable material is available.

Use primary descriptions, accessible gameplay footage, map documentation and
relevant community discussion. Distinguish firsthand play from video/document
analysis and subjective community reports. Do not claim to have played a map
based only on watching it.

Produce a concise, source-backed report and actionable tuning recommendations
for Boundstoy. Do not change the game, add mechanics or levels, install game
clients/untrusted map tools, or copy proprietary code/art/assets. The current
single-player, static, existing-mechanics and maximum-ten-level constraints stay
in force.

## Acceptance criteria

- [ ] The sample covers both requested map families and a relevant comparison, with identifiable names/versions where available and working source links.
- [ ] Each example explains its core challenge and the concrete design choices that support or undermine fun.
- [ ] Analysis covers movement feel, obstacle layout, readability/telegraphing, timing versus memorization, difficulty progression, checkpoint/retry cost, pacing and replay motivation.
- [ ] Social/cooperative factors are identified separately rather than assumed transferable to a single-player offline game.
- [ ] Observed evidence, interpretation and unverified claims are clearly separated; unavailable archival material is noted rather than invented.
- [ ] The report extracts a short set of design principles and prioritized recommendations mapped to Boundstoy's existing mechanics.
- [ ] At least three small tuning/playtest experiments include a hypothesis, the proposed change, what to observe or measure, and what would count as an improvement.
- [ ] Suggested implementation issues are returned as recommendations for the orchestrator, not silently created, approved or implemented by the research worker.

## Implementation context

Read README.md, docs/GAME_SYSTEMS.md and the current six-level curriculum to
understand the transfer constraints. Relevant questions include: when does
failure feel fair; how much information should a player read before committing;
what makes repetition satisfying rather than tedious; and how do maps teach
through layout instead of blocking tutorials?

Use concrete footage timestamps or described encounters when possible. Compare
successful patterns with frustrating counterexamples, not only popularity or
nostalgia. Recommendations should improve existing walking, ice, pulse, saw and
mud challenges before proposing any out-of-scope system.

## Verification

Check every cited source and example. The final report should include a
comparison table, evidence-backed principles, limitations, and prioritized
Boundstoy experiments. An orchestrator reviews the recommendations before any
game changes or new work is approved. No game build is needed for research-only
documentation.

## Handoff

Pending.

## Result

Pending.
