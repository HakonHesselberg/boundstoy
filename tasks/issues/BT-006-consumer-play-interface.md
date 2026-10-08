---
{
  "id": "BT-006",
  "title": "Replace the development dashboard with a consumer play interface",
  "type": "feature",
  "status": "ready",
  "priority": "P1",
  "depends_on": [],
  "parent": "BT-005",
  "scope": ["index.html", "presentation/main.ts", "presentation/style.css"],
  "approval": "Approved by the user's 2026-10-08 consumer-facing UI and shippable-game request, recorded in BT-005.",
  "assignment": null,
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

- [ ] The normal play view is dominated by the game, with no persistent field-notes sidebar, terrain cards, developer speed meter or lab branding.
- [ ] Start, pause/resume, restart, levels, sound, fullscreen, help and secondary editor entry remain accessible.
- [ ] Level counts and progression use LEVELS.length and generic copy; no first/second/two-course assumptions remain.
- [ ] Keyboard and touch input remain usable; menu/focus changes pause safely and do not leave held input behind.
- [ ] Desktop and 390x844 / 844x390 layouts have no horizontal overflow, clipped required actions or unusable overlays.
- [ ] Editor import/export/playtest still works and does not overwrite built-in records.
- [ ] Type checking, repository tests/build and real-browser smoke checks pass with the current data.

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

Pending.

## Result

Pending.
