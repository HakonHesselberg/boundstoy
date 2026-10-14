---
{
  "id": "BT-086",
  "title": "Replace the dashboard menu with a home, level select and full-bleed play flow",
  "type": "feature",
  "status": "blocked",
  "priority": "P1",
  "depends_on": [],
  "parent": null,
  "scope": ["index.html", "presentation/main.ts", "presentation/style.css", "presentation/tokens.css", "application/level-catalogue.ts", "application/menu-model.ts", "tests/level-catalogue.test.ts", "tests/menu-model.test.ts", "tests/run-continuation.test.ts", "tests/browser/", "scripts/browser-check.ts", "docs/", "README.md", "tasks/issues/BT-086-consumer-screen-flow.md"],
  "approval": "2026-10-13 user reviewed the UI audit and proposal, said all levels will be remade so the level menu may be reinvented, the editor may be hidden for now, and 'For the rest, do as suggested.'",
  "assignment": null,
  "blocked_reason": "Implementation handed off; continuation baseline timeout and motion-clips rerun remain unresolved. Primary reservation released during BT-092 reconciliation; UI acceptance is not marked done."
}
---
# BT-086: Replace the dashboard menu with a home, level select and full-bleed play flow

## Problem

The UI audit found one dialog acting as both main and pause menu, an 18-card
2,900 px trial list, duplicated Sound/Play/Restart controls, developer copy in
play (level IDs, tick margins, PUZZLE badge, always-visible save button), a
board that gets only 230 of 390 px on a landscape phone, and a flat ↑←↓→ row
instead of a D-pad. Players on every platform need a clear, focused flow.

## Scope

- Home screen: Aftershock continue card (section progress, run time/retries,
  best time, deathless), Continue/Play, confirmed New run, Levels, Settings and
  How to play. Sections are never selectable (no checkpoint skipping).
- Level select: data-driven sets as tabs, compact numbered tile grid,
  a detail panel with description/credit and Play, live board preview.
  Levels are placeholders that will be remade, so sets come from one catalogue.
- Play: full-bleed board, HUD overlaid on the board (pause, title, section
  pips, time, retries, restart), short-lived route hint, save warning only on
  failure. One pause card: Resume, Restart, Settings, Home/Levels.
- Results: time, retries, best, Next/Retry/Home-or-Levels.
- Settings dialog: sound and volume, fullscreen, saved-game options, controls
  and this level's terrain help.
- Touch: a cross-shaped hold-to-move D-pad in the thumb zone; landscape
  overlays it bottom-left, portrait places it under the board.
- Editor and sound garden hidden behind the `?dev` (or `?debug`) flag.

Non-goals: gameplay, movement, saves, records or audio behaviour changes; new
levels; accounts/telemetry; swipe or gamepad controls.

## Acceptance criteria

- [x] Boot shows Home; Continue resumes the exact saved run, New run confirms before replacing it.
- [x] Level select shows each set without page scrolling at 1280x800, 390x844 and 844x390, and plays a chosen level.
- [x] Play HUD contains no IDs, tick margins or badges; the board uses at least 80% of the viewport height on 844x390 and its full width on 390x844.
- [x] Pause offers Resume, Restart, Settings and Home/Levels; Esc/Space pause; results offer Next/Retry/Home-or-Levels.
- [x] Touch D-pad is cross-shaped with 56px+ targets and hold-to-move behaviour unchanged.
- [x] Editor and sound garden are unreachable without `?dev`/`?debug`; remain functional with it.
- [ ] `npm test`, `npm run build` and the migrated browser suites pass.

## Implementation context

UI lives in `index.html`, `presentation/style.css` and `presentation/main.ts`.
New pure helpers: `application/level-catalogue.ts` (trial sets) and
`application/menu-model.ts` (home/HUD/result labels). BT-085 is concurrently
adding a level; it should register through the catalogue. BT-035's world
selection goals (no section skipping, confirmed replacement) are preserved.

## Verification

`npm test`, `npm run build`, `npm run test:browser`, `npm run test:journey`,
plus the explosion-puzzle, sound-demo and editor browser suites. Named captures
of home, levels, play, pause and results at 1280x800, 390x844 and 844x390 under
`artifacts/ui-flow/`.

## Handoff

- Reservation reconciliation (BT-092, 2026-10-14): user explicitly requested
  autonomous continuation of the audio work. The recorded direct handoff below
  reports implementation returned and no owned resources; its session last
  updated 2026-10-13T18:34:35Z. Released the stale primary reservation, preserving
  all UI changes and outstanding verification. Former assignment: owner
  `copilot`, run `a4d18339-a07d-4a78-a018-1dcfa3c606be`, branch null, worktree `.`.
- Summary: Implemented by the orchestrator directly in the shared working tree; ready for review pending the final browser rerun noted under Verification.
- Changes: `index.html`, `presentation/style.css` and `presentation/main.ts` rebuilt around Home / Levels / Play (+ dev-only Edit) screens on one persistent board; HUD over the board; single pause/ready/results card; settings dialog (sound, fullscreen, saved game, how to play, developer tools behind `?dev`/`?debug`); cross D-pad; Home world card with section pips, Continue and confirmed New run; course strip when several worlds exist (legacy fixtures, BT-035). New pure modules `application/level-catalogue.ts` (trial sets, BT-085's Pulse Line and later a Tentative set register here) and `application/menu-model.ts`, with unit tests. Home/Levels render on demand; no `backdrop-filter` over the board (a full-screen blur stalled software-GL boots by ~5 s and broke reload-time storage acquisition). Sound toggles stay focusable and queue the latest request while a change is in flight. Browser suites migrated: rough-world, rough-journey, explosion-puzzles (rewritten for level select), sound-demo, world-editor, continuation, graphics-recovery, motion-clips, checkpoint-camera, legacy scenarios and journey. New `tests/browser/ui-flow.ts` capture script.
- Verification: `npm test` 536/536; `npm run build`; `npm run test:browser` pass. Passing browser suites: journey (production + ordinary non-debug), explosion-puzzles (`--timeout 600000`), sound-demo, world-editor, graphics-recovery, explosions, aftershock (production + all three retired V1 regressions: scenarios, journey, aftershock), world-camera, checkpoint-camera, walls. `node tests/browser/ui-flow.ts` captures in `artifacts/ui-flow/`: board 1280x800 = 100%, 844x390 = 100%, 390x844 = full width (74% height above the D-pad). Level select fits every set without scrolling at all three sizes with 44px targets.
- Not passing: `tests/browser/continuation.ts` stalls inside one 5 s CDP evaluate; a CPU profile shows ~8.8 s in SwiftShader `getProgramInfoLog`/`getShaderInfoLog` (first-use WebGL program compile). The pre-change baseline also fails this suite in this environment (at the following reload). `motion-clips` was migrated but not rerun.
- Risks: shared machine load (load average 20-38) caused evaluate timeouts in long suites; the concurrent BT-085 session edits the catalogue and these UI files. `motion-clips` was migrated but not rerun. Physical devices untested.
- Commit: not committed; changes are in the shared working tree alongside other sessions' uncommitted work.
- Resources: no servers left running by this task; temporary probe files removed.
- Decisions: editor and sound garden hidden behind `?dev` (or `?debug`, which tests use); pause button only pauses (Space/Esc toggle); trial levels start immediately from Levels; sound demos keep a ready card.

## Result

Pending.
