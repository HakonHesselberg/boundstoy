import assert from 'node:assert/strict';
import { test } from 'node:test';
import { center, importLevel, parseLevel, type Hazard, type World } from '../core/level.ts';
import * as simulation from '../core/simulation.ts';
import * as worlds from '../core/world.ts';
import { RULES } from '../data/terrain.ts';
import { worldFixture, walkTo } from './fixtures/world.ts';

const { createState, step, STILL, hazardTick, hazardSample, lethalAt, ascii } = simulation;
type State = simulation.State;

function puzzle(overrides: Partial<World> = {}): World {
  return worldFixture({
    puzzleMode: 'checkpoint',
    hazards: [4, 12, 20].flatMap((x, i): Hazard[] => [
      { kind: 'pulse', x, y: 5, period: 120, on: 1, phase: 0, sectionId: `section-${i + 1}` },
      { kind: 'saw', from: { x: x - 1, y: 6 }, to: { x: x + 1, y: 6 },
        period: 240, phase: 0, sectionId: `section-${i + 1}` },
    ]),
    ...overrides,
  });
}

function collectFirst(world: World): State {
  let state = createState(world);
  for (let i = 0; i < 200 && state.event !== 'checkpoint'; i++)
    state = step(world, state, { x: 1, y: 0 });
  assert.equal(state.event, 'checkpoint');
  return state;
}

function dieInSecond(world: World): State {
  let state = collectFirst(world);
  state = walkTo(world, state, { x: state.position.x, y: 4.5 });
  state = walkTo(world, state, { x: 12.5, y: 4.5 });
  for (let i = 0; i < 200 && state.event !== 'death'; i++)
    state = step(world, state, state.position.y < 5.49 ? { x: 0, y: 1 } : STILL);
  assert.equal(state.event, 'death');
  assert.equal(state.deathCause, 'pulse');
  return state;
}

test('CheckpointPuzzles_ValidOwnership_RoundtripsWithoutAddingOptionalFieldsToGlobalWorlds', () => {
  const world = puzzle();
  assert.equal(worlds.checkpointPuzzles(world), true);
  assert.deepEqual(importLevel(JSON.stringify(world)), world);
  assert.ok(Object.isFrozen(world));
  assert.ok(world.hazards.every(Object.isFrozen));
  assert.deepEqual(world.hazards.map(h => h.sectionId),
    ['section-1', 'section-1', 'section-2', 'section-2', 'section-3', 'section-3']);
  const global = worldFixture(), legacy = parseLevel({ ...global, version: 1 });
  for (const level of [global, legacy]) {
    assert.equal(worlds.checkpointPuzzles(level), false);
    assert.equal(Object.hasOwn(level, 'puzzleMode'), false);
    assert.ok(level.hazards.every(h => !Object.hasOwn(h, 'sectionId')));
    assert.deepEqual(importLevel(JSON.stringify(level)), level);
  }
});

test('CheckpointPuzzles_InvalidModesAndMissingOrInvalidOwners_RejectExplicitly', () => {
  const global = worldFixture();
  for (const puzzleMode of ['global', '', false, null, 1, {}])
    assert.throws(() => parseLevel({ ...global, puzzleMode }), /puzzleMode/);
  assert.throws(() => parseLevel({ ...global, version: 1, puzzleMode: 'checkpoint' }), /puzzleMode/);
  for (const hazard of global.hazards) {
    for (const sectionId of [undefined, null, '', 'Bad ID', 'section-99', 3, 'a'.repeat(61)]) {
      assert.throws(() => parseLevel({ ...global, puzzleMode: 'checkpoint',
        hazards: [{ ...hazard, sectionId }] }), /sectionId/);
    }
    for (const version of [1, 2])
      assert.throws(() => parseLevel({ ...global, version,
        hazards: [{ ...hazard, sectionId: 'section-1' }] }), /sectionId.*checkpoint/);
  }
});

test('CheckpointPuzzles_ExplicitOwnership_AllowsConnectorCrossingAndWallTraversingSaws', () => {
  const world = puzzle({ hazards: [{
    kind: 'saw', from: { x: 0, y: 5 }, to: { x: 23, y: 5 },
    period: 240, phase: 0, sectionId: 'section-2',
  }, { kind: 'pulse', x: 8, y: 5, period: 120, on: 1, phase: 0, sectionId: 'section-1' }] });
  assert.deepEqual(importLevel(JSON.stringify(world)), world);
  assert.equal(simulation.hazardEnabled(world, world.hazards[0], createState(world)), false);
  assert.equal(simulation.hazardEnabled(world, world.hazards[0], collectFirst(world)), true);
});

test('CheckpointPuzzles_InitialState_EnablesOnlyFirstOwnerAndRequiresCollisionContext', () => {
  const world = puzzle(), state = createState(world);
  assert.throws(() => lethalAt(world, center(world.spawn), 0), /state.*checkpoint|checkpoint.*state/i);
  for (const hazard of world.hazards) {
    const enabled = hazard.sectionId === 'section-1', sample = hazardSample(hazard, 0);
    assert.equal(sample.active, true, 'raw sampler remains stateless');
    assert.equal(simulation.hazardEnabled(world, hazard, state), enabled);
    assert.equal(lethalAt(world, sample.position, 0, state), enabled ? hazard.kind : null);
  }
});

test('CheckpointPuzzles_FuturePulseAndSaw_ActualWalkingAndWaitingRemainSafe', () => {
  const world = puzzle();
  let state = walkTo(world, createState(world), { x: 1.5, y: 4.5 });
  state = walkTo(world, state, { x: 12.5, y: 4.5 });
  state = walkTo(world, state, { x: 12.5, y: 5.5 });
  for (let i = 0; i < 120; i++) state = step(world, state, STILL);
  state = walkTo(world, state, { x: 12.5, y: 6.5 });
  for (let i = 0; i < 240; i++) state = step(world, state, STILL);
  assert.equal(state.deaths, 0);
  assert.deepEqual(state.visited, []);
  assert.equal(state.patternOffset, 0);
});

test('CheckpointPuzzles_CheckpointEvent_ResetsEpochAtCollectionWithoutChangingMotion', () => {
  const world = puzzle();
  let state = createState(world), transitions = 0;
  for (let i = 0; i < 650; i++) {
    const prior = state, saved = structuredClone(prior);
    Object.freeze(prior); Object.freeze(prior.visited);
    state = step(world, prior, { x: 1, y: 0 });
    assert.deepEqual(prior, saved);
    assert.equal(state.tick, prior.tick + 1);
    assert.ok(Math.abs(state.position.x - prior.position.x - 0.03) < 1e-12);
    assert.deepEqual(state.velocity, { x: 3.6, y: 0 });
    assert.equal(state.deaths, 0);
    if (state.event === 'checkpoint') {
      transitions++;
      assert.equal(state.patternOffset, state.tick);
      assert.equal(hazardTick(state), 0);
      assert.notDeepEqual(state.position, center(state.checkpoint));
      assert.equal(state.respawnTicks, 0);
    } else assert.equal(state.patternOffset, prior.patternOffset);
    for (const hazard of world.hazards)
      assert.equal(simulation.hazardEnabled(world, hazard, state),
        hazard.sectionId === `section-${state.visited.length + 1}`);
  }
  assert.equal(transitions, 2);
});

test('CheckpointPuzzles_CollisionPrecedesCollection_AndNewPatternStartsAtLocalZero', () => {
  const base = puzzle({ hazards: [] });
  const checkpoints = [{ ...base.checkpoints[0], radius: 3 }, base.checkpoints[1]];
  const walkApproach = (world: World) => {
    let state = walkTo(world, createState(world), { x: 1.5, y: 5.5 });
    state = walkTo(world, state, { x: 4.5, y: 5.5 });
    for (let i = 0; i < 100 && state.event === 'none'; i++)
      state = step(world, state, { x: 0, y: -1 });
    return state;
  };
  const collection = walkApproach(puzzle({ checkpoints, hazards: [] }));
  assert.equal(collection.event, 'checkpoint');
  const current = puzzle({ checkpoints, hazards: [{
    kind: 'pulse', x: 4, y: 4, period: 120, on: 1,
    phase: (120 - collection.tick % 120) % 120, sectionId: 'section-1',
  }] });
  const death = walkApproach(current);
  assert.equal(death.tick, collection.tick);
  assert.equal(death.event, 'death');
  assert.deepEqual(death.visited, []);
  assert.equal(death.patternOffset, 0);
  const next = puzzle({ checkpoints, hazards: [{
    ...current.hazards[0], phase: 0, sectionId: 'section-2',
  }] });
  const advanced = walkApproach(next);
  assert.equal(advanced.event, 'checkpoint');
  assert.equal(advanced.tick, collection.tick);
  assert.equal(hazardTick(advanced), 0);
  assert.equal(lethalAt(next, advanced.position, 0, advanced), 'pulse');
  assert.equal(step(next, advanced, STILL).deaths, 0, 'next collision uses local tick one');
});

test('CheckpointPuzzles_OrdinaryDeathAndAll54RespawnTicks_KeepActiveEpochAdvancing', () => {
  const world = puzzle(), death = dieInSecond(world);
  assert.equal(death.respawnTicks, 54);
  assert.equal(RULES.respawnTicks, 54);
  assert.ok(death.patternOffset > 0);
  let state = death;
  for (let i = 1; i <= RULES.respawnTicks; i++) {
    state = step(world, state, { x: 1, y: 1 });
    assert.equal(state.tick, death.tick + i);
    assert.equal(state.patternOffset, death.patternOffset);
    assert.equal(hazardTick(state), hazardTick(death) + i);
    assert.equal(state.deaths, 1);
    assert.equal(state.deathCause, 'pulse');
    assert.deepEqual(state.visited, death.visited);
    assert.equal(state.respawnTicks, RULES.respawnTicks - i);
    for (const hazard of world.hazards) {
      assert.equal(simulation.hazardEnabled(world, hazard, state), hazard.sectionId === 'section-2');
      assert.deepEqual(hazardSample(hazard, hazardTick(state)),
        hazardSample(hazard, death.tick + i - death.patternOffset));
    }
  }
  assert.deepEqual(state.position, center(world.checkpoints[0]));
  const moving = step(world, state, { x: 1, y: 0 });
  assert.equal(moving.patternOffset, death.patternOffset);
  assert.equal(moving.deaths, 1);
});

test('CheckpointPuzzles_ActiveSaw_ActualContactStillKills', () => {
  const world = puzzle({ hazards: [{
    kind: 'saw', from: { x: 4, y: 5 }, to: { x: 4, y: 5 },
    period: 120, phase: 0, sectionId: 'section-1',
  }] });
  let state = walkTo(world, createState(world), { x: 4.5, y: 2.5 });
  for (let i = 0; i < 150 && state.event !== 'death'; i++)
    state = step(world, state, { x: 0, y: 1 });
  assert.equal(state.event, 'death');
  assert.equal(state.deathCause, 'saw');
});

test('CheckpointPuzzles_CompletedHazards_BacktrackingAndWaitingCannotReactivateThem', () => {
  const world = puzzle();
  let state = collectFirst(world);
  const epoch = state.patternOffset;
  state = walkTo(world, state, { x: 4.5, y: 2.5 });
  state = walkTo(world, state, { x: 4.5, y: 5.5 });
  for (let i = 0; i < 120; i++) state = step(world, state, STILL);
  state = walkTo(world, state, { x: 4.5, y: 6.5 });
  for (let i = 0; i < 240; i++) state = step(world, state, STILL);
  state = walkTo(world, state, center(world.checkpoints[0]));
  assert.equal(state.deaths, 0);
  assert.deepEqual(state.visited, ['6,2']);
  assert.equal(state.patternOffset, epoch);
  assert.equal(state.event, 'none');
});

test('CheckpointPuzzles_RestartFromSpawnCheckpointOrRespawn_IsPureAndDoesNotFakeDeath', () => {
  const world = puzzle(), active = collectFirst(world), death = dieInSecond(world);
  for (const prior of [step(world, createState(world), { x: 1, y: 0 }),
    active, step(world, active, { x: 1, y: 0 }), death, step(world, death, STILL)]) {
    const saved = structuredClone(prior);
    Object.freeze(prior); Object.freeze(prior.visited); Object.freeze(prior.position);
    const restarted = simulation.restartCheckpoint(world, prior);
    assert.deepEqual(prior, saved);
    assert.deepEqual(restarted, { ...prior, position: center(prior.checkpoint),
      velocity: STILL, respawnTicks: 0, event: 'none', patternOffset: prior.tick });
    assert.equal(restarted.visited, prior.visited);
    assert.equal(hazardTick(restarted), 0);
    const moving = step(world, restarted, { x: 1, y: 0 });
    assert.equal(moving.tick, prior.tick + 1);
    assert.equal(hazardTick(moving), 1);
    assert.equal(moving.deaths, prior.deaths);
  }
});

test('CheckpointPuzzles_Win_DisablesEveryTimedHazardAndRestartCannotReopenRun', () => {
  const world = puzzle();
  let state = createState(world);
  for (let i = 0; i < 800 && !state.won; i++) state = step(world, state, { x: 1, y: 0 });
  assert.equal(state.won, true);
  assert.deepEqual(state.visited, ['6,2', '14,2']);
  for (const hazard of world.hazards) {
    assert.equal(simulation.hazardEnabled(world, hazard, state), false);
    assert.equal(lethalAt(world, hazardSample(hazard, 0).position, 0, state), null);
  }
  assert.equal(simulation.restartCheckpoint(world, state), state);
  assert.equal(step(world, state, STILL), state);
});

test('CheckpointPuzzles_Ascii_OnlyDisplaysEnabledTimedHazards', () => {
  const world = puzzle();
  for (const state of [createState(world), collectFirst(world)]) {
    const rows = ascii(world, state).split('\n');
    for (const hazard of world.hazards) {
      const sample = hazardSample(hazard, hazardTick(state)), p = sample.position;
      const enabled = hazard.sectionId === `section-${state.visited.length + 1}`;
      assert.equal(rows[Math.floor(p.y)][Math.floor(p.x)],
        enabled ? hazard.kind === 'saw' ? 'X' : sample.active ? '*' : 'o' : '.');
    }
  }
});

test('CheckpointPuzzles_TerrainVoidAndSpikes_RemainLethalDuringEveryProgressStage', () => {
  for (const tile of [' ', '!']) {
    const base = puzzle(), tiles = [...base.tiles];
    tiles[4] = `${tiles[4].slice(0, 3)}${tile}${tiles[4].slice(4)}`;
    const world = puzzle({ tiles }), cause = tile === ' ' ? 'void' : 'spikes';
    for (const prior of [createState(world), collectFirst(world)]) {
      let state = walkTo(world, prior, { x: 3.5, y: 2.5 });
      for (let i = 0; i < 100 && state.event !== 'death'; i++)
        state = step(world, state, { x: 0, y: 1 });
      assert.equal(state.deathCause, cause);
      assert.equal(lethalAt(world, { x: 3.5, y: 4.5 }, 0, { ...state, won: true }), cause);
    }
    assert.equal(lethalAt(world, { x: -1, y: -1 }, 0, createState(world)), 'void');
    assert.throws(() => lethalAt(world, { x: -1, y: -1 }, 0), /state/i);
  }
});

test('CheckpointPuzzles_LegacyAndGlobalWorlds_KeepGlobalHazardsAndRejectCheckpointRestart', () => {
  const global = worldFixture();
  for (const level of [global, parseLevel({ ...global, version: 1, resetPatternOnRetry: true })]) {
    const state = walkTo(level, createState(level), center(level.checkpoints[0]));
    assert.equal(state.patternOffset, 0);
    assert.throws(() => simulation.restartCheckpoint(level, state), /checkpoint/i);
    for (const hazard of level.hazards) {
      const tick = hazard.period - hazard.phase, sample = hazardSample(hazard, tick);
      assert.equal(lethalAt(level, sample.position, tick), hazard.kind);
      assert.equal(simulation.hazardEnabled(level, hazard, { ...state, won: true }), true);
      assert.equal(lethalAt(level, sample.position, tick, { ...state, won: true }), hazard.kind);
    }
  }
});
