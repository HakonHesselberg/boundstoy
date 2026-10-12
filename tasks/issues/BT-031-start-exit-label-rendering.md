---
{
  "id": "BT-031",
  "title": "Improve start and exit label rendering",
  "type": "bug",
  "status": "ready",
  "priority": "P2",
  "depends_on": [],
  "parent": "BT-038",
  "scope": ["presentation/scene.ts", "presentation/readability.ts", "tests/", "docs/"],
  "approval": "2026-10-10 user approved implementation of the entire BT-038 plan, including reused presentation issues.",
  "assignment": null,
  "blocked_reason": null
}
---
# BT-031: Improve start and exit label rendering

## Problem

The user reports that the start and end labels do not render well. Players
need to recognize the start and exit without distracting or illegible markers.

## Scope

Diagnose and improve START/EXIT label rendering, placement and scaling.
Preserve marker positions, trigger radii, camera behavior and gameplay.

## Acceptance criteria

- [ ] START and EXIT are legible and visually anchored to their markers on desktop and mobile.
- [ ] Labels avoid clipping, flicker and obstruction of nearby route or hazard cues.
- [ ] All three shipped levels and editor-placed markers retain correct behavior.

## Implementation context

Requested on 2026-10-10 as issue creation, not implementation approval.
`presentation/scene.ts` creates START/EXIT markers; `presentation/readability.ts`
controls label visibility and placement. Diagnose the visual failure before
choosing a treatment.

## Verification

Run `npm test`, `npm run build` and `npm run test:readability`.
Capture before/after START and EXIT views for each shipped level at 1280x900
and 390x844; inspect editor markers beside walls and near board edges.
Record named screenshot paths and remaining limitations in the handoff.

## Handoff

Pending.

## Result

Pending.
