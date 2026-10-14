---
{
  "id": "BT-079",
  "title": "Audition softer expressive ice sound candidates before further integration",
  "type": "feature",
  "status": "blocked",
  "priority": "P2",
  "depends_on": ["BT-078"],
  "parent": null,
  "scope": ["public/audio/ice-candidates/", "public/audio/ice-palette/", "public/THIRD_PARTY_NOTICES.txt", "scripts/render-strudel-audio.ts", "scripts/prepare-ice-candidates.ts", "scripts/prepare-ice-palette.ts", "scripts/browser-check.ts", "data/ice-palette.ts", "data/sound-demo.ts", "presentation/audio.ts", "presentation/main.ts", "presentation/style.css", "index.html", "tests/ice-candidates.test.ts", "tests/ice-palette.test.ts", "tests/ice-audio.test.ts", "tests/audio.test.ts", "tests/browser-check.test.ts", "tests/browser/runtime.ts", "tests/browser/ice-candidates.ts", "tests/browser/sound-demo.ts", "docs/AUDIO.md", "docs/ARCHITECTURE.md"],
  "approval": "2026-10-13 user approved the shortlist, preferred A/C and rejected B, then requested: Use the sound garden to make a big variety of possible ice sounds. Expand to twelve demo-only alternatives; no final production selection.",
  "assignment": null,
  "blocked_reason": "Technical audition delivery is preserved; awaiting human sonic selection and long-hold acceptance, not an active code worker. Playback loudness feedback is handled separately."
}
---
# BT-079: Audition softer expressive ice sound candidates before further integration

## Problem

The user auditioned BT-078 and described it as machinery or a heavily trafficked
road. The desired reference is the feeling of a graceful animated character or
figure skater gliding on ice: delicate, silky, buoyant and gently magical.
It need not reproduce real ice. Lowering the current mix alone is insufficient.

On 2026-10-13 the user requested this plan, including different sound types,
source research and an actual soft pad authored in Strudel and exported.
The user subsequently approved production of the shortlist. Final selection
and production integration remain gated on listening feedback. The subsequent
approved expansion integrates alternatives only into Sound garden; the normal
gameplay sound bank is unchanged.

## Scope

Current approved expansion: twelve original tonal ice alternatives inside the
existing Sound garden, retaining Weightless and Airy veil as references. Include
round pads, airy/vocal colours, soft strings and delicate harmonic textures;
no stretched cloth or traffic-like noise beds. Author ten additional Strudel
patches, prepare matched-loudness steady-state loops, and provide a grouped
selector plus previous/next/preview controls. Selection works while skating.
Load only the chosen loop, retain the shared eight-voice cap and existing
stop/pause/death/navigation cleanup. Preserve all demo routes, world saves,
editor drafts and non-demo sounds. Verify actual loop joins, sustained-motion
playback, asset failures, all twelve choices and responsive controls. Previous
shortlist evidence below describes the completed earlier phase; the expansion
is technically delivered and awaits human listening.

The user also requested no playback through their speakers. Automated browser
checks and Strudel authoring use the shared muted Chromium launcher; audio
graphs and offline measurements still run. Do not alter system volume or
trigger playback in the user's own browser.

Create a small, genuinely varied shortlist before further audio-engine work.
Start with pad-only sound, not a noise bed with another layer added. Preserve
BT-078's useful sustained playback, lifecycle cleanup and isolated demo.
Do not treat its existing timbres, low-register voicing, chorus or noise balance
as constraints to preserve.

No recognizable film themes, franchise recordings, new movement rules, runtime
Strudel dependency, production rollout or wholesale sound replacement.
Other cues remain a stable comparison reference until an ice direction is chosen.

## Acceptance criteria

- [x] Twelve selectable Sound garden alternatives span at least four sound families, not merely gain or pitch changes.
- [x] All twelve have measured steady-state loops and previews, lazy loading, bounded playback and unchanged demo/save behavior.
- [x] At least one pad is actually authored and rendered in Strudel, with its editable source and captured audio retained.
- [x] At least one candidate has no wind/noise layer.
- [x] Candidate recordings have per-file verified redistribution licenses and provenance; prefer CC0.
- [ ] Equal-context previews are compared at approximately matched perceived loudness, not merely equal peaks. Measured -30 LUFS matching is delivered; subjective comparison awaits the user.
- [ ] User listening selects a final direction before production integration or broader palette changes.
- [x] Demo masters loop cleanly and preserve actual-motion playback, voice limits, cleanup and save isolation.

## Implementation context

### Sound brief

Aim for weightlessness and a gentle skating gesture, not propulsion or friction.
Exclude prominent low rumble, static engine-like tones, broad road-like noise,
grit, metallic resonances, sharp hiss and audible rhythmic pumping.
Do not assume every candidate needs a chord, reverb or a realistic ice layer.
Musical character is welcome; repetitive melodies and reward jingles are not
part of the sustained movement sound.

### Candidate directions

| Candidate | Character | Creation/source approach |
| --- | --- | --- |
| A: Weightless pad | Warm, rounded, softly floating; no wind underneath | Original Strudel sine/soft-triangle patch with restrained upper partials, sparse mid-register voicing and smooth envelopes. No bass drone, rhythmic LFO or conspicuous chorus beating. |
| B: Silk glide | A delicate, short-to-sustained swish with little or no identifiable pitch | Search CC0 soft fabric, gentle brush and light airy-swish recordings on Freesound/OpenGameArt. Reject crowd, wind rumble and skating-rink ambience; edit only a clean close texture. An original recording is an alternative if appropriate recording facilities are available. |
| C: Airy musical veil | Lighter and more diffuse than A, without a bell attack | A second original Strudel patch using softly shaped harmonic/formant colour and modest diffusion. No sampled choir/instrument bank unless its asset license is verified. |
| D: Storybook hybrid | A small hint of skating gesture around a soft tonal body | Combine the strongest tonal candidate with a much quieter selected swish only after auditioning the components. Omit this candidate if it merely returns to the rejected noise-plus-pad balance. |

Search by perceived gesture, not only by the word "ice". Finding a result on a
free-sound site does not establish that its specific file is CC0. Record author,
source URL, original filename, exact license and processing. Avoid NC/ND assets;
consider attribution-required material only with clear terms and retained credit.

### Phase 1: Prove actual Strudel-to-audio export

1. Author one original sustained pad, using Strudel's documented synths,
   partials, gain/filter envelopes and restrained reverb. Prefer simple synth
   sources so no unverified sample-bank rights enter the result.
2. Render a held passage in the real Strudel engine. Retain the editable
   pattern and record the engine/browser version, tempo and capture duration.
   The previous BT-078 Strudel file only played pre-generated WAVs; that does
   not satisfy this phase.
3. Prove one playable exported audio file before developing the full set.
   Official effects documentation describes routing outputs into a recorder/DAW.
   Use an isolated Strudel output: do not capture microphone input or unrelated
   applications. A code/pattern download is not an audio export.
4. Confirm the actual capture format in the chosen environment. Prefer
   lossless capture, then make a PCM WAV master with available audio tools.
   Converting a compressed capture to WAV does not make it lossless; disclose
   that limitation rather than hiding it.

The reviewed official docs verify synthesis, envelopes/effects and output
routing, not a specific one-click WAV export button. Establish the working
capture route as the first implementation gate rather than assuming that UI.

### Phase 2: Author/source the shortlist

Develop A first, then B and C independently; D is an optional combination.
For each, capture roughly 20-30 seconds of usable material plus release.
Try a sparse dyad and a more open voicing before choosing the candidate's
version, rather than fixing the previous D3/A3/E4 voicing in advance.
Reject traffic/motor-like textures before spending time mastering them.

Retain full-quality authoring material and license records in session artifacts
until shortlisted. Only selected redistributable assets should enter public/.
Use original composition/synthesis; do not copy an existing Strudel example
without checking its separate composition/sample licensing.

### Phase 3: Listening comparison before integration

Provide three or four labelled, 10-12 second solo previews, each with an onset,
held passage and release. Also compare each in the same short movement scene
with unchanged wall/warning/explosion cues, using the existing demo/rendering
facilities rather than another UI rewrite.

Match perceived loudness approximately using measurements plus listening;
equal peak normalization alone previously did not establish a coherent mix.
Keep conservative headroom (initial target at most -6 dBTP for preview masters,
not a final volume prescription). Evaluate tone at an ordinary fixed listening
volume, including whether the sound disappears on laptop speakers or becomes
fatiguing in headphones.

Human questions: does it suggest a graceful glide rather than a motor, is it
soft without merely being inaudible, is a 30-60 second hold pleasant, and can
warning/contact cues still be distinguished? User preference is the selection
gate; numerical safety checks cannot answer those questions.

### Phase 4: Prepare only the chosen direction for the game

Create a steady-state seamless loop from the selected render, preserving a
clean onset/release separately as needed. Do not repeat the full swelling
envelope at every loop boundary or solve the seam with an audible volume dip.
Choose loop duration from the sound (roughly 6-12 seconds as a starting range),
not an obligation to preserve the current four-second period.

Keep a high-quality stereo master if spatial diffusion helps; check mono
compatibility and choose the smallest delivery format that preserves the
auditioned character. The current mono/32 kHz budget must not silently dictate
the artistic result.

Use the existing data-owned ice settings and movement-driven WebAudio layer,
with minimal changes if the chosen source needs a different layer count.
Softer/harder ice should be subtle variations of the selected family, not
independent instruments or a much louder "hard" sound. No rollout outside the
isolated Sound garden without listening approval.

### References checked while planning

- Strudel synths/partials: https://strudel.cc/learn/synths/
- Strudel effects/envelopes/orbits and recorder routing: https://strudel.cc/learn/effects/
- Strudel scheduler/output architecture: https://strudel.cc/technical-manual/repl/
- Candidate search locations, not pre-approved files: https://freesound.org/ and https://opengameart.org/

## Verification

Shortlist production verified on 2026-10-13:

- TDD: the two new native tests initially failed on missing candidates.
  The browser regression reproduced Stop being overwritten by a stale
  `onended`; playback generations now protect status as well as loading.
  A second regression reproduced failed playback after persisted pagehide/show;
  restored pages now recreate closed audio contexts.
- `node --test tests/ice-candidates.test.ts tests/audio.test.ts`: 12/12.
- `npm test`: 518/518, including concurrent ice-escape work left untouched.
- `npm run build`: type-check and static build pass; existing chunk warning.
- `node tests/browser/ice-candidates.ts`: real decoding, gesture-only loading,
  one-shot/context replacement, finite 12-second expiry, mono, zero volume,
  blur/hidden/pagehide, restored-page playback, explicit HTTP failure/retry,
  cancelled loading and unchanged storage.
  Final passing report: `artifacts/browser-check/run-pWLdrL/report.json`.
- Screenshots at 1280x900, 390x844 and 844x390 inspected:
  `artifacts/ice-candidates/run-44Rely/`. No horizontal overflow. The final
  lifecycle rerun also captured `artifacts/ice-candidates/run-Y36M7e/`.
- Both original Strudel patches actually exported native stereo PCM16 WAVs:
  28 seconds at 48 kHz, two/three onsets. Source/engine/browser hashes and
  render logs are retained in the shipped `.render.json` files.
- Delivery files measure -30 LUFS each, with -23.9/-16.5/-22.7 dBTP.
  Full-volume 48 kHz stereo reference mixes peak at
  0.1190202013/0.1519535333/0.1232895628.
- Mastering from the retained captures regenerates byte-identical WAVs and
  manifest. A repeated native Strudel raw export did not match byte-for-byte:
  asynchronous reverb initialization varies. Do not claim deterministic raw
  export or cross-version PCM identity. Fixed delivery files do not vary.
- The live server still responds at port 4321 and serves
  `/audio/ice-candidates/index.html`. Authoring/test-owned browsers, profiles,
  sockets and preview servers were cleaned up without stopping the game.

Listening feedback on 2026-10-13: the user found Weightless pad (A) and Airy
musical veil (C) "pretty decent" and a promising direction. Silk glide (B) was
strongly rejected as horrible and broken-sounding. Do not carry B or its
stretched-cloth layer into further sound design. Technical safety checks did
not establish acceptable timbre.

A/C are preferred directions, not final sonic acceptance. Their final roles
and long-hold comfort remain open; the expansion below supplies measured loops
and motion integration for auditioning.

### Twelve-choice Sound garden expansion

- Twelve original CC0 Strudel sounds across round pads, airy voices, soft
  strings and delicate harmonics. Weightless and Airy veil retain their
  original captures; ten new patches add timbral alternatives. No rejected
  cloth or noise bed enters this palette.
- Stereo PCM16, 48 kHz, 16,723,532 WAV bytes total; steady-state loops span
  6.0-8.992 seconds, each approximately -30 LUFS, maximum -21.8 dBTP.
  Phase-matched joins avoid repeating full attack/release envelopes.
- All 25 delivery WAV/JSON files reproduce byte-identically from retained
  raw captures. Native Strudel re-renders remain subject to the asynchronous
  reverb variation documented above.
- Grouped selection, Previous/Next, 12-second Preview, Stop and editable
  patch links work in both demo scenes. Selected samples load lazily and
  cache; live changes crossfade without pausing skating. Failed loading,
  retry, cancellation and the shared eight-source cap have regressions.
- Final `npm test`: 522/522 passed, including shared-tree regressions.
  `npm run build`: passed, with the existing chunk-size warning only.
  The final obsolete wind header first failed its copy regression, then
  passed after replacement with `SOUND GARDEN · ICE SOUNDS`.
- Final `node tests/browser/sound-demo.ts`: passed all twelve choices,
  lifecycle, live switching, released-key glide/reflection, exact routes,
  responsive controls and save isolation.
  Report: `artifacts/browser-check/run-9YTaiN/report.json`.
  Screenshots/mix evidence: `artifacts/sound-demo/run-55QX7B/`.
  Previous desktop/portrait/landscape screenshots inspected at
  `artifacts/sound-demo/run-DQks39/`; final run includes the corrected header.
- All twelve crossfades with six aligned blast cues pass at 44.1/48 kHz,
  maximum sample peak 0.5399609208106995.
- Shared browser/authoring launcher uses `--mute-audio`, asserted both in a
  native regression and the actual browser launch. No further speaker
  playback or system-volume changes. Test-owned resources were cleaned.

## Handoff

- Coordination reconciliation, 2026-10-14: the completed `soft-ice-candidates`
  assignment in session `22313679-7a79-4454-8d26-620ceffba984` has no active
  worker. Release its primary-worktree reservation while human selection is
  pending; retain all technical delivery and evidence. This resolves its
  stale reservation conflicting with the later UI review task.
- Summary: Twelve ice alternatives are delivered in Sound garden; the issue
  awaits human preference and final selection, without an active worker or
  primary-worktree reservation; it is not marked done.
- Changes: Registry-driven selector, lazy cached loading, bounded crossfading
  playback, twelve mastered loops and editable Strudel patches, provenance,
  muted automation, regressions and audio/architecture documentation.
  Demo geometry, movement, normal gameplay audio and save behavior are unchanged.
- Verification: 522/522 native tests, production build and muted real-browser
  checks pass; detailed assets and evidence above. Numeric matching is not
  a substitute for perceived softness or preference.
- Risks: All twelve new loops are CC0. Rejected historical Silk remains only
  in the archived comparison with its CC BY 3.0 attribution. The external
  Strudel authoring engine is AGPL and is not shipped. Raw reverb synthesis
  is not bit-deterministic; retained-capture mastering is reproducible.
  Final sonic acceptance and long-hold comfort require human listening.
- Commit: None requested or made; unrelated shared-tree changes preserved.
- Resources: Session `22313679-7a79-4454-8d26-620ceffba984`,
  `files/strudel-candidates/` retains the pinned engine and earlier captures;
  `palette-renders/` contains all twelve 28-second captures and render records.
  Final command logs are in the session's `files/ice-palette-*.log`.
  Attached `boundstoy-game` server remains intentionally running at port 4321.
- Decisions: Expand the user-preferred tonal directions rather than reusing
  Silk or wind. Selection is session-only and demo-only; no winner is chosen
  automatically and there is no production rollout.

## Result

- Summary: The approved twelve-choice expansion is technically ready for
  listening review, not final sonic acceptance.
- Verification: Full native suite, build, muted browser interaction, measured
  loops/mix safety, licensing and retained-capture reproduction pass.
- Integration: `http://127.0.0.1:4321/` -> Menu -> Sound garden ->
  Audition sounds & volume. Choose a family/sound, use Previous/Next and
  finite previews, or compare while skating. Normal gameplay does not load
  these alternatives. Final selection and production integration remain gated.
