# Sound garden and audio palette

Open **`/?dev` > Settings > Sound garden**, expand **Audition sounds & volume**, and enable
sound. **Start walk** plays a short materials lane followed by a safe checkpoint
and an explosion wave. Individual cue buttons pause the walk and play one cue
alone. Auditioning a cue explicitly enables sound; zero volume remains silent.
Use the normal arrows/WASD, pause and restart controls. The demo never replaces
Aftershock saves, records or editor drafts.

**Physical palette v2** replaces the entire first palette, which the user
auditioned and rejected. No Kenney samples remain. This version starts with
recorded stone/sand contacts and mechanical knocks, then builds friction,
fuse, pressure and status textures specifically for the game. There is no
shared glass instrument, note arpeggio, stock drum loop or background music.
The user found this an improvement, but not final, and requested a less literal,
more atmospheric direction. The ice comparison below explores that direction
without replacing the remaining cues or treating music as undesirable.

**Approved gameplay explosion:** the softened **Airy puff impact** is now used
throughout gameplay and Sound garden. It reuses the exact approved 200 ms
CC0 WAV from `audio/explosion-candidates/airy-puff-blast.wav`; no remastering,
pitch change or randomized variant is applied. Its buildup was not selected:
the existing warning remains unchanged. Selection is recorded
in `data/explosion-palette.ts` and the listening manifest.

**Approved retry and buttons:** **Falling feather** and **Soft tick** now play
in gameplay and Sound garden. `APPROVED_BOARD_SOUNDS` in `data/sounds.ts` records
these selections. Their exact auditioned WAVs are reused without remastering;
cue gain 2 cancels the existing 0.5 premix because the files already contain
their role's mastered level. Rates, cooldowns, priorities, fades and output
protection are unchanged. Other feedback roles remain unselected.

## Playback loudness

The user found the original conservative mix too quiet even at maximum volume.
Gameplay, Sound garden and both standalone listening rooms now share a
**+12 dB output lift** (about four times the signal amplitude). Normal sounds
retain their existing timbre, relative balance, fades and timing. Slider
defaults and saved preferences are unchanged; refresh and start below maximum
when trying the louder output. System volume is never modified.

`public/audio/output.js` is the single output-stage implementation, bundled
into gameplay and imported by the standalone pages. A typed declaration
keeps the TypeScript adapter checked. The stage raises gain, applies a
memoryless soft peak ceiling, then applies user volume. The curve is exactly
linear through amplitude 0.7, smoothly approaches 0.85 at unit input and stays
bounded beyond it. Only unusually dense overlaps change shape; this is not a
compressor with attack/release pumping or automatic makeup gain. Oversampling
inside the shaper is off because its reconstruction filter can overshoot the
ceiling. Zero volume remains silent and existing voice/lifecycle limits remain.

At full volume, all 42 individual game/listening choices measured +12 dB
(within 0.2 dB) at 44.1 and 48 kHz. Another 26 dense-mix cases cover eight
aligned blasts and all ice crossfades with six aligned blasts. Peak output
remains at most 0.851 in the checked signals, including fourfold sample-rate
reconstruction. Quarter volume scales the protected output to one quarter;
it does not change how strongly the peak ceiling is driven.

The downloadable WAVs and mastering/provenance measurements below are
**unchanged source assets**, not post-output measurements. For example,
the -30 LUFS ice pad masters now play at approximately -18 LUFS at full
listening volume. This corrects audibility without choosing a new timbre or
claiming subjective listening acceptance.

```sh
node --test tests/audio-output.test.ts tests/audio.test.ts tests/ice-audio.test.ts
npm run build && node tests/browser/audio-output.ts
```

This browser check inspects the actual graph in gameplay and both listening
pages, compares pre/post-output RMS, checks busy-mix peaks and verifies zero
and quarter volume. All automated playback stays muted.

### When playback is silent despite a high volume setting

Check the browser's site/tab mute and its application mute in the system mixer,
not only the volume slider. PipeWire/WirePlumber can restore Chromium playback
at 100% volume **while muted**, including after a stream is recreated. Unmute
the browser's playback entry rather than increasing output gain or changing
microphone settings. Return to the listening page and click a preview again:
changing focus stops previews by design. A "Playing" status and passing offline
audio measurements do not establish that the system mixer is sending sound
to speakers.

## Current Sound garden: twelve ice sounds

Open **`/?dev` > Settings > Sound garden > Audition sounds & volume**. The grouped
**12 ice sounds** selector and **Previous sound / Next sound** buttons choose
among these original CC0 alternatives:

| Family | Sounds |
| --- | --- |
| Round pads | Weightless pad, Warm organ, Single ribbon |
| Airy voices | Airy musical veil, Hollow flute, Hushed choir |
| Soft strings | Velvet strings, Distant glow, Floating fifths |
| Delicate harmonics | Glass halo, Soft shimmer, Warm reed |

Weightless and Airy musical veil retain the original captures the user
preferred. Ten additional original Strudel patches explore different
waveforms, vowel colours, voicings, filtering and gentle harmonic FM. There
are no external instrument samples, wind beds or stretched-cloth layers.
The rejected Silk glide is **not** part of this palette. All twelve are
listening alternatives, not a declared final sound direction.

Selecting while paused starts a **12-second preview**. **Preview · 12 seconds**
pauses the walk and auditions the current choice. Selecting while skating
crossfades into the new sound without pausing the game. **Enter ice room**
offers long glides, turning, wall contacts and nearby visible explosions;
**Materials walk** returns to the original corridor. Soft and hard ice use the
same selected sound with a modest filter-brightness difference. Other cues,
both routes, all movement rules and production save/draft behavior stay intact.

The choice is session-only. It loads only after a gesture or existing audio
consent, and only the chosen loop is fetched, then cached. The twelve files
are not added to `AUDIO_SAMPLES`, so normal gameplay does not download them.
Loading failures are visible and retryable. Stop, pause or leaving during a
pending selection prevents delayed preview playback.

Loops are stereo 48 kHz PCM16, approximately **6–9 seconds**, each measured
at **-30 LUFS**. The builder searches a 6–10-second range for a highly
correlated steady-state period, then applies a one-second cosine overlap.
It does not loop the original swelling attack/release. Asset checks cover
join steps, 100 ms energy windows (no recurring fade gap/swell), mono
compatibility, conservative eight-voice headroom, hashes and provenance.
Actual-motion playback uses a 450 ms attack and 400 ms release. One active
loop and all retiring loops share the existing eight-source limit with cues;
rapid switching removes the oldest retiring voice if necessary to stay bounded.
Ordinary movement and soft-ice wall reflections do not retrigger sources.
Pause, mute, volume zero, death/respawn, navigation and disposal stop/release
the layer through the existing lifecycle.

`data/ice-palette.ts` owns the registry and settings. Each public asset has an
editable `.strudel.js` patch and `.render.json` export evidence alongside
`manifest.json` and `LICENSE.txt`. Native Strudel rendering remains an
external authoring step, not a game dependency. Its asynchronous reverb
initialization means raw re-renders are not guaranteed byte-identical; the
retained captures and delivered loop WAVs are fixed.

Using the pinned external bundle described below, render each new patch with
the existing exporter, then prepare the complete palette:

```sh
node scripts/render-strudel-audio.ts /path/to/package/dist public/audio/ice-palette/warm-organ.strudel.js /path/to/palette-renders
# Repeat for the other new patches. Reuse the original Weightless/Veil raw
# WAV and .render.json pairs; their copied source patches are unchanged.
node scripts/prepare-ice-palette.ts /path/to/palette-renders
node --test tests/ice-palette.test.ts tests/ice-audio.test.ts tests/audio.test.ts tests/sound-demo.test.ts
npm run build && node tests/browser/sound-demo.ts
```

**Silent automation:** the shared Chromium launcher passes `--mute-audio`,
and browser checks verify that the launched process retains that flag. This
mutes test-browser output, not the game mixer or the user's system volume.
Real source scheduling/decoding and offline measurements still run. The
authoring exporter uses the same muted launcher. Do not manually trigger
sounds in the user's browser during automated validation.

## Explosion and buildup listening suggestions

Open **Sound garden > Audition sounds & volume > Explore 8 buildup & explosion
pairs**, or visit **`/audio/explosion-candidates/index.html`**. This remains a
separate listening page. The softened Airy puff impact is now the approved
gameplay explosion; the other impacts and all candidate buildups are alternatives.

| Pair | Buildup | Impact |
| --- | --- | --- |
| Soft magic | Gathering rounded harmonics | Soft open fifth; no reward melody |
| Airy puff | Subdued, low-passed intake | Softer, short unpitched breath for frequent bursts |
| Rounded pop | Rising hollow tone | Elastic, cushioned pitch drop |
| Glass bloom | Fine resonances focusing | Softened inharmonic glass colour |
| Wooden knock | Brushed-wood swell | Dry hollow tap |
| Deep cushion | Warm low-mid pressure | Rounded low pulse with upper body |
| Electric snap | Compact harmonic charge | Short, softened falling FM snap |
| Arcade burst | Smooth ascending pulse | Punchier band-limited tonal burst |

Each card has **Buildup only**, **Explosion only**, **Hear pair**,
**Pattern x4** and **Rapid x8 (4/sec)**, plus both WAV downloads. The pair's impact starts exactly
**225 ms (27/120 s)** after the buildup begins. The four-pair pattern starts
at 0, 1.2, 2.4 and 3.6 seconds and stops after the last decay: at most 4.445
seconds. Rapid mode plays eight impacts without buildups, 250 ms apart,
then stops (1.95 seconds for Airy puff). It uses the same eight-source limit,
volume, mono and cancellation behavior. The illustrative tile distinguishes buildup and harmless decay;
it does not introduce sustained damage or change any gameplay timing.

Playback is opt-in, centred stereo with a mono control, initially at 65%.
Only selected components download; repeated patterns reuse the same decoded
buffers. One preview replaces another, with at most eight scheduled source
nodes and no looping sources. Stop, zero volume, blur, hidden/pagehide and
cancelled loading prevent later playback. Failed multi-file loads play no
partial pair and show a retryable error. A restored page recreates its closed
context. The shared `public/audio/audition-player.js` also preserves the
earlier ice page's finite previews and reference cues.

All **sixteen PCM16 stereo/48 kHz WAVs are original CC0 synthesis**, totalling
956,864 bytes. Buildups are 225 ms; impacts are 200-620 ms. Source definitions
are frozen in `data/explosion-palette.ts`; the seeded original DSP lives in
`scripts/prepare-explosion-palette.ts`. No Kenney sounds, recordings, external
sample banks, Strudel runtime or new dependency is involved.

For these short events, standalone integrated LUFS would be misleading.
Each component is measured in an identical **six-event, 1.2-second-interval,
silence-padded train** with EBU R128: buildups at **-40 event LUFS**, impacts at
**-33 event LUFS**, except Airy puff at **-43 / -36 event LUFS**. Each asset
records its target in the manifest. A static gain is checked against the quantized delivery
and corrected in at most four passes if loudness gating moves. There is no
limiter or dynamic normalization. Highest delivered true peak is **-16.5 dBTP**;
all complete patterns at full volume peak below 0.15 at 44.1 and 48 kHz,
with unchanged mono energy. These are safety/comparison measurements, not
proof that a timbre is pleasing, readable or comfortable over long play.

**Airy puff revision:** the user preferred this direction but requested a
softer sound for several explosions per second. The blast now has an 18 ms
smooth attack instead of 3 ms, two low-pass stages at 900 Hz, a faster
exponential decay and a 200 ms file instead of 320 ms. Its warning is also
double low-passed, sweeping from 350 to 1000 Hz. Both parts are mastered
3 dB lower; the shared +12 dB output correction and other sounds are unchanged.
Spectral checks require less than 3% of blast energy above 3 kHz, independently
of gain. Rapid-repeat output is checked at 44.1/48 kHz through the actual
calibrated output graph. The user subsequently approved this impact for gameplay
(BT-093); the Airy puff buildup and other candidates remain unselected.

## Other-sounds comparison board

Open **Sound garden > Compare other sounds**, follow the link from the explosion
listening room, or visit **`/audio/sound-board/index.html`**. Nine category buttons
keep the board focused: footsteps, mud, wall contact, buildup, retry, checkpoint,
exit, buttons and ice. Six one-shot roles have their current game cue and two
suggestions. Retry and buttons each show the approved/current choice once,
plus their remaining alternative. Ice reuses the twelve existing tonal files
and current soft/hard cues: **36 choices, including 16 original CC0 board files**.
Falling feather and Soft tick are marked **Approved - in game**. The approved
explosion is unchanged; browsing or auditioning does not select other sounds.

The ten rejected movement/contact and arrival/exit options have been replaced:

| Role | Suggestions |
| --- | --- |
| Footsteps | Soft shoe (unpitched heel/toe) and Wooden patter (dry, short resonances) |
| Mud | Damp tread (granular compression) and Sticky release (a gathering textured pull) |
| Wall contact | Rubber nudge (elastic body) and Fabric catch (compact unpitched scrunch) |
| Checkpoint | Hearth notes and Coming home: warm lower-register F-major note sequences |
| Exit | Little fanfare and Victory flourish: rounded brass-like rising phrases with resolving chords |

Checkpoint jingles last 0.92/1.04 seconds; exit jingles last 1.45/1.65 seconds.
These are original timed melodies, not renamed sustained chords. Their repeat
intervals (1.3/1.9 seconds) leave room for each tail. Human listening is still
required before these alternatives replace current gameplay feedback.

**Hear once**, **Repeat x4** and **With explosion** provide finite comparisons.
Repeats use a role-specific interval and at most four sources. Ice options play
one source file with fades (6-10 seconds), not an endless loop; they have no
repeat button. The context button adds the approved puff at its gameplay gain,
exactly 225 ms after a buildup, after other short cues, or 2 seconds into an ice
preview. Ice source previews omit movement-dependent filters, as the board says.

The sixteen designs use seeded original synthesis, rounded envelopes, textured
noise and finite harmonic instruments. They are not Strudel exports or external
recordings. Their levels match a **fixed original physical-palette reference
within each role**, including its original effective gain and gameplay fades.
This avoids circular normalization after a board choice becomes the current
game sound and preserves the approved files byte-for-byte. Measurement uses
six events at least 1.2 seconds apart, extended for longer jingles; each group's
reference, hash, gain and measurement interval are recorded in the manifest.
Buttons intentionally remain quieter than exits. Other current assets and ice
files are reused unchanged; downloads are source WAVs, not post-volume or
post-boost renders.

The board uses the shared finite `AuditionPlayer` and +12 dB output protection.
Audio loads only on a playback gesture. Group changes, Stop, mute, blur/hidden
and pagehide cancel playback and pending loads. Failures are explicit and
retryable. No selection, preferences, saves or drafts are written.

`data/sound-board.ts` owns the designs; its builder records asset/source hashes,
levels and provenance. Rebuild and verify with:

```sh
node scripts/prepare-sound-board.ts
node --test tests/sound-board.test.ts tests/audio.test.ts
npm run build && node tests/browser/sound-board.ts
```

An optional output directory supports byte-identical reproduction. Automated
browser checks stay muted and cover every control, loading/cancellation,
finite expiry, mobile hit targets, keyboard groups and rendered repeat/context
mixes at 44.1/48 kHz. Human listening remains the selection gate.

```sh
node scripts/prepare-explosion-palette.ts
node --test tests/explosion-candidates.test.ts tests/ice-candidates.test.ts
npm run build
node tests/browser/explosion-candidates.ts
node tests/browser/ice-candidates.ts
```

The generator accepts an optional output directory for reproduction checks.
All sixteen WAVs and the manifest reproduced byte-identically on the current
Node 24/FFmpeg toolchain. The manifest records source/registry/delivery hashes,
timing and per-component measurements. See
`public/audio/explosion-candidates/LICENSE.txt` for licensing. Browser checks
remain muted; no system-volume changes or automatic user-speaker auditions.
Final sonic selection and production integration require listening feedback.

## Earlier three-candidate listening shortlist

The user rejected the wind-led ice study below as traffic/machinery-like.
The earlier [listening room](../public/audio/ice-candidates/index.html) remains
at **`/audio/ice-candidates/index.html`** as an archived comparison. The user
preferred A/C and rejected B as broken-sounding. Use the current Sound garden
above for the expanded palette; the archived finite previews are not loops.

| Preview | Character and origin | License |
| --- | --- | --- |
| A: Weightless pad | Original Strudel sine dyad, F4/C5; slow onset and restrained space, no wind bed | CC0 1.0 |
| B: Silk glide | Close cloth gesture, filtered and pitch-preserving time-stretched; no tonal layer | CC BY 3.0, Vinrax |
| C: Airy musical veil | Original Strudel triangle chord, C5/F5/A5, vowel shaping and more diffusion; no wind bed or choir sample | CC0 1.0 |

Each stereo 48 kHz PCM16 preview lasts 12 seconds, including onset/release.
**Solo** plays only the candidate. **With cues** adds the same existing wall
contact at 4 s, warning at 7 s and blast at 7.225 s, at the current gameplay
rates/gains/envelopes. This is a fixed **audio reference**, not a new playable
course or proof of in-motion integration. The existing ice room remains intact.
The optional fourth hybrid is omitted until there is a reason to combine the
components; another noise-plus-pad mix is not the default.

All three delivery files measure **-30.0 LUFS integrated** before the page's
listening-volume control (initially 70%). Static gain matching uses EBU R128,
not equal peaks or automatic dynamic normalization. True peaks are -23.9,
-16.5 and -22.7 dBTP respectively. The 48 kHz decoded stereo context mixes at
full volume peak at 0.1191, 0.1520 and 0.1233 or less. Numeric checks do not
establish equal subjective loudness, pleasantness or final sonic acceptance.
Use a fixed comfortable volume, compare in mono, and listen for fatigue.

The page permits one preview group (one candidate and at most three cue
sources), requires a gesture, and stops on Stop, mute, blur, hidden page or
navigation. A later preview supersedes pending loads and scheduled playback.
Errors are visible and retryable. It neither loads Strudel nor writes storage.
Three previews total 6,912,132 WAV bytes; none is in `AUDIO_SAMPLES` or downloaded
by normal gameplay. These are finite sketches, **not seamless movement loops**.
The new Sound garden expands A/C into looped movement auditions; final human
selection and sonic tuning remain open gates.

### Actual Strudel export and reproduction

Unlike the older sample-audition recipes, A and C were **synthesized by the real
Strudel engine**. The pinned `@strudel/web@1.3.0` bundle exports
`renderPatternAudio`, which schedules the compiled pattern into an
`OfflineAudioContext` and downloads a stereo PCM16 WAV. This was exercised in
Chromium 151.0.7922.137 at 48 kHz: 28 seconds, 0.5 cycles/second, two/three held
onsets, with seeded authoring randomness. No microphone, desktop recording,
lossy recording codec, external sample bank or production dependency is used.
This verifies the programmatic export API, not a claimed one-click REPL button.

Editable `.strudel.js` compositions and `.render.json` engine/browser/source
hash evidence ship beside the previews. The full 28-second raw exports and
downloaded engine/source archive remain in this task's session authoring
artifacts (`files/strudel-candidates/`). Repeated native Strudel exports were
**not byte-identical**, even with the same seed and browser; its reverb buffer
is initialized asynchronously. Keep the actual captures rather than promising
deterministic raw synthesis. The three delivery WAVs and manifest were verified
to regenerate byte-identically from the retained captures with the recorded
FFmpeg version. Gameplay only plays these fixed assets; it never synthesizes
them or depends on the authoring engine.

Download/extract the authoring package **outside `public/`**:

- `https://registry.npmjs.org/@strudel/web/-/web-1.3.0.tgz`
- Archive SHA-256: `8243690c87483e27816b7210316ded3908acb0f373c7e439e73c6d19e8eca032`
- `dist/index.mjs` SHA-256 (enforced by the exporter):
  `50beb01abd04589333a10e078dce182c82e2de75b43e9bbe81a34bd069948931`

The engine is AGPL-3.0-or-later; it is not vendored or distributed with Boundstoy.
The original compositions and generated A/C sound assets are separately CC0.
Do not assume that third-party Strudel compositions or sample banks share that
license.

With Node 24+, sandbox-capable `/usr/bin/chromium` on Linux and FFmpeg:

```sh
node scripts/render-strudel-audio.ts /path/to/package/dist public/audio/ice-candidates/weightless.strudel.js /path/to/renders
node scripts/render-strudel-audio.ts /path/to/package/dist public/audio/ice-candidates/veil.strudel.js /path/to/renders
node scripts/prepare-ice-candidates.ts /path/to/renders /path/to/cloth_sounds.flac
node --test tests/ice-candidates.test.ts tests/audio.test.ts
npm run build && node tests/browser/ice-candidates.ts
```

The exporter owns and cleans up its isolated browser, profile and ephemeral
local server; it does not touch a running game server. The final builder
verifies raw/source hashes, applies endpoint fades, measures the **quantized
delivery**, and refuses unsafe peaks. It does not silently limit bad renders.
A single extreme Rubber Band stretch produced an invalid transient and was
rejected; the delivered cloth uses three bounded 0.5x WSOLA (`atempo`) stages.

B's source is [Cloth swing sounds by Vinrax](https://opengameart.org/content/cloth-swing-sounds),
original `cloth_sounds.flac`, licensed **CC BY 3.0**, not CC0. The source page
identifies the author and license explicitly. Its close recording is used in
preference to a broader environmental whoosh. Credits are required and retained
in the room, `LICENSE.txt` and `THIRD_PARTY_NOTICES.txt`, with the source URL,
SHA-256 and modification notice. The excerpt is 6.32–7.55 s, high-passed at
850 Hz and low-passed at 2700 Hz before stretching. No Kenney sounds are used.

## Retired wind / wind + pad experiment

These sounds were rejected as machinery/traffic-like and are no longer
selectable in Sound garden. Their assets and legacy engine regressions remain
for compatibility. The historical A/B control switched wind versus wind + pad
without restarting the wind; previews lasted eight seconds. The following
details describe that earlier implementation, not the current selector.

**Enter ice room** opens a larger optional room: soft ice above, hard ice below,
and a safe normal-ground middle path. Start the walk, release the keys while
sliding, turn, contact a wall, and hear nearby explosions alongside the wind.
**Materials walk** returns to the original showcase. Neither room affects
Aftershock progress, records or editor drafts.

The experiment is deliberately limited to these two Sound garden scenes.
Other gameplay/editor playtests retain the physical v2 palette. Only ice is
replaced in the experiment; warning, blast, contact and status cues are unchanged
so the comparison has a stable reference.

Two four-second periodic loops provide filtered wind and a quiet D/A/E-family
pad (147, 220.5 and 330.75 Hz, with gentle chorus). Soft and hard ice share the
same sources; filter cutoff and restrained gains distinguish them. A/B changes
the pad gain, not the wind's phase or playback position.

The layer follows actual movement, not key state or a 250 ms event cadence.
It uses a 280 ms attack/transition and a 240 ms release when sliding ends.
Soft-ice reflection keeps the layer running; hard-ice stopping releases it.
Pause, mute, volume zero, blur, navigation and disposal stop all nodes
immediately. Previews end on the audio clock after eight seconds, without
a UI timer or changing gameplay time.

Both loop nodes (including the silent pad in A mode) share the existing
eight-source budget with one-shots; fading-out nodes also count. Sources are
not restarted each tick, and no sound changes simulation rules.

Reproduce the original CC0 loops with Node alone:

```sh
node scripts/prepare-ice-audio.ts
```

`data/ice-audio.ts` owns the settings. The two mono/32 kHz/PCM16 loops add
512,088 bytes, making the complete opt-in bank 742,652 bytes. Filters are warmed
through a full noise cycle, and all pad partials complete integer cycles at
the loop boundary; neither loop has a repeated attack or fade gap.
Credits ship in `public/audio/ice-study/LICENSE.txt`.

## Sources and license

All thirteen **base-bank** WAVs are **CC0 1.0**: four edited recordings and nine
original synthesized effects. The two OpenGameArt source pages explicitly
identify the recordings as CC0; those licenses were checked during replacement
research. Credits are retained in the demo, `public/THIRD_PARTY_NOTICES.txt` and
`public/audio/physical-v2/LICENSE.txt`. The new generated sound assets are also
dedicated to CC0; the generator code retains the project's MIT license.
CC0 permits modification and commercial redistribution without attribution.
The twelve current demo-only ice loops are also original CC0 assets, with
separate credits under `public/audio/ice-palette/`. Only the rejected cloth
asset in the archived three-candidate page requires CC BY attribution.

The physical v2 bank (the old blast is retained only for historical audition):

| Source | Original | Cue | Treatment / role |
| --- | --- | --- | --- |
| [Fantozzi footsteps, edited by qubodup](https://opengameart.org/content/fantozzis-footsteps-grasssand-stone) | `Fantozzi-StoneL1.flac` | `step` | Short weighted stone contact |
| Same pack | `Fantozzi-SandL2.flac` | `mud` | Granular ground scuff |
| [rubberduck, 100 CC0 SFX](https://opengameart.org/content/100-cc0-sfx) | `hit_01.ogg` | `bump` | Recorded wall knock |
| Same pack | `switch_01.ogg` | `ui` | Quiet mechanical switch |
| Original seeded DSP | Filtered noise, slow amplitude motion | `soft`, `hard` | Low friction wash / finer edge scrape |
| Original seeded DSP | Rising filtered-noise/FM texture | `warning` | 225 ms fuse matching the visible warning |
| Original seeded DSP | Noise crack, low pressure and rapidly falling body | archived `blast` | Superseded by the approved Airy puff impact |
| Original seeded DSP | Damped descending mechanism | `death` | Wind-down rather than sad notes |
| Original seeded DSP | Short transient and settling resonance | `checkpoint` | Compact latch |
| Original seeded DSP | Warm rising body and filtered air | `win` | Longer opening/release, no melody |

Masters live at `public/audio/physical-v2/<cue>/sound.wav`; new paths avoid
reusing previously cached copies of the rejected palette. No downloaded
Freesound ice/explosion previews are included: their CDN downloads were blocked.
The active explosion instead uses the original CC0 Airy puff asset described
above, with credits in `public/audio/explosion-candidates/LICENSE.txt`.

Verified archive downloads:

- [Fantozzi footsteps 7z](https://opengameart.org/sites/default/files/Fantozzi-footsteps.7z)
  SHA-256 `415d360e0911c1c1c5355ee94023b772e6f4044f59b9b580610e7dbffd1840fd`
- [100 CC0 SFX ZIP](https://opengameart.org/sites/default/files/100-CC0-SFX_0.zip)
  SHA-256 `a5c135878c132f1c59cca54e60061c296cd0ac27ad031ca2c41b8cd5cab3c706`

## Mastering and mixing

Rebuild with Node 24+, `bsdtar` and FFmpeg (not needed to build/play the game):

```sh
node scripts/prepare-audio.ts /path/to/Fantozzi-footsteps.7z /path/to/100-CC0-SFX.zip
```

The script extracts only the four named recordings, converts to 32 kHz mono
float PCM, filters rumble/high harshness, applies gentle 3:1 transient compression
and endpoint fades, then peak-masters to -3 dBFS. Processing float first avoids
clipping the overshooting decoded OGG peaks before normalization. Seven custom
effects use deterministic seeded noise, filtering, envelopes and short
frequency-modulated bodies. No random generation happens during play.

The original eleven physical v2 WAVs total **230,564 bytes**, with 120-650 ms durations. The larger
320 KB test budget allows distinct, less aggressively shortened effects while
remaining small for a one-time opt-in download. `data/sounds.ts` owns cue gains,
cadence and priority. Every cue uses its own master at original speed, one voice
per trigger. Movement sits below status/danger feedback. Outside Sound garden,
the two original friction textures retain the existing 250 ms cadence.

The active eleven-cue bank substitutes the stereo/48 kHz, 200 ms Airy puff for
the old mono/32 kHz blast. Cue gain 1.2 compensates for its more conservative
source master, through the unchanged 0.5 premix and +12 dB output stage.
This keeps its single-cue peak near the old blast rather than making it
inaudible by retaining a gain designed for a -3 dBFS master. Its softened
envelope and reduced treble are preserved. Listening-page and game sliders
remain independent; selection does not promise identical listening levels.

Runtime playback adds a 5 ms attack and up to 25 ms release. Movement is lower
than status feedback. At most eight source nodes can exist, including scheduled
notes; higher-priority status cues displace lower-priority voices if necessary.
Per-cue cooldowns coalesce same-frame catch-up and dense detonation events.
Simultaneous pads produce one local warning/blast cue, not one per tile.
Eight aligned voices retain premix headroom below 0.7; browser checks also
exercise ice crossfades with six blasts and the protected +12 dB output stage
at 44.1/48 kHz. These are measured output rates, not a claim about every resampler.
Playback and pitch never use random numbers.

Audio is presentation-only and observes immutable simulation transitions.
Warnings start with the visible 27-tick warning; blast sound is a short effect,
not a longer damage window. Dormant/completed puzzles are silent. No warning is
sound-only. Material cues require movement; ice U-turns are not wall impacts.
The demo labels the last event even when muted.

Samples are local and fetched/decoded only after an enabling gesture. Loading
fails explicitly through the normal error notification and can be retried.
No queued gameplay events play after loading. Mute/zero volume, pause, blur,
hidden page, navigation and graphics loss stop existing and scheduled voices.
Dispose cancels loading and releases buffers/nodes/context. Restored preferences
never bypass the browser's user-gesture requirement.

## Older optional Strudel sample audition

This recipe retains the original physical-palette pressure crack and its old
gain for historical comparison; it does not represent the approved explosion.

Strudel is an **authoring/audition option only**, not a runtime dependency and
not the tool that generated the **physical-v2/ice-study** WAVs. The newer
ice-candidate pads above are actual Strudel exports. See its official
[local sample import](https://strudel.cc/learn/samples/) documentation.

For the ice comparison, import `public/audio/ice-study` using the same folder
import below, then paste its `audition.strudel.js`. Its `wind` and `pad`
subfolders become the two sound names. The pattern repeats every four seconds;
set the pad gain to zero to compare wind alone. It approximates the soft-ice
mix, not the game's movement-dependent envelopes or finite preview controls.

1. Open the [Strudel REPL](https://strudel.cc/).
2. Choose **Sounds > import-sounds > Import sounds folder** and select this
   checkout's `public/audio/physical-v2` folder. Import reads local files; no
   sample upload or local server is required. Its eleven subfolders become
   the sound names; each contains only `sound.wav` (index 0).
3. Paste `public/audio/physical-v2/audition.strudel.js` into the REPL and play.
   The Sound garden also provides the pattern as a download. It auditions all
   eleven cues, one per second, at their game-relative gains.
4. The commented alternative mixes footsteps, warning/blast and checkpoint
   together. Replace the solo pattern with it to hear interactions.

These are straightforward sample patterns, not music added to gameplay.
Strudel's output volume and scheduling differ from the game's opt-in default
50% volume, cooldowns and priority mixer; start quietly. The pattern uses
full-master relative gains. Native tests execute its JavaScript against a
small API fixture to verify sound names, tempo, gains and import-folder layout;
that is not an assertion of an interactive Strudel listening session.

## Evidence and limits

```sh
node --test tests/audio.test.ts tests/ice-audio.test.ts tests/ice-palette.test.ts tests/sound-demo.test.ts
npm run build
node tests/browser/sound-demo.ts --browser /usr/bin/chromium
```

The demo's exact straight-right witness finishes at tick 769 without deaths
and includes every surface, a checkpoint, warnings, blasts and the exit.
After a checkpoint death, Restart plus a 48-tick wait then 286 ticks right
finishes without another death. Independently varying that wait by +/-24 ticks
also succeeds. This is an audio showcase, not another production puzzle or a
claim of optimal/interesting gameplay.

The new ice room offers more than eight seconds of released-key soft gliding
including a wall reflection, with warnings/blasts audible nearby. Its optional
safe exit route takes 820 ticks; independent turn errors from -10 through +10
ticks still finish deathlessly. The pulses are intentionally avoidable, not
a necessity-tested production puzzle.

Historical wind/pad checks still measure the legacy layers at 44.1/48 kHz.
Current browser checks additionally exercise every palette choice, single-file
lazy loading and caching, cancelled selection, 12-second expiry, live
crossfades, non-retriggered released-key sliding, reflection, stop/pause, mobile
selector/previous/next controls and both rooms' save/draft isolation.
All twelve filtered crossfades are rendered with six aligned blast cues at
44.1/48 kHz to check the shared eight-source mix. These are technical
measurements, not human approval of the sound.

Browser evidence includes all eleven audition buttons, real WebAudio source
starts and sample decoding, actual live movement audio, offline-rendered cue
and maximum-density mix measurements, desktop/portrait/landscape screenshots,
mute/pause behavior, and production save/draft isolation. This verifies output
and technical mix safety, not human listening quality. Final tonal/loudness
acceptance on speakers and headphones remains a human judgement.
