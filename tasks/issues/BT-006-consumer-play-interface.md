---
{
  "id": "BT-006",
  "title": "Replace the development dashboard with a consumer play interface",
  "type": "feature",
  "status": "done",
  "priority": "P1",
  "depends_on": [],
  "parent": "BT-005",
  "scope": ["index.html", "presentation/main.ts", "presentation/style.css"],
  "approval": "Approved by the user's 2026-10-08 consumer-facing UI and shippable-game request, recorded in BT-005.",
  "assignment": {
    "owner": "consumer-ui-worker",
    "run": "3118dfe8-24de-4333-8e20-da4f68deee6d",
    "branch": "task/bt-006",
    "worktree": ".worktrees/BT-006"
  },
  "blocked_reason": null
}
---
# BT-006: Replace the development dashboard with a consumer play interface

## Problem

The main page is a lab/workshop dashboard: permanent sidebar, field notes,
surface legend, speed readout and multiple administrative headings compete with
the actual game. Progression and finish copy also assume exactly two courses.

## Scope

Redesign the main page around the playfield, a small brand/menu area and minimal
time/retry/pause controls. Level selection, sound/fullscreen, help and editor
access belong in compact menus/overlays, not a permanent dashboard. Retain a
short contextual teaching hint without paragraphs of surrounding explanation.

Use the existing scene and core unchanged. Support any current LEVELS length
up to ten, including a generic course intro, next-course and campaign-complete
flow. Preserve the optional debug API and usable level editor.

Only edit index.html, presentation/main.ts and presentation/style.css.
No data, physics, dependency, tracker or documentation changes by this worker.

## Acceptance criteria

- [x] The normal play view is dominated by the game, with no persistent field-notes sidebar, terrain cards, developer speed meter or lab branding.
- [x] Start, pause/resume, restart, levels, sound, fullscreen, help and secondary editor entry remain accessible.
- [x] Level counts and progression use LEVELS.length and generic copy; no first/second/two-course assumptions remain.
- [x] Keyboard and touch input remain usable; menu/focus changes pause safely and do not leave held input behind.
- [x] Desktop and 390x844 / 844x390 layouts have no horizontal overflow, clipped required actions or unusable overlays.
- [x] Editor import/export/playtest still works and does not overwrite built-in records.
- [x] Type checking, repository tests/build and real-browser smoke checks pass with the current data.

## Implementation context

Read the existing DOM IDs and event handlers carefully before changing markup.
`Scene` observes viewport size, so a new layout does not need new rendering code.
`courseGuide` provides per-checkpoint teaching hints. Preserve current static,
no-network, muted-by-default and local-storage behaviour.

The next worker will provide six levels using the unchanged LEVELS,
COURSE_LESSONS and REPLAYS interfaces. Do not author those levels here.
Execution uses an isolated issue worktree created from the approved baseline.
Issue-branch commits are authorized; no tracker edits or remote pushes.
Use an owned preview on port 4323 only when needed, then stop it.

## Verification

Run `npm run evaluate`. In a production browser, exercise real movement,
pause/restart, level selection, next/finish flow, mobile/touch layout and
editor round-trip/playtest. Inspect screenshots and console errors. Report the
actual commands/scenarios and any remaining concerns; stop your preview server.

## Handoff

- Summary: Worker delivered a minimal consumer play interface ready for review.
- Changes: Only index.html, presentation/main.ts and presentation/style.css; large playfield, compact menu, contextual help, generic progression and responsive overlays.
- Verification: Worker ran npm run evaluate (69 passing tests, tracker, typecheck, production build), UI assertions and git diff --check. Chromium desktop, portrait and landscape screenshots inspected; keyboard/pointer, menus/focus, ten-entry scrolling, levels, sound/fullscreen, editor painting/undo/JSON/playtest, persistence and offline-after-load checked. Current legal replays finished at 1480/1722 ticks with no retries and no application console errors.
- Risks: Six-level integration remains BT-007/BT-008. Physical touchscreen hardware and OS save dialogs were not exercised; pointer controls and download Blob/filename were checked. Headless WebGL and existing bundle-size warnings remain.
- Commit: 4d45f66dccc7bb1e2663f6f50ff8fcdafb495a34 on task/bt-006.
- Resources: Worker stopped its preview on 4323 and closed both owned browser tabs. Logs remain in the ignored worker artifacts/bt006 directory.
- Decisions: No core/data/contracts changed. Editor is secondary; navigation pauses safely.

## Result

- Summary: Accepted the scoped UI delivery and unlocked the curriculum work.
- Verification: Orchestrator confirmed the commit changes exactly the three allowed files, both trees are clean, whitespace checks pass, and npm run evaluate passes all 69 tests/type checking/build after integration. Broader six-level browser acceptance is explicitly reserved for BT-008.
- Integration: Fast-forwarded master to 4d45f66dccc7bb1e2663f6f50ff8fcdafb495a34. No remote push.
