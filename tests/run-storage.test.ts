import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createState, restartCheckpoint, step, STILL } from '../core/simulation.ts';
import { createCheckpointSnapshot, createRunSnapshot, type RunSnapshot } from '../application/run-snapshot.ts';
import { RunContinuation, shouldSave } from '../application/run-continuation.ts';
import { createRunStorage, RUN_STORAGE_KEY, MAX_RUN_STORAGE_BYTES,
  openBrowserRunStorage, type LockPort, type StoragePort, type Result } from '../application/run-storage.ts';
import { DRAFT_KEY, PROGRESS_KEY, readProgress, readWorldRecords, recordWorldFinish,
  getWorldRecord } from '../application/storage.ts';
import { worldFixture } from './fixtures/world.ts';
import { createIndexedDBPort, PersistenceError, type Transaction, type TransactionPort } from '../application/indexeddb.ts';

const world = worldFixture();
const resolveWorld = (id: string, revision: number) => id === world.id && revision === world.revision ? world : undefined;
const snapshot = (id = 'run-a', ticks = 0) => {
  let state = createState(world);
  for (let i = 0; i < ticks; i++) state = step(world, state, STILL);
  return createRunSnapshot(world, id, state);
};
const finish = (id = 'run-a') => {
  let state = createState(world);
  while (!state.won) state = step(world, state, { x: 1, y: 0 });
  return createRunSnapshot(world, id, state);
};
function ok<T>(result: Result<T>): T {
  if (result.status !== 'ok') assert.fail(JSON.stringify(result));
  return result.value;
}
class Memory implements StoragePort, TransactionPort {
  data = new Map<string, string | null>();
  failRead = false;
  failWrite = false;
  writes = 0;
  deferCommit = false;
  abortCommit = false;
  commit = () => {};
  private notify = () => {};
  private requestReady = new Promise<void>(resolve => { this.notify = resolve; });
  requested() { return this.requestReady; }
  close() {}
  async transact<T>(_keys: readonly string[], action: (tx: Transaction) => T): Promise<T> {
    if (this.failRead) throw new PersistenceError('storage denied');
    const pending = new Map(this.data);
    let writes = 0;
    const value = action({
      get: key => pending.get(key),
      put: (key, source) => {
        if (this.failWrite) throw new PersistenceError('QuotaExceededError');
        writes++;
        pending.set(key, source);
      },
    });
    if (this.deferCommit) {
      const completion = new Promise<void>(resolve => { this.commit = resolve; });
      this.notify();
      await completion;
    }
    if (this.abortCommit) throw new PersistenceError('AbortError after successful requests');
    this.data = pending;
    this.writes += writes;
    return value;
  }
  getItem(key: string) {
    if (this.failRead) throw new Error('storage denied');
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (this.failWrite) throw new DOMException('full', 'QuotaExceededError');
    this.writes++;
    this.data.set(key, value);
  }
}
class Locks implements LockPort {
  held = false;
  async request(_name: string, _options: { mode: 'exclusive'; ifAvailable: true },
    callback: (lock: object | null) => Promise<void>) {
    if (this.held) return callback(null);
    this.held = true;
    try { await callback({}); } finally { this.held = false; }
  }
}
function fixture() {
  const storage = new Memory(), legacyStorage = new Memory(), locks = new Locks();
  const a = createRunStorage({ database: storage, legacyStorage, locks }, resolveWorld);
  const b = createRunStorage({ database: storage, legacyStorage, locks }, resolveWorld);
  return { storage, legacyStorage, locks, a, b };
}

test('ObsoleteActive_ExplicitIdentityPolicyDeletesOnlyActiveAndRetiresIdUnderOwnership', async () => {
  const { a, storage, legacyStorage, locks } = fixture();
  legacyStorage.data.set(DRAFT_KEY, 'untouched draft');
  const lease = ok(await a.acquire());
  ok(await lease.replace(snapshot()));
  const records = recordWorldFinish(readWorldRecords(null), world, 800, 2);
  ok(await lease.mergeRecords(records));
  const revised = worldFixture({ revision: 2, puzzleMode: 'checkpoint', hazards: [] });
  const resolver = (id: string, revision: number) => id === revised.id && revision === 2 ? revised : undefined;
  const obsolete = [{ worldId: world.id, revision: 1 }];
  const next = createRunStorage({ database: storage, locks }, resolver, obsolete);
  const before = new Map(storage.data);
  assert.equal((await next.acquire()).status, 'busy');
  assert.deepEqual(storage.data, before);
  await lease.release();
  const owner = ok(await next.acquire());
  assert.equal(owner.initial.active, null);
  assert.deepEqual(owner.initial.records, records);
  assert.equal(storage.data.get(DRAFT_KEY), 'untouched draft');
  assert.equal(storage.data.get(PROGRESS_KEY), before.get(PROGRESS_KEY));
  assert.equal(storage.data.has('boundstoy.recovery.v1'), false, 'no obsolete-save archive');
  const oldId = createCheckpointSnapshot(revised, 'run-a', createState(revised));
  assert.equal((await owner.replace(oldId)).status, 'retired', 'old ID cannot resurrect under the new revision');
  assert.equal((await owner.save(oldId)).status, 'stale');
  await owner.release();
});

test('ObsoleteActive_AbortOrWriteFailureRetainsAllSourceBytesAndCanRetry', async () => {
  for (const failure of ['abortCommit', 'failWrite'] as const) {
    const { a, storage, locks } = fixture();
    const lease = ok(await a.acquire());
    ok(await lease.replace(snapshot()));
    ok(await lease.mergeRecords(recordWorldFinish(readWorldRecords(null), world, 800, 0)));
    ok(await lease.writeLegacyDraft('keep draft'));
    await lease.release();
    const before = new Map(storage.data);
    const next = createRunStorage({ database: storage, locks }, () => undefined,
      [{ worldId: world.id, revision: world.revision }]);
    storage[failure] = true;
    assert.equal((await next.acquire()).status, 'storage-error');
    assert.deepEqual(storage.data, before);
    assert.equal(locks.held, false);
    storage[failure] = false;
    const owner = ok(await next.acquire());
    assert.equal(owner.initial.active, null);
    await owner.release();
  }
});

test('ObsoleteActive_UnrelatedUnavailableAndMalformedSourcesRemainExplicitErrors', async () => {
  const { a, storage, locks } = fixture();
  const lease = ok(await a.acquire()); ok(await lease.replace(snapshot())); await lease.release();
  const source = storage.data.get(RUN_STORAGE_KEY)!;
  const raw = JSON.parse(source);
  const policy = createRunStorage({ database: storage, locks }, () => undefined,
    [{ worldId: world.id, revision: 1 }]);
  for (const [active, status] of [
    [raw.active.replace('"revision":1', '"revision":3'), 'incompatible'],
    [raw.active.replace('"runId":"run-a"', '"runId":""'), 'corrupt'],
    [raw.active.replace('"revision":1', '"revision":1,"revision":1'), 'corrupt'],
    [raw.active.replace('"schemaVersion":1', '"schemaVersion":2'), 'unsupported'],
    [raw.active.replace('"schemaVersion":1', '"schemaVersion":2,"future":true'), 'unsupported'],
    ['{broken', 'corrupt'],
  ]) {
    const bytes = JSON.stringify({ ...raw, active });
    storage.data.set(RUN_STORAGE_KEY, bytes);
    assert.equal((await policy.acquire()).status, status);
    assert.equal(storage.data.get(RUN_STORAGE_KEY), bytes);
    assert.equal(locks.held, false);
  }
  storage.data.set(RUN_STORAGE_KEY, source);
  const noPolicy = createRunStorage({ database: storage, locks }, () => undefined);
  assert.equal((await noPolicy.acquire()).status, 'incompatible', 'default policy discards nothing');
});

test('CheckpointDurability_QueueWritesLegalBoundariesAndPauseOnly_SameTickRestartIsIdempotent', async () => {
  const checkpoint = worldFixture({ puzzleMode: 'checkpoint', hazards: [] });
  const storage = new Memory(), locks = new Locks();
  const api = createRunStorage({ database: storage, locks }, () => checkpoint);
  const run = new RunContinuation(ok(await api.acquire()));
  let state = createState(checkpoint);
  ok(await run.replace(createCheckpointSnapshot(checkpoint, 'checkpoint-run', state)));
  const initialWrites = storage.writes;
  for (let i = 0; i < 300; i++) {
    const next = step(checkpoint, state, { x: 1, y: 0 });
    if (shouldSave(state, next, checkpoint))
      ok(await run.save(createCheckpointSnapshot(checkpoint, 'checkpoint-run', next)));
    state = next;
  }
  assert.equal(storage.writes, initialWrites + 1, 'one checkpoint, no periodic writes');
  const durable = createCheckpointSnapshot(checkpoint, 'checkpoint-run', state);
  ok(await run.save(durable)); // pause / leaving
  const pauseWrites = storage.writes;
  state = restartCheckpoint(checkpoint, state);
  ok(await run.save(createCheckpointSnapshot(checkpoint, 'checkpoint-run', state)));
  assert.equal(storage.writes, pauseWrites, 'same-tick restart is identical, not a stale-guard exception');
  const exact = createRunSnapshot(checkpoint, 'checkpoint-run', { ...state, position: { x: state.position.x + 0.1, y: state.position.y } });
  assert.equal((await run.lease.save(exact)).status, 'stale');
  await run.close();
  const resumed = ok(await api.acquire());
  assert.deepEqual(resumed.initial.active, durable);
  await resumed.release();
});

test('CheckpointDurability_DeathFailureRetryAndRespawnKeepHonestTotalsWithoutExtraWrites', async () => {
  const tiles = [...world.tiles]; tiles[2] = '#.!....................#';
  const checkpoint = worldFixture({ puzzleMode: 'checkpoint', hazards: [], tiles });
  const storage = new Memory(), locks = new Locks();
  const api = createRunStorage({ database: storage, locks }, () => checkpoint);
  const run = new RunContinuation(ok(await api.acquire()));
  let state = createState(checkpoint);
  const save = () => createCheckpointSnapshot(checkpoint, 'death-run', state);
  ok(await run.replace(save()));
  while (!state.respawnTicks) state = step(checkpoint, state, { x: 1, y: 0 });
  const dead = structuredClone(state), bytes = storage.data.get(RUN_STORAGE_KEY);
  storage.abortCommit = true;
  assert.equal((await run.save(save())).status, 'storage-error');
  assert.equal(storage.data.get(RUN_STORAGE_KEY), bytes);
  assert.deepEqual(state, dead, 'saving death never teleports the live player');
  storage.abortCommit = false;
  ok(await run.retry());
  assert.equal(run.view.active?.state.deaths, 1);
  assert.equal(run.view.active?.state.deathCause, 'spikes');
  assert.equal(run.view.active?.state.respawnTicks, 0);
  const writes = storage.writes;
  while (state.respawnTicks) {
    const next = step(checkpoint, state, STILL);
    if (shouldSave(state, next, checkpoint))
      ok(await run.save(createCheckpointSnapshot(checkpoint, 'death-run', next)));
    state = next;
  }
  assert.equal(storage.writes, writes, 'no respawn countdown/completion writes');
  assert.equal(state.patternOffset, 0, 'live death keeps the pattern running');
  ok(await run.save(save())); // pause at recovered spawn
  const normalized = run.view.active!;
  state = restartCheckpoint(checkpoint, state);
  ok(await run.save(save()));
  assert.deepEqual(run.view.active, normalized);
  assert.equal((await run.lease.save(createCheckpointSnapshot(checkpoint, 'death-run',
    { ...state, tick: state.tick + 1, deaths: 0, deathCause: null }))).status, 'stale');
  // Legally go around the spike, collect both checkpoints, then finish.
  for (let i = 0; i < 60; i++) state = step(checkpoint, state, { x: 0, y: 1 });
  for (let i = 0; i < 150; i++) state = step(checkpoint, state, { x: 1, y: 0 });
  for (let i = 0; i < 60; i++) state = step(checkpoint, state, { x: 0, y: -1 });
  while (!state.won) state = step(checkpoint, state, { x: 1, y: 0 });
  ok(await run.save(save()));
  assert.equal(run.view.active, null);
  assert.deepEqual(getWorldRecord(run.view.records, checkpoint), { ticks: state.tick, deaths: 1 });
  assert.equal(getWorldRecord(run.view.records, checkpoint)?.cleanTicks, undefined);
  await run.close();
});

test('ObsoleteActive_TransactionCompletionIsRequiredAndKnownCorruptionIsNeverDiscarded', async () => {
  const { a, storage, locks } = fixture();
  const lease = ok(await a.acquire()); ok(await lease.replace(snapshot())); await lease.release();
  const source = storage.data.get(RUN_STORAGE_KEY)!;
  const raw = JSON.parse(source);
  const policy = createRunStorage({ database: storage, locks }, resolveWorld,
    [{ worldId: world.id, revision: 1 }]);
  const corrupt = JSON.stringify({ ...raw, active: raw.active.replace('"tick":0', '"tick":-1') });
  storage.data.set(RUN_STORAGE_KEY, corrupt);
  assert.equal((await policy.acquire()).status, 'corrupt');
  assert.equal(storage.data.get(RUN_STORAGE_KEY), corrupt);
  storage.data.set(RUN_STORAGE_KEY, source);
  storage.deferCommit = true;
  let settled = false;
  const acquisition = policy.acquire().then(value => { settled = true; return value; });
  await storage.requested();
  assert.equal(settled, false);
  assert.equal(storage.data.get(RUN_STORAGE_KEY), source);
  assert.equal((await a.acquire()).status, 'busy');
  storage.commit();
  const owner = ok(await acquisition);
  assert.equal(owner.initial.active, null);
  await owner.release();
});

test('Recovery_ExplicitResetArchivesExactBytesAtomicallyAndLeavesLegacyUntouched', async () => {
  const { a, storage, legacyStorage } = fixture();
  storage.data.set(RUN_STORAGE_KEY, 'broken original');
  legacyStorage.setItem(PROGRESS_KEY, '{"version":99,"future":"keep"}');
  legacyStorage.setItem(DRAFT_KEY, 'old draft bytes');
  assert.equal((await a.acquire()).status, 'corrupt');
  const before = ok(await a.exportRecovery());
  storage.abortCommit = true;
  assert.equal((await a.resetRecovery()).status, 'storage-error');
  storage.abortCommit = false;
  assert.deepEqual(ok(await a.exportRecovery()), before);
  ok(await a.resetRecovery());
  const recovered = ok(await a.exportRecovery());
  assert.equal(recovered[RUN_STORAGE_KEY], null);
  assert.equal(recovered[PROGRESS_KEY], before[PROGRESS_KEY]);
  assert.equal(recovered[DRAFT_KEY], before[DRAFT_KEY]);
  assert.match(recovered['boundstoy.recovery.v1']!, /broken original/);
  const lease = ok(await a.acquire());
  assert.equal((await lease.readLegacy()).status, 'corrupt');
  await lease.release();
});
test('Recovery_BusyOrOversizedArchive_NeverResetsAndRepeatedResetsRetainPriorBytes', async () => {
  const { a, b, storage } = fixture();
  const lease = ok(await a.acquire());
  assert.equal((await b.resetRecovery()).status, 'busy');
  await lease.release();
  const oversized = 'x'.repeat(MAX_RUN_STORAGE_BYTES);
  storage.data.set(RUN_STORAGE_KEY, oversized);
  assert.equal((await a.resetRecovery()).status, 'too-large');
  assert.equal(storage.data.get(RUN_STORAGE_KEY), oversized);
  assert.equal(storage.data.has('boundstoy.recovery.v1'), false);
  storage.data.set(RUN_STORAGE_KEY, 'first original');
  ok(await a.resetRecovery());
  const first = storage.data.get('boundstoy.recovery.v1');
  storage.data.set(RUN_STORAGE_KEY, 'second original');
  ok(await a.resetRecovery());
  const archive = JSON.parse(storage.data.get('boundstoy.recovery.v1')!);
  assert.equal(archive.previous, first);
  assert.equal(archive.sources[RUN_STORAGE_KEY], 'second original');
});

test('Transactions_RequestSuccessIsNotCommit_ReleaseWaitsAndCancelsQueuedOperations', async () => {
  const { a, b, storage, locks } = fixture();
  const lease = ok(await a.acquire());
  storage.deferCommit = true;
  let settled = false;
  const first = lease.replace(snapshot()).then(value => { settled = true; return value; });
  await storage.requested();
  assert.equal(settled, false);
  assert.equal(storage.getItem(RUN_STORAGE_KEY), null);
  const queued = lease.save(snapshot('run-a', 1));
  const release = lease.release();
  assert.equal(locks.held, true);
  assert.equal((await b.acquire()).status, 'busy');
  storage.commit();
  ok(await first);
  assert.equal((await queued).status, 'released');
  await release;
  assert.equal((await lease.read()).status, 'released');
  storage.deferCommit = false;
  const next = ok(await b.acquire());
  assert.equal(next.initial.active?.state.tick, 0);
  await next.release();
});

test('Transactions_AbortAfterRequestsNeverReportsSuccess_QueueReadsLastCommittedState', async () => {
  const { a, storage } = fixture();
  const lease = ok(await a.acquire());
  ok(await lease.replace(snapshot()));
  storage.abortCommit = true;
  assert.equal((await lease.complete(finish())).status, 'storage-error');
  storage.abortCommit = false;
  assert.equal(ok(await lease.read()).active?.runId, 'run-a');
  const results = await Promise.all([lease.save(snapshot('run-a', 10)), lease.save(snapshot('run-a', 20))]);
  results.forEach(ok);
  assert.equal(ok(await lease.read()).active?.state.tick, 20);
  await lease.release();
});

test('Transactions_ReleaseDuringAbortingCommit_HoldsLockUntilAbortAndPreservesLastSave', async () => {
  const { a, b, storage, locks } = fixture(), lease = ok(await a.acquire());
  ok(await lease.replace(snapshot()));
  storage.deferCommit = true;
  storage.abortCommit = true;
  const pending = lease.save(snapshot('run-a', 10));
  await storage.requested();
  const release = lease.release();
  assert.equal((await b.acquire()).status, 'busy');
  assert.equal(locks.held, true);
  storage.commit();
  assert.equal((await pending).status, 'storage-error');
  await release;
  storage.deferCommit = false;
  storage.abortCommit = false;
  const next = ok(await b.acquire());
  assert.equal(next.initial.active?.state.tick, 0);
  await next.release();
});

test('Ownership_PauseBlocksAllWriters_ReleaseInvalidatesOldCapabilityAndReadsLatest', async () => {
  const { a, b } = fixture();
  const first = ok(await a.acquire());
  assert.equal(first.initial.active, null);
  ok(await first.replace(snapshot()));
  ok(await first.save(snapshot('run-a', 21)));
  assert.equal((await b.acquire()).status, 'busy');
  assert.equal((await b.mergeRecords(readWorldRecords(null))).status, 'busy');
  await first.release();
  const second = ok(await b.acquire());
  assert.equal(second.initial.active?.state.tick, 21);
  assert.equal((await first.save(snapshot('run-a', 22))).status, 'released');
  assert.equal((await first.replace(snapshot('run-b'))).status, 'released');
  await second.release();
});

test('Records_OverlappingAndStaleInputs_JoinLatestBestCleanAndOtherWorldFacts', async () => {
  const { a, b } = fixture();
  const fast = recordWorldFinish(readWorldRecords(null), world, 800, 4);
  const clean = recordWorldFinish(readWorldRecords(null), world, 1000, 0);
  const results = await Promise.all([a.mergeRecords(fast), b.mergeRecords(clean)]);
  for (let i = 0; i < results.length; i++) if (results[i].status === 'busy')
    ok(await [a, b][i].mergeRecords([fast, clean][i]));
  ok(await a.mergeRecords(recordWorldFinish(fast, { ...world, id: 'other' }, 700, 1)));
  const lease = ok(await b.acquire());
  assert.deepEqual(getWorldRecord(lease.initial.records, world), { ticks: 800, deaths: 4, cleanTicks: 1000 });
  assert.deepEqual(getWorldRecord(lease.initial.records, { ...world, id: 'other' }), { ticks: 700, deaths: 1 });
  await lease.release();
});

test('Snapshot_SaveCannotCreateOrReplace_RejectsBackwardsTicksDeathsHistoryAndEqualTickChanges', async () => {
  const { a } = fixture();
  const lease = ok(await a.acquire());
  assert.equal((await lease.save(snapshot())).status, 'stale');
  ok(await lease.replace(snapshot()));
  ok(await lease.save(snapshot('run-a', 100)));
  assert.equal((await lease.save(snapshot('run-b', 101))).status, 'stale');
  assert.equal((await lease.save(snapshot('run-a', 99))).status, 'stale');
  const changed = { ...snapshot('run-a', 100), state: { ...snapshot('run-a', 100).state, position: { x: 2, y: 2.5 } } };
  assert.equal((await lease.save(changed)).status, 'stale');
  const assisted: RunSnapshot = { ...snapshot('run-a', 100), state: {
    ...snapshot('run-a', 100).state, deaths: 1, deathCause: 'pulse' } };
  ok(await lease.replace(snapshot('run-b')));
  ok(await lease.save({ ...assisted, runId: 'run-b', state: { ...assisted.state, tick: 101 } }));
  assert.equal((await lease.save(snapshot('run-b', 102))).status, 'stale');
  await lease.release();
});

test('Snapshot_CodecKeepsNegativeZero_ReplacementRetiresOldIdPermanently', async () => {
  const { a } = fixture();
  const lease = ok(await a.acquire());
  const exact = { ...snapshot(), state: { ...snapshot().state, velocity: { x: -0, y: 0 } } };
  ok(await lease.replace(exact));
  assert.ok(Object.is(ok(await lease.read()).active?.state.velocity.x, -0));
  ok(await lease.replace(snapshot('run-b')));
  assert.equal((await lease.replace(snapshot())).status, 'retired');
  assert.equal((await lease.save(snapshot('run-a', 20))).status, 'stale');
  await lease.release();
});

test('Completion_OneAtomicWriteRetiresActive_ReplayIsIdempotentAndCannotResurrect', async () => {
  const { a, b, storage } = fixture();
  const lease = ok(await a.acquire());
  ok(await lease.replace(snapshot()));
  const won = finish(), before = storage.writes;
  ok(await lease.complete(won));
  assert.equal(storage.writes, before + 1);
  assert.equal(ok(await lease.read()).active, null);
  assert.deepEqual(getWorldRecord(ok(await lease.read()).records, world), { ticks: won.state.tick, deaths: 0 });
  ok(await lease.complete(won));
  assert.equal(storage.writes, before + 1);
  assert.equal((await lease.save(snapshot('run-a', 20))).status, 'stale');
  assert.equal((await lease.replace(snapshot())).status, 'retired');
  await lease.release();
  const next = ok(await b.acquire());
  ok(await next.complete(won));
  ok(await next.replace(snapshot('run-b')));
  ok(await next.complete(won));
  assert.equal(ok(await next.read()).active?.runId, 'run-b');
  assert.equal((await next.complete({ ...won, state: { ...won.state, tick: won.state.tick + 1 } })).status, 'retired');
  await next.release();
});

test('Completion_QuotaFailureLeavesBothRecordsAndActiveUnchanged_ThenCanRetry', async () => {
  const { a, storage } = fixture();
  const lease = ok(await a.acquire());
  ok(await lease.replace(snapshot()));
  const before = storage.getItem(RUN_STORAGE_KEY);
  storage.failWrite = true;
  assert.equal((await lease.complete(finish())).status, 'storage-error');
  assert.equal(storage.getItem(RUN_STORAGE_KEY), before);
  storage.failWrite = false;
  ok(await lease.complete(finish()));
  await lease.release();
});

test('CorruptUnsupportedIncompatibleAndOversizeBytes_ArePreservedAndFailedAcquireReleases', async () => {
  const { a, storage, locks } = fixture();
  const lease = ok(await a.acquire());
  ok(await lease.replace(snapshot()));
  const good = storage.getItem(RUN_STORAGE_KEY)!;
  await lease.release();
  const raw = JSON.parse(good);
  for (const [source, status] of [
    ['{bad', 'corrupt'],
    [good.replace('"version":1', '"version":2'), 'unsupported'],
    [good.replace('"version":1', '"version":1,"\\u0076ersion":1'), 'corrupt'],
    [JSON.stringify({ ...raw, active: raw.active.replace('"revision":1', '"revision":2') }), 'incompatible'],
    [' '.repeat(MAX_RUN_STORAGE_BYTES + 1), 'corrupt'],
  ]) {
    storage.setItem(RUN_STORAGE_KEY, source);
    assert.equal((await a.acquire()).status, status);
    assert.equal(storage.getItem(RUN_STORAGE_KEY), source);
    assert.equal(locks.held, false);
  }
});

test('UnavailableOrThrowingPorts_AreExplicitAndNeverLeakLocks', async () => {
  const { a, storage, locks } = fixture();
  assert.equal((await createRunStorage({ database: storage }, resolveWorld).acquire()).status, 'unsupported');
  assert.equal((await createRunStorage({ locks }, resolveWorld).acquire()).status, 'unsupported');
  storage.failRead = true;
  assert.equal((await a.acquire()).status, 'storage-error');
  assert.equal(locks.held, false);
  storage.failRead = false;
  storage.failWrite = true;
  assert.equal((await a.mergeRecords(readWorldRecords(null))).status, 'storage-error');
  assert.equal(locks.held, false);
  const broken: LockPort = { request: async () => { throw new Error('denied'); } };
  assert.equal((await createRunStorage({ database: storage, locks: broken }, resolveWorld).acquire()).status, 'lock-error');
  assert.equal(openBrowserRunStorage(resolveWorld).status, 'unsupported');
});

test('Snapshot_CheckpointHistoryCannotMoveBackwardsEvenWithANewerTick', async () => {
  const { a } = fixture(), lease = ok(await a.acquire());
  ok(await lease.replace(snapshot()));
  let state = createState(world);
  while (!state.visited.length) state = step(world, state, { x: 1, y: 0 });
  ok(await lease.save(createRunSnapshot(world, 'run-a', state)));
  assert.equal((await lease.save(snapshot('run-a', state.tick + 1))).status, 'stale');
  await lease.release();
});

test('FailureWhileOwning_BytesPreserved_ReleaseStillWorksAndEveryOldMethodIsRejected', async () => {
  const { a, b, storage } = fixture(), lease = ok(await a.acquire());
  ok(await lease.replace(snapshot()));
  storage.setItem(RUN_STORAGE_KEY, '{corrupted while owning');
  assert.equal((await lease.save(snapshot('run-a', 1))).status, 'corrupt');
  assert.equal((await lease.replace(snapshot('run-b'))).status, 'corrupt');
  assert.equal((await lease.mergeRecords(readWorldRecords(null))).status, 'corrupt');
  assert.equal(storage.getItem(RUN_STORAGE_KEY), '{corrupted while owning');
  await lease.release();
  await lease.release();
  for (const answer of await Promise.all([lease.read(), lease.complete(finish()), lease.mergeRecords(readWorldRecords(null)),
    lease.recordLegacyFinish('course', 1, 0), lease.readLegacy(), lease.writeLegacyDraft(null)]))
    assert.equal(answer.status, 'released');
  assert.equal((await b.acquire()).status, 'corrupt');
});

test('Legacy_WritesMergeLatestWithoutResettingUnknownCoursesOrDrafts', async () => {
  const { a, b, storage, legacyStorage } = fixture();
  legacyStorage.setItem(DRAFT_KEY, 'uninterpreted draft');
  const original = '{"version":1,"runs":{"old-course":{"ticks":450,"deaths":0}}}';
  legacyStorage.setItem(PROGRESS_KEY, original);
  ok(await a.recordLegacyFinish('course', 900, 4));
  ok(await b.recordLegacyFinish('course', 1000, 0));
  ok(await a.recordLegacyFinish('course', 950, 2));
  assert.deepEqual(readProgress(storage.getItem(PROGRESS_KEY)), {
    'old-course': { ticks: 450, deaths: 0 }, course: { ticks: 900, deaths: 4, cleanTicks: 1000 },
  });
  assert.equal(storage.getItem(DRAFT_KEY), 'uninterpreted draft');
  assert.equal(legacyStorage.getItem(PROGRESS_KEY), original);
  assert.equal(ok(await a.readLegacy()).draft, 'uninterpreted draft');
  ok(await a.writeLegacyDraft('edited draft'));
  assert.equal(ok(await b.readLegacy()).draft, 'edited draft');
  assert.equal(legacyStorage.getItem(DRAFT_KEY), 'uninterpreted draft');
  legacyStorage.setItem(PROGRESS_KEY, '{stale old app');
  assert.equal((await b.readLegacy()).status, 'ok');
  storage.setItem(PROGRESS_KEY, '{bad');
  assert.equal((await b.recordLegacyFinish('course', 10, 0)).status, 'corrupt');
  assert.equal(storage.getItem(PROGRESS_KEY), '{bad');
});

test('InvalidIncomingValuesOrBoundedSerialization_DoNotWriteAndConvenienceMethodsRelease', async () => {
  const { a, storage, locks } = fixture();
  assert.equal((await a.mergeRecords({} as never)).status, 'invalid');
  assert.equal(locks.held, false);
  assert.equal((await a.recordLegacyFinish('bad!', 0, -1)).status, 'invalid');
  const lease = ok(await a.acquire());
  assert.equal((await lease.replace({ ...snapshot(), runId: '!' })).status, 'invalid');
  assert.equal((await lease.replace(finish())).status, 'invalid');
  const records = { schemaVersion: 1 as const, worldVersion: 2 as const,
    records: Array.from({ length: 16000 }, (_, i) => ({ worldId: `world-${i}`, revision: 1, run: { ticks: 10, deaths: 0 } })) };
  assert.equal((await lease.mergeRecords(records)).status, 'too-large');
  assert.equal(storage.getItem(RUN_STORAGE_KEY), null);
  await lease.release();
});

test('Migration_CorruptBytesRemainExportable_NoResetOrOldProjectionAuthority', async () => {
  const { a, b, storage, legacyStorage, locks } = fixture();
  legacyStorage.setItem(RUN_STORAGE_KEY, '{broken');
  legacyStorage.setItem(PROGRESS_KEY, '{old invalid progress');
  legacyStorage.setItem(DRAFT_KEY, 'original draft');
  assert.equal((await a.acquire()).status, 'corrupt');
  assert.equal(storage.data.size, 0, 'failed initial import is atomic');
  const recovered = ok(await a.exportRecovery());
  assert.equal(recovered[RUN_STORAGE_KEY], '{broken');
  assert.equal(recovered[PROGRESS_KEY], '{old invalid progress');
  assert.equal(recovered[DRAFT_KEY], 'original draft');
  assert.equal(storage.data.size, 0, 'export does not write or mark import complete');
  legacyStorage.data.delete(RUN_STORAGE_KEY);
  const lease = ok(await a.acquire());
  assert.equal((await b.exportRecovery()).status, 'busy');
  assert.equal((await lease.readLegacy()).status, 'corrupt');
  await lease.release();
  assert.equal(locks.held, false);
  assert.equal(ok(await a.exportRecovery())[PROGRESS_KEY], '{old invalid progress');
  legacyStorage.setItem(PROGRESS_KEY, '{"version":1,"runs":{}}');
  assert.equal((await b.readLegacy()).status, 'corrupt', 'old app bytes are no longer authority');
});

test('Migration_DeniedLegacyAccessFailsWithoutCommittingImportMarkers', async () => {
  const { a, legacyStorage, storage, locks } = fixture();
  legacyStorage.failRead = true;
  assert.equal((await a.acquire()).status, 'storage-error');
  assert.equal(storage.data.size, 0);
  assert.equal(locks.held, false);
});

// Small event driver for adapter lifecycle failures; native transaction behaviour
// (including request-success followed by abort) is also checked in Chromium.
function adapterEvents(putError?: Error) {
  let opened!: (request: IDBOpenDBRequest) => void;
  const opening = new Promise<IDBOpenDBRequest>(resolve => { opened = resolve; });
  let read!: (request: IDBRequest) => void;
  const reading = new Promise<IDBRequest>(resolve => { read = resolve; });
  let closes = 0, aborts = 0, puts = 0;
  const tx = {
    onabort: null, onerror: null, oncomplete: null, error: null,
    abort() { aborts++; queueMicrotask(() => tx.onabort?.(new Event('abort'))); },
    objectStore() {
      return {
        get() { const request = { result: null }; queueMicrotask(() => read(request as IDBRequest)); return request; },
        put() { if (putError) throw putError; puts++; },
      };
    },
  } as unknown as IDBTransaction;
  const db = {
    onversionchange: null, onclose: null,
    transaction() { return tx; },
    close() { closes++; },
  } as unknown as IDBDatabase;
  const factory = {
    open() {
      const request = { result: db };
      queueMicrotask(() => opened(request as IDBOpenDBRequest));
      return request;
    },
  } as unknown as IDBFactory;
  const port = createIndexedDBPort(factory);
  return { port, opening, reading, db, tx, counts: () => ({ closes, aborts, puts }) };
}

test('IndexedDB_AdapterWaitsForComplete_NotRequestSuccess', async () => {
  const h = adapterEvents();
  let settled = false;
  const operation = h.port.transact(['key'], tx => { tx.put('key', 'new'); return 'saved'; })
    .then(value => { settled = true; return value; });
  const open = await h.opening;
  open.onsuccess!.call(open, new Event('success'));
  const read = await h.reading;
  read.onsuccess!.call(read, new Event('success'));
  await Promise.resolve();
  assert.equal(h.counts().puts, 1);
  assert.equal(settled, false);
  h.tx.oncomplete!.call(h.tx, new Event('complete'));
  assert.equal(await operation, 'saved');
  assert.equal(h.counts().closes, 1);
});

test('IndexedDB_BlockedOpenRejects_AndClosesLateSuccess', async () => {
  const h = adapterEvents(), operation = h.port.transact(['key'], () => null);
  const rejected = assert.rejects(operation, /blocked/);
  const open = await h.opening;
  open.onblocked!.call(open, {} as IDBVersionChangeEvent);
  await rejected;
  open.onsuccess!.call(open, new Event('success'));
  assert.equal(h.counts().closes, 1);
});

test('IndexedDB_SynchronousPutQuotaException_IsAStorageFailureNotInputValidation', async () => {
  const h = adapterEvents(new DOMException('full', 'QuotaExceededError'));
  const operation = h.port.transact(['key'], tx => tx.put('key', 'new'));
  const rejected = assert.rejects(operation, error => error instanceof PersistenceError && /QuotaExceededError/.test(error.message));
  const open = await h.opening;
  open.onsuccess!.call(open, new Event('success'));
  const read = await h.reading;
  read.onsuccess!.call(read, new Event('success'));
  await rejected;
  assert.equal(h.counts().aborts, 1);
});

test('IndexedDB_OpenErrorVersionchangeConnectionClosureAndTransactionThrow_AreExplicit', async () => {
  for (const scenario of ['open-error', 'versionchange', 'closure', 'transaction-throw', 'async-body']) {
    const h = adapterEvents();
    if (scenario === 'transaction-throw') h.db.transaction = () => { throw new Error('closed connection'); };
    const operation = h.port.transact(['key'], () => scenario === 'async-body' ? Promise.resolve('invalid') : 'value');
    const rejected = assert.rejects(operation, scenario === 'async-body' ? /synchronous/ : /IndexedDB/);
    const open = await h.opening;
    if (scenario === 'open-error') {
      open.onerror!.call(open, new Event('error'));
    } else {
      open.onsuccess!.call(open, new Event('success'));
      if (scenario !== 'transaction-throw') {
        const read = await h.reading;
        read.onsuccess!.call(read, new Event('success'));
        if (scenario === 'versionchange') h.db.onversionchange!.call(h.db, {} as IDBVersionChangeEvent);
        if (scenario === 'closure') h.db.onclose!.call(h.db, new Event('close'));
      }
    }
    await rejected;
  }
  const h = adapterEvents();
  h.port.close();
  await assert.rejects(h.port.transact(['key'], () => null), /closed/);
});
