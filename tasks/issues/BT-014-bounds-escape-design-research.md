---
{
  "id": "BT-014",
  "title": "Research what makes bounds and escape maps fun",
  "type": "chore",
  "status": "done",
  "priority": "P2",
  "depends_on": [],
  "parent": null,
  "scope": ["docs/research/bounds-escape-design.md"],
  "approval": "User explicitly requested starting both BT-013 and BT-014 on 2026-10-09. Approval covers research and recommendations, not applying unapproved tuning ideas or copying proprietary assets.",
  "assignment": {
    "owner": "escape-design-researcher",
    "run": "6025fec1-4e48-426b-a927-afdad786bb52",
    "branch": "task/bt-014",
    "worktree": ".worktrees/BT-014"
  },
  "blocked_reason": null
}
---
# BT-014: Research what makes bounds and escape maps fun

## Problem

Boundstoy needs design lessons grounded in successful existing maps, not only
mechanically solvable courses. The user requested investigation of StarCraft
bounds, Warcraft III escape/sliding maps and similar games to identify what
makes them good and fun.

Research was explicitly approved on 2026-10-09. Applying recommendations is
outside this issue's scope and requires a separate decision.

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

- [x] The sample covers both requested map families and a relevant comparison, with identifiable names/versions where available and working source links.
- [x] Each example explains its core challenge and the concrete design choices that support or undermine fun.
- [x] Analysis covers movement feel, obstacle layout, readability/telegraphing, timing versus memorization, difficulty progression, checkpoint/retry cost, pacing and replay motivation.
- [x] Social/cooperative factors are identified separately rather than assumed transferable to a single-player offline game.
- [x] Observed evidence, interpretation and unverified claims are clearly separated; unavailable archival material is noted rather than invented.
- [x] The report extracts a short set of design principles and prioritized recommendations mapped to Boundstoy's existing mechanics.
- [x] At least three small tuning/playtest experiments include a hypothesis, the proposed change, what to observe or measure, and what would count as an improvement.
- [x] Suggested implementation issues are returned as recommendations for the orchestrator, not silently created, approved or implemented by the research worker.

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

- Summary: Source-backed design report completed; five examples cover two StarCraft bounds, two Warcraft III sliding/escape maps and N++.
- Changes: Only docs/research/bounds-escape-design.md. The report separates documented facts, sampled video observations, community opinion and design inference, then proposes four local tuning experiments.
- Verification: Worker opened seven cited links and inspected three Deca Bound frames, without claiming firsthand play. Orchestrator independently confirmed the map rules in SEN and wc3maps, Warden's dated author/community posts, both Metanet articles, the same-title Epic War identity warning, and Deca creator metadata. git diff --check passed.
- Risks: Slide Kitty Slide original lineage is uncertain. Video evidence is sampled frames, not continuous timing/collision analysis. Popularity, creator intent and selected opinions are not empirical proof of fun; experiments and numerical thresholds remain hypotheses.
- Commit: 417dbdb82e7d59c0b5f0b1bf12f3a97bdaf0c5d5 on task/bt-014, integrated into master.
- Resources: Worker closed research tabs and launched no game server/client or untrusted map tools. Orchestrator source-review tabs are closed after acceptance.
- Decisions: Preserve current mechanics and six focused lessons; recommendations emphasize layout/controls agreement, readable timing, retry cost and voluntary mastery. No suggested game change or new issue was implemented or approved.

## Result

- Summary: Accepted the research deliverable and its explicit evidence limitations.
- Verification: The five-example comparison, seven source links, design principles, separate social/co-op analysis, per-lesson recommendations and four consent-based local experiments satisfy the issue. Source checks support the specific attributed statements; speculative transfer remains labeled.
- Integration: The report is available at docs/research/bounds-escape-design.md on master. BT-013 was implemented independently; research-driven tuning awaits a separate decision.
