---
{
  "id": "BT-038",
  "title": "Finish and release Boundstoy after proving Aftershock",
  "type": "epic",
  "status": "in_progress",
  "priority": "P1",
  "depends_on": [],
  "parent": null,
  "scope": ["."],
  "approval": "2026-10-10 user: Implement the entire plan, using subagent where it is helpful to do so. Local implementation and bounded subagents approved; human gameplay acceptance, release-size choice and explicit publication authorization remain gates.",
  "assignment": null,
  "blocked_reason": null
}
---
# BT-038: Finish and release Boundstoy after proving Aftershock

Interview-based release plan, 2026-10-10.

**Status: local implementation approved on 2026-10-10.**
The user requested: "Implement the entire plan, using subagent where it is
helpful to do so." Work proceeds through bounded approved issues in dependency
order. Gameplay acceptance, launch-size choice and explicit publication
authorization remain required. No purchases or broad baseline commit authorized.

The user requested review and issue decomposition, and confirmed on 2026-10-10
that the rendering agent had finished and this session could update the tracker.
The reviewed plan now lives here; BT-024 groups its world-proof work and
BT-039 through BT-062 are bounded follow-ups. Existing visual issues are reused.
The subsequent implementation request approves the local work; individual
metadata below records execution state. BT-061 remains unapproved until the
deployment destination and publication are explicitly authorized.

## Scope

Prove one continuous eight-section Aftershock world, then complete its release
presentation, reliability, acceptance and static publication. The eventual
number of launch worlds is a user decision after the proof, not assumed here.
This epic is a plan and release gate; execute only approved child issues.

## Problem

Build a proper browser bounds/escape game for genre enthusiasts that newcomers
can also enjoy. A world should feel like one finished StarCraft bound or Warcraft
escape map: a continuous journey through increasingly demanding A-to-B puzzles,
with safe checkpoints separating them.

The first substantial deliverable is **one complete rough Aftershock world with
eight connected puzzle sections**. Build enough for the user to judge the entire
experience, rather than repeatedly stopping after isolated demonstrations.
Then revise the world based on their playtest. Decide whether the first public
release contains only Aftershock or additional worlds only after Aftershock
has proved worthwhile.

The three current encounters are disposable. Do not preserve their geometry,
names, route witnesses or targets as design constraints. Preserve useful
engine behavior, compatibility and regression evidence, not rejected gameplay.

### Decisions from the interview

| Topic | Agreed direction |
| --- | --- |
| Audience | Bounds/escape enthusiasts first; newcomers should still find an accessible entry. |
| Structure | One continuous world, initially eight puzzle sections, not eight separately loaded levels. |
| Progression | Start-to-finish play. No checkpoint selection or skipping initially. |
| Checkpoints | Safe landings between puzzles. Seven intermediate checkpoints; section eight ends at the world exit. |
| Puzzle character | Committed movement through danger. Any interior refuge can be temporary; permanently safe observation belongs before the puzzle. |
| Hazards | Explosion patterns and patrolling saws; other thematically consistent hazards may be explored. |
| Experimental interactions | Keys or switches may be attempted if they improve a puzzle. They are not required launch features. |
| Movement | Aftershock starts on normal ground. Preserve the four existing movement rules; no movement rewrite. |
| Hazard clock | Only the active puzzle runs. Checkpoints start the next pattern; completed hazards deactivate. Death/respawn preserves the active phase; explicit Restart resets it. |
| Pausing | Timer and hazard clock freeze together during pause, menus, hidden tabs and closure. |
| Records | Completion time is primary. Death count remains visible; deathless completion is a separate achievement. |
| Targets | No authored medal/mastery times initially. Personal bests supply the time challenge. |
| Saving | Save checkpoint position, retaining elapsed/death totals on checkpoint, death and pause/leaving boundaries; no periodic saves. Reload starts the active pattern over, paused. |
| Deathless continuation | A saved-and-continued run remains eligible if the entire run has zero deaths. |
| Camera | Mostly fixed, section-framed views. Designed movement is allowed where a puzzle needs it. |
| Presentation | Improve the existing procedural 3D direction rather than replace its identity. |
| Audio | Useful reinforcing cues; no essential information available only through sound. |
| Accessibility | Baseline readability and comfort without weakening intended gameplay. |
| Platforms | Chromium is mandatory; the user's Brave browser is a real acceptance target. Broader compatibility is desirable, not certified without testing. |
| Distribution | Ordinary website hosting. No desktop wrapper or store integration required. |
| Resources | No deadline; zero spending on assets, services or tools. |
| Feedback | User can playtest; build as much of the rough world as practical before requesting that playtest. |

### Non-goals for this release plan

No accounts, backend, telemetry, multiplayer, online leaderboard, combat,
generic inventory, scripting engine, daily challenges, ghosts or new movement
abilities. No mobile-only redesign, controller requirement, paid asset pipeline
or mandatory soundtrack. No forced return of the old lesson campaign.

Future worlds may introduce their own theme and reuse previously explored
mechanics where useful. This is a future direction, not an instruction to
produce several worlds before Aftershock earns approval.

## Implementation context

The reusable foundation includes immutable 120 Hz simulation, one-tick pulses,
saws, checkpoints, local records, input clearing, responsive menus, optional
audio, a secondary editor, production-browser checks and static deployment.

The current implementation is not yet shaped for the new world:

- The active registry contains three separate pulse-only encounters with
  `resetPatternOnRetry: true` and preset mastery targets.
- The camera fits the complete level instead of a current puzzle section.
- Version-1 level limits are 40 columns, 32 rows and 80 hazards.
- Core checkpoints are collected independently; the exit does not require an
  ordered eight-section journey.
- Progress stores completed runs, not resumable live gameplay.
- Full-world best-time comparisons need to replace clean-only comparison
  behavior for the new mode.
- The editor, inspection tools and browser scenarios assume the old level shape.

During this interview, BT-036 was marked done as an evaluation and BT-037 was
in progress; at decomposition BT-037 has returned a handoff and is in review,
adding motion interpolation and revised hazard cues. Reuse and
review that work when integrated; do not implement an alternative animation
system alongside it. Its human-comprehension acceptance remains separate from
its code and capture evidence.

Two release gaps were reproduced during the preceding review:

1. A stale in-memory progress collection can overwrite records written since
   startup. Address completed records and resumable runs together.
2. Resume can advance simulation while the WebGL context remains lost.

The previous review passed 233 portable tests and all five browser suites across
the runs, with one journey-reload timeout that passed on retry. This is
historical evidence, not certification of the subsequently changing worktree.

### Tracker reconciliation

BT-024 now records the revised product scope: continuous eight-section world, mixed themed
hazards, continuous death-time clocks, time-first records, exact continuation
and no preset targets. Its earlier pulse-only, separate-stage, retry-reset and
three-greybox-first directions are superseded by this interview.

Retain completed issues as history. Reconcile BT-031 through BT-037 against the
actual integrated code. In particular, BT-035 should become world selection and
Continue/New run navigation, not a selector that exposes locked checkpoints.
Do not declare any visual issue done merely because a nearby issue changed the
same files.

### Active rendering-agent coordination

The user explicitly confirmed that another agent is working on rendering.
Treat its work as an external dependency, not as unfinished work for this plan
to duplicate. BT-031/032/033/036/037 concern labels, floor shades, walls,
hazard readability and animation; BT-034/035 also overlap shared UI surfaces.
Only BT-037 was recorded as assigned and in review at decomposition; this
list is a collision map, not a claim that all those issues are assigned.

The user confirmed the rendering owner finished and permitted tracker edits,
then approved implementation. BT-037 has since been reviewed and code-accepted
after correcting live respawn-footprint scaling. The prior author's changes
remain uncommitted and preserved. Human feel and hardware acceptance are still
separate gates. Later workers must build on this integrated baseline rather
than reverting or replacing the rendering work.

Require a handoff with changed paths, current revision/diff, commands and visual
evidence, remaining limitations and owned-resource cleanup. Then establish one
integrated baseline, reconcile issue statuses and adapt the world/camera plan to
the accepted renderer and motion interfaces. Do not reimplement already
accepted hazard cues or the twelve-principle motion work.

Bounded child records are managed by the sole tracker writer authorized by the
user. Implementation approval is now recorded explicitly on executable issues.
Use one serial-primary code writer while the baseline is uncommitted, and
record real worker IDs. Do not alter another active session's assignment.

### Plan review findings and corrections

- Split the oversized world, persistence and release packages into independently
  verifiable issues. Gameplay authoring uses four two-section batches rather than
  one eight-section assignment or dozens of tiny tile-edit tickets.
- Separated pure snapshot validation, record semantics, storage ownership and
  browser lifecycle integration. A stale-record fix alone cannot safely own a
  resumable run.
- Corrected the save promise: an asynchronous lock cannot be acquired reliably
  during unload. Hold ownership during play, persist at normal state boundaries,
  and treat abrupt termination as best-effort recovery of the latest committed
  snapshot, not a guaranteed one-second durability bound.
- On 2026-10-11 the user approved IndexedDB transactions after native multi-tab
  testing exposed stale localStorage reads despite Web Locks. Transactions are
  the durable authority; writes may complete asynchronously. Added BT-062 to
  require a working solution on every selected launch platform, not only Chromium.
- Made minimal navigation, relevant audio and editor compatibility part of the
  rough-world integration, so they are not deferred until after users need them.
  Final polish still waits for the complete-world playtest.
- Kept numeric map limits, difficulty margins and hardware budgets provisional.
  Validate them in their owning issues rather than silently treating suggestions
  as user-approved requirements.
- Reused BT-031 through BT-037 instead of creating duplicate rendering work.
  Rendering acceptance gates its consumers, not pure contract/record work.
- Represented human acceptance and the release-size choice as explicit gates.
  Rejected content requires bounded follow-up issues before acceptance; optional
  new mechanics/worlds are not mandatory children that would block epic closure.

## 3. Gameplay contract

### Puzzles and recovery

Each section has an observation/launch area, a dangerous traversal and a clear
completion landing. There must be a reason to read the pattern and commit.
A longer puzzle needs related decisions, not copies of the same gate.

Checkpoints must be reachable by all intended successful routes. Their entire
recovery area must remain safe throughout every local hazard phase, including
saw reach and the player's collision radius. They must not trigger through a
wall, before the puzzle is completed or from a shortcut around the challenge.

The first checkpoint follows puzzle one. The seventh precedes puzzle eight.
There is no checkpoint on the final exit approach. The exit itself ends the
final puzzle and freezes the completion time.

Interior pockets are temporary opportunities, not checkpoint substitutes.
Where a section promises that standing still is unsafe, verify that its pockets
and relevant floor positions eventually become lethal. Do not manufacture
continuous fire by stacking consecutive one-tick detonations.

### Timing and difficulty

Keep existing movement, the 0.20-tile player radius, 27-tick pulse warning,
one-tick pulse lethality and 54-tick respawn. Harmless aftermath remains
presentation only. Do not retune these globally to rescue a poor layout.

Elapsed run time advances at 120 Hz. Only the active puzzle's timed hazards
run, using a local pattern clock reset at its preceding checkpoint. Completed
and future timed hazards are inactive. Death preserves the active phase;
explicit Restart resets it at the checkpoint without erasing totals. Existing
version-1 imports retain their declared retry behavior.

Initial authoring targets below are recommendations to test, not interview
promises or substitutes for worthwhile play:

| Measure | Initial target |
| --- | --- |
| Successful traversal, early sections | Roughly 4-8 seconds after committing. |
| Successful traversal, middle sections | Roughly 8-15 seconds. |
| Successful traversal, finale | Roughly 15-25 seconds if its decisions justify the length. |
| Mandatory waiting at a safe entry | Prefer a useful opportunity within 3 seconds; longer waits need a design reason. |
| Normal-route launch margin | Aim for at least 24 contiguous legal tick offsets early and 12 later. |
| Optional faster routes | May be tighter, but never require a single exact input tick. |
| Per-section combined pattern cycle | Prefer at most 1,440 ticks so full-phase recovery remains testable. |

Measure local decision margins as well as launch offsets. A wide initial
window does not excuse a hidden frame-perfect turn later. Revise these targets
using actual play; do not claim a first-clear world duration before observing it.

Difficulty should escalate through reading, commitment, spatial choices and
combination, not merely shorter warning times or longer repeated execution.

## 4. Proposed eight-section progression

These are design hypotheses and working descriptions, not eight approved final
layouts. Replace weak concepts during authoring rather than defending them.

| Section | Core decision | Proposed treatment | Faster play |
| --- | --- | --- | --- |
| 1. Follow the wake | When to enter a moving sequence. | One clear sequential explosion traversal, observable from safety. Establish that spent blast effects are harmless. | Enter on an earlier valid beat instead of waiting an extra cycle. |
| 2. Temporary refuge | When to leave a pocket. | A longer explosion chain with offset refuge pockets. The chain's spent route becomes the escape as pockets detonate. | Transfer directly when arrival permits; a readable refuge route still exists. |
| 3. Patrol crossing | Where and when to pass a moving threat. | Introduce saw patrols without simultaneous complicated pulse demands. The route has meaningful space to choose a crossing. | Use an earlier crossing line or pass behind the patrol. |
| 4. Lateral transfer | Change lane rather than only move forward. | Offset travelling explosions across a broad route with expiring interior positions. Do not copy Crosscurrent's geometry. | A shorter diagonal/lane sequence instead of a long safe detour. |
| 5. Conflicting appointments | Coordinate a crossing with a temporary opening. | Combine a taught saw patrol and a taught pulse sequence, with their full relationship visible before commitment. | Choose the route that matches arrival phase rather than always wait. |
| 6. Route commitment | Choose and complete a route with a real cost. | Test a meaningful short/long route decision. A local touch-key or switch variant is optional only if it creates a better decision. | Shorter exposure or a more direct return, not an arbitrary collectible tax. |
| 7. Coupled rhythms | Transfer between familiar patterns. | Two spatially distinct, readable hazard rhythms interact. Any refuge expires; no new basic rule is introduced here. | Chain transfers without an unnecessary intermediate wait. |
| 8. Finale | Read, choose, commit and transfer under sustained pressure. | A coherent final puzzle combining a small selection of proven ideas, not all earlier rooms concatenated. End directly at the exit. | Route and phase understanding reduce time; zero deaths is the separate achievement. |

Author the main route first. Optional fast routes must save meaningful travel
or waiting and carry a legible tradeoff. A wider corridor with no relevant
decision is not route depth.

New hazards or keys/switches are conditional experiments. Start with pulses,
saws and existing lethal terrain. If a new interaction is needed, use a small
explicit data/state extension and contact activation where possible, not a
generic inventory or action-button framework. Teach it before combining it.
Reject it if it delays the complete rough world without improving play.

For any adopted local interaction, specify collision/activation, visible state,
death reset, checkpoint commit and saved-state behavior before coding. Local
puzzle progress may reset on death without resetting the global hazard clock.
No new mechanic is allowed to arrive unexplained in the finale.

## 5. World architecture and compatibility

### One world, one simulation

Keep a continuous global coordinate space and one immutable live state.
Section transitions must not call `loadCourse`, teleport the player, recreate
the run or reset hazards.

Recommended structure: a versioned world extension containing global terrain,
hazards and eight ordered section definitions. Each section identifies its
bounds, observation area, camera framing and completion checkpoint; the last
uses the world exit. Reuse the existing point, terrain and hazard contracts.

Authoring helpers may assemble translated section data into the global map,
but runtime still sees one world. Reject overlapping incompatible terrain,
unreachable connectors, invalid bounds and misplaced checkpoints.

Keep legacy version-1 parsing and limits unchanged. Add bounded version-2
validation and export rather than silently weakening all imports. Proposed
first-world ceilings are 160x128 tiles, 640 hazards, eight sections and 1 MB
JSON. Confirm these against the authored map and hardware measurements before
freezing the format; they are limits, not a mandate to fill a giant map.

Use typed discriminated unions and frozen definitions. Core remains independent
of DOM, Three.js, storage and camera animation. No new runtime dependency is
required.

### Ordered progression

Track the highest completed section independently of camera location. Only the
next valid section completion advances the checkpoint. Require all seven
intermediate completions before the final exit can finish the world.

Do not use invisible progress barriers to compensate for bad geometry. Verify
that authored walls and routes prevent meaningful puzzle bypasses. Backtracking
must not downgrade the respawn point or leave the player outside the camera.

### Section camera and rendering

Fit the current puzzle, its readable entry and its completion landmark, rather
than shrinking the entire world to fit the viewport. Most sections use a fixed
view. Camera metadata is presentation configuration, not physics.

For the rough world, an immediate section-view change at a safe transition is
acceptable. Add smooth transitions only when they preserve control and advance
warning visibility. No automatic pause or hidden timer reset during camera
motion. If the player moves toward danger before a transition settles, prioritize
the required view over animation. Reduced motion uses a direct stable view.

Camera location may follow a deliberate backtrack without changing progression.
Designed moving-camera sections must expose the next required decision before
the player commits; never kill the player with an unreadable off-screen arrival.

Initially render the current section and necessary connector/neighbor geometry.
Keep active hazard phases independent of visibility. Do not make all eight
sections' blasts equally audible: sound cues should describe the visible or
immediately relevant puzzle.

Profile the larger world before adding a spatial-index framework. Existing
instancing, resource ownership and disposal should be extended first.

### Editor and tools

Preserve all legacy editing and import behavior. Version-2 worlds must validate,
round-trip, playtest and remain excluded from built-in records.

Provide section-focused editing of ordinary geometry/hazards using existing
brushes, with advanced section/camera metadata editable through validated JSON
initially. Do not build a general world-building suite. New accepted hazards
must be wired through validation, simulation, visuals, help, import/export and
the relevant editor surface.

Extend the debug API and `scripts/inspect.ts` for world state, section identity
and checkpoint recovery. Developer section positioning may support tests, but
must never appear as ordinary checkpoint skipping.

## 6. Persistence, records and failure handling

### Checkpoint continuation (BT-065/066/067 supersede exact-position saves)

Persist a versioned run containing content ID/revision, run ID, elapsed ticks,
hazard clock state, position, velocity, section progress, checkpoint, visited
markers, death count, respawn state and any adopted local interaction state.
Never serialize renderer objects or trust arbitrary saved data without bounds
and consistency validation.

Validate the live simulation state before normalizing its durable representation:
checkpoint/spawn center, stopped velocity, no respawn countdown, active phase
zero, unchanged elapsed tick/deaths/history. Preserve completed states exactly.
Reload that checkpoint state paused with no held input or wall-clock catch-up.
In-session Resume retains live position and phase instead of normalizing it.

With run ownership already held, enqueue transactional saves at meaningful
state boundaries: death, checkpoint, completion, pause, menu opening and
visibility loss. Normal page exit is an additional best-effort opportunity,
not a guarantee of a final asynchronous commit. No periodic saves or
respawn-completion saves. Queue death saves promptly and preserve
ordering so a later or stale save cannot erase deaths. Show saved only after
transaction completion; do not stall simulation on every tick for storage.

Distinguish normal continuation from crash recovery. Browsers cannot guarantee
a last-moment write after process/OS failure; resume the latest committed
checkpoint snapshot. Document the boundary-save policy and storage limitations, not a hard
loss bound that browser crashes, failed writes or scheduling can invalidate.
Do not promise anti-cheat or perfect crash durability for editable local saves.

New run replaces an unfinished run only after a clear confirmation. Ordinary
death never replaces its run identity or erases totals. R/Restart return to the
latest checkpoint and reset only its pattern, retaining the run identity and
totals. Menu New run remains separate and confirmed. The user explicitly
requested deletion of obsolete revision-1 active saves, not migration/archive;
unrelated records and drafts must remain untouched.

### Content revisions and migrations

Retain legacy records and drafts without counting them as completion of the
new world. Use a new world content ID and revision. Changed geometry, timing or
mechanics invalidate compatible continuation/record comparisons unless an
explicit tested migration exists.

On incompatible or corrupt saves, preserve stored data and show a useful
recovery/reset choice. Never silently overwrite the only copy with empty data.
Storage-denied/quota failures remain visible; the game can still run in memory,
but it must not claim progress was saved.

### Multi-tab safety

Separate immutable best-record merging from ownership of one resumable run.
Serialize read-merge-write operations against the latest stored data; merging
an old startup snapshot is insufficient.

The approved implementation uses IndexedDB transactions for durable state and
a same-origin browser lock for active-run ownership. A Web Lock alone does not
make cross-tab localStorage caches coherent. Another tab may view the menu but
must not silently overwrite the running session. Handle tab termination and
ownership acquisition without relying solely on unload events. Reads/writes
resolve against the transactional authority; aborts cannot report success.

Hold the active-run lease while playing rather than trying to acquire it during
page exit. Final completion must persist the record and retire the active run
atomically or idempotently by run ID; a stale active snapshot must not resurrect
an already completed run. Never await a new lock inside an unload-only save.

For browsers without the selected coordination primitive, explicitly restrict
unsafe concurrent continuation or provide an equally tested fallback. Do not
use a racy localStorage flag as a pretend lock. Test two real browser tabs,
stale writers, independent record updates and owner disappearance.
BT-062 must qualify this behavior on every platform chosen in BT-054. Missing
required capability needs a verified alternative or an explicit user decision
to change launch scope; a silent memory-only downgrade is not acceptance.

### Results

Show world completion time, deaths, personal-best comparison and deathless
achievement. Time is compared across all legitimate completions; fewer deaths
can break an exact-time tie. Retain a separate best deathless time if useful.
Achievement status is sticky once earned for that world revision.

No preset targets, medals or checkpoint-selection rewards initially. A legitimate
saved zero-death continuation remains eligible. Player-written localStorage is
not a competitive score authority.

### Graphics and startup failures

Treat WebGL context loss as a blocked recovery state: clear input, stop gameplay
and both clocks, preserve the latest run and disable Resume until graphics are
actually usable. Restore resources and remain paused, or offer a clear reload
action if restoration fails. Retest audio and camera after recovery.

Handle unsupported WebGL, initialization failures and asset-load failures with
actionable copy rather than an apparently playable blank board.

## 7. Issue breakdown

Metadata in each linked issue is the operational dependency source of truth.
BT-024 groups the complete-world proof; this epic groups the remaining release
work and existing unassigned presentation issues. Proposed implementation paths
within the issues may be refined when their owning implementation is approved;
the issue IDs and filenames are now durable tracker records.

| Issue | Bounded outcome |
| --- | --- |
| [BT-039](BT-039-world-data-contract.md) | Versioned world and section data contract, assembly and legacy compatibility. |
| [BT-040](BT-040-world-progression-clock.md) | Ordered checkpoints, exit gating and continuous world simulation clock. |
| [BT-041](BT-041-section-camera-rendering.md) | Section framing, connected transitions, backtracking and bounded scene resources. |
| [BT-042](BT-042-run-snapshot-contract.md) | Validated exact-run snapshot and content-revision compatibility. |
| [BT-043](BT-043-world-records-deathless.md) | Time-first records and separate deathless achievement. |
| [BT-044](BT-044-safe-storage-ownership.md) | Race-safe writes, active-run ownership and idempotent completion. |
| [BT-045](BT-045-exact-run-continuation.md) | Autosave/continue lifecycle and honest recovery UI. |
| [BT-046](BT-046-graphics-loss-recovery.md) | Block invisible play after WebGL loss; restore or reload explicitly. |
| [BT-047](BT-047-world-editor-inspection.md) | World import/export, minimal editor support and headless inspection. |
| [BT-048](BT-048-aftershock-sections-one-two.md) | Author the first two explosion/temporary-refuge sections. |
| [BT-049](BT-049-aftershock-sections-three-four.md) | Author saw introduction and lateral-transfer sections. |
| [BT-050](BT-050-aftershock-sections-five-six.md) | Author combined-hazard and meaningful route-choice sections. |
| [BT-051](BT-051-aftershock-sections-seven-eight.md) | Author coupled rhythms and a coherent finale. |
| [BT-052](BT-052-complete-rough-world.md) | Integrate one complete rough world, minimal navigation and full-world evidence. |
| [BT-053](BT-053-aftershock-gameplay-acceptance.md) | User playtest and explicit acceptance after any bounded rework. |
| [BT-054](BT-054-release-scope-decision.md) | Decide launch world count and available release destination. |
| [BT-055](BT-055-world-presentation-integration.md) | Accept existing visual/navigation work in the complete world. |
| [BT-056](BT-056-world-audio-feedback.md) | Relevant, bounded audio cues and mute/pause/recovery behavior. |
| [BT-057](BT-057-world-performance-acceptance.md) | Measured hardware frame pacing and resource acceptance. |
| [BT-058](BT-058-browser-comfort-acceptance.md) | Brave/Chromium, input, reduced-motion/flash and available-device acceptance. |
| [BT-059](BT-059-release-docs-asset-package.md) | Accurate documentation, licenses and versioned static release package. |
| [BT-060](BT-060-release-candidate-verification.md) | Reproducible acceptance of the frozen complete release candidate. |
| [BT-061](BT-061-publish-static-release.md) | Authorized publication, hosted smoke checks and rollback evidence. |
| [BT-062](BT-062-launch-platform-qualification.md) | Verified gameplay, persistence and recovery on every selected launch platform. |

Reuse [BT-031](BT-031-start-exit-label-rendering.md),
[BT-032](BT-032-similar-ground-shades.md),
[BT-033](BT-033-wall-visual-hierarchy.md),
[BT-034](BT-034-remove-account-network-copy.md),
[BT-035](BT-035-scalable-level-selection.md),
[BT-036](BT-036-explosion-chargeup-readability.md) and
[BT-037](BT-037-animation-overhaul.md); no duplicate animation rewrite is planned.

Work within each package is test-first: failing regression/contract test,
implementation, targeted verification, full suite, review and recorded evidence.
Aim to keep resulting child issues bounded to a few implementation iterations,
not assign entire architectural packages to a worker in one unreviewed batch.

BT-042/043 and content authoring can proceed independently after BT-040.
BT-041 and browser lifecycle work require accepted rendering interfaces.
BT-048 and BT-049 have no artificial ordering dependency, but their declared
file scopes still prevent unsafe concurrent edits. BT-052 requires content,
camera, persistence and editor compatibility together.
Do not parallelize edits to the same world registry
or `presentation/main.ts`. Existing worker rules and explicit authorization
still apply; this plan does not request a large agent workflow.

## 8. Milestones and feedback gates

### M0: a safe, reconciled starting point

Accept the actual active animation work before depending on it. Reconcile the
tracker and record the new product rules. Do not commit unrelated changes or
restore discarded requirements from old issue descriptions.

### M1: complete rough Aftershock, not another three-room demo

Finish BT-052 and its prerequisites before the main user playtest. Include all eight sections,
safe checkpoints, adequate hazard cues, basic section camera, working saves and
honest results. Art can be simple; unreadable or unrecoverable play cannot.

Run internal checks continually without asking the user to approve every small
layout. Ask early only for a genuine unresolved behavior/scope decision or a
blocker. Do not spend the entire milestone polishing the first room.

### M2: accepted gameplay

The user plays the whole map in Brave and reports where it becomes confusing,
boring, unfair or worth retrying. Record observations manually; add no telemetry.
Offer a second run for improvement, not an obligation to memorize an input
script. Observe newcomers only if volunteers are actually available.

For each section capture first-clear attempts, notable waits, misunderstood
hazards, perceived control/camera problems and whether a faster route seems
discoverable. Record actual feedback, not invented engagement statistics.

Revise rejected sections and retest affected downstream phases/checkpoints.
The user must accept the overall progression and final puzzle before major
final-art work or additional-world production.

If feedback is delayed, wait. Do not treat silence, a green test suite or the
existence of a full map as gameplay approval.

### M3: choose release size and prepare the candidate

Once Aftershock works as a complete escape map, explicitly decide whether that
is the first public release or whether another world is necessary. Do not
invent a world count or call a multi-world game complete without this decision.
Additional worlds, if chosen, repeat the same full-map/playtest gate using the
established infrastructure, rather than trigger a new engine project.

Finish presentation, compatibility and release hardening on the accepted map.
Recheck actual gameplay after visual changes; more attractive effects can still
hide the timing cues that made a section fair.

### M4: verify and publish the authorized release

BT-060 verifies the frozen candidate only after the chosen launch content and
acceptance gates are satisfied. BT-061 then requires explicit publication
authorization, hosted checks and rollback evidence. Neither a green candidate
nor approval of this plan is permission to deploy.

There is no calendar deadline. Track progress through verified milestones and
feedback, not guessed dates or autonomous credit budgets.

## 9. Presentation, audio and usability

### Visual hierarchy

Preserve the current industrial/procedural identity while making the world feel
like a connected place. Background objects and walls should frame the route,
not compete with hazards. The two normal-floor shades remain the same movement
surface; preserve group identity only where the pattern needs it.

Finish START/EXIT/checkpoint legibility at actual viewing sizes, not merely
texture resolution. Keep player position, lethal footprint and next decision
readable through overlapping effects.

Use the BT-036/037 hazard treatment as the current baseline: visible idle
explosive marking, rising warning salience, brief clear detonation and subdued
harmless aftermath. Do not reintroduce a whole-cycle warning or expand damage.
Verify dense pulse/saw combinations, not only isolated effects.

### Animation

Apply the existing twelve-principle plan consistently to the full world:
squash/stretch without changing colliders, hazard anticipation without input
delay, clear staging, deterministic pose/effect sampling, restrained follow-through,
easing and arcs, secondary character motion, frame-rate-independent timing,
selective exaggeration, grounded volume and a coherent character.

Prefer useful checkpoint, death, respawn and completion beats over spectacle.
No camera shake requirement. Preserve tick-accurate warning/detonation cues
even when character and saw poses interpolate between display frames.

### Audio

Polish existing effects first: distinct detonation, danger/patrol character,
checkpoint confirmation, death/respawn and final completion. Reinforce timing
without an earlier audio-only warning. Prevent dense hazards from overwhelming
player feedback or the voice budget.

Keep explicit sound opt-in, remembered mute/volume and useful silent play.
Pause/hidden/context-loss behavior must not leave misleading sounds running.
Music or ambient loops are optional after gameplay and cue clarity work; their
absence does not block release.

### Interface and accessibility

World selection should show identity, completion/best time, deathless status
and resumable progress. For one available world, keep navigation simple; test
larger fixture lists without exposing imaginary worlds or checkpoint skipping.

Retain keyboard/touch access and obvious focus. Help explains active mechanics
without per-section tutorial modals. Remove account/network promotional copy
from normal, result, startup and fallback UI while retaining actionable save
and compatibility errors.

Provide reduced-motion/flash-conscious presentation and shape/state cues where
they preserve the challenge. Respect preference changes during a session.
Review flashing at the combined-world pattern level; reduced motion is not
itself flash-safety certification. Do not quietly slow hazards or enlarge
colliders as an accessibility shortcut.

Controls, text and camera must remain usable at supported sizes. Remapping,
gamepads, assist modes and extra settings are not automatic launch requirements.

## Verification

### Portable deterministic tests

- Old level parsing, all four movement models, editor transformations and saved
  records remain compatible.
- World definitions, section geometry and checkpoint order validate strictly.
- Run clock advances through all 54 respawn ticks; the active pulse/saw phase
  remains continuous through death/recovery, but restarts at the next checkpoint.
- In-session pause/resume preserves the complete live state; reload/Restart
  returns to the checkpoint with reset phase and retained totals.
- Final completion requires the intended ordered journey and freezes time.
- Time-first comparisons, ties, deathless retention, migration and corruption
  paths behave explicitly.
- New local interactions, if adopted, have deterministic death/save semantics.

### Gameplay evidence for every section

- At least one exact ordinary input witness from its legal entry state.
- A genuinely different faster strategy where the geometry supports one.
- Deliberate incorrect timing/route/camping cases that fail for the intended
  reason, without teleporting or disabling hazards.
- Full local-cycle launch/recovery exploration, including arrival phases that
  arise after death. Store exact successful windows and maximum entry waits.
- All-phase checkpoint safety and downstream recoverability.
- Spatial/bypass checks and explicit evidence that temporary pockets expire.
- Full continuous-world witnesses; section witnesses alone are insufficient.

Do not claim exhaustive continuous-space solvability from sampled positions,
or human enjoyment from replay legality. Keep reference routes out of the
normal player UI.

### Production-browser acceptance

Extend the existing native Node/Chromium harness rather than install another
test framework. Cover real keyboard and touch, section camera transitions,
backtracking, held-input clearing, save/reload in motion and during respawn,
all seven recoveries, complete-world records, new-run confirmation and editor
record isolation.

Reproduce the multi-tab failure with two real tabs and verify the fix. Inject
WebGL loss and verify clocks cannot resume invisibly. Exercise unsupported
graphics, storage-denied, malformed/incompatible snapshots, interrupted loading
and asset failures with explicit outcomes.

Use 1280x900 and 1440x900 desktop, 390x844 portrait, 844x390 landscape and the
existing reduced-space checks; include DPR 1/2 and full/reduced motion.
Test the real user's Brave configuration, not only an isolated Chrome profile.

### Performance and resource acceptance

Record the hardware/browser for every measurement. On the available desktop
hardware, target sustained 60 Hz play with p95 frame intervals at or below
20 ms and no routine section transition causing a visible >100 ms stall.
These are initial release targets to measure, not existing guarantees.

Measure the densest section, camera changes, repeated death/reload and long
sessions. Check stable GPU resource counts across repeated world/editor
transitions and no ongoing gameplay rendering while paused/hidden.

Preserve simulation outcomes at 30/60/120/144 Hz and after bounded stalls.
Do not treat software WebGL, CPU throttling or emulated touch as a physical
phone benchmark. Add a quality reduction only if measurements justify it and
it preserves essential signals.

### Commands

Run the smallest affected Node test group during development, then `npm test`
before integration/commit. Use the current repository commands:

```sh
npm run tasks:check
npm test
npm run build
npm run release:check
npm run test:motion
```

Extend the named suites to cover the new world instead of allowing retired
three-level checks to masquerade as release evidence. Run `npm run test:astro`
when distributing the Astro wrapper or changing its integration.

Run full tests and typechecking sequentially to avoid temporary Astro fixtures
being mistaken for project source. Preserve real failure logs; diagnose
intermittent timeouts rather than treating a retry as proof of no problem.
Final certification belongs to a frozen content/code revision.

## 11. Assets, documentation and publishing

Prefer original procedural assets and verified CC0 resources. Spend nothing.
For each external asset, record source, author, exact license, modification and
attribution requirements; bundle it locally and keep required notices in the
published output.

Game-icons.net is free but not CC0: its official
[about page](https://game-icons.net/about.html), checked 2026-10-10, states
CC BY 3.0 and requires author credit. Do not apply the project's MIT label to
third-party art with a different license or remove upstream notices.

Update README, architecture, mechanics, testing, platform and relevant authoring
guidance to match the new world. Remove obsolete active-scope promises, retired
inspection indices and claims that checks establish fun. Preserve historical
evidence as clearly historical.

Build a versioned static artifact containing all `dist/` assets and notices.
Choose a zero-cost/existing website destination with HTTPS, correct MIME types,
relative-path support and suitable cache behavior. No hosting account creation
or deployment occurs without the user's authorization.

Publish HTML and hashed assets consistently; retain the previous complete
artifact for rollback. Verify the actual hosted version from a clean browser,
including nested path, asset requests, save/continue, sound gesture behavior,
world completion and a reload after deployment. Hosting at a new origin changes
local-storage scope; document that rather than promising portable saves.

Include a clear game description, instructions, author/asset credits, supported
browser expectations and a simple feedback route appropriate to the chosen
website. A social preview image is useful packaging, not a gameplay blocker.
No game-owned backend or analytics is needed.

CI can automate the same portable/browser gates if the selected repository
hosting provides it at no cost. A documented, reproducible manual release is
acceptable; a new CI platform is not a prerequisite.

## Acceptance criteria

- [ ] The user accepts Aftershock as one worthwhile complete bounds/escape map.
- [ ] Eight distinct escalating sections form one continuous, readable journey.
- [ ] Seven safe intermediate checkpoints recover every intended route; the
  finale ends at the exit with no redundant checkpoint.
- [ ] Hazard clocks continue through deaths and freeze only with paused gameplay.
- [ ] Exact saved continuation works, including zero-death eligibility.
- [ ] Time-first records and the separate deathless achievement are correct.
- [ ] No normal-play checkpoint skipping or obsolete preset mastery targets.
- [ ] All intended puzzles have legal routes, measured margins and real failure/
  recovery evidence; no accepted known unfair or unreadable section.
- [ ] Visual hierarchy, animation, sound and navigation support the full map.
- [ ] Multi-tab writes preserve progress and context loss cannot permit invisible play.
- [ ] Legacy saves/imports/editor behavior are preserved or explicitly migrated.
- [ ] All required tests pass on the frozen release candidate, with user Brave
  playtesting and honest reporting of untested browsers/devices.
- [ ] No paid assets/services; all third-party licenses and credits are correct.
- [ ] Documentation, versioned artifact, actual deployment checks and rollback
  procedure match the published game.
- [ ] The user has chosen the release size after the Aftershock proof.

## 13. Decisions deliberately deferred

The interview is sufficient to start implementing an approved plan. These
decisions belong at evidence-based gates rather than being guessed now:

- The final eight layouts and any worthwhile new hazard/key/switch interaction.
- Actual first-clear duration and final difficulty tuning.
- Whether Aftershock alone is the first public release.
- Which additional browsers/devices can honestly be claimed as tested.
- Exact website URL, available zero-cost hosting workflow and feedback channel.
- Whether ambient audio/music improves the accepted world enough to include.

Wait for user answers at these gates. Do not infer acceptance from response
time, expand into more worlds automatically or mark a release finished because
the implementation checklist is green.

## Handoff

Pending implementation. Plan review and issue decomposition only.

## Result

Pending release acceptance.
