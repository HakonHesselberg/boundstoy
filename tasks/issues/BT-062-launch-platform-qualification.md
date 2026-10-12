---
{
  "id": "BT-062",
  "title": "Qualify gameplay persistence and recovery on every launch platform",
  "type": "chore",
  "status": "ready",
  "priority": "P1",
  "depends_on": ["BT-045", "BT-054", "BT-064"],
  "parent": "BT-038",
  "scope": ["tests/browser/", "docs/PLATFORM.md", "docs/BROWSER_CHECKS.md", "tasks/issues/"],
  "approval": "2026-10-11 user approved the IndexedDB architecture change and requested an issue ensuring a working solution for every intended launch platform; execution remains subject to the agreed launch matrix and issue prerequisites.",
  "assignment": null,
  "blocked_reason": null
}
---
# BT-062: Qualify gameplay persistence and recovery on every launch platform

## Problem

Passing Chromium checks does not establish that the game and its persistence
work on every browser/OS/device we intend to support. Real multi-tab testing
already disproved the proposed localStorage coherence assumption.

## Scope

Qualify the launch matrix chosen in BT-054 against the actual release game,
IndexedDB transaction authority, active-run ownership and recovery. Chromium
and the user's Brave setup are mandatory; other engines/devices become required
when selected for launch, not simply because they appear in a generic matrix.
BT-058 owns detailed presentation/input comfort; this issue owns capability
coverage and verified persistence on every selected platform.

Do not invent compatibility claims from API availability or viewport emulation.
Use bounded follow-up implementation issues for platform defects or alternative
storage/ownership paths; do not silently expand this into a browser port.

## Acceptance criteria

- [ ] Every launch target has an explicit OS, browser/engine, relevant version range, device/input class and support expectation agreed in BT-054.
- [ ] Each target boots the production game, renders usable WebGL, accepts its intended controls and completes a run; audio opt-in works where sound is claimed.
- [ ] Each target verifies exact-position continuation, zero-death eligibility, record retention, atomic completion and active-save retirement against the actual persistence implementation.
- [ ] Two-tab ownership, latest committed reads, close/termination recovery and unavailable coordination primitives are exercised where the platform supports those scenarios.
- [ ] Transaction abort/quota, blocked upgrades, corrupt/incompatible data, private/restricted storage, reload, background suspension and relevant BFCache paths have explicit, truthful outcomes.
- [ ] No platform reports saved before transaction completion, depends on unload completing an asynchronous write, or claims guaranteed persistence after OS eviction/site-data clearing.
- [ ] A missing required capability has a tested alternative with equivalent safety, or an explicit user-approved change to launch scope/support expectations. Silent downgrade to memory-only is not a full-save compatibility pass.
- [ ] All selected targets have evidence, or remain blockers with named missing devices/tests; an untested target cannot be certified by disclaimer alone.
- [ ] Platform-specific fixes and acceptance reruns are completed before release documentation and the candidate gate.

## Implementation context

The user approved IndexedDB on 2026-10-11 with this additional requirement.
BT-044 owns the transactional store and ownership implementation; BT-045 wires
real gameplay lifecycle. Their first Chromium results are a starting point,
not certification of WebKit/Firefox/mobile or the user's configured Brave.
BT-044's native quota probe is specifically outstanding: Chromium accepted
the CDP override but still committed a bounded 1 MiB probe. Unit quota failures
and real transaction aborts passed; neither certifies native quota rejection.
Preserve that distinction and complete relevant platform failure-path coverage
before release; do not fill the developer's disk to force a test.
BT-045 additionally exercised real history navigation, but Chromium did not
retain the document in BFCache. Its explicit persisted pagehide/pageshow event
test is handler coverage, not native BFCache certification. Qualify the actual
BFCache/eviction behavior on the selected launch targets.

Do not add paid services, accounts, telemetry, runtime network calls or a new
test dependency. Prefer the existing native browser harness and actual available
devices. Record manual evidence when automation cannot reach a target.
Missing hardware is a real acceptance blocker, not permission to fabricate tests.

## Verification

Run the current `node tests/browser/run-storage.ts` and
`node tests/browser/continuation.ts` on applicable targets, plus the actual
world journey and graphics-recovery scenarios. Extend harness support only
where needed and approved; collect equivalent manual steps/results elsewhere.
Record candidate revision, actual browser/OS/device, storage mode, scenario,
expected/actual outcome and artifact location in a platform matrix.
Run `npm run tasks:check` after adding any repair dependencies.

## Handoff

BT-063 found a repeatable native continuation fixture reload stall, also
reproduced with the pre-camera-change Scene. BT-064 records the evidence and
required investigation. Production-world checkpoint recovery and exact reload
still pass, but that does not replace the failed fixture or certify launch
platforms. BT-064 is unapproved backlog, not an automatically dispatched fix.

## Result

Pending.
