import assert from 'node:assert/strict';
import { test } from 'node:test';
import { center, parseLevel, type Level, type Point } from '../core/level.ts';
import { createState, distance, hazardSample, hazardTick, step, STILL, terrainAt, type State } from '../core/simulation.ts';
import { worldFixture, walkTo } from './fixtures/world.ts';
import { LEVELS } from './fixtures/relay-levels.ts';
import { REPLAYS } from './fixtures/relay-replays.ts';
import { RULES, TERRAIN } from '../data/terrain.ts';

const DIRECTIONS: readonly Point[] = [
  { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 },
  { x: -1, y: 0 }, STILL, { x: 1, y: 0 },
  { x: -1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 1 },
];

test('Recovery_World_FirstDeathAndAll54RespawnTicks_KeepExactPulseAndSawClock', () => {
  const world = worldFixture();
  assert.equal(RULES.respawnTicks, 54);
  for (const visitedCount of [0, 1, 2]) {
    let state = createState(world);
    if (visitedCount) state = walkTo(world, state, center(world.checkpoints[visitedCount - 1]));
    const checkpoint = state.checkpoint;
    state = walkTo(world, state, { x: state.position.x, y: 4.5 });
    state = walkTo(world, state, { x: 4.5, y: 4.5 });
    while (!state.deaths) state = step(world, state,
      state.position.y < 5.48 ? { x: 0, y: 1 } : STILL);
    const dead = state, saved = structuredClone(dead);
    assert.equal(dead.deathCause, 'pulse');
    assert.equal(dead.respawnTicks, 54);
    assert.equal(dead.visited.length, visitedCount);
    for (let tick = 0; tick <= 54; tick++) {
      if (tick) state = step(world, state, { x: 1, y: 1 });
      assert.equal(state.tick, dead.tick + tick);
      assert.equal(hazardTick(state), state.tick);
      assert.equal(state.patternOffset, 0);
      assert.equal(state.respawnTicks, 54 - tick);
      assert.equal(state.deaths, 1);
      assert.deepEqual(state.visited, dead.visited);
      assert.deepEqual(state.velocity, STILL);
      assert.deepEqual(state.position, tick === 54 ? center(checkpoint) : dead.position);
      const pulse = hazardSample(world.hazards[0], hazardTick(state));
      assert.equal(pulse.cycle, tick, 'death is pulse cycle zero; no retry rewind');
      assert.equal(pulse.active, tick === 0, 'one lethal tick only');
      assert.equal(pulse.warning, false);
      const saw = hazardSample(world.hazards[1], hazardTick(state));
      const cycle = (dead.tick + tick + 30) % 240;
      const progress = cycle <= 120 ? cycle / 120 : (240 - cycle) / 120;
      assert.equal(saw.cycle, cycle);
      assert.ok(Math.abs(saw.position.x - (11.5 + 2 * progress)) < 1e-12);
      assert.equal(saw.position.y, 5.5);
    }
    assert.deepEqual(dead, saved, 'retained death snapshot is unchanged');
    state = step(world, state, STILL);
    assert.equal(state.deaths, 1);
    assert.deepEqual(state.position, center(checkpoint));
    for (let cycle = 56; cycle <= 120; cycle++) {
      state = step(world, state, STILL);
      const pulse = hazardSample(world.hazards[0], hazardTick(state));
      assert.equal(pulse.cycle, cycle % 120);
      assert.equal(pulse.warning, cycle >= 93 && cycle < 120, 'exact 27-tick warning');
      assert.equal(pulse.active, cycle === 120);
    }
    const resumedTick = state.tick;
    state = walkTo(world, state, { x: 21.9, y: 2.5 });
    assert.deepEqual(state.visited, ['6,2', '14,2']);
    assert.equal(state.deaths, 1, 'subsequent transitions retain the death count');
    assert.ok(state.tick > resumedTick);
    assert.equal(hazardTick(state), state.tick);
    while (!state.won) state = step(world, state, { x: 1, y: 0 });
    assert.equal(state.deaths, 1, 'the recovered run can finish without another death');
  }
});

test('Recovery_LegacyExplicitRetryReset_RewindsOnlyHazardsAfter54Ticks', () => {
  const world = worldFixture();
  for (const resetPatternOnRetry of [true, false]) {
    const level = parseLevel({ ...world, version: 1, resetPatternOnRetry });
    let state = walkTo(level, createState(level), { x: 4.5, y: 2.5 });
    while (!state.deaths) state = step(level, state,
      state.position.y < 5.48 ? { x: 0, y: 1 } : STILL);
    const dead = state;
    state = advance(level, state, 53, { x: 1, y: 0 });
    assert.equal(hazardTick(state), dead.tick + 53);
    state = step(level, state, { x: 1, y: 0 });
    assert.equal(state.tick, dead.tick + 54);
    assert.equal(state.deaths, 1);
    assert.equal(hazardTick(state), resetPatternOnRetry ? 0 : state.tick);
    for (const hazard of level.hazards)
      assert.deepEqual(hazardSample(hazard, hazardTick(state)),
        hazardSample(hazard, resetPatternOnRetry ? 0 : dead.tick + 54));
  }
});

function advance(level: Level, state: State, ticks: number, input = STILL) {
  for (let tick = 0; tick < ticks; tick++) state = step(level, state, input);
  return state;
}

function cycleLength(level: Level) {
  const periods = [...new Set(level.hazards.map(hazard => hazard.period))];
  assert.ok(periods.length <= 1, 'Extend the recovery driver if a course uses multiple periods.');
  return periods[0] ?? 1;
}

function waitForPhase(level: Level, state: State, phase: number, period: number) {
  return advance(level, state, ((phase - state.tick) % period + period) % period);
}

function dieByInput(level: Level, reached: State) {
  for (const input of DIRECTIONS) {
    let state = reached;
    for (let tick = 0; tick < 600 && !state.deaths && !state.won; tick++) {
      state = step(level, state, input);
      if (state.visited.length !== reached.visited.length) break;
    }
    if (state.deaths === 1 && state.visited.length === reached.visited.length) return state;
  }
  assert.fail(`${level.id}: no bounded death input found at ${JSON.stringify(reached.checkpoint)}`);
}

function witness(index: number) {
  const level = LEVELS[index];
  const inputs = REPLAYS[index].flatMap(command =>
    Array.from({ length: command.ticks }, () => ({ x: command.x, y: command.y })));
  const states = [createState(level)];
  for (const input of inputs) states.push(step(level, states.at(-1)!, input));
  assert.equal(states.at(-1)!.won, true);
  assert.equal(states.at(-1)!.deaths, 0);
  return { inputs, states };
}

function recoverySites(index: number) {
  const level = LEVELS[index], { inputs, states } = witness(index);
  return [level.spawn, ...level.checkpoints].map((checkpoint, visitedCount) => {
    const reached = visitedCount === 0 ? states[0] :
      states.find(state => state.event === 'checkpoint' && state.visited.length === visitedCount);
    assert.ok(reached, `${level.id}: checkpoint ${visitedCount} is reached by the actual witness`);
    const reference = states.filter(state =>
      state.visited.length === visitedCount && terrainAt(level, state.position).id === 'normal')
      .sort((a, b) => distance(a.position, center(checkpoint)) - distance(b.position, center(checkpoint)))[0];
    assert.ok(reference && distance(reference.position, center(checkpoint)) < RULES.markerRadius);
    return { checkpoint, reached, reference, inputs, dead: dieByInput(level, reached) };
  });
}

for (const [index, level] of LEVELS.entries()) {
  test(`Recovery_${level.id}_ActualDeathIgnoresHeldInputsUntilCheckpointRespawn`, () => {
    for (const { checkpoint, reached, dead } of recoverySites(index)) {
      assert.equal(dead.event, 'death');
      assert.ok(dead.deathCause);
      assert.equal(dead.respawnTicks, RULES.respawnTicks);
      assert.deepEqual(dead.checkpoint, checkpoint);
      assert.deepEqual(dead.visited, reached.visited);
      for (const input of DIRECTIONS) {
        let state = dead;
        for (let tick = 1; tick <= RULES.respawnTicks; tick++) {
          state = step(level, state, input);
          assert.equal(state.tick, dead.tick + tick);
          assert.equal(state.respawnTicks, RULES.respawnTicks - tick);
          assert.equal(state.deaths, 1);
          assert.deepEqual(state.velocity, STILL);
          assert.deepEqual(state.visited, reached.visited);
          assert.deepEqual(state.position, tick === RULES.respawnTicks ? center(checkpoint) : dead.position);
        }
        const released = step(level, state, STILL);
        assert.deepEqual(released.position, center(checkpoint));
        assert.equal(released.deaths, 1, 'no immediate repeat death on the safe checkpoint');
      }
    }
  });

  test(`Recovery_${level.id}_EveryCyclePhaseCanFinishFromEveryRespawnCenter`, t => {
    const period = cycleLength(level), sites = recoverySites(index);
    for (const { checkpoint, reference, inputs, dead } of sites) {
      const respawned = advance(level, dead, RULES.respawnTicks);
      assert.deepEqual(respawned.position, center(checkpoint));
      for (let phase = 0; phase < period; phase++) {
        let state = waitForPhase(level, respawned, phase, period);
        assert.equal(state.tick % period, phase);
        assert.equal(state.deaths, 1);
        // Rejoin the proven route using only cardinal keys on its safe staging tile.
        for (const axis of ['x', 'y'] as const) {
          const delta = reference.position[axis] - state.position[axis];
          const ticks = Math.round(Math.abs(delta) * RULES.tickRate / TERRAIN['.'].speed);
          const input = { x: axis === 'x' ? Math.sign(delta) : 0, y: axis === 'y' ? Math.sign(delta) : 0 };
          state = advance(level, state, ticks, input);
        }
        assert.ok(distance(state.position, reference.position) < 0.022, 'within keyboard-step rounding');
        state = waitForPhase(level, state, reference.tick % period, period);
        for (const input of inputs.slice(reference.tick)) state = step(level, state, input);
        state = advance(level, state, 120, inputs.at(-1)!);
        const label = `${level.id} checkpoint ${checkpoint.x},${checkpoint.y}, phase ${phase}`;
        assert.equal(state.deaths, 1, `${label}: no additional deaths`);
        assert.equal(state.won, true, `${label}: remaining course is solvable`);
        assert.deepEqual(state.visited, level.checkpoints.map(point => `${point.x},${point.y}`), label);
      }
    }
    t.diagnostic(`${sites.length} spawn/checkpoint sites x ${period} phases = ${sites.length * period} recovery runs`);
  });
}

test('Recovery_SeededDirectionalRunsAndRepeatedResets_PreserveStateInvariants', () => {
  function play(index: number, seed: number) {
    const level = LEVELS[index], baseline = createState(level);
    let state = baseline, random = seed, input = STILL;
    const roll = () => { random = (Math.imul(random, 1664525) + 1013904223) >>> 0; return random; };
    for (let tick = 0; tick < 1200; tick++) {
      if (tick % 400 === 0) {
        state = createState(level);
        assert.deepEqual(state, baseline, 'restart clears deaths, time, movement and checkpoint history');
      }
      if (tick % 17 === 0) input = DIRECTIONS[roll() % DIRECTIONS.length];
      const prior = state, saved = structuredClone(prior);
      state = step(level, prior, input);
      assert.deepEqual(prior, saved, 'movement never mutates a retained state');
      assert.ok(Number.isFinite(state.position.x) && Number.isFinite(state.position.y));
      assert.ok(Math.hypot(state.velocity.x, state.velocity.y) <= 4.8 + 1e-9);
      assert.equal(state.tick, prior.won ? prior.tick : prior.tick + 1);
      assert.ok(state.deaths === prior.deaths || state.deaths === prior.deaths + 1);
      assert.deepEqual(state.visited.slice(0, prior.visited.length), prior.visited);
      assert.equal(new Set(state.visited).size, state.visited.length);
      assert.ok(!terrainAt(level, state.position).solid, 'diagonal input cannot enter a wall');
      if (state.respawnTicks === 0) assert.equal(terrainAt(level, state.position).lethal, false);
    }
    return state;
  }
  for (let index = 0; index < LEVELS.length; index++) for (let seed = 1; seed <= 8; seed++) {
    assert.deepEqual(play(index, seed), play(index, seed), `deterministic level ${index}, seed ${seed}`);
  }
});
