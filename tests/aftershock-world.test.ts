import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LEVELS, MASTERY_TARGETS } from '../data/levels.ts';
import { REPLAYS, MASTERY_REPLAYS } from '../data/replays.ts';
import { completeEight } from './fixtures/aftershock-world.ts';
import { createState, hazardTick, step, STILL } from '../core/simulation.ts';
import { courseGuide } from '../application/guidance.ts';

test('Production_Aftershock_IsOneStableCompleteWorldWithoutAuthoredTargets', () => {
  assert.equal(LEVELS.length, 1);
  const world = LEVELS[0];
  assert.equal(world.version, 2);
  if (world.version !== 2) return;
  assert.equal(world.id, 'aftershock');
  assert.equal(world.revision, 2);
  assert.equal(world.puzzleMode, 'checkpoint');
  assert.equal(world.name, 'Aftershock');
  assert.equal(world.sections.length, 8);
  assert.equal(world.checkpoints.length, 7);
  assert.deepEqual(world.goal, { x: 29, y: 44 });
  assert.equal(world.resetPatternOnRetry, false);
  assert.deepEqual(world.tiles, completeEight.tiles);
  assert.equal(world.hazards.length, completeEight.hazards.length);
  assert.deepEqual(world.checkpoints, completeEight.checkpoints);
  assert.deepEqual(MASTERY_TARGETS, {});
  assert.deepEqual(MASTERY_REPLAYS, [], 'faster witnesses are not mastery targets');
});

test('Production_OrdinaryWitness_PreservesActualArrivalsAndSectionGuidance', () => {
  const world = LEVELS[0];
  assert.equal(world.version, 2);
  assert.equal(REPLAYS.length, 1);
  let state = createState(world);
  const arrivals: number[] = [], hints = new Set<string>();
  for (const command of REPLAYS[0]) for (let i = 0; i < command.ticks; i++) {
    const guide = courseGuide(world, state);
    hints.add(guide.hint);
    assert.ok(guide.hint.length <= 200);
    assert.doesNotMatch(guide.hint, /ticks|phase \d|press .* for \d/i);
    state = step(world, state, command);
    assert.equal(state.deaths, 0);
    assert.equal(hazardTick(state), state.tick - state.patternOffset);
    if (state.event === 'checkpoint') assert.equal(hazardTick(state), 0);
    if (state.event === 'checkpoint') arrivals.push(state.tick);
  }
  assert.equal(state.won, true);
  assert.equal(state.tick, 5752);
  assert.deepEqual(arrivals, [507, 1339, 1872, 2539, 3272, 4072, 4773]);
  assert.equal(hints.size, 8, 'each section explains its own decision');
  assert.deepEqual(step(world, state, STILL), state);
});
