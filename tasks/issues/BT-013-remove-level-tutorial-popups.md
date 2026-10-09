---
{
  "id": "BT-013",
  "title": "Remove per-level tutorial popups",
  "type": "feature",
  "status": "in_progress",
  "priority": "P1",
  "depends_on": [],
  "parent": null,
  "scope": ["index.html", "presentation/main.ts", "presentation/style.css", "tests/browser/scenarios.ts", "tests/browser-check.test.ts", "docs/BROWSER_CHECKS.md", "README.md"],
  "approval": "User explicitly requested starting both BT-013 and BT-014 on 2026-10-09. Approval covers removal of per-level tutorial popups while preserving pause/results/help and existing gameplay.",
  "assignment": {
    "owner": "tutorial-flow-worker",
    "run": "dispatching-sync; runtime agent ID will be recorded when returned",
    "branch": "task/bt-013",
    "worktree": ".worktrees/BT-013"
  },
  "blocked_reason": null
}
---
# BT-013: Remove per-level tutorial popups

## Problem

The user wants the tutorial popup removed from each level. Requiring another
instruction dismissal interrupts the flow between short levels and adds
unnecessary UI to the consumer-facing game.

Implementation was explicitly approved on 2026-10-09.

## Scope

Remove the per-level tutorial/instruction modal from level entry, selection,
next-level progression and retry. Keep any useful instruction in the existing
non-blocking hint or optional Help menu.

A single generic initial Play action may remain if needed for intentional game
entry/focus, but it must not become a tutorial popup repeated for every level.
Do not remove pause/resume, results, campaign completion or menu dialogs.
Do not change physics, level layouts, timing windows, records or editor data.

## Acceptance criteria

- [ ] Entering or advancing to a level does not show a tutorial/instruction popup.
- [ ] Level selection, next-level progression and retry do not require an extra tutorial dismissal before playing.
- [ ] Initial game entry, keyboard focus and touch controls remain deliberate and usable; sound remains muted until enabled.
- [ ] Pause/resume, result screens, campaign completion and secondary editor access retain their intended behaviour.
- [ ] Instructions remain available without blocking play through the contextual hint and/or Help menu.
- [ ] Deterministic debug resets and legal replay verification remain valid; browser checks assert the new flow instead of expecting per-level intros.

## Implementation context

Review overlay/play/loadCourse/menu transitions in presentation/main.ts, the
overlay markup/styles, and tests/browser/scenarios.ts. The browser suite
currently expects an intro between levels, so changing only the visual markup
would leave an inconsistent flow.

Preserve the distinction between normal player navigation and paused,
deterministic debug resets. Do not hide timing drift by padding or weakening
the replay assertions. BT-014 is independent research, not a prerequisite for
this explicit UI request.

## Verification

Run npm run evaluate and npm run test:browser. Exercise initial entry, level
selection, next/retry/final flows, pause/menu/focus and touch controls in desktop,
portrait and landscape layouts. Confirm no per-level tutorial appears and no
required controls are clipped or unexpectedly active behind overlays.

## Handoff

Pending.

## Result

Pending.
