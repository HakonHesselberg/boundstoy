---
{
  "id": "BT-067",
  "title": "Integrate and verify checkpoint-based Aftershock play",
  "type": "feature",
  "status": "done",
  "priority": "P1",
  "depends_on": ["BT-065", "BT-066", "BT-033", "BT-063"],
  "parent": "BT-038",
  "scope": ["data/", "core/editor.ts", "core/simulation.ts", "presentation/main.ts", "presentation/scene.ts", "presentation/audio.ts", "presentation/hazard-visuals.ts", "tests/", "scripts/inspect.ts", "docs/", "README.md", "CLAUDE.md"],
  "approval": "2026-10-11 user approved active-only puzzle timing, deactivation after completion and checkpoint restart/resume with boundary-only persistence.",
  "assignment": null,
  "blocked_reason": null
}
---
# BT-067: Integrate and verify checkpoint-based Aftershock play

## Problem

Core timing and checkpoint saves must agree with visible hazards, sound,
authored routes, debug inspection and normal browser play.

## Scope

Register the revised checkpoint-mode world, render dormant/completed hazards
without activity, gate sound, recheck routes and recovery, adapt browser
scenarios to checkpoint resume and boundary-only writes, update documentation
and refresh the owned preview. No geometry or movement changes.

## Acceptance criteria

- [x] Future/completed hazards are inert in collision, rendering, sound and inspection.
- [x] Puzzle phases have explicit local origins; legal ordinary/faster witnesses and recovery evidence cover the revised rules.
- [x] Native restart/reload/death/checkpoint tests confirm the selected save and timing behavior without periodic writes.
- [x] Full portable suite, build, relevant native checks and preview fingerprints are recorded.
- [x] User feedback remains the human acceptance gate; no release or publication is inferred.

## Implementation context

Preserve the authored movement layouts and the quiet walls/checkpoint camera.
Bump the production world revision for timing changes; do not reinterpret old
records as new-rule results. Keep old global-clock authoring fixtures available
for prior evidence rather than rewriting history.
Wire editor-created timed hazards to their explicit owning section so the
new schema does not break editing a registered/imported checkpoint world.

## Verification

Headless replays and necessity/recovery checks, rendered activation/reveal
checks, native checkpoint save/write-count and editor/graphics regressions.

## Handoff

Serial-primary integration; no concurrent writers, commits or publication.
Worker 4ad36254-bdf2-40a8-94c4-3d87cea56e8c failed with a tool/server error after
partial implementation. Runtime confirms failed, not running. Inventory
comparison identified twelve changed/added paths, all in scope. Orchestrator
resumed directly, preserving that work; no replacement worker was launched.

- Summary: Production Aftershock revision 2 now runs one checkpoint-owned puzzle at a time, with checkpoint saves and separate Restart/New run actions.
- Changes: Explicit hazard ownership/local phases, quiet dormant pads and hidden inactive saws, sound/ASCII/inspection gates, editor ownership, updated production witnesses/browser drivers/docs. Collision resolves active ownership once per evaluation, not for every hazard. Preserved geometry, movement, camera scale and matte walls.
- Verification: Full portable suite 442/442; typecheck/build/diff checks pass. Ordinary/faster input-only finishes 5752/5648 ticks. Ordinary delay checks are capped at 40 ticks with minimum measured 30; fast shelter margins 23/23/25/25/25 ticks. All seven live-death and normalized restart/reload recoveries pass.
- Risks: Human gameplay, launch platforms and hardware performance remain unaccepted. Historical global-clock continuation fixture BT-064 is not resolved or counted as passing. Earlier wrapper-based browser attempts hit startup timeouts; final same-version direct Chromium binary checks pass without changing deadlines or disabling its sandbox.
- Commit: None; accepted primary-tree changes remain uncommitted. Owned preview remains at http://127.0.0.1:4400/.

### Native evidence

- Production lifecycle, obsolete revision-1 active deletion, revision-isolated records, same-ID Restart, no periodic writes and deathless continued finish at 6221: `artifacts/browser-check/run-klTp2k`.
- Seven actual deaths, uninterrupted live respawn clocks, checkpoint reloads, downstream recovery, editor isolation/resources, sound and ordinary non-debug play: `artifacts/browser-check/run-2nZKQU`.
- All seven full-puzzle reveals and active-only visuals at desktop/portrait/landscape, normal/reduced motion, pause and checkpoint reload: `artifacts/checkpoint-camera/run-5GZOJj`, harness `artifacts/browser-check/run-66vAXn`.
- Graphics loss/restoration: `artifacts/graphics-recovery/run-KjwYIS`, harness `artifacts/browser-check/run-YLezVW`.
- Real-pixel readability: `artifacts/browser-check/run-j0f0j9`.
- Independent isolated headless-browser checks also completed all 5752 ticks at 1280x900, 390x844 and 844x390. Active counts were 13/23/1/32/25/14/44/74 and zero after completion; dormant warning/burst/glow and inactive saw visibility were all off. That owned tab was closed.

The first new visual assertion sampled newly allocated objects before the
first frame. The driver now waits for rendered frames after the new-run
transaction; actual visual assertions remain strict. A separate inspection
regression added a mode to legacy identity output; identity compatibility
was restored, and the full suite then passed.

Session logs: `bt067-full-final.log`, `bt067-targeted-final.log`,
`bt067-fast-margins.json`, `bt067-browser-final.log`, `bt067-journey-final.log`,
`bt067-camera-binary.log`, `bt067-graphics.log`, `bt067-readability.log`,
`bt067-build-final.log`.

Build and served preview fingerprints match:

- `dist/index.html`: `210f795a6c45f31cf422c83c548940c450a058d87eebc809d1a83a0aa7648f76`
- `dist/assets/index-TW6drP_8.js`: `37d8cd6c1b91cd093e8a5c4fee1fa3d0974ff7a804554445a794efd05ec1913f`

## Result

- Summary: Approved checkpoint gameplay/save correction is implemented and verified.
- Verification: Portable, native lifecycle, all seven recoveries, visual activation/reveals, graphics and pixel-readability evidence above; no failed attempt was relabeled as passing.
- Integration: Local production build and existing preview agree. BT-053 resumes human feedback; no commit, deployment, publication or human acceptance inferred.
