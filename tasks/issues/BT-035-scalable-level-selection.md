---
{
  "id": "BT-035",
  "title": "Scale world selection without exposing checkpoint skipping",
  "type": "feature",
  "status": "ready",
  "priority": "P2",
  "depends_on": ["BT-043", "BT-045", "BT-053"],
  "parent": "BT-038",
  "scope": ["index.html", "presentation/main.ts", "presentation/style.css", "presentation/tokens.css", "tests/", "docs/"],
  "approval": "2026-10-10 user approved implementation of the entire BT-038 plan, preserving its full-world gameplay acceptance prerequisite.",
  "assignment": null,
  "blocked_reason": null
}
---
# BT-035: Scale world selection without exposing checkpoint skipping

## Problem

The current selector assumes separate short courses. The new game needs
world-level selection and understandable Continue/New run actions without
turning its continuous eight-section map into a checkpoint-skip menu.

## Scope

Polish the minimal world navigation delivered by BT-052. Show world identity,
completion time, deathless achievement and saved progress. Confirm before
replacing an unfinished run. Exercise one-, three- and ten-world fixtures
without publishing imaginary content or authorizing additional worlds.
Do not expose section skipping or restore preset mastery targets.

## Acceptance criteria

- [ ] Players can identify and select worlds in one-, three- and ten-world fixtures without confusing sections with worlds.
- [ ] Current world, saved continuation, best time and deathless status are clear.
- [ ] Keyboard, pointer and touch navigation work without clipped or unreachable controls.
- [ ] Continue restores the existing run; New run requires confirmation before replacing unfinished progress.
- [ ] Opening, selecting and closing preserve focus and approved clock rules, with no checkpoint skipping.
- [ ] The shipped world count is unchanged by fixture-based scalability work.

## Implementation context

Originally requested on 2026-10-10 for a larger level selector; revised during
the interview/plan decomposition to world selection. This remains unapproved
backlog scope. See BT-038 for the product decisions.
The current `.game-menu` and `.course-card` UI lives in `index.html`,
`presentation/main.ts` and `presentation/style.css`.
Do not assume pagination, categories or a new progression system are required.
BT-052 owns functional first-world navigation before playtesting; this issue
owns the accepted world's finished selector design. World expansion remains
gated on human feedback and BT-054.

## Verification

Run `npm test`, `npm run build` and `npm run test:journey`.
Exercise one-, three- and ten-world fixtures at 1280x900, 390x844 and 844x390
with keyboard, pointer and touch. Record named captures and selection/focus
outcomes, including last-world reachability, declined/accepted run replacement,
and exact continuation. Confirm no per-checkpoint navigation appears.

## Handoff

Pending.

## Result

Pending.
