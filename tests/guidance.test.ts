import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../data/levels.ts';
import { createState } from '../core/simulation.ts';
import { courseGuide, deathMessage } from '../application/guidance.ts';
import { blankLevel } from '../core/editor.ts';

test('Guide_FirstCourse_TeachesNoBrakingBeforeTheIce', () => {
  const level = LEVELS[0], guide = courseGuide(level, createState(level));
  assert.match(guide.hint, /no brakes/i);
  assert.equal(guide.index, 0);
  assert.equal(guide.total, level.checkpoints.length + 1);
});
test('Guide_CheckpointProgress_AdvancesToNextLesson', () => {
  const level = LEVELS[1];
  let state = createState(level);
  for (let index = 0; index < level.checkpoints.length; index++) {
    const point = level.checkpoints[index];
    state = { ...state, visited: [...state.visited, `${point.x},${point.y}`] };
    assert.equal(courseGuide(level, state).index, index + 1);
  }
  assert.match(courseGuide(level, state).hint, /mud/i);
});
test('Guide_CustomLevel_UsesActualTerrainAndGoal', () => {
  const level = blankLevel(), guide = courseGuide(level, createState(level));
  assert.equal(guide.total, 1);
  assert.match(guide.hint, /Release to stop/);
});
test('DeathMessage_EachCause_ExplainsWhatWentWrong', () => {
  assert.match(deathMessage('void'), /edge/i);
  assert.match(deathMessage('spikes'), /spikes/i);
  assert.match(deathMessage('pulse'), /blast/i);
  assert.match(deathMessage('saw'), /saw/i);
});
