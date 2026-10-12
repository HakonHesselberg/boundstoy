import assert from 'node:assert/strict';
import { test } from 'node:test';
import { center, parseLevel } from '../core/level.ts';
import { createState, hazardSample, hazardTick, step, STILL, type State } from '../core/simulation.ts';
import { worldSectionIndex } from '../core/world.ts';
import { RULES } from '../data/terrain.ts';
import { worldFixture, walkTo } from './fixtures/world.ts';

test('World_ExitContact_WithAnyMissingIntermediateSectionCannotWin', () => {
  const world = worldFixture();
  for (const collectFirst of [false, true]) {
    let state = createState(world);
    if (collectFirst) state = walkTo(world, state, center(world.checkpoints[0]));
    state = walkTo(world, state, { x: state.position.x, y: 4.5 });
    state = walkTo(world, state, { x: 22.5, y: 4.5 });
    // Enter the goal trigger using actual input, including a full stopped tick.
    for (let tick = 0; tick < 67; tick++) state = step(world, state, { x: 0, y: -1 });
    state = step(world, state, STILL);
    assert.equal(state.visited.length, collectFirst ? 1 : 0);
    assert.equal(state.won, false);
    assert.equal(state.event, 'none');
  }
});

test('World_ActualOutOfOrderApproachesAndBacktracking_NeverSkipOrDowngrade', () => {
  const world = worldFixture();
  let state = createState(world);
  state = walkTo(world, state, { x: 1.5, y: 4.5 });
  state = walkTo(world, state, center(world.checkpoints[1]));
  assert.deepEqual(state.visited, [], 'second checkpoint cannot be banked first');
  assert.deepEqual(state.checkpoint, world.spawn);
  state = walkTo(world, state, center(world.goal));
  assert.equal(state.won, false, 'exit is locked before any completion');
  state = walkTo(world, state, { x: 22.5, y: 4.5 });
  state = walkTo(world, state, center(world.checkpoints[0]));
  assert.deepEqual(state.visited, ['6,2']);
  state = walkTo(world, state, { x: 6.5, y: 4.5 });
  state = walkTo(world, state, center(world.goal));
  assert.equal(state.won, false, 'exit is still locked with only one intermediate section');
  state = walkTo(world, state, center(world.checkpoints[1]));
  assert.deepEqual(state.visited, ['6,2', '14,2']);
  state = walkTo(world, state, center(world.checkpoints[0]));
  assert.deepEqual(state.checkpoint, world.checkpoints[1], 'backtracking preserves latest recovery');
  assert.deepEqual(state.visited, ['6,2', '14,2']);
  state = walkTo(world, state, { x: 21.9, y: 2.5 });
  while (!state.won) state = step(world, state, { x: 1, y: 0 });
  assert.equal(state.event, 'win');
  assert.equal(state.deaths, 0);
  assert.equal(step(world, state, STILL), state, 'finish freezes the exact live state');
});

test('World_Transitions_OnlyChangeProgressAndPreserveImmutableDeterministicRun', () => {
  const world = worldFixture();
  function replay() {
    let state = createState(world), transitions = 0;
    for (let tick = 0; tick < 650; tick++) {
      const prior = state, saved = structuredClone(prior);
      Object.freeze(prior); Object.freeze(prior.position); Object.freeze(prior.velocity);
      Object.freeze(prior.visited);
      state = step(world, prior, { x: 1, y: 0 });
      assert.equal(worldSectionIndex(world, state.visited), state.visited.length);
      assert.deepEqual(prior, saved);
      assert.equal(state.tick, prior.tick + 1);
      assert.equal(state.patternOffset, 0);
      assert.equal(state.deaths, 0);
      assert.ok(Math.abs(state.position.x - prior.position.x - 0.03) < 1e-12);
      assert.deepEqual(state.velocity, { x: 3.6, y: 0 });
      if (state.event === 'checkpoint') {
        transitions++;
        assert.equal(state.respawnTicks, 0);
        assert.equal(state.visited.length, prior.visited.length + 1);
        assert.notDeepEqual(state.position, center(state.checkpoint), 'no transition teleport');
        for (const hazard of world.hazards) {
          assert.deepEqual(hazardSample(hazard, hazardTick(state)), hazardSample(hazard, prior.tick + 1));
        }
      }
    }
    assert.equal(transitions, 2);
    return state;
  }
  assert.deepEqual(replay(), replay());
});

test('World_OverlappingCollectionZones_AdvanceOnlyTheNextSectionPerTick', () => {
  const base = worldFixture();
  const world = worldFixture({
    hazards: [],
    checkpoints: [{ ...base.checkpoints[0], radius: 3 },
      { ...base.checkpoints[1], x: 8, radius: 3 }],
    sections: base.sections.map((section, i) => {
      const x = [1, 7, 9][i], width = [6, 2, 14][i];
      return { ...section, bounds: { x, y: 1, width, height: 6 },
        entry: { x, y: 2 }, observation: { x, y: 2, width: 1, height: 1 },
        camera: { mode: 'fixed', frame: { x, y: 1, width, height: 6 } } };
    }),
  });
  let state = walkTo(world, createState(world), { x: 1.5, y: 6.5 });
  state = walkTo(world, state, { x: 7.5, y: 6.5 });
  for (let tick = 0; tick < 100 && state.event !== 'checkpoint'; tick++)
    state = step(world, state, { x: 0, y: -1 });
  assert.deepEqual(state.visited, ['6,2']);
  assert.equal(worldSectionIndex(world, state.visited), 1);
  const next = step(world, state, STILL);
  assert.deepEqual(next.visited, ['6,2', '8,2']);
  assert.equal(worldSectionIndex(world, next.visited), 2);
  assert.deepEqual(state.visited, ['6,2'], 'previous history is not mutated');
});

test('World_CheckpointNearWallVoidOrSpikes_RequiresExistingClearFloorSegment', () => {
  for (const barrier of ['#', ' ', '!']) {
    const base = worldFixture(), rows = [...base.tiles];
    rows[2] = `${rows[2].slice(0, 5)}${barrier}${rows[2].slice(6)}`;
    const world = worldFixture({ tiles: rows,
      checkpoints: [{ ...base.checkpoints[0], radius: 3 }, base.checkpoints[1]] });
    let state = walkTo(world, createState(world), { x: 4.7, y: 2.5 });
    assert.deepEqual(state.visited, [], `${barrier}: no collection through the barrier`);
    state = walkTo(world, state, { x: 4.7, y: 4.5 });
    state = walkTo(world, state, center(world.checkpoints[0]));
    assert.deepEqual(state.visited, ['6,2'], `${barrier}: legal route around the barrier collects`);
    assert.equal(state.deaths, 0);
  }
});

test('World_SimultaneousHazardAndCheckpointOrGoal_DeathHasPriority', () => {
  const base = worldFixture();
  for (const target of ['checkpoint', 'goal'] as const) {
    // A broad checkpoint zone may overlap danger outside its safe recovery tile.
    const world = worldFixture({
      checkpoints: [{ ...base.checkpoints[0], radius: 3 }, base.checkpoints[1]],
      hazards: [{ kind: 'pulse', x: target === 'checkpoint' ? 4 : 22, y: 2,
        period: 120, on: 1, phase: 119 }],
    });
    const prior: State = { ...createState(world),
      position: target === 'checkpoint' ? { x: 4.5, y: 2.5 } : center(world.goal),
      visited: target === 'goal' ? ['6,2', '14,2'] : [] };
    const state = step(world, prior, STILL);
    assert.equal(state.event, 'death');
    assert.equal(state.deathCause, 'pulse');
    assert.equal(state.won, false);
    assert.deepEqual(state.visited, prior.visited);
    assert.deepEqual(state.checkpoint, prior.checkpoint);
    assert.equal(state.respawnTicks, RULES.respawnTicks);
  }
});

test('World_OneSectionWithoutCheckpoints_ExitIsImmediatelyEligible', () => {
  const base = worldFixture();
  const world = worldFixture({ checkpoints: [], sections: [{
    ...base.sections[0], bounds: { x: 1, y: 1, width: 22, height: 6 },
    completion: { kind: 'goal' },
    camera: { mode: 'fixed', frame: { x: 1, y: 1, width: 22, height: 6 } },
  }] });
  let state = walkTo(world, createState(world), { x: 21.9, y: 2.5 });
  while (!state.won) state = step(world, state, { x: 1, y: 0 });
  assert.equal(state.deaths, 0);
  assert.equal(worldSectionIndex(world, state.visited), 0, 'final section stays selected after winning');
});

test('Legacy_OutOfOrderCheckpointsAndUngatedExit_KeepVersionOneBehavior', () => {
  const world = worldFixture();
  const level = parseLevel({ ...world, version: 1,
    checkpoints: world.checkpoints.map(({ x, y }) => ({ x, y })) });
  let state = walkTo(level, createState(level), { x: 1.5, y: 4.5 });
  state = walkTo(level, state, center(level.checkpoints[1]));
  assert.deepEqual(state.visited, ['14,2'], 'legacy default-radius marker still collects independently');
  state = walkTo(level, state, center(level.checkpoints[0]));
  assert.deepEqual(state.visited, ['14,2', '6,2']);
  assert.deepEqual(state.checkpoint, level.checkpoints[0], 'legacy latest new marker still wins');
  state = walkTo(level, createState(level), { x: 1.5, y: 4.5 });
  state = walkTo(level, state, { x: 22.5, y: 4.5 });
  while (!state.won) state = step(level, state, { x: 0, y: -1 });
  assert.deepEqual(state.visited, []);
});
