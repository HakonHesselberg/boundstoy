---
{
  "id": "BT-013",
  "title": "Remove per-level tutorial popups",
  "type": "feature",
  "status": "done",
  "priority": "P1",
  "depends_on": [],
  "parent": null,
  "scope": ["index.html", "presentation/main.ts", "presentation/style.css", "tests/browser/scenarios.ts", "tests/browser-check.test.ts", "docs/BROWSER_CHECKS.md", "docs/TESTING.md", "docs/ARCHITECTURE.md", "README.md"],
  "approval": "User explicitly requested starting both BT-013 and BT-014 on 2026-10-09. Approval covers removal of per-level tutorial popups while preserving pause/results/help and existing gameplay.",
  "assignment": {
    "owner": "tutorial-flow-worker",
    "run": "803a68dd-a19a-4432-9c2a-4e68e8885702",
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

- [x] Entering or advancing to a level does not show a tutorial/instruction popup.
- [x] Level selection, next-level progression and retry do not require an extra tutorial dismissal before playing.
- [x] Initial game entry, keyboard focus and touch controls remain deliberate and usable; sound remains muted until enabled.
- [x] Pause/resume, result screens, campaign completion and secondary editor access retain their intended behaviour.
- [x] Instructions remain available without blocking play through the contextual hint and/or Help menu.
- [x] Deterministic debug resets and legal replay verification remain valid; browser checks assert the new flow instead of expecting per-level intros.

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

- Summary: Worker removed per-level tutorial popups while retaining one generic intentional initial Play action and explicit pause/results/help flows.
- Changes: Worker changed index.html, presentation/main.ts, tests/browser/scenarios.ts, docs/BROWSER_CHECKS.md and README.md. CSS, renderer, physics, timing, level data and storage schema were unchanged. Orchestrator aligned the related architecture/testing documentation during acceptance.
- Verification: Worker demonstrated a failing pre-change navigation regression, then npm run evaluate passed all 116 tests/typecheck/build. The production browser suite passed 17 scenario groups, including generic entry, real keyboard/touch/cancel, selection/next/retry/final/editor-return navigation at desktop/portrait/landscape sizes, idle/focus handling, saves and offline play. All six witnesses retained exact ticks, zero deaths and ordered checkpoints.
- Risks: Physical-device and non-Chromium coverage remain unverified; the existing bundle warning is unchanged.
- Commit: 0ffec236259603adf3ee5739f480ac974a7e2437 on task/bt-013, integrated into master.
- Resources: Worker verified ten owned runs cleaned and left no manual server/context. Orchestrator's integrated run artifacts/browser-check/run-ZyxA3J also passed; the exact profile/PIDs/process group/ports were independently confirmed removed or stopped.
- Decisions: Normal navigation starts directly; debug.load remains an explicit paused reset so deterministic inspection does not race live ticks. BT-014 recommendations were not applied.

## Result

- Summary: Accepted. The first page load retains a generic Play gate; subsequent level navigation has no repeated tutorial dismissal.
- Verification: Orchestrator reviewed the five-file worker diff, ran the combined portable evaluation and production browser suite, and confirmed 17 passing scenario groups with no browser problems. Cleanup was checked using recorded resource identities, not only the report flag.
- Integration: Worker commit 0ffec23 is on master, followed by the orchestrator's related documentation and issue-closure commit. No changes to the six-level curriculum or existing mechanics.
