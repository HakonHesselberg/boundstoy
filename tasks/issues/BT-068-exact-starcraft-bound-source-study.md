---
{
  "id": "BT-068",
  "title": "Inspect exact StarCraft bounds and port feasibility",
  "type": "chore",
  "status": "done",
  "priority": "P1",
  "depends_on": [],
  "parent": null,
  "scope": ["tasks/issues/BT-068-exact-starcraft-bound-source-study.md"],
  "approval": "2026-10-12 user requested viewing exact old StarCraft bounds and investigating copying individual puzzles to compare with Boundstoy movement. This record covers the source investigation and feasibility findings, not a claim that playable ports or third-party reuse permissions have been obtained.",
  "assignment": null,
  "blocked_reason": null
}
---
# BT-068: Inspect exact StarCraft bounds and port feasibility

## Problem

BT-014 studied general design and a few video frames, not original map data.
The user wants actual old puzzles as references, rather than another loosely
inspired design. Establish what those puzzles really do and what a faithful
movement comparison would require.

## Scope

Inspect original downloadable scenarios, full-map images, location rectangles
and triggers. Identify a small candidate set and explicit incompatibilities.
Do not replace production Aftershock, change movement rules, publish source
assets or call an approximation an exact port.

## Acceptance criteria

- [x] Inspect full-map images and original scenario data for identifiable old bounds.
- [x] Verify provenance and source hashes; distinguish archive timestamps from creation dates.
- [x] Identify concrete obstacle geometry, ordering and stored timing fields.
- [x] Compare with existing movement, collision, warnings and progression.
- [x] Separate verified source facts from unverified runtime timing, playability and reuse permission.
- [x] Preserve the current game and record findings durably.

## Implementation context

### Primary sources inspected

1. [Beginner Bound](https://scmscx.com/map/Y4jhzHt7), credited in its
   force metadata to **NewRecord**. A 64 x 64 Twilight map, 65 locations
   reported in archive metadata, 53 triggers and eight labelled obstacles.
   Its archive includes a replay attributed to RucO, dated 2007-10-26,
   1,146 frames. This is evidence of an old reference, not a verified release
   date or proof that this replay completes the map.
2. [Level Up Bound](https://scmscx.com/map/TR6r752y), credited to **Mp(U)**.
   A 96 x 96 map with 125 locations and 410 triggers. Its archive includes
   replays dated 2006-12-25 and 2008-04-15 (UTC). These dates do not establish the
   map's original publication date. The preview shows a compact reusable
   arena; the scenario defines a five-by-five grid of two-tile-square cells.

Archive API evidence:

- `/api/uiv2/map_info/Y4jhzHt7` and `/api/uiv2/map_info/TR6r752y`
- `/api/uiv2/replays/Y4jhzHt7` and `/api/uiv2/replays/TR6r752y`
- `/api/chk/trig/Y4jhzHt7` and `/api/chk/trig/TR6r752y`
- Raw CHK: `/api/chk/<sha256>`; rendered image: `/api/chk/<sha256>/map_img`

All endpoints above are relative to `https://scmscx.com`. The public raw
download and trigger routes were verified against the archive's open-source
`crates/bwmapserver/src/server.rs`, not guessed through restricted endpoints.

| Source | SHA-256 |
| --- | --- |
| Beginner Bound MPQ | `f0ccd611f8b16f19a0b707bbe2036b7fa7a7dc067268415e188e60a52413e7e9` |
| Beginner Bound CHK | `293c1838f351e2e471e2ecc9b568f4620b3af9928a1d7c5cc8f9c678a702cfff` |
| Level Up Bound CHK | `36c33bd8ab3f51a9c0c489960624841f0c775e9d4cdc35707b786b7e910fc34b` |

### Concrete candidates

Trigger indexes below are zero-based. Dimensions use StarCraft's 32-pixel
terrain tiles, not Boundstoy units. Wait values are source fields, **not
measured real-time milliseconds**.

| Candidate | Verified source mechanism | Value as a movement comparison |
| --- | --- | --- |
| Beginner #1, travelling sequence; trigger 20 | Seven adjacent 2 x 2 kill regions along a 14 x 2 corridor, fired in order with six `Wait 300` actions. No explicit final wait before preserving the trigger. | Baseline for following or crossing a travelling sequence. Do not infer a 2,100 ms cycle by inventing a seventh wait. |
| Beginner #2, alternating spaces; trigger 22 | Nine adjacent 2 x 2 regions across an 18 x 2 corridor. Five odd regions fire together, then `Wait 800`, four even regions fire together, then `Wait 800`. | Clean test of stop-and-hop control versus uninterrupted gliding. |
| Beginner #3, side refuges; trigger 24 | One 2 x 14 central kill strip, seven visual unit creations along it, then `Wait 1500`. The terrain image shows alternating side recesses. | Stronger lateral-steering comparison. It is not a sequence of seven independently timed explosions. |
| Level Up, switch 23; trigger 39 | On the five-by-five grid: four corners, `Wait 100`, four inward diagonal cells, `Wait 50`, center. No explicit final wait. | A compact two-dimensional convergence pattern, but a poor first *literal-timing* port: runtime cycle length is unresolved and our minimum pulse period is one second. |

The first three are the most useful initial comparison set. These are source
mechanisms, not claims of interesting play or demonstrated legal Boundstoy
routes. The Level Up example is identified by switch/trigger, not assigned an
unverified player-facing level number.

### Important compatibility findings

- **One-shot damage is compatible in principle.** Selected triggers create
  visual units and immediately kill units in their regions, without a wait
  between those actions. There is no source charge-up interval in those
  sequences. Our 27-tick warning would be an explicit presentation adaptation.
- **Progression gating is present.** Beginner transitions clear the previous
  switch and set the next when a runner reaches a location. Clearing a switch
  prevents future activations; it does not prove that an already waiting
  StarCraft trigger aborts immediately. Do not equate this with our exact
  checkpoint epoch semantics.
- **Timing is not a direct field conversion.** Beginner triggers 36, 49 and 50
  each contain eleven zero waits and Preserve Trigger, owned by Player 8.
  Its obstacle waits are also owned by Player 8. Hyper-trigger scheduling and
  wait interactions must be measured in the original engine before claiming
  exact periods or phase offsets. No source replay was executed here.
- **Spatial resemblance is not collision equivalence.** A source 2 x 2 kill
  rectangle could be represented visually by four pulse tiles, but our pulse
  half-width is 0.43 with a 0.20-radius player. Source region/unit collision
  semantics differ; neither pixels nor terrain tiles automatically establish
  equal clearance.
- **Surface replacement changes the puzzle.** At a proposed 1:1 tile scale,
  two tile centers are 0.556 s apart on normal ground, 0.455 s on soft ice,
  0.417 s on hard ice and 1.333 s in mud at full speed. These are straight-line
  distances/speeds, not successful crossing times. Soft ice's maximum-turn
  free-space radius is 1.375 tiles, with a body-inclusive U-turn diameter of
  3.15 tiles. A two-tile corridor cannot accommodate that free U-turn; wall
  reflection is a different maneuver. Hard ice cannot make the original
  stop-and-hop adjustments without a wall.
- **Reject control hijacking.** Beginner #8 includes a preserved movement
  order toward a kill location, repeated after `Wait 125` (trigger 35), plus
  a repeatedly checked kill trigger (34). It is not a suitable copy under our
  movement and one-tick-explosion constraints.

### Reuse and experiment boundary

No explicit reuse license was established for either archived map. Public
download, attribution and the archive server's source-code license are not
evidence of a license for uploaded maps. Do not package their creative layouts,
text, artwork or audio as release content without resolving appropriate rights.
Simple mechanics can inform original studies, but label those as adaptations,
not exact copies of the original experience.

The explicitly CC-BY-4.0
[Terran](https://acodcha.github.io/sc/scenario/terran_obstacle_course/) and
[Zerg](https://acodcha.github.io/sc/scenario/zerg_obstacle_course/) courses by
Alexandre Coderre-Chabot were inspected as alternatives. Their descriptions
concern squads/unit evolution, not these classic timed bounds; they were not
silently substituted.

A future playable comparison should retain source geometry/timing evidence,
start with normal ground, then change only the surface in a separate variant.
Any timing calibration, scaling, warning or collision difference must be
visible in its provenance. Keep experiments outside production progression
and saves. Exact legal routes and measured input margins remain necessary
before a playtest, but cannot establish human acceptance.

## Verification

Downloaded scenario data was handled as inert data, never executed.
Both CHK hashes and the Beginner MPQ hash match archive metadata. Compared the
raw 2,400-byte TRIG records with the archive's decoded JSON: both trigger counts
match, and ten selected records have matching action counts, enabled actions
and non-disabled trigger flags. Location coordinates were decoded from MRGN;
Level Up location names were resolved through STR.

Beginner contains an invalid trailing `uBeR` chunk declaration at byte 179242,
with only 14 bytes remaining. The investigation records that limitation rather
than claiming a fully validated generic CHK importer. All selected MRGN/TRIG
data precedes it; raw hashes and decoded trigger counts agree.

Full-map previews for both sources were actually viewed. Their screenshots do
not show explosion timing. Replay metadata was inspected, not played.
Format and scheduler references were opened:

- [Scenario.chk](https://wiki.staredit.net/wiki/Scenario.chk)
- [Hyper triggers](https://wiki.staredit.net/wiki/Hyper_Triggers)
- [Wait blocks](https://wiki.staredit.net/wiki/Wait_blocks)

Local evidence is under session
`183b57e8-2976-4cc3-88cc-7f7536f244de/files/sc-bound-research/`:
the source CHKs, decoded trigger JSON, original/resized map images and
`verified-source-facts.json`. No third-party map files were added to Git.
Tracker/index consistency is checked with `npm run tasks:check`.

## Handoff

- Summary: Concrete source investigation completed directly by the orchestrator; no worker or game implementation.
- Changes: This source-study record and generated task index only.
- Verification: Source/hash/binary checks, actual image inspection and current `data/terrain.ts`, `core/level.ts`, `core/simulation.ts` comparison.
- Risks: Real-time source schedules, exact collision/terrain clearance, source reuse rights and human playability remain unverified.
- Commit: None; research record integrated into the existing dirty primary worktree.
- Resources: Research tab closed and temporary parser/image-tool virtual environment removed. Source evidence retained in the session. Production preview and other sessions untouched; no game content was executed.
- Decisions: Research is complete; a faithful playable port is not. Do not infer release acceptance or silently adjust original geometry/timing.

## Result

- Summary: Accepted as source-backed feasibility research, not a completed port. Three concrete first candidates and one contrasting grid example have specific timing, control and rights limits.
- Verification: Original hashes, selected binary trigger records, source images and existing movement rules support the stated findings; unplayed schedules and rights are explicitly unresolved. Tracker validation passed for 68 issues with a current index.
- Integration: This record and generated index are working-tree changes only. Production Aftershock is unchanged.
