import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { RunContinuation, shouldSave } from '../application/run-continuation.ts';
import type { RunLease, RunView, Result } from '../application/run-storage.ts';
import { createRunSnapshot } from '../application/run-snapshot.ts';
import { createState, step, STILL } from '../core/simulation.ts';
import { readWorldRecords } from '../application/storage.ts';
import { worldFixture } from './fixtures/world.ts';

const world = worldFixture();
const initial: RunView = { active: null, records: readWorldRecords(null) };
const snapshot = (id: string, ticks = 0) => {
  let state = createState(world);
  while (state.tick < ticks) state = step(world, state, STILL);
  return createRunSnapshot(world, id, state);
};
function fixture() {
  const calls: string[] = [];
  let finish!: (value: Result<RunView>) => void;
  const barrier = () => {
    let resolve!: () => void;
    const promise = new Promise<void>(ready => { resolve = ready; });
    return { promise, resolve };
  };
  let started = barrier();
  const unused = async (): Promise<never> => { throw new Error('Unexpected lease operation'); };
  const lease: RunLease = {
    initial,
    replace: async () => {
      calls.push('replace');
      return new Promise<Result<RunView>>(resolve => { finish = resolve; started.resolve(); });
    },
    save: async () => { calls.push('save'); return { status: 'ok', value: initial } as const; },
    release: async () => { calls.push('release'); },
    read: unused, complete: unused, mergeRecords: unused,
    readLegacy: unused, recordLegacyFinish: unused, writeLegacyDraft: unused,
  };
  const run = new RunContinuation(lease);
  return { run, calls, started: () => started.promise, finish: (value: Result<RunView>) => {
    started = barrier();
    finish(value);
  } };
}
test('Continuation_TickZeroCommitsBeforeQueuedSnapshot_StatusWaitsForCompletion', async () => {
  const f = fixture();
  const replacing = f.run.replace(snapshot('new'));
  const saving = f.run.save(snapshot('new', 120));
  await Promise.resolve();
  assert.deepEqual(f.calls, ['replace']);
  assert.equal(f.run.status.phase, 'saving');
  f.finish({ status: 'ok', value: { ...initial, active: snapshot('new') } });
  await replacing; await saving;
  assert.deepEqual(f.calls, ['replace', 'save']);
  assert.equal(f.run.status.phase, 'saved');
});
test('Continuation_PagehideDrainsMeaningfulQueuedBoundaryBeforeLeaseRelease', async () => {
  const f = fixture();
  const replacing = f.run.replace(snapshot('new'));
  const saving = f.run.save(snapshot('new', 120));
  const closing = f.run.close();
  assert.equal((await f.run.save(snapshot('new', 121))).status, 'released');
  await Promise.resolve();
  f.finish({ status: 'ok', value: initial });
  await replacing; await saving; await closing;
  assert.deepEqual(f.calls, ['replace', 'save', 'release']);
  assert.equal(f.run.status.phase, 'closed');
});
test('Continuation_FailureIsVisibleAndRetryRetainsExactOperation', async () => {
  const f = fixture();
  const pending = f.run.replace(snapshot('new'));
  await Promise.resolve();
  f.finish({ status: 'storage-error', reason: 'QuotaExceededError' });
  await pending;
  assert.equal(f.run.status.phase, 'error');
  assert.match(f.run.status.reason!, /Quota/);
  const retry = f.run.retry();
  await f.started();
  f.finish({ status: 'ok', value: { ...initial, active: snapshot('new') } });
  await retry;
  assert.equal(f.run.status.phase, 'saved');
  assert.deepEqual(f.calls, ['replace', 'replace']);
});
test('Continuation_RetryOrdersFailedReplaceBeforeNewlyEnqueuedSave', async () => {
  const f = fixture(), pending = f.run.replace(snapshot('new'));
  await f.started();
  f.finish({ status: 'storage-error', reason: 'QuotaExceededError' });
  await pending;
  const retry = f.run.retry(), saving = f.run.save(snapshot('new', 120));
  await f.started();
  f.finish({ status: 'ok', value: { ...initial, active: snapshot('new') } });
  await retry; await saving;
  assert.deepEqual(f.calls, ['replace', 'replace', 'save']);
  assert.equal(f.run.status.phase, 'saved');
});
test('Continuation_BoundariesIncludeDeathRespawnCheckpointWinAnd120Ticks', () => {
  const before = createState(world);
  assert.equal(shouldSave(before, { ...before, tick: 1 }), false);
  for (const event of ['death', 'checkpoint', 'win'] as const)
    assert.equal(shouldSave(before, { ...before, tick: 1, event }), true);
  assert.equal(shouldSave(before, { ...before, tick: 120 }), true);
  assert.equal(shouldSave({ ...before, respawnTicks: 1 }, { ...before, tick: 1 }), true);
});

test('Continuation_CheckpointModeLegalPlaySavesOnlyCollectionsDeathAndWin_NotPeriodicOrRespawn', () => {
  const checkpoint = worldFixture({ puzzleMode: 'checkpoint', hazards: [] });
  let state = createState(checkpoint), saves = 0, periodic = 0;
  for (let i = 0; i < 360; i++) {
    const next = step(checkpoint, state, STILL);
    assert.equal(shouldSave(state, next, checkpoint), false);
    if (shouldSave(state, next, world)) periodic++;
    state = next;
  }
  assert.equal(periodic, 3, 'legacy periodic behavior remains');
  while (!state.won) {
    const next = step(checkpoint, state, { x: 1, y: 0 });
    if (shouldSave(state, next, checkpoint)) { saves++; assert.ok(['checkpoint', 'win'].includes(next.event)); }
    state = next;
  }
  assert.equal(saves, 3);
  assert.equal(shouldSave(state, state, checkpoint), false);
  const tiles = [...checkpoint.tiles]; tiles[2] = '#.!....................#';
  const lethal = worldFixture({ puzzleMode: 'checkpoint', hazards: [], tiles });
  state = createState(lethal); saves = 0;
  while (!state.respawnTicks) {
    const next = step(lethal, state, { x: 1, y: 0 });
    if (shouldSave(state, next, lethal)) saves++;
    state = next;
  }
  assert.equal(saves, 1);
  while (state.respawnTicks) {
    const next = step(lethal, state, STILL);
    assert.equal(shouldSave(state, next, lethal), false, 'including respawn completion');
    state = next;
  }
});

test('Continuation_PresentationWiringSeparatesCheckpointRestartAndConfirmedNewRun', () => {
  // Source-level wiring guard only; BT-067 exercises the native browser actions.
  const main = readFileSync(new URL('../presentation/main.ts', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /id="new-run"/);
  assert.match(main, /shouldSave\(before, state, level\)/);
  assert.match(main, /continuation\.save\(createCheckpointSnapshot\(level, currentRunId, state\)\)/);
  assert.match(main, /state = restartCheckpoint\(level, state\)/);
  assert.match(main, /text\('retry-course', benchmark && state\.won \? 'New trial ↻' : checkpointPuzzles\(level\) && !state\.won \? 'Restart puzzle ↻'/);
  assert.match(main, /level\.version === 2 && \(!testing \|\| checkpointPuzzles\(level\)\) \? 'New run ↻'/);
  assert.match(main, /course\.id === 'aftershock' && checkpointPuzzles\(course\) && course\.revision === 2/);
  assert.match(main, /element\('new-run'\)\.addEventListener\('click'/);
});
