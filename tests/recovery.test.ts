import assert from 'node:assert/strict';
import { test } from 'node:test';
import { center, type Level, type Point } from '../core/level.ts';
import { createState, distance, step, STILL, terrainAt, type State } from '../core/simulation.ts';
import { LEVELS } from '../data/levels.ts';
import { REPLAYS } from '../data/replays.ts';
import { RULES, TERRAIN } from '../data/terrain.ts';

const DIRECTIONS: readonly Point[] = [
  { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 },
  { x: -1, y: 0 }, STILL, { x: 1, y: 0 },
  { x: -1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 1 },
];

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
