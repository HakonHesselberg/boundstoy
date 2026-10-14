---
{
  "id": "BT-084",
  "title": "Audition varied explosion and buildup sound pairs",
  "type": "feature",
  "status": "done",
  "priority": "P2",
  "depends_on": [],
  "parent": null,
  "scope": ["data/explosion-palette.ts", "scripts/prepare-explosion-palette.ts", "public/audio/explosion-candidates/", "public/audio/audition-player.js", "public/audio/ice-candidates/audition.js", "public/THIRD_PARTY_NOTICES.txt", "index.html", "tests/audio.test.ts", "tests/explosion-candidates.test.ts", "tests/browser/explosion-candidates.ts", "docs/AUDIO.md", "docs/ARCHITECTURE.md"],
  "approval": "2026-10-13 user: Create another sound thingy with suggestions for various explosion and buildup sounds. User unavailable for placement clarification; use the proposed bounded default: a separate listening page linked from Sound garden.",
  "assignment": {"owner": "explosion-candidates", "run": "22313679-7a79-4454-8d26-620ceffba984", "branch": null, "worktree": "."},
  "blocked_reason": null
}
---
# BT-084: Audition varied explosion and buildup sound pairs

## Problem

The user wants an auditionable range of explosion and buildup sounds, like the
ice listening experiments. Provide contrasting, stylised suggestions rather
than choosing a production replacement without feedback.

## Scope

Eight original CC0 pairs: soft magic, airy puff, rounded pop, glass bloom,
wooden knock, deep cushion, electric snap and arcade burst. Use original seeded
offline synthesis, not Kenney or franchise recordings. Each warning lasts
exactly 27/120 seconds; each explosion has a brief impact and harmless decay.
Measure equal-context event loudness, keep warnings quieter than impacts and
leave conservative headroom. Per-pair previews offer warning, explosion,
warning-then-explosion and four finite repetitions.

Create a static listening page linked from Sound garden; no production bank,
hazards, routes, saves, dependencies or default sound changes. Reuse the
existing finite audition player's lifecycle through a shared helper and retain
the archived ice page's behavior. Keep audio opt-in, loading lazy, cancellation
safe, volume/mono/Stop available and errors explicit. All browser checks are
muted. Do not launch the user's game server or change system volume.

## Acceptance criteria

- [x] Eight clearly described contrasting pairs, with sixteen original CC0 WAVs and reproducible source/provenance.
- [x] Every buildup is exactly 225 ms; explosion onset and finite decay remain distinct.
- [x] Loudness is compared in the same repeated-event context, with measured headroom and clean endpoints.
- [x] Solo parts, paired playback and four-event patterns work after a gesture, with at most eight scheduled sources.
- [x] Stop, replacement, failure/retry, pending-load cancellation, zero volume, mono, hidden/blur/pagehide and restored-page playback work.
- [x] Responsive controls, lazy loading, game link and persistence isolation are verified; archived ice auditions still work.
- [x] Native tests, build and muted browser verification pass; final sonic selection is explicitly left to the user.

## Implementation context

Follow `data/ice-palette.ts` for frozen definitions, `scripts/prepare-audio.ts`
for seeded sound synthesis and `scripts/prepare-ice-candidates.ts` for PCM
encoding and FFmpeg measurements. Use the existing isolated browser harness.
Extract only finite preview playback from the earlier ice page; do not alter
its assets or the runtime `presentation/audio.ts` engine.

## Verification

- TDD: new native tests failed on the absent registry before implementation.
  Asset checks cover seeded reproduction, distinct waveforms, exact duration,
  endpoints, mono, finite decay, loudness, headroom and source/delivery hashes.
  The old explicit public-audio inventory also caught the new folder/helper;
  it was updated without weakening the runtime-bank assertions.
- `npm test`: 524/524 pass, no skipped/cancelled tests.
  Final log: session `22313679-7a79-4454-8d26-620ceffba984`,
  `files/explosion-tests.log`.
- `npm run build`: type-check and production build pass; existing large-chunk
  warning remains. No dependency or manifest changes.
- `node tests/browser/explosion-candidates.ts`: all 32 controls, sixteen
  gesture-only decoded assets, cache, exact 225 ms warning-to-impact spacing,
  four-pair intervals, eight-source bound, replacement, finite expiry, mono,
  zero volume, blur/hidden/pagehide, restored context, HTTP failure/retry,
  atomic loading, cancellation and unchanged storage pass.
  Final report: `artifacts/browser-check/run-sNoBmZ/report.json`.
- Initial browser checks exposed test-observer assumptions: closing a context
  need not dispatch every pending source's ended event. The observer now
  retires closed-context sources, as the existing ice check already does.
  Deliberately failed/delayed responses use prefetched fixtures so intentional
  aborts do not become unexpected transport failures in the strict harness.
  The delayed fixture ignores cancellation deliberately; the check verifies
  the signal was aborted and that its late completion still cannot play.
- `node tests/browser/ice-candidates.ts`: existing finite previews, reference
  mix, stale-ended protection, cancellation, failures and restored pages pass
  using the extracted player.
  Report: `artifacts/browser-check/run-lPtGXP/report.json`.
- `node tests/browser/sound-demo.ts`: unchanged garden playback, selection,
  route/recovery and persistence isolation pass.
  Report: `artifacts/browser-check/run-n8kj5o/report.json`.
- Responsive controls clicked at 1280x900, 390x844 and 844x390 with no horizontal
  overflow. Screenshots inspected:
  `artifacts/explosion-candidates/run-9mBgik/` (final desktop/landscape) and
  `artifacts/explosion-candidates/run-au2In2/` (same-layout portrait).
- Sixteen centred stereo PCM16/48 kHz files, 979,904 bytes total. Warning
  duration 225 ms, impact duration 280-620 ms. Event-train loudness -40 LUFS
  for warnings and -33 LUFS for impacts; maximum true peak -16.5 dBTP.
  All sixteen full-volume paired-pattern mixes (eight pairs at 44.1/48 kHz)
  peak at most 0.14929655194282532 with zero mono difference.
- The wooden hit was softened before mastering to reduce its transient crest.
  Static matching remeasures quantized output and corrects short-event gating
  in at most four passes; no limiter or dynamic normalization is used.
- Reproduction into session `files/explosion-reproduction/` produced all
  sixteen WAVs and the manifest byte-identically. Mastering output retained
  in `files/explosion-mastering.log`. Source hashes are tested.
- Every owned browser used the asserted `--mute-audio` flag. All owned
  browsers/profiles/sockets/preview servers were cleaned up. No user-speaker
  playback, system-volume change or game-server launch.

## Handoff

- Summary: Eight contrasting buildup/explosion pairs are ready for listening.
- Changes: Frozen registry, reproducible offline generator, sixteen original
  CC0 WAVs, a separate responsive page, Sound garden link, shared finite
  audition player, regression coverage, licensing and audio documentation.
- Verification: Full native suite, build, three real-browser flows, measured
  mixes and byte-identical asset reproduction pass; exact evidence above.
- Decisions: User was unavailable for placement clarification, so used the
  proposed separate-page default. Existing gameplay sounds, geometry, rules
  and persistence are unchanged. No final pair is automatically selected.
- Risks: Numerical matching and muted checks do not establish subjective
  timbre quality, warning readability in play or long-session comfort.
  Human listening and later production integration remain separate gates.
- Commit: None requested or made. Unrelated classic-bounds, ice-escape and
  earlier sound work in the shared tree preserved.
- Resources: All task-owned test resources were cleaned. This task did not
  launch a game server; at final verification an existing server on port 4321
  served the new page successfully and was left untouched.

## Result

- Summary: The requested eight-pair listening demo is delivered. Human
  preference and production selection are separate future decisions, not
  claimed as accepted by this task.
- Verification: 524/524 native tests, build, three muted browser flows,
  responsive screenshots, measured mixes and reproducible assets pass.
  Exact reports and results appear above.
- Integration: `/audio/explosion-candidates/index.html`, also linked from
  Sound garden > Audition sounds & volume > Explore 8 buildup & explosion pairs.
  Use Buildup only, Explosion only, Hear pair or Pattern x4 at a fixed volume.
  Existing gameplay audio is unchanged. The page is currently served at
  `http://127.0.0.1:4321/audio/explosion-candidates/index.html`.
  The completed assignment no longer reserves the shared primary worktree.
