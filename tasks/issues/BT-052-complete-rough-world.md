---
{
  "id": "BT-052",
  "title": "Integrate the complete rough Aftershock world for playtesting",
  "type": "feature",
  "status": "done",
  "priority": "P1",
  "depends_on": ["BT-041", "BT-045", "BT-047", "BT-048", "BT-049", "BT-050", "BT-051"],
  "parent": "BT-024",
  "scope": ["data/", "application/campaign.ts", "application/guidance.ts", "presentation/main.ts", "presentation/audio.ts", "presentation/style.css", "index.html", "tests/aftershock-world.test.ts", "tests/aftershock-world-sections.test.ts", "tests/aftershock-integration.test.ts", "tests/fixtures/aftershock-world.ts", "tests/campaign.test.ts", "tests/guidance.test.ts", "tests/editor.test.ts", "tests/hazards.test.ts", "tests/hazard-visuals.test.ts", "tests/relay-courses.test.ts", "tests/render-loop.test.ts", "tests/audio.test.ts", "tests/browser/", "tests/astro-consumer/scenarios.ts", "tests/mobile-readability.test.ts", "docs/TESTING.md", "docs/GAME_SYSTEMS.md", "docs/BROWSER_CHECKS.md", "docs/ARCHITECTURE.md", "docs/ASTRO_CHECKS.md", "README.md", "CLAUDE.md"],
  "approval": "2026-10-10 user approved implementation of the entire BT-038 plan with bounded subagents where helpful.",
  "assignment": {
    "owner": "orchestrator",
    "run": "183b57e8-2976-4cc3-88cc-7f7536f244de",
    "branch": null,
    "worktree": "."
  },
  "blocked_reason": null
}
---
# BT-052: Integrate the complete rough Aftershock world for playtesting

## Problem

Independent section witnesses and infrastructure do not establish a coherent
continuous escape map. The user wants substantial complete gameplay before
the main playtest, not another three-room prototype.

## Scope

Assemble and register the full world, retiring the three prototypes from the
selector without deleting useful regression evidence or old saves. Wire basic
Start/Continue/New run/results navigation, time-first records, exact continuation,
context recovery, guidance and section-relevant audio. Final selector and audio
polish remain BT-035/056. Do not wait for final art before delivering the map.

## Acceptance criteria

- [x] One continuous registered world contains eight sections, seven safe intermediate checkpoints and one final exit.
- [x] At least one complete legal world witness and a worthwhile faster strategy preserve global arrival phases across every connector.
- [x] Each checkpoint has input-driven death and successful downstream continuation, including representative/all-local-phase recovery.
- [x] Basic navigation, run replacement confirmation, saving, results and deathless continuation work without preset mastery targets or checkpoint skipping.
- [x] Hazard cues are readable and audio refers to the relevant section rather than unrelated off-screen blasts.
- [x] Editor roundtrip/playtest remains usable and cannot overwrite world records or active campaign saves.
- [x] The actual rough production build, named section/transition captures and remaining limitations are ready for the user's full-map playtest.

## Implementation context

Implementation approved; BT-038 defines M1. Content batches share one clock, so simply
concatenating zero-phase input recordings is insufficient. Test connector
arrival phases and re-author affected timing rather than inserting arbitrary
resets. Minimal usable UI/cues are required now; major final polish waits for
human acceptance. No intermediate user approval of every section is required.

Scope refinement before assignment: registry consumers include legacy unit
fixtures, optional motion captures, native lifecycle runners and the Astro
consumer. Adapt only directly coupled assumptions, preserving legacy behavior
tests via explicit legacy imports rather than deleting coverage. A dedicated
world-fixture file may keep bounded authoring maps out of production. Minimal
navigation CSS and current architecture/browser/README guidance are included;
this does not authorize unrelated tests, a rendering overhaul or final polish.
The directly coupled Astro check documentation is included when adapting its
retired localStorage/independent-course assumptions to the real V2 world.

## Verification

TDD in `tests/aftershock-world.test.ts`. Update existing production runners to
exercise the registered world rather than only the retired course count.
Run `npm test`, `npm run build` and `npm run release:check`, plus the new
camera/continuation/storage/graphics/editor runners from prerequisite issues.
Capture 1280x900, 390x844 and 844x390 starts, transitions, mixed hazards and
completion; record save/reload mid-puzzle and recovery at all seven checkpoints.

## Handoff

- Summary: Integrated one complete rough production world, preserving legacy compatibility.
- Changes: World registration, navigation/guidance/local audio, production and legacy browser coverage, related consumers and documentation.
- Verification: Parent passed 398 tests, build, combined release gate and additional native suites; exact evidence is recorded below.
- Risks: Human gameplay acceptance, busy wall presentation and poor software-renderer pacing remain explicit; launch platforms are not certified.
- Commit: None; all scoped changes remain in the primary worktree alongside preserved inherited work.

Worker d191f761-ea70-4b46-b33b-3e5eea3a9034 failed at transport return
(400 internal server error) after preserving partial integration. All owned
commands have completed; no replacement worker was launched. Parent takes over
direct review and completion. The preserved diff is in session
`files/bt052-worker.diff`; worker unit evidence reports 398 passing tests,
and native general/capture runs completed, but required lifecycle/recovery,
coverage preservation, documentation and visible captures are not accepted.
In particular, captured pause overlays obscure the actual puzzle views.

Assigned one serial-primary background worker, d191f761-ea70-4b46-b33b-3e5eea3a9034.
Baseline master d069ba5aecedb3dab027f08d4ccecc65bd9233ff plus accepted
foundations and all eight unregistered content sections. Parent independently
passed 395 tests and production build; full suite is about 163 seconds.
All 189 source/tracker baseline files are copied in session
`files/bt052-baseline/`; hashes in `files/pre-bt052-hashes.json`.
Only this worker writes code. Parent independently reviews outstanding human
and platform gates and retains tracker ownership; no concurrent code edits.
No commits, publication, new mechanics or dependency installation authorized.

## Result

- Summary: Parent integration accepted after direct review, corrections and actual final
verification. This accepts a complete rough candidate for the user to play,
not human enjoyment, final visual quality, hardware performance or release.
The faster strategy earns a measured 714-tick saving through different legal
choices; its subjective value and the finale remain part of BT-053.

- Verification: `npm run release:check` passed: **398/398 portable tests**, typecheck/build,
production general/journey/explosions/captures/readability and all three
isolated legacy browser suites. The final general/journey runs are
`run-U4GWf1` / `run-0BMnRR`, explosions `run-dwvBpA`, world captures
`run-1eJk0N` / `captures-2epRgF`, legacy registry `run-3WHtmg` with browser
runs `run-jO425J`, `run-jaYNL0`, `run-BKVaFa`, and readability `run-5BAyUY`.
Production graphics passed again as `run-0eZ8RX` / `run-xE4pB5`.
Optional affected Checkerboard/UI motion captures and world pacing completed
as `run-Ydf9jh`, under `artifacts/bt052/motion`.
Full output: session `files/bt052-release-final.log`.

The first combined attempt exposed a test-order race: injected CPU stalling
could hit the first resumed frame, whose elapsed time correctly starts at zero.
The corrected test waits for eight actual live ticks before injection, retaining
the same 13-tick maximum. The complete gate then passed; no gameplay clock
behavior was changed to satisfy it.

**Performance limitation:** the four-second SwiftShader world sample produced
21 frame intervals, mean 189.67 ms, p95 283.3 ms, maximum 616.7 ms. This is poor
software-renderer pacing, not a performance pass. Hardware Brave play and
BT-057 must assess/fix actual target performance; no smoothness claim is made.
The optional clip command reports measurements without imposing a frame budget.

Candidate: world `aftershock` revision 1, uncommitted on master
`d069ba5aecedb3dab027f08d4ccecc65bd9233ff`. Production JavaScript
`index-Byi1kkgy.js`, SHA-256
`76e73d53d3c82591b7c36e03f28f155a017f950e536cd94c8ad91fd60a886eb8`;
`dist/index.html` SHA-256
`0785a47fcb96335718cd6fa5b6b5f4fc1f92e25cdad46f3895f878b6b91dba38`.
- Integration: One stable production world replaces the retired selector entries; inherited rendering and earlier accepted foundations remain intact. No commit, deployment or publication occurred.

Corrections beyond the preserved worker implementation:

- Replaced racing capture-only `hidden` mutations with explicit CSS visibility;
  native save/HUD callbacks no longer cover legal scene captures with pause cards.
- Restored all three retired V1 browser suites through an isolated registry,
  rather than silently replacing their coverage with the shorter V2 smoke check.
- Added the actual world journey: sound/volume/mute, held/repeated keys, native
  hidden-tab pause, bounded 4x-CPU catch-up, full same-ID editor isolation and
  repeated resources, ordinary non-debug play, and every real checkpoint retry.
- Shared the already-accepted input-only recovery cases between Node and native
  checks. Production death/respawn/downstream ticks are
  853/907/1755, 1617/1671/2221, 2168/2222/2905, 2951/3005/3783,
  3733/3787/4604, 4848/4902/5619 and 5284/5338/6325. Legal waits are
  0/0/0/15/0/0/34 ticks. Every death state also survives exact native reload.
- Corrected obsolete full-world visibility and always-mobile-locator assumptions:
  measure actual opaque locator pixels when needed, and require the entire
  current section/connector frame at all named stops and the final pre-win tick.
- Corrected graphics-test expectations for presentation-only editor focus;
  production loss/restore/resource/failure checks passed without renderer changes.
- Adapted Astro and optional motion consumers away from retired registry indices
  and localStorage authority. Updated world/accessibility instructions and docs.

Native prerequisite evidence: world camera `run-HpVhZS` / `run-TDzC2l`;
continuation `run-geiEsk` / `run-DTfxHW`; storage `run-cp0bkk`;
world editor `native-OT4bK7` / `run-qmdtLW`; production graphics
`run-C8aGEZ` / `run-Ac1StR`. All owned resources were cleaned up. Native
BFCache retention and quota exhaustion remain explicitly unverified under BT-062.
The successful production journey is `run-ypuCxR`. Root and nested real Astro
consumers passed under `tests/astro-consumer/artifacts/run-2e9637da-3db6-4174-aa52-653e7c0ed4c0`.
These are integration checks, not launch-platform or human gameplay certification.

Parent inspected unobscured views spanning all eight sections under
`artifacts/bt052/captures-f2xqzK`. Warning/flash tiles, patrols and player
locators are distinguishable in the captures, but the dense wall treatment is
visually busy, especially on mobile, and distant rooms can appear in unused
viewport space. This remains visible rough presentation, not final visual
acceptance. Human confusion, fairness, progression and finale value remain BT-053;
wall hierarchy and final visual integration remain BT-033/055.
