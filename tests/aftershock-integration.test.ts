import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LEVELS, COURSE_LESSONS } from '../data/levels.ts';
import { REPLAYS } from '../data/replays.ts';
import { createState, hazardTick, step, STILL } from '../core/simulation.ts';
import { courseGuide } from '../application/guidance.ts';
import { nextCourse } from '../application/campaign.ts';
import { recordFinish } from '../application/storage.ts';
import { RULES } from '../data/terrain.ts';
import { FAILURE_REPLAYS } from './fixtures/aftershock-failures.ts';

test('Aftershock_PlayableRegistry_ReplacesRelayWithTheThreeApprovedEncounters', () => {
  assert.deepEqual(LEVELS.map(level => level.name), ['Slipstream', 'Borrowed Ground', 'The Cut']);
  assert.equal(REPLAYS.length, 3);
  assert.deepEqual(Object.keys(COURSE_LESSONS), LEVELS.map(level => level.id));
  for (const level of LEVELS) {
    assert.ok(level.id.startsWith('aftershock-'));
    assert.equal(level.resetPatternOnRetry, true);
    assert.equal(level.checkpoints.length, 0, 'short standalone encounters retry from their start');
    assert.ok(level.hazards.every(hazard => hazard.kind === 'pulse' && hazard.on === 1));
    assert.ok([...level.tiles.join('')].every(tile => '.# '.includes(tile)));
    const guide = courseGuide(level, createState(level));
    assert.equal(guide.total, 1);
    assert.equal(guide.hint, COURSE_LESSONS[level.id][0].hint);
    assert.ok(guide.hint.length <= 200);
  }
});

test('Aftershock_RetiredRelayRecords_DoNotUnlockOrOverwriteNewEncounters', () => {
  const legacy = { 'relay-courtyard-v1': { ticks: 652, deaths: 0 },
    'relay-crescendo-v2': { ticks: 2641, deaths: 0 } };
  assert.equal(nextCourse(LEVELS, legacy), 0);
  const saved = recordFinish(legacy, LEVELS[0].id, 1000, 0);
  assert.equal(nextCourse(LEVELS, saved), 1);
  assert.deepEqual(saved['relay-crescendo-v2'], legacy['relay-crescendo-v2']);
});

test('Aftershock_EachActualDeath_CanRetryTheExactWitnessWithRunCostsRetained', () => {
  for (const [index, level] of LEVELS.entries()) {
    let death = createState(level);
    for (const command of FAILURE_REPLAYS[index]) for (let tick = 0; tick < command.ticks; tick++)
      death = step(level, death, command);
    assert.equal(death.event, 'death', `${level.id}: fixture must end on a real input-driven death`);
    let state = death;
    for (let tick = 0; tick < RULES.respawnTicks; tick++) state = step(level, state, { x: 1, y: 1 });
    const retryStart = state.tick;
    assert.equal(hazardTick(state), 0);
    assert.equal(state.deaths, 1);
    assert.deepEqual(state.position, createState(level).position);
    for (const command of REPLAYS[index]) for (let tick = 0; tick < command.ticks; tick++) {
      const before = structuredClone(state);
      const next = step(level, state, command);
      assert.deepEqual(state, before);
      state = next;
      assert.equal(state.deaths, 1, `${level.id}: retry must not require a different input phase`);
    }
    assert.equal(state.won, true, level.id);
    assert.equal(state.tick, retryStart + REPLAYS[index].reduce((sum, command) => sum + command.ticks, 0));
    assert.deepEqual(step(level, state, STILL), state, 'finish freezes both clocks');
  }
});
