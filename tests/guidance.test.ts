import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AFTERSHOCK_LEVELS as LEVELS, AFTERSHOCK_LESSONS as COURSE_LESSONS } from '../data/aftershock.ts';
import { createState } from '../core/simulation.ts';
import { courseGuide, deathMessage } from '../application/guidance.ts';
import { blankLevel } from '../core/editor.ts';
import { worldFixture, walkTo } from './fixtures/world.ts';

test('Guide_FirstEncounter_UsesItsAuthoredDecisionHint', () => {
  const level = LEVELS[0], guide = courseGuide(level, createState(level));
  assert.equal(guide.hint, COURSE_LESSONS[level.id][0].hint);
  assert.equal(guide.index, 0);
  assert.equal(guide.total, level.checkpoints.length + 1);
});
test('Guide_Aftershock_HasDistinctConciseEncounterHints', () => {
  assert.equal(new Set(LEVELS.map(level => COURSE_LESSONS[level.id][0].hint)).size, LEVELS.length);
  for (const level of LEVELS) {
    const hints = COURSE_LESSONS[level.id].map(lesson => lesson.hint);
    assert.equal(hints.length, level.checkpoints.length + 1);
    assert.ok(hints.every(hint => hint.length <= 200));
  }
});
test('Guide_CheckpointProgress_AdvancesThroughEveryCoursesOwnLessons', () => {
  for (const level of LEVELS) {
    let state = createState(level);
    for (let index = 0; index <= level.checkpoints.length; index++) {
      const guide = courseGuide(level, state);
      assert.equal(guide.index, index);
      assert.equal(guide.title, COURSE_LESSONS[level.id][index].title);
      assert.equal(guide.hint, COURSE_LESSONS[level.id][index].hint);
      const point = level.checkpoints[index];
      if (point) state = { ...state, visited: [...state.visited, `${point.x},${point.y}`] };
    }
  }
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

test('DeathMessage_StaticHazards_DoesNotAssumeAnIceLesson', () => {
  for (const cause of ['void', 'spikes'] as const) {
    assert.doesNotMatch(deathMessage(cause), /ice|brak|glid|turning arc/i);
  }
});

test('Guide_World_UsesOrderedSectionNamesNotLegacyLessonsOrPlayerLocation', () => {
  const world = worldFixture({ id: LEVELS[0].id });
  let state = createState(world);
  assert.equal(courseGuide(world, state).title, world.sections[0].name);
  assert.equal(courseGuide(world, state).total, 3);
  assert.match(courseGuide(world, state).hint, /checkpoint/i);
  state = walkTo(world, state, { x: 1.5, y: 4.5 });
  state = walkTo(world, state, { x: 18.5, y: 4.5 });
  assert.equal(courseGuide(world, state).index, 0, 'position is not completion');
  state = walkTo(world, state, { x: 6.5, y: 2.5 });
  assert.equal(courseGuide(world, state).title, world.sections[1].name);
  state = walkTo(world, state, { x: 14.5, y: 2.5 });
  state = walkTo(world, state, { x: 6.5, y: 2.5 });
  assert.equal(courseGuide(world, state).index, 2);
  assert.equal(courseGuide(world, state).title, world.sections[2].name);
  assert.match(courseGuide(world, state).hint, /exit/i);
  assert.match(courseGuide(world, state).hint, /Release to stop/);
});
