import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readProgress, recordFinish, runRank } from '../application/storage.ts';

test('Progress_NoSave_StartsEmpty', () => {
  assert.deepEqual(readProgress(null), {});
});
test('Progress_ConstructorId_DoesNotReadInheritedPrototypeAsAPreviousRun', () => {
  assert.deepEqual(recordFinish({}, 'constructor', 100, 0).constructor, { ticks: 100, deaths: 0 });
});
test('Progress_BestRun_PreservesFastestFinish', () => {
  const first = recordFinish({}, 'first', 1000, 3);
  const slower = recordFinish(first, 'first', 1100, 1);
  assert.equal(slower.first.ticks, 1000);
  assert.equal(slower.first.deaths, 3);
  assert.equal(first.first.ticks, 1000);
  assert.equal(recordFinish(first, 'first', 900, 0).first.ticks, 900);
});
test('Progress_CorruptData_ThrowsInsteadOfPretendingSuccess', () => {
  assert.throws(() => readProgress('{"version": 9}'), /version/);
  assert.throws(() => readProgress('{"version":1,"runs":{"a":{"ticks":-2,"deaths":0}}}'), /run/i);
});

test('Progress_AssistedAndCleanRecords_NeverEraseEachOther', () => {
  const clean = recordFinish({}, 'test', 1000, 0);
  const assisted = recordFinish(clean, 'test', 900, 2);
  assert.deepEqual(assisted.test, { ticks: 900, deaths: 2, cleanTicks: 1000 });
  const betterClean = recordFinish(assisted, 'test', 950, 0);
  assert.deepEqual(betterClean.test, { ticks: 900, deaths: 2, cleanTicks: 950 });
  assert.deepEqual(readProgress(JSON.stringify({ version: 1, runs: betterClean })), betterClean);
  assert.equal(recordFinish(betterClean, 'test', 1050, 0), betterClean);
  assert.deepEqual(recordFinish(betterClean, 'test', 850, 0).test, { ticks: 850, deaths: 0 });
  assert.deepEqual(clean.test, { ticks: 1000, deaths: 0 }, 'saved snapshots remain immutable');
});

test('Progress_FirstCleanAfterFasterAssistedClear_IsRetainedAndValidated', () => {
  const assisted = recordFinish({}, 'test', 900, 2);
  assert.deepEqual(recordFinish(assisted, 'test', 1000, 0).test, { ticks: 900, deaths: 2, cleanTicks: 1000 });
  for (const cleanTicks of [0, 899, 900.5, '1000', null]) {
    assert.throws(() => readProgress(JSON.stringify({
      version: 1, runs: { test: { ticks: 900, deaths: 2, cleanTicks } },
    })), /clean/i);
  }
});

test('Progress_Mastery_RequiresAnActualCleanTimeAtOrBelowTheAuthoredTarget', () => {
  assert.equal(runRank(undefined, 1000), 'Uncleared');
  assert.equal(runRank({ ticks: 800, deaths: 1 }, 1000), 'Clear');
  assert.equal(runRank({ ticks: 1001, deaths: 0 }, 1000), 'Clean');
  assert.equal(runRank({ ticks: 1000, deaths: 0 }, 1000), 'Mastered');
  assert.equal(runRank({ ticks: 800, deaths: 2, cleanTicks: 1000 }, 1000), 'Mastered');
});
