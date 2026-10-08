---
{
  "id": "BT-005",
  "title": "Ship a focused consumer-facing teaching game",
  "type": "epic",
  "status": "in_progress",
  "priority": "P1",
  "depends_on": [],
  "parent": null,
  "scope": [],
  "approval": "User approved investigation, issue creation and subagent fixes on 2026-10-08: a shippable game, maximum ten levels, one concept per level, existing mechanics only, minimal consumer-facing UI.",
  "assignment": null,
  "blocked_reason": null
}
---
# BT-005: Ship a focused consumer-facing teaching game

## Problem

The game still presents a development dashboard, and its two courses combine
multiple concepts too early. The user approved turning it into a focused,
shippable player experience, while keeping later tuning easy.

## Scope

Ship six teaching levels, below the user's maximum of ten: walking/navigation,
soft-ice turning, hard-ice alignment, pulse timing, saw timing, and mud timing.
Each level focuses on one concept and uses only existing mechanics. Simplify
the player UI; keep editor/debug facilities secondary.

No new movement rules, hazards, inventory, powerups, backend, telemetry, runtime
dependencies or cloud deployment. The user subsequently authorized local
commits as needed; no remote push or deployment is requested.

## Acceptance criteria

- [ ] Main play is consumer-facing with minimal surrounding chrome and no permanent development dashboard.
- [ ] Six distinct, focused teaching levels have legal deathless witnesses and concept-specific checks.
- [ ] Full progression, retries, persistence, input, mobile layout and editor access work together.
- [ ] Static production build, documentation and open-source notices are ready to copy to a static host or Astro site.
- [ ] Child issues are reviewed, integrated and verified before this epic closes.

## Implementation context

Investigation found hard-coded two-course counts and first/second-course copy in
`presentation/main.ts`, `index.html`, `scripts/inspect.ts` and the course tests.
The first existing course already mixes soft/hard ice, spikes, pulse timing and
mud. The main page exposes Workshop, field notes, terrain cards, speed readout
and development-style headings around the playfield.

BT-006 generalizes the UI first; BT-007 then replaces the curriculum; BT-008
checks the integrated release. Older proposed BT-002/003/004 remain unapproved
unless specifically covered by these new issues; do not silently execute them.

The user explicitly authorized commits after intake. Establish a baseline,
then use separate issue branches/worktrees. The UI worker runs first so its
generalized progression is available to the curriculum worker. The orchestrator
alone updates tracker state, reviews scope and integrates accepted commits.

## Verification

Complete the verification specified by BT-006, BT-007 and BT-008. Run
`npm run evaluate` after integration, drive every course in a real production
browser, and check small-screen UI and static/offline operation.

## Handoff

Pending.

## Result

Pending.
