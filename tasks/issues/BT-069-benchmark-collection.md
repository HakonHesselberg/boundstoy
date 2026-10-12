---
{
  "id": "BT-069",
  "title": "Build a controlled 24-level benchmark collection",
  "type": "feature",
  "status": "done",
  "priority": "P1",
  "depends_on": [],
  "parent": null,
  "scope": ["data/benchmarks.ts", "data/benchmark-replays.ts", "presentation/main.ts", "presentation/style.css", "index.html", "tests/benchmarks.test.ts", "tests/browser/benchmarks.ts", "tests/run-continuation.test.ts", "docs/GAME_SYSTEMS.md", "docs/ARCHITECTURE.md", "tasks/issues/BT-069-benchmark-collection.md"],
  "approval": "2026-10-12 user requested many levels to benchmark what works, then selected 24 levels (six families by four surfaces), fixed geometry/timing across surfaces and clear labels for variants without a verified solution. Keep the collection separate from Aftershock.",
  "assignment": {"owner": "orchestrator", "run": "183b57e8-2976-4cc3-88cc-7f7536f244de", "branch": null, "worktree": "."},
  "blocked_reason": null
}
---
# BT-069: Build a controlled 24-level benchmark collection

## Problem

We need enough short, accessible experiments to compare movement/puzzle fit
through actual human play, rather than select content from legal replays alone.

## Scope

Create six original puzzle families: travelling wave, alternating bands, side
refuges, checker grid, inward rings and wall slalom. Each has normal, soft-ice,
hard-ice and mud variants: 24 unique IDs, revision 1. Change only marked puzzle
floor; keep safe normal staging/exit landings, topology, spawn/exit, camera,
hazards, phases and periods identical within each family. No source assets or
literal StarCraft map copies; these are original mechanical studies.

Use validated immutable single-section checkpoint-mode V2 levels, no checkpoints
beside the exit, unchanged movement and one-tick blasts. Whole-puzzle reveals.
Ordinary deaths keep the clock; Restart resets the pattern and retains totals.
Winning permits a fresh trial.

Add a dedicated Benchmarks menu, family selection and four clearly labelled
surface variants. Show stable IDs, what each family investigates and whether
an input-only deathless route is verified. Unknown means unsolved by this
investigation, not impossible. All 24 remain selectable regardless of evidence.
Benchmark trials do not replace the active Aftershock run, update production
records or overwrite the editor draft. Returning to Aftershock restores its
in-memory run; reload retains normal production checkpoint persistence.

No automatic solver in the browser, no ratings/backend/telemetry, no production
level-count expansion and no physics/timing tuning per surface.

## Acceptance criteria

- [x] Six distinct families times four surfaces yield 24 validated immutable levels.
- [x] Paired variants differ only in puzzle-floor surface and identity/description.
- [x] Every normal baseline has a verified deathless input-only route; other variants are labelled from actual evidence, never assumed solvable.
- [x] Published witnesses have exact finish times, measured late-input margins and appropriate failure/necessity probes.
- [x] All levels are accessible in a separate responsive keyboard/touch menu, with stable IDs, comparison questions and honest evidence labels.
- [x] Restart, pause, completion, graphics/layout behavior and return navigation work without touching production run/records or draft.
- [x] Native browser checks cover all 24 selections, comparison navigation, a legal completion, unknown-route labels, storage isolation and three viewport sizes.
- [x] Full portable suite and build pass; current preview serves the collection.

## Implementation context

BT-068 documents source mechanics and limitations. This issue uses original
layouts and game-native tick schedules, not unverified source millisecond
conversions. `data/levels.ts` remains production-only. Reuse existing playtest
save suppression, checkpoint restart and world camera. Distinguish benchmarks
from editor playtests explicitly so finish/return actions never route to the
wrong activity. Keep the editor draft and world continuation independent.

## Verification

TDD: data/schema/equality/evidence tests before data implementation, browser
scenario before menu wiring. Use `node --test tests/benchmarks.test.ts`,
`npm test`, `npm run build`, and
`node tests/browser/benchmarks.ts --browser /usr/lib/chromium/chromium`.
Measure source-route failure/clear outcomes and input margins with real `step`;
never teleport, weaken physics or classify unsuccessful search as impossibility.
Native checks use isolated owned profiles, never the user's live save.

## Human playtest feedback

2026-10-12: User reviewed all 24 benchmarks, revision 1, in two batches (1-8
and 9-24). Record feedback without changing the collection.

| # | Benchmark ID | User feedback |
| --- | --- | --- |
| 1 | `bench-travelling-wave-normal` | Standard wave level. Fairly easy timing, but works as an early puzzle. |
| 2 | `bench-travelling-wave-soft` | Does not really make sense: soft ice without turning is essentially level 1. |
| 3 | `bench-travelling-wave-hard` | Better than 2, but still essentially a variant of 1 because travel is in a straight line. |
| 4 | `bench-travelling-wave-mud` | Reported as unbeatable. Mud is not fun when the puzzle requires being fast. |
| 5 | `bench-alternating-bands-normal` | Fine: a standard alternating timing puzzle. |
| 6 | `bench-alternating-bands-soft` | Very frustrating: cannot control timing and there is not enough room to slide around. Takes the fun away from sliding. |
| 7 | `bench-alternating-bands-hard` | Feels like throwing the character forward and hoping to miss the explosion. At the end, the character stops at the ice edge and dies to the next explosion unless moved farther inside. Feels bad. |
| 8 | `bench-alternating-bands-mud` | Surprisingly more acceptable. Moving a little, waiting, then moving and waiting again suits mud's slower movement. |
| 9 | `bench-side-refuges-normal` | Acceptable and a good early puzzle. Would be more interesting if the pockets also exploded. |
| 10 | `bench-side-refuges-soft` | Works, but requires a lot of precision. Tight spaces and precise explosion timings are not fun on soft ice. |
| 11 | `bench-side-refuges-hard` | Hard ice feels very bad for this kind of puzzle. |
| 12 | `bench-side-refuges-mud` | Reported as unsolvable with mud, and also feels bad. |
| 13 | `bench-checker-grid-normal` | Feels nice and normal. |
| 14 | `bench-checker-grid-soft` | Soft ice feels terrible at this level of required precision. |
| 15 | `bench-checker-grid-hard` | Same problem as soft ice; feels mostly luck-based depending on when sliding starts. |
| 16 | `bench-checker-grid-mud` | Acceptable. |
| 17 | `bench-inward-rings-normal` | Does not feel like a good puzzle. |
| 18 | `bench-inward-rings-soft` | Not good. |
| 19 | `bench-inward-rings-hard` | Not good. |
| 20 | `bench-inward-rings-mud` | Not good. |
| 21 | `bench-wall-slalom-normal` | Completely trivial. |
| 22 | `bench-wall-slalom-soft` | Layout is okay for soft ice, but explosions are not the best obstacle for soft ice, at least in this arrangement. |
| 23 | `bench-wall-slalom-hard` | Does not feel good for hard ice; explosions are trivial. |
| 24 | `bench-wall-slalom-mud` | Mud is generally boring when the level is so easy and requires walking far very slowly. |

These are human observations, not substituted solver results. Levels 4 and 12
remain without verified routes; impossibility has not been established.
The user reports that level 10 works, but no exact input replay has been
captured, so its automated evidence label remains unchanged. Level 7's
reported end-of-ice stop/death behavior is recorded for later investigation,
not yet diagnosed. No level changes or fixes are authorized by this feedback
record alone.

Design takeaways from this playtest, not an approved redesign:

- Normal-ground wave, alternating bands, side refuges and checker grid are
  acceptable foundations; wave and side refuges suit early puzzles.
- Soft ice needs room for enjoyable steering. Straight-line substitutions
  add little, while cramped, precision-timed explosions fight the movement.
  Wall slalom's layout is more promising than its current explosion obstacles.
- Hard-ice versions repeatedly feel bad or luck-based rather than controlled;
  a legal route does not resolve that gameplay problem.
- Mud can suit short move/wait timing decisions (8 and 16), but speed demands
  and long, trivial slow walks feel bad.
- Inward rings received negative feedback on every surface. Wall slalom's
  current hazards are too trivial on normal and hard ice.

### Subsequent scope decision

2026-10-12, after reviewing all 24: the user directed us to ignore mud
completely and focus on a good set of explosion puzzles. This supersedes the
proposed next round of six mixed prototypes: no mud prototype or separate
hazard-free sliding/aiming course in the next set. Prioritize explosion-pattern
gameplay rather than surface comparisons. This does not itself remove existing
movement rules or benchmark data; the existing 24 remain reference material.
The exact next layouts and the role of ice have not been selected.

The user also requested closing the running game. Stopped the owned
`aftershock-playtest` preview session on port 4400.

## Handoff

- Summary: Implemented the approved 24-trial collection directly in the primary worktree.
- Changes: Benchmark registries, menu/play flow, isolated session results, portable/native tests and documentation, detailed below.
- Verification: Build, 448 portable tests, benchmark and production native browser scenarios passed; evidence below.
- Risks: Four variants remain unverified, human gameplay acceptance and launch-platform qualification remain open.
- Commit: Uncommitted changes in `/home/hhh/pri/boundstoy`, limited to the declared scope; inherited dirty work preserved.
- Resources: Owned native-test resources cleaned; existing user preview on port 4400 left running.
- Decisions: Fixed geometry/timing and honest unknown-route labels follow the user's explicit comparison choice. No workers or publication.

- Added the two benchmark registries and portable/native tests; wired the
  separate menu, session trial summaries, explicit benchmark identity and
  external Start trial action into `presentation/main.ts`, `index.html` and
  `presentation/style.css`. Updated architecture and game-system documentation.
- All six normal baselines and fourteen other variants have exact deathless
  witnesses. Unverified: travelling-wave mud; side-refuges soft ice, hard ice
  and mud. These remain playable and are not classified as impossible.
- Measured each witness command boundary's independent late-input margin
  through actual simulation, capped at 24 ticks; the minimum is 7 ticks.
  Six failure probes die with hazards and finish with hazards removed.
  This evidence does not prove optimality, compulsory use of every refuge,
  resilience to simultaneous mistakes, or worthwhile human gameplay.
- TDD reproduced missing data/evidence, missing menu and an obscuring ready
  overlay. Moved Start trial outside the canvas rather than accepting camera
  projection alone as a complete reveal. Corrected the native harness's
  Shift-Tab modifier (8, not Alt's 1). The initial full suite then found one
  source-wiring assertion tied to the previous retry-label expression;
  updated it to assert both the new benchmark branch and the retained
  checkpoint restart branch in `tests/run-continuation.test.ts`.
- `npm run build`: pass, including type checking. Existing nonfatal bundle
  warning remains (711.65 kB minified JavaScript).
- `node --test tests/run-continuation.test.ts tests/benchmarks.test.ts`: pass.
- Final `npm test`: **448/448 pass**, zero failures/skips, 218.843 seconds.
  The earlier 447/448 result is retained in the session log, not hidden.
- `node tests/browser/benchmarks.ts --browser /usr/lib/chromium/chromium`:
  pass; harness `artifacts/browser-check/run-pXOcG4`, screenshots
  `artifacts/benchmarks/run-6W21Iy`. Covers all 24 definitions, real keyboard
  selection and movement, 44px native click targets, all six reveals at
  1280x900 / 390x844 / 844x390, completion/new trial/restart, nonempty draft
  preservation, editor return, production record/run isolation and reload.
- `node scripts/browser-check.ts --browser /usr/lib/chromium/chromium`:
  pass; `artifacts/browser-check/run-HELdZe`. Production checkpoint saves,
  native controls, reload, continued finish, records and offline play remain
  working at all three viewport sizes.
- Inspected final screenshots: side-refuges portrait, wall-slalom landscape
  and checker-grid desktop. Whole puzzles are unobstructed while ready;
  start controls are outside the canvas. This is desktop Chromium evidence,
  not qualification of every launch platform.
- Existing preview `http://127.0.0.1:4400/` responds with the updated Start trial
  markup and `index-DzcLk1ws.js` / `index-B6Tm31ve.css`; no restart needed.
  Native checks cleaned their owned browsers, profiles and preview servers.
  The user's preview remains running.

Detailed command logs are in the session's `files/` directory:
`bt069-build.log`, `bt069-browser-final.log`,
`bt069-production-regression.log`, `bt069-targeted-final.log`,
`bt069-full.log` and `bt069-full-final.log`.

## Result

- Summary: Accepted after direct code/data review, actual browser runs, screenshot
inspection and the final fully passing portable suite. Menu > Benchmarks
provides the approved 24 fixed-comparison experiments with 20 verified
reference routes. Production Aftershock, movement rules and save formats were
not expanded or retuned by this work. BT-053 remains ready for human acceptance;
these experiments and legal replays do not satisfy that release gate.
- Verification: 448/448 portable tests, typechecked production build, both native browser scenarios and named screenshots above.
- Integration: Changes integrated in the primary working tree and rebuilt into the existing local preview; no commit or publication.
