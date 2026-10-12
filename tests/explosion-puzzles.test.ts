import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EXPLOSION_PUZZLES } from '../data/explosion-puzzles.ts';
import { EXPLOSION_REPLAYS, EXPLOSION_PROBES, COMBINATION_RECOVERY } from '../data/explosion-replays.ts';
import { parseLevel, type Level } from '../core/level.ts';
import { createState, step, lethalAt, restartCheckpoint, reachesCheckpoint, type State } from '../core/simulation.ts';
import { LEVELS } from '../data/levels.ts';
import type { BenchmarkCommand } from '../data/benchmark-replays.ts';

function run(level: Level, commands: readonly BenchmarkCommand[], initial: State = createState(level)) {
  let state = initial;
  for (const c of commands) for (let i = 0; i < c.ticks && !state.won && state.deaths === initial.deaths; i++)
    state = step(level, state, c);
  return state;
}

test('ExplosionPuzzles_Registry_SixSeparateImmutableNormalGroundPulseLevels', () => {
  assert.equal(EXPLOSION_PUZZLES.length, 6);
  assert.equal(new Set(EXPLOSION_PUZZLES.map(p => p.level.id)).size, 6);
  for (const { level, hints } of EXPLOSION_PUZZLES) {
    assert.ok(Object.isFrozen(level) && Object.isFrozen(level.hazards));
    assert.deepEqual(parseLevel(JSON.parse(JSON.stringify(level))), level);
    assert.ok(level.tiles.every(row => /^[.#]+$/.test(row)));
    assert.ok(level.hazards.length > 0 && level.hazards.every(h => h.kind === 'pulse' && h.on === 1));
    assert.equal(level.puzzleMode, 'checkpoint');
    assert.equal(level.revision, 1);
    assert.equal(hints.length, level.sections.length);
    assert.equal(LEVELS.some(l => l.id === level.id), false);
    assert.equal(level.checkpoints.length, level.id === 'puzzle-combination' ? 1 : 0);
    let idle = createState(level);
    for (let i = 0; i < 1200; i++) idle = step(level, idle, { x: 0, y: 0 });
    assert.equal(idle.deaths, 0);
  }
});

test('ExplosionPuzzles_Refuges_ExplodeAndStraightDashCannotReplaceThePockets', () => {
  const level = EXPLOSION_PUZZLES[2].level;
  const initial = createState(level);
  for (const point of [{ x: 5.2, y: 5.5 }, { x: 9.8, y: 10.5 }]) {
    assert.equal(lethalAt(level, point, 30, initial), 'pulse');
    assert.equal(lethalAt(level, point, 29, initial), null);
    assert.equal(lethalAt(level, point, 31, initial), null);
  }
  for (let wait = 0; wait < 360; wait++) {
    const result = run(level, [{ ticks: wait, x: 0, y: 0 }, { ticks: 500, x: 0, y: 1 }]);
    assert.ok(result.deaths > 0 && !result.won, `straight dash at phase ${wait}`);
  }
  let state = initial;
  const pockets = new Set<string>();
  for (const c of EXPLOSION_REPLAYS[level.id].commands) for (let i = 0; i < c.ticks && !state.won; i++) {
    state = step(level, state, c);
    if (state.position.x < 6) pockets.add('left');
    if (state.position.x > 9) pockets.add('right');
  }
  assert.deepEqual([...pockets].sort(), ['left', 'right']);
});

test('ExplosionPuzzles_CrossingWaves_UseDistinctAxesAndRequireATurn', () => {
  const level = EXPLOSION_PUZZLES[4].level;
  const pulses = level.hazards.filter(h => h.kind === 'pulse');
  assert.ok(new Set(pulses.filter(h => h.x < 9).map(h => h.phase)).size > 3);
  assert.ok(new Set(pulses.filter(h => h.x >= 9).map(h => h.phase)).size > 3);
  for (const direction of [{ x: 1, y: 0 }, { x: 0, y: -1 }, { x: 1, y: -1 }])
    assert.equal(run(parseLevel({ ...level, hazards: [] }), [{ ticks: 1000, ...direction }]).won, false);
});

test('ExplosionPuzzles_Combination_CheckpointIsSafeWideAndRecoversAfterActualDeath', () => {
  const level = EXPLOSION_PUZZLES[5].level, checkpoint = level.checkpoints[0];
  assert.ok(level.goal.x - checkpoint.x >= 8);
  for (const y of [3.21, 3.5, 4.5, 5.5, 5.79])
    assert.equal(reachesCheckpoint(level, { x: 12.5, y }, checkpoint), true);
  let state = createState(level);
  assert.equal(lethalAt(level, { x: 16.5, y: 2.5 }, 100, state), null, 'future grid dormant');
  outer: for (const c of EXPLOSION_REPLAYS[level.id].commands) for (let i = 0; i < c.ticks; i++) {
    state = step(level, state, c);
    assert.equal(state.deaths, 0);
    if (state.event === 'checkpoint') break outer;
  }
  assert.equal(state.visited.length, 1);
  assert.equal(state.patternOffset, state.tick);
  assert.equal(lethalAt(level, { x: 16.5, y: 2.5 }, 100, state), 'pulse');
  assert.equal(lethalAt(level, { x: 3.5, y: 4.5 }, 110, state), null, 'completed wave disabled');
  const atCheckpoint = restartCheckpoint(level, state);
  const idle = run(level, [{ ticks: 960, x: 0, y: 0 }], atCheckpoint);
  assert.equal(idle.deaths, 0);
  assert.deepEqual(idle.position, atCheckpoint.position);
  const dead = run(level, [{ ticks: 600, x: 1, y: 0 }], state);
  assert.equal(dead.deaths, 1, 'input-only downstream death');
  const reset = restartCheckpoint(level, dead);
  assert.equal(reset.tick, dead.tick);
  assert.equal(reset.deaths, 1);
  assert.deepEqual(reset.position, { x: 12.5, y: 4.5 });
  const recovered = run(level, COMBINATION_RECOVERY, reset);
  assert.equal(recovered.won, true);
  assert.equal(recovered.deaths, 1);
  assert.equal(recovered.tick - reset.tick, 605);
});

test('ExplosionPuzzles_Witnesses_ExactDeathlessRoutesAndAtLeastTwelveTickLateMargins', t => {
  for (const { level } of EXPLOSION_PUZZLES) {
    const witness = EXPLOSION_REPLAYS[level.id];
    assert.ok(witness, level.id);
    const result = run(level, witness.commands);
    assert.equal(result.won, true, level.id);
    assert.equal(result.deaths, 0, level.id);
    assert.equal(result.tick, witness.ticks, level.id);
    assert.equal(witness.lateMargins.length, witness.commands.length);
    for (let at = 0; at < witness.commands.length; at++) {
      let margin = 0;
      for (let delay = 1; delay <= 24; delay++) {
        const commands = witness.commands.map((c, i) => ({ ...c, ticks: c.ticks + (i === at - 1 ? delay : 0) }));
        if (at === 0) commands.unshift({ ticks: delay, x: 0, y: 0 });
        const changed = run(level, commands);
        if (changed.deaths || !changed.won) break;
        margin = delay;
      }
      assert.equal(margin, witness.lateMargins[at], `${level.id} input ${at}`);
      assert.ok(margin >= 12, `${level.id} input ${at} too tight: ${margin}`);
    }
    t.diagnostic(`${level.id}: ${result.tick} ticks, margins ${witness.lateMargins.join(',')}`);
  }
});

test('ExplosionPuzzles_FailureProbes_HazardsMatterWithoutWeakeningMovement', () => {
  assert.equal(EXPLOSION_PROBES.length, 6);
  for (const { id, commands } of EXPLOSION_PROBES) {
    const level = EXPLOSION_PUZZLES.find(p => p.level.id === id)!.level;
    assert.ok(run(level, commands).deaths > 0, id);
    assert.equal(run(parseLevel({ ...level, hazards: [] }), commands).won, true, id);
  }
});
