import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readProgress, recordFinish } from '../application/storage.ts';

test('Progress_NoSave_StartsEmpty', () => {
  assert.deepEqual(readProgress(null), {});
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
