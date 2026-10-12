---
{
  "id": "BT-044",
  "title": "Prevent stale saves and coordinate one resumable run across tabs",
  "type": "bug",
  "status": "done",
  "priority": "P1",
  "depends_on": ["BT-042", "BT-043"],
  "parent": "BT-024",
  "scope": ["application/storage.ts", "application/run-storage.ts", "application/indexeddb.ts", "application/run-snapshot.ts", "application/json.ts", "tests/run-storage.test.ts", "tests/browser/run-storage.ts", "docs/ARCHITECTURE.md"],
  "approval": "2026-10-10 user approved BT-038 implementation; on 2026-10-11 explicitly approved IndexedDB transactional persistence with asynchronous commits, retaining Web Locks for ownership and adding BT-062 launch-platform qualification.",
  "assignment": null,
  "blocked_reason": null
}
---
# BT-044: Prevent stale saves and coordinate one resumable run across tabs

## Problem

A reproduced stale-session write deletes records saved since boot. Adding live
snapshots without ownership would also let tabs overwrite or resurrect runs.

## Scope

Provide tested storage APIs for latest-state record merging, active-run ownership,
snapshot commits and completion. Use real browser coordination, not a racy
localStorage flag. IndexedDB transactions are the durable authority; Web Locks
retain one active owner. Successful writes mean transaction completion, not
merely queuing a request. Main-game lifecycle wiring is BT-045.

## Acceptance criteria

- [x] Independent record updates and stale writers preserve every best/deathless fact.
- [x] Only one tab owns a resumable run; another cannot silently overwrite it or start from a stale copy.
- [x] Ownership survives ordinary pause and is recoverable after the owner closes or terminates.
- [x] Completion commits its result and retires the active snapshot atomically or idempotently by run ID.
- [x] Ownership is held during play; saving on exit does not depend on acquiring a new asynchronous lock.
- [x] Missing coordination/storage support and quota/corruption failures produce explicit outcomes, never false persistence success.

## Implementation context

Implementation approved; review reproduction evidence is `artifacts/browser-check/run-j4Shej`.
BT-042 supplies snapshot validation and BT-043 supplies merge rules. Browser
Web Locks are a recommended implementation on supported secure origins.
The user approved the IndexedDB revision after real Chromium disproved
cross-tab localStorage coherence. Operations may commit asynchronously; errors
must be visible, and unload is not a durability guarantee. BT-062 qualifies
every selected launch platform and any required alternative.
If unavailable, use an equally tested alternative or visibly disable unsafe
shared persistence; do not pretend an unsupported lock is safe.
No backend, dependency or claims of tamper-proof scores.

## Verification

TDD for storage errors and transactions in `tests/run-storage.test.ts`.
After `npm test` and `npm run build`, run the new
`node tests/browser/run-storage.ts` with two actual isolated-browser tabs,
overlapping writes, owner disappearance and replayed completion commits.
Record exact retained records and ownership outcomes.

## Handoff

- Summary: IndexedDB transactional authority implemented by worker
  a64560e7-d8f8-42e8-a963-4f119bb2b2a2 and returned for review.
- Changes: New narrow IndexedDB adapter; async FIFO lease APIs; release drains
  started transactions and rejects queued/new operations; atomic completion,
  one-time legacy import and original-byte recovery export. Unit/native tests
  and architecture/API documentation updated; game UI is not wired here.
- Verification: RED async commit/release, recovery export and quota classification;
  final 21 storage tests, full 315 tests and build pass. Native two-tab run
  `artifacts/run-storage/run-qUBZx4/report.json` verifies closure/termination,
  atomic abort after put success, latest reads, corruption and no resurrection.
- Risks: Native quota probe was skipped: Chromium acknowledged CDP quota override
  but still committed the bounded probe. Unit quota failures and native aborts
  pass; real per-platform quota coverage remains BT-062. Tombstones are retained
  permanently and the size bound fails explicitly. No destructive reset API.
- Commit: None; integrated serial-primary working-tree changes, prior edits retained.
- Resources: Owned browser, renderer, CDP connections, profile and preview cleaned up.
- Decisions: IndexedDB alone is authority after one-time import; legacy
  localStorage bytes remain untouched. Older app versions must be closed/reloaded
  before migration. Writes resolve only after transaction completion.

### Superseded localStorage attempt and architecture decision

IndexedDB rework assigned on 2026-10-11 following explicit user approval.
The prior synchronous worker cannot receive follow-up messages; its work is
retained for a bounded transactional-adapter implementation.
Serial-primary, one code writer, same preserved
working tree; no commits. The failed first attempt below is retained as evidence,
not acceptance. Replace its provisional APIs and rerun the native failure case.

- Summary: Partial implementation; native browser coherence regression blocks acceptance.
- Changes: Provisional `application/run-storage.ts`, shared `application/json.ts`,
  reused parser in snapshot/records, unit/native browser tests and architecture docs.
- Verification: Unit RED then targeted 36/36, full 306/306, build and diff checks
  pass. Native multi-tab runner FAILS: after quota recovery and lock handoff,
  the new owner sees the preceding envelope, then receives newer bytes later.
  Evidence: `artifacts/run-storage/run-T2bbUw/report.json`.
- Risks: Web Locks serialize cooperating code but did not establish localStorage
  cache coherence in this browser. No sleeps/retries have been used to disguise
  the failure. Do not wire this provisional API into gameplay.
- Commit: None; serial-primary changes preserved, not accepted.
- Resources: Owned Chromium, verified renderer PID, CDP connections, profile and
  preview all cleaned up; no code writer remains running.
- Decisions: Propose IndexedDB transactional authority with asynchronous commits
  and existing Web Locks for active-run ownership. The latest committed snapshot
  remains the crash-recovery boundary; no unload-write durability promise.

## Result

- Summary: Accepted after direct review of the transaction adapter, lease
  lifecycle and migration. The original coherence failure is resolved without
  delay-based workarounds. This is API acceptance, not full platform certification.
- Verification: Orchestrator reran 45 storage/snapshot/record tests and native
  browser checks independently. `artifacts/run-storage/run-0QxLij/report.json`
  confirms immediate latest reads, recovery at ticks 73/111, atomic abort,
  corruption retention and cleanup. Native quota remains explicitly unverified;
  unit quota and native abort evidence are not mislabeled as that coverage.
- Integration: Accepted uncommitted master working-tree changes. BT-045 still
  owns consumer migration, honest saving UI and browser lifecycle wiring.
