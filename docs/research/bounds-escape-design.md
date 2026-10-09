# Bounds and escape maps: lessons for Boundstoy

Research for **BT-014**, accessed **2026-10-09**. Recommendations only; no
game changes or follow-up issues are authorized by this report.

## Scope and method

This is a purposive five-example sample: two StarCraft: Brood War bounds,
two Warcraft III sliding maps, and N++, an adjacent movement/obstacle game.
Examples were selected for obtainable evidence and contrasting design choices,
not popularity. They illustrate hypotheses about enjoyable play, not measured
engagement or a ranking of the genres.

Evidence labels distinguish **D**: creator documentation/explanation;
**M**: map instructions mirrored by an archive, with weaker provenance;
**V**: directly inspected video frames; **C**: community opinion; and
**I**: this report's design inference. Claims about an improvement being *fun*
remain interpretations unless explicitly attributed.

Public sources were searched, then opened as readable pages or browser DOM.
No maps were played, downloaded, or executed. Deca Bound playback initially
failed; a normal reload subsequently allowed inspection of decoded, paused
frames at **00:34.15, 00:36 and 00:40**, with the player reporting a ready,
non-seeking video. These are sampled frames, **not a watched continuous
playthrough**, and cannot establish timing windows or collision correctness.
Other examples use page text, not firsthand gameplay or unviewed transcripts.

Coverage is necessarily uneven. Creator posts describe intentions; selected
comments are not representative user research. Archived names do not prove
original authorship. The Warden thread mixes revisions, so dated feedback is
kept separate. A TL.net bounds discussion returned HTTP 403, GDC Vault exposed
only boilerplate, and Radiant Bound playback was unreliable; none supplies
mechanics evidence here. Accessible author posts were used instead.

Local grounding is the assigned baseline
`0d97f5af30603fc5ce62907164e12941faa1b3c4`: [README](../../README.md),
[GAME_SYSTEMS](../GAME_SYSTEMS.md), and [course definitions](../../data/levels.ts).
There was no documentation manifest; the explicitly requested documents were
read directly. Boundstoy remains single-player, static/offline after loading,
six one-concept lessons, maximum ten, and existing mechanics only.

## Comparison

“Useful” and “risk” below are **I**, unless another label is supplied.

| Family and identifiable example | Documented/visible challenge | Concrete useful choice and frustration risk | Evidence |
| --- | --- | --- | --- |
| **SC1: Deca Bound**, WieJ, December 2025 creation; numbered version unstated | **D:** ten obstacles, 160 lives, creator-rated 7.5/10 difficulty. **V:** a zergling and linked dotted circular regions; blue explosion effects occupy different regions in the sampled frames. | Useful: visible subdivisions offer landmarks for thinking about a sequence. Risk: bright effects obscure parts of the much fainter dotted layout; a finite life allowance adds stakes but can discourage experimentation. Neither actual hitboxes nor exhaustion behaviour was verified. | [1], creator's video description and three frames. Difficulty is the author's subjective rating, not a calibrated scale. |
| **SC1: New Double Bound**, credited in map force text to **l_x_l**, uploaded May 23, 2008; numbered version unstated | **D:** seven obstacles, ten lives per obstacle, two players required. The uploader calls it their second bound. | Useful: an explicitly per-obstacle allowance partitions the retry budget. Risk: local limits can strand a learning pair, and the second-player requirement prevents independent practice. The exact cooperative action and what happens at zero lives are undocumented here. | [2], creator upload description and force labels. The site's separate Author field displays an unresolved identifier; attribution relies on the matching uploader/embedded credit. |
| **WC3: Slide Kitty Slide v0.1**, “this version” credited to **TriggerHappy187** | **M:** avoid dogs, slide over items, receive score-proportional XP at safe points; revived kitties leave in the reviver's direction. | Useful: rescue involves choosing a departure heading, not merely reaching a body. Risk: another player's heading determines your return to motion. A rescue near danger could produce immediate confusion; this is a hypothetical encounter, not an observed death. | [3], archived map instructions. Original creator, lineage, physics and exact course layout remain unverified. |
| **WC3: Warden Ice Escape**, **Rufus**, development thread begun December 2017, introduction edited January 25, 2019 | **D:** arrow-key sliding, different-friction ice, frequent checkpoints and introductory tracks. **C:** January 2018 tester reports that short adjustment taps often fail. **D:** January 2019 author reports a more responsive input system and says obstacles must be reworked to fit it. | Useful: matching obstacle geometry to control response rather than blaming players. Risk: varied obstacles cannot compensate for unreliable small corrections. Do not attribute the older complaint to the revised build. | [4], especially posts 1, 7, 22 and 24. No claim that the fix succeeded in independent testing. |
| **Adjacent: N++**, **Metanet**, PS4 Ultimate Edition discussed January 2018; concrete comparison: **Ride the Lightning**, **Kelevra_V**, highlighted in 2015 | **D:** movement/momentum mastery with multiple goals. Metanet describes Ride the Lightning as having a short, relatively easy exit route but a harder all-gold route; steep tiles constrain manoeuvring, while two enemy types impose different pressures. | Useful: completing and mastering the same space are distinct goals. Risk: simultaneous behavioural demands suit experienced players, not a first lesson. The same developer article identifies Apocalyptic Bridge as an expert, single-precise-solution level, including an optional exploit-dependent gold challenge—a counterexample to broad accessibility. | [5–6], developer explanations, not play observations. The 2015 community level is not misidentified as newly added in Ultimate Edition. |

**Slide Kitty Slide identity caution.** The v0.1 archive is enough to include
the requested inspiration, not to certify the original map. A separate
2024 listing under the same title credits stan0448@Discord and describes a
development build of Max Escape Creation [3b]. Those records must not be
combined into one ruleset. No reliable braking, acceleration or dog-patrol
timings were established for either.

## Design principles and counterexamples

### 1. Movement feel is a contract with the layout

Warden's dated complaint and subsequent redesign are unusually direct evidence
that responsiveness and course geometry cannot be tuned independently [4].
Metanet likewise explains that knowing acceleration and retained momentum
informs which tile arrangements feel good [5]. **I:** difficulty should ask
players to use a dependable movement rule, not discover whether input registered.

For Boundstoy this means preserving, not softening away, its contract:
soft ice is always 4.4 tiles/s, bounded turning is 3.2 radians/s, reverse is a
U-turn, and release is **not braking**. The approximately 1.38-tile minimum
turning radius must inform clearance. Hard ice locks the entry line and stops
at curbs; soft ice reflects. A corridor designed for instantaneous reversals
would contradict the lesson.

### 2. Shape a decision, rather than filling space with hazards

IcemanBo's Warden feedback explicitly prefers creative paths/turns over many
repeated simple patrols [4, post 7]. This is **C**, not a universal law.
Metanet's Ride the Lightning explanation connects steep geometry to limited
manoeuvrability [6]. **I:** changing approach angle, bend clearance or landing
space can create meaningful practice without another enemy type.

Deca's visible linked regions provide an example of spatial segmentation [1].
Its sampled effects also illustrate a trade-off: spectacle can dominate route
markings. Do not copy the layout or assume its decorative boundaries equal
lethal boundaries. For a teaching game, broad approach and recovery spaces
should surround the one movement decision being assessed.

### 3. Telegraph the space and time of danger separately

The Deca frames establish changing explosion locations, not whether warnings
are sufficient [1]. **I:** show both *where a collision would occur* and *when
it becomes dangerous*, then test recognition rather than awarding readability
because an effect is bright.

Boundstoy already has a pulse footprint, dark safe state, amber warning, and
fire throughout the lethal phase; saws display their complete path.
Prioritize those signals over extra particles. Since sound starts muted,
audio cannot carry necessary timing information. Colour should be reinforced
by outline, shape and state change, including reduced-motion presentation.

### 4. Teach timing before requiring memorized choreography

Deca's changing pattern suggests sequence learning, but three frames cannot
show whether memorization is mandatory [1]. A useful counterexample is
Metanet's explicit description of Apocalyptic Bridge as having one precise,
expert solution [6]. **I:** such solutions can reward specialists while being
the wrong introductory target.

Pulse crossing should let a novice observe from stationary ground and choose
a generous interval. Saw crossing should ask whether the patrol is moving
away, not require remembering a hidden delay after respawn. Boundstoy's hazards
continue through death, so “repeat the same input immediately after every
death” is not a dependable teaching strategy. Teach re-reading the world.

### 5. Progression is a sequence of understandable successes

Warden documents simple introductory tracks; Metanet describes repeatedly
testing levels against different player abilities and goals [4–5].
**I:** introduce one concept, allow a clear application, then end before
repetition becomes filler. A reference replay proves a route exists, not that
a newcomer understands it.

Keep Boundstoy's order: walking → steerable ice → locked ice → pulses → saws
→ mud with a familiar pulse. “More challenging” need not mean adding a mixed
gauntlet or compressing every safe window. Its six short lessons are a design
constraint, not a content shortage.

### 6. Retry cost includes travel and uncertainty, not just respawn delay

New Double Bound's per-obstacle life allowance and Warden's frequent
checkpoints make failure budgeting explicit [2,4]. **I:** checkpoints should
preserve solved understanding while returning players to a place where the
next attempt can be planned. Finite lives are not necessary to create mastery.

Boundstoy already has unlimited retries and a 54-tick, 0.45-second death
animation. Preserve safe checkpoint positions, zero-momentum respawn and
cause-specific feedback. A technically fast respawn that launches straight
into danger would be worse; soft-ice respawns in particular immediately
resume full-speed movement. Keep teaching checkpoints on stoppable ground.

### 7. Pace tension, then make replay voluntary

Metanet describes balancing tension with reward and supporting both reaching
the exit and pursuing harder goals [5–6]. **I:** a safe landing is a moment
to recognize success; endless waiting is not the same as relief.

Use Boundstoy's existing local best times to invite a cleaner second run,
without making speed the condition for first completion. Its time-first,
retry-tiebreak scoring may favour hurried runs; player feedback must establish
whether that actually conflicts with learning. Do not add medals, collectibles,
online rankings or new movement powers to manufacture replay motivation.

## Social pleasure is not automatically transferable

New Double Bound requires another player [2]. Slide Kitty Slide's documented
revival heading makes teammates part of movement control [3]. **I:** rescue
risk, shared explanations and watching a friend succeed can make failure
socially rewarding, but this research did not measure those effects.

Warden's thread also discusses racing to checkpoints and teleporting the
group forward; these are **proposals in posts 14–16**, not verified released
rules. IcemanBo warns that a fixed checkpoint-points race can become decided
before it ends [4]. N++'s developer values shared high-score replays as both
examples and expressions of different styles [5].

Transfer clear goals, readable examples, short retries and personal improvement.
**Do not copy** mandatory partners, revive dependence, group teleports, finite
team lives, online replay services, chat, accounts or leaderboards. An offline
solo game must supply its own legibility; another player will not explain
the unexplained rule. Existing local records and the secondary editor suffice.

## Prioritized recommendations for the existing six lessons

All are **I**, pending orchestrator review. Tune existing lessons before
considering any expansion.

| Priority / lesson | Recommendation |
| --- | --- |
| **P0 — First steps** | Check that floor, void, curbs and spikes remain distinguishable at the actual play viewport. Use the existing checkpoints/route markers to expose a walk–stop–turn decision; do not add a timed threat. |
| **P0 — Gentle curve** | Protect the steering lead-in before the spike block and the wide normal-ground landing. Test a small clearance change, not braking or a faster turn rate. Verify that turning is still necessary. |
| **P0 — Curb turn** | Make the clear entry lane and destination curb easy to see together. Preserve the contrast: hard-ice contact stops you and permits relaunch; it is not a soft-ice bounce. Keep the alignment checkpoint. |
| **P0 — Pulse crossing** | Test recognition of dark/charging/active states from the existing safe pad before changing period or density. Keep the full lethal footprint readable. |
| **P1 — Saw crossing** | Retain the single unavoidable patrol crossing and visible path/endpoints. Observe whether players distinguish “moving away” from “about to return”; avoid adding a second saw as a difficulty shortcut. |
| **P1 — Take your time** | Preserve mud's 1.5 tiles/s and the familiar pulse. Test reduced forced waiting while preserving the safe-window length; do not introduce another movement or hazard concept. |
| **P2 — Campaign** | Preserve unlimited retries, all-level access and optional local-time improvement. Evaluate waiting/travel cost and cause recall before shortening feedback. |

Per-level tutorial-popup removal is **already independently approved as
BT-013**. It is not a new finding, dependency or implementation request here.
Future playtests should record whether they use the pre- or post-BT-013 build,
rather than confounding popup changes with tuning.

## Small, consent-based local experiments

These are proposed tests, **not completed measurements**. Use six willing
participants if available; record input method and prior genre experience.
Counterbalance A/B order, keep builds identical except for the named change,
and separate first exposure from practiced attempts. Use paper/manual local
notes and a stopwatch or existing local tick/debug readout—no telemetry or
network collection. Let participants stop freely; never interpret voluntary
continuation alone as proof of enjoyment. All thresholds below are hypotheses,
not established standards or statistically powered conclusions.

1. **Gentle curve: earlier room to steer.**
   **Hypothesis:** slightly more lead-in teaches anticipation without disguising
   constant speed. **Change:** restore the spike column at `x=8, y=6..9`
   to soft ice, leaving `x=9, y=6..9` lethal; all speeds, turn rates and landing
   tiles stay unchanged. This adds one tile, about 0.23 seconds of travel, before
   the remaining leading face. **Observe:** first three attempts, spike/void
   deaths, successful deliberate heading changes, and explanations of release
   and reverse input. **Proposed pass:** at least four of six players complete
   within three attempts and median spike deaths decrease, with no increase in
   the belief that reverse brakes. **Fail:** a straight-through route becomes
   possible, the wrong movement model persists, or falls simply move elsewhere.

2. **Pulse crossing: strengthen existing footprint feedback.**
   **Hypothesis:** stronger spatial contrast reduces uncertain commitments.
   **Change:** double the current pulse-outline thickness, leaving colour
   states, period 480, active duration 240 and warning 54 ticks unchanged.
   **Observe:** on paused examples, ask players to distinguish safe, charging
   and active; then observe live launch choices and footprint-edge deaths.
   The warning means activation is approaching, not an unconditional promise
   that there is time to cross. **Proposed pass:** five of six distinguish all
   three states and edge-related deaths decrease without more launches during
   charging. **Fail:** the thicker outline masks the route or misrepresents
   the lethal boundary. Do not “fix” comprehension by silently enlarging safety.

3. **Retry feedback: less delay without lost explanation.**
   **Hypothesis:** 30 rather than 54 death-animation ticks improves retry flow.
   **Change:** only that duration, from 0.45 to 0.25 seconds; retain cause text,
   checkpoint placement and continuing hazard cycles. **Observe:** wall-clock
   death-to-next-deliberate-action time, cause recall, accidental held-input
   movement and reorientation after respawn. Compare separately on walking
   and timed crossings; changed arrival phases are a possible confound.
   **Proposed pass:** median deliberate-retry time improves by at least
   0.15 seconds, five of six recall the cause, and involuntary repeat deaths
   do not increase. **Fail:** faster animation removes useful comprehension.

4. **Mud: remove idle time, not the slower-crossing lesson.**
   **Hypothesis:** shorter forced waits retain timing comprehension.
   **Change:** on Take your time only, change pulse period/active ticks from
   `840/300` to `720/180`. Both leave 540 safe ticks; keep the 54-tick warning
   and mud speed. The documented 104-tick hazard exposure remains unchanged.
   **Observe:** time stationary on the pad, late-entry deaths, completion and
   whether players explain why mud needs a fresh safe window. **Proposed pass:**
   median waiting decreases, at least five of six explain the speed consequence,
   and late-entry deaths do not increase. **Fail:** people lose the opportunity
   to observe a cycle or succeed without understanding the slower traversal.

## Verified sources and confidence

All links below were opened on **2026-10-09**. Confidence describes support
for the attributed claim, not confidence that the map is enjoyable.

- **[1] [Deca Bound — WieJ](https://www.youtube.com/watch?v=OgLecsPyObI)**,
  published January 18, 2026. Creator description supplies creation date,
  obstacles, lives and subjective difficulty. Browser-rendered frames inspected
  at 00:34.15, 00:36 and 00:40 show changing blue effects and linked dotted
  regions. High confidence in description/visible arrangement; low in inferred
  readability impact; no continuous timing or collision analysis.
- **[2] [New Double Bound — SEN file 428](https://staredit.net/sc1db/file/428/)**.
  Browser text verifies uploader, embedded credit and seven obstacles/ten lives
  per obstacle/two-player requirement. High for those stated rules; limited
  attribution because the Author field is malformed. No specific cooperative
  mechanism or loss condition verified.
- **[3] [Slide Kitty Slide v0.1 — wc3maps archive](https://wc3maps.com/map/141310/Slide_Kitty_Slide_-_0.1)**.
  Readable map instructions explicitly document revival direction, item
  collection, XP at safe points and avoiding dogs. Medium confidence: mirrored
  instructions, not a verified original-author release.
  **[3b] [Same-title 2024 listing — Epic War](https://www.epicwar.com/maps/336232/)**:
  raw page text/metadata verifies stan0448@Discord and the development-build
  description. Used only to flag identity ambiguity, not to supplement v0.1.
- **[4] [Warden Ice Escape — Rufus's HIVE thread](https://www.hiveworkshop.com/threads/warden-ice-escape.301689/)**.
  Read browser-rendered posts, because simplified fetching returned only a
  fragment. Post 1 documents introductory tracks/checkpoints; post 7 contains
  IcemanBo's path-variety opinion; posts 14–16 discuss a proposed race;
  post 22 contains EdgeOfChaos's January 5, 2018 responsiveness complaint;
  post 24 is Rufus's January 25, 2019 revision explanation. High confidence
  in who said what; no independent confirmation of revised play quality.
- **[5] [How Metanet Built the 4,000++ Levels Included in N++ Ultimate Edition](https://blog.playstation.com/2018/01/11/how-metanet-built-the-4000-levels-included-in-n-ultimate-edition/)**,
  Mare Sheppard, Metanet co-founder, January 11, 2018. Full article and byline
  verified. Primary explanation of momentum-aware design, repeated testing,
  layered goals and shared replays; promotional claims of satisfaction are
  creator intent, not engagement data.
- **[6] [The N++ team reveals their favourite player-made levels](https://blog.playstation.com/archive/2015/10/01/the-n-team-reveals-their-favourite-player-made-levels/)**,
  October 1, 2015. Article text verifies the named creators and concrete
  Ride the Lightning / Apocalyptic Bridge descriptions. High confidence in
  Metanet's explanations, not an independent play evaluation. Embedded image
  placeholders were not treated as viewed gameplay.
