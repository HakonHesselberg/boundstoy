import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bestClean, readWorldRecords, validateWorldRecords, encodeWorldRecords,
  recordWorldFinish, getWorldRecord, mergeWorldRecords, readProgress, PROGRESS_KEY, DRAFT_KEY,
} from '../application/storage.ts';
import { createRunSnapshot, encodeRunSnapshot, decodeRunSnapshot } from '../application/run-snapshot.ts';
import { createState, step, STILL } from '../core/simulation.ts';
import { worldFixture } from './fixtures/world.ts';

const world = worldFixture();
const empty = () => readWorldRecords(null);
const saved = (ticks: number, deaths: number) => recordWorldFinish(empty(), world, ticks, deaths);
const envelope = (run: unknown) => ({
  schemaVersion: 1, worldVersion: 2, records: [{ worldId: world.id, revision: 1, run }],
});

test('WorldRecords_TimeFirstAndDeathTies_KeepIndependentDeathlessBest', () => {
  const clean = saved(1000, 0);
  const assisted = recordWorldFinish(clean, world, 900, 4);
  assert.deepEqual(getWorldRecord(assisted, world), { ticks: 900, deaths: 4, cleanTicks: 1000 });
  const tie = recordWorldFinish(assisted, world, 900, 2);
  assert.deepEqual(getWorldRecord(tie, world), { ticks: 900, deaths: 2, cleanTicks: 1000 });
  assert.deepEqual(recordWorldFinish(tie, world, 900, 3), tie);
  assert.deepEqual(recordWorldFinish(tie, world, 1100, 0), tie);
  const improved = recordWorldFinish(tie, world, 950, 0);
  assert.equal(bestClean(getWorldRecord(improved, world)), 950);
  assert.deepEqual(getWorldRecord(recordWorldFinish(improved, world, 900, 0), world),
    { ticks: 900, deaths: 0 });
  assert.equal(bestClean(getWorldRecord(saved(800, 1), world)), undefined);
  assert.deepEqual(getWorldRecord(clean, world), { ticks: 1000, deaths: 0 });
});

test('WorldRecords_RevisionsAndLegacy_AreIsolatedWithoutMigrationOrDraftChanges', () => {
  const source = '{"version":1,"runs":{"progression-fixture":{"ticks":100,"deaths":0}}}';
  const legacy = readProgress(source);
  assert.equal(getWorldRecord(empty(), world), undefined);
  assert.throws(() => readWorldRecords(source));
  const old = saved(800, 0), revised = { ...world, revision: 2 };
  assert.equal(getWorldRecord(old, revised), undefined);
  const both = recordWorldFinish(old, revised, 1000, 1);
  assert.deepEqual(getWorldRecord(both, world), { ticks: 800, deaths: 0 });
  assert.deepEqual(getWorldRecord(both, revised), { ticks: 1000, deaths: 1 });
  assert.equal(getWorldRecord(both, { ...world, id: 'other' }), undefined);
  assert.deepEqual(readProgress(source), legacy);
  assert.equal(PROGRESS_KEY, 'boundstoy.progress.v1');
  assert.equal(DRAFT_KEY, 'boundstoy.draft.v1');
  assert.throws(() => getWorldRecord(both, { ...world, version: 1 } as unknown as typeof world));
});

test('WorldRecords_IndependentWriters_MergeCommutativelyAssociativelyAndIdempotently', () => {
  const a = saved(800, 4), b = saved(1200, 0);
  const c = recordWorldFinish(saved(900, 0), { ...world, revision: 2 }, 700, 1);
  const ab = mergeWorldRecords(a, b);
  assert.deepEqual(getWorldRecord(ab, world), { ticks: 800, deaths: 4, cleanTicks: 1200 });
  assert.deepEqual(mergeWorldRecords(a, a), a);
  assert.deepEqual(mergeWorldRecords(a, empty()), a);
  for (const x of [a, b, c, ab]) for (const y of [a, b, c, ab]) {
    assert.equal(encodeWorldRecords(mergeWorldRecords(x, y)), encodeWorldRecords(mergeWorldRecords(y, x)));
    assert.deepEqual(mergeWorldRecords(mergeWorldRecords(x, y), c),
      mergeWorldRecords(x, mergeWorldRecords(y, c)));
  }
  const merged = mergeWorldRecords(ab, c);
  assert.deepEqual(getWorldRecord(merged, world), { ticks: 800, deaths: 4, cleanTicks: 900 });
  assert.deepEqual(getWorldRecord(merged, { ...world, revision: 2 }), { ticks: 700, deaths: 1 });
  assert.deepEqual(mergeWorldRecords(merged, a), merged, 'stale writer cannot erase facts');
  assert.deepEqual(getWorldRecord(a, world), { ticks: 800, deaths: 4 });
});

test('WorldRecords_CanonicalSerialization_IsSortedDetachedAndDeeplyFrozen', () => {
  const raw = { schemaVersion: 1, worldVersion: 2, records: [
    { worldId: 'z', revision: 10, run: { ticks: 800, deaths: 1, cleanTicks: 1000 } },
    { worldId: 'a', revision: 2, run: { ticks: 500, deaths: 0 } },
    { worldId: 'z', revision: 2, run: { ticks: 600, deaths: 0 } },
  ] };
  const parsed = validateWorldRecords(raw);
  assert.deepEqual(parsed.records.map(r => [r.worldId, r.revision]), [['a', 2], ['z', 2], ['z', 10]]);
  const source = encodeWorldRecords(parsed);
  assert.equal(encodeWorldRecords(readWorldRecords(source)), source);
  raw.records[0].run.ticks = 2;
  assert.equal(encodeWorldRecords(parsed), source);
  assert.ok(Object.isFrozen(parsed) && Object.isFrozen(parsed.records));
  for (const entry of parsed.records) assert.ok(Object.isFrozen(entry) && Object.isFrozen(entry.run));
  assert.throws(() => { (parsed.records[0].run as { ticks: number }).ticks = 1; }, TypeError);
});

test('WorldRecords_NumericValidation_RejectsInsteadOfDefaultingOrLosingValidFacts', () => {
  const good = saved(900, 0), before = encodeWorldRecords(good);
  for (const value of [NaN, Infinity, -Infinity, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, '1', null, undefined]) {
    for (const field of ['ticks', 'deaths', 'cleanTicks']) {
      const bad = envelope({ ticks: 800, deaths: 1, [field]: value });
      assert.throws(() => validateWorldRecords(bad), field);
      assert.throws(() => encodeWorldRecords(bad), field);
      assert.throws(() => mergeWorldRecords(good, bad as typeof good), field);
    }
    assert.throws(() => recordWorldFinish(good, world, value as number, 0));
    assert.throws(() => recordWorldFinish(good, world, 100, value as number));
    assert.throws(() => recordWorldFinish(good, { ...world, revision: value as number }, 100, 0));
  }
  for (const run of [{ ticks: 0, deaths: 0 }, { ticks: 800, deaths: 1, cleanTicks: 799 },
    { ticks: 800, deaths: 1, cleanTicks: 800 }, { ticks: 800, deaths: 0, cleanTicks: 900 }]) {
    assert.throws(() => validateWorldRecords(envelope(run)));
  }
  assert.equal(encodeWorldRecords(good), before);
  assert.deepEqual(getWorldRecord(saved(Number.MAX_SAFE_INTEGER, 0), world),
    { ticks: Number.MAX_SAFE_INTEGER, deaths: 0 });
});

test('WorldRecords_MalformedIncomingData_FailsExplicitly', () => {
  const valid = envelope({ ticks: 800, deaths: 0 });
  const entry = valid.records[0];
  for (const value of [null, [], {}, { ...valid, schemaVersion: 2 }, { ...valid, worldVersion: 1 },
    { ...valid, extra: true }, { ...valid, records: {} }, { ...valid, records: [entry, entry] },
    { ...valid, records: [null] }, { ...valid, records: Array(1) },
    { ...valid, records: [{ ...entry, revision: 0 }] },
    { ...valid, records: [{ ...entry, worldId: '__proto__' }] },
    { ...valid, records: [{ ...entry, worldId: '' }] },
    envelope({ ticks: 800, deaths: 0, achievement: true }), envelope([800, 0]),
    envelope(Object.create({ ticks: 800, deaths: 0 })),
    envelope(Object.defineProperty({ deaths: 0 }, 'ticks', { enumerable: true, get() { throw new Error('getter ran'); } })),
  ]) {
    assert.throws(() => validateWorldRecords(value));
    assert.throws(() => encodeWorldRecords(value));
  }
  for (const source of ['', '{', 'null', '{"schemaVersion":1,"worldVersion":2,"records":[],"records":[]}']) {
    assert.throws(() => readWorldRecords(source));
  }
  assert.throws(() => readWorldRecords('{"schemaVersion":1,"worldVersion":2,"records":[],"recor\\u0064s":[]}'));
});

test('WorldRecords_ConstructorId_IsAnOrdinaryIsolatedWorld', () => {
  const named = { ...world, id: 'constructor' };
  assert.equal(getWorldRecord(empty(), named), undefined);
  const records = recordWorldFinish(empty(), named, 100, 0);
  assert.deepEqual(getWorldRecord(readWorldRecords(encodeWorldRecords(records)), named), { ticks: 100, deaths: 0 });
});

test('WorldRecords_LegitimateSavedContinuation_ZeroDeathsEligibleAndAnyDeathIneligible', () => {
  for (const withDeath of [false, true]) {
    let state = createState(world);
    for (let i = 0; i < 167; i++) state = step(world, state, { x: 1, y: 0 });
    if (withDeath) {
      for (let i = 0; i < 67; i++) state = step(world, state, { x: -1, y: 0 });
      for (let i = 0; i < 100; i++) state = step(world, state, { x: 0, y: 1 });
      for (let i = 0; i < 120 && !state.respawnTicks; i++) state = step(world, state, STILL);
      assert.equal(state.deaths, 1);
    }
    const decoded = decodeRunSnapshot(world, encodeRunSnapshot(world, createRunSnapshot(world, 'run-043', state)));
    if (decoded.status !== 'valid') assert.fail(decoded.reason);
    state = decoded.snapshot.state;
    for (let i = 0; i < 900 && !state.won; i++) state = step(world, state,
      state.respawnTicks ? STILL : { x: 1, y: 0 });
    assert.equal(state.won, true);
    const records = recordWorldFinish(empty(), world, state.tick, state.deaths);
    assert.equal(bestClean(getWorldRecord(records, world)), withDeath ? undefined : state.tick);
    assert.deepEqual(recordWorldFinish(records, world, state.tick, state.deaths), records);
  }
});
