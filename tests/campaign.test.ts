import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextCourse, finishResult } from '../application/campaign.ts';
import { readProgress, recordFinish } from '../application/storage.ts';

const courses = [{ id: 'new-a' }, { id: 'new-b' }, { id: 'new-c' }];
const run = { ticks: 1200, deaths: 2 };

test('Campaign_FreshAndLegacyProgress_StartAtFirstNewCourseWithoutLosingOldRecords', () => {
  const old = readProgress(JSON.stringify({ version: 1, runs: { 'first-steps-v1': run } }));
  assert.equal(nextCourse(courses, old), 0);
  const saved = recordFinish(old, 'new-a', 900, 0);
  assert.deepEqual(saved['first-steps-v1'], run);
  assert.equal(nextCourse(courses, readProgress(JSON.stringify({ version: 1, runs: saved }))), 1);
  assert.equal(old['new-a'], undefined);
});

test('Campaign_OutOfOrderClears_SelectNextMissingAndCompleteRegardlessOfFinalIndex', () => {
  assert.equal(nextCourse(courses, { 'new-c': run }, 2), 0);
  assert.equal(nextCourse(courses, { 'new-a': run, 'new-c': run }, 0), 1);
  assert.equal(nextCourse(courses, { 'new-a': run, 'new-b': run, 'new-c': run }, 1), null);
  assert.equal(nextCourse([], {}), null);
});

test('Finish_FirstClearAndFasterRun_ReportTruthfulPersonalBestAndDelta', () => {
  assert.deepEqual(finishResult(undefined, run), { kind: 'first', deltaTicks: 0, fewerRetries: 0 });
  assert.deepEqual(finishResult(run, { ticks: 1140, deaths: 9 }), { kind: 'best', deltaTicks: -60, fewerRetries: -7 });
  assert.deepEqual(finishResult(run, { ticks: 1260, deaths: 0 }), { kind: 'slower', deltaTicks: 60, fewerRetries: 2 });
});

test('Finish_EqualTime_RespectsRetryTiebreakWithoutInventingTimeImprovement', () => {
  assert.deepEqual(finishResult(run, { ticks: 1200, deaths: 1 }), { kind: 'best', deltaTicks: 0, fewerRetries: 1 });
  assert.equal(finishResult(run, run).kind, 'equal');
  assert.equal(finishResult(run, { ticks: 1200, deaths: 3 }).kind, 'slower');
});
