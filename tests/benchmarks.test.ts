import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BENCHMARKS, BENCHMARK_FAMILIES, BENCHMARK_SURFACES } from '../data/benchmarks.ts';
import { BENCHMARK_REPLAYS, BENCHMARK_PROBES, type BenchmarkCommand } from '../data/benchmark-replays.ts';
import { LEVELS } from '../data/levels.ts';
import { parseLevel, type Level } from '../core/level.ts';
import { createState, restartCheckpoint, step, STILL } from '../core/simulation.ts';

function run(level: Level, commands: readonly BenchmarkCommand[]) {
  let state = createState(level);
  for (const command of commands) for (let i = 0; i < command.ticks; i++) {
    state = step(level, state, command);
    if (state.deaths || state.won) return state;
  }
  return state;
}

test('Benchmarks_Registry_HasSixOriginalFamiliesAndFourSurfacesOutsideProduction', () => {
  assert.equal(BENCHMARK_FAMILIES.length, 6);
  assert.deepEqual(BENCHMARK_SURFACES.map(s => s.tile), ['.', '~', '=', ':']);
  assert.equal(BENCHMARKS.length, 24);
  assert.equal(new Set(BENCHMARKS.map(b => b.level.id)).size, 24);
  assert.equal(LEVELS.some(l => BENCHMARKS.some(b => b.level.id === l.id)), false);
  for (const b of BENCHMARKS) {
    assert.ok(Object.isFrozen(b) && Object.isFrozen(b.level) && Object.isFrozen(b.level.hazards));
    assert.deepEqual(parseLevel(JSON.parse(JSON.stringify(b.level))), b.level);
    assert.equal(b.level.revision, 1);
    assert.equal(b.level.puzzleMode, 'checkpoint');
    assert.equal(b.level.sections.length, 1);
    assert.equal(b.level.checkpoints.length, 0);
    assert.equal(b.level.resetPatternOnRetry, false);
    assert.equal(b.level.tiles[b.level.spawn.y][b.level.spawn.x], '.');
    assert.equal(b.level.tiles[b.level.goal.y][b.level.goal.x], '.');
    assert.ok(b.level.hazards.length > 0);
    assert.ok(b.level.tiles.length <= 18 && b.level.tiles[0].length <= 18);
  }
});

test('Benchmarks_PairedVariants_ChangeOnlyTheMarkedSurfaceAndIdentity', () => {
  for (const family of BENCHMARK_FAMILIES) {
    const variants = BENCHMARKS.filter(b => b.familyId === family.id);
    assert.equal(variants.length, 4);
    assert.ok(family.question.length > 20);
    const baseline = variants[0].level;
    const comparable = (level: Level) => {
      const { id, name, description, tiles, ...rest } = level;
      return { ...rest, tiles: tiles.map(row => row.replace(/[~=:]/g, '.')) };
    };
    const masks: string[] = [];
    for (const b of variants) {
      assert.deepEqual(comparable(b.level), comparable(baseline), b.level.id);
      const surface = BENCHMARK_SURFACES.find(s => s.id === b.surfaceId)!;
      if (surface.tile !== '.') {
        const mask = b.level.tiles.map(row => [...row].map(c => c === surface.tile ? 'x' : ' ').join('')).join('\n');
        assert.ok(mask.includes('x'));
        masks.push(mask);
      }
    }
    assert.equal(new Set(masks).size, 1, family.id);
  }
});

test('Benchmarks_Staging_IsSafeAndStoppableThroughoutTwoPatternCycles', () => {
  for (const b of BENCHMARKS) {
    let state = createState(b.level);
    const period = Math.max(...b.level.hazards.map(h => h.period));
    for (let i = 0; i < period * 2; i++) state = step(b.level, state, STILL);
    assert.equal(state.deaths, 0, b.level.id);
    assert.deepEqual(state.position, createState(b.level).position);
    const reset = restartCheckpoint(b.level, state);
    assert.equal(reset.tick, state.tick);
    assert.equal(reset.patternOffset, state.tick);
  }
});

test('Benchmarks_Evidence_HasAnActualNormalBaselineForEveryFamily', () => {
  for (const b of BENCHMARKS.filter(b => b.surfaceId === 'normal'))
    assert.ok(BENCHMARK_REPLAYS[b.level.id], `Missing normal witness: ${b.level.id}`);
  for (const id of Object.keys(BENCHMARK_REPLAYS))
    assert.ok(BENCHMARKS.some(b => b.level.id === id), `Stale witness: ${id}`);
});

test('Benchmarks_PublishedWitnesses_AreExactDeathlessInputOnlyRoutesWithMeasuredMargins', t => {
  for (const b of BENCHMARKS) {
    const witness = BENCHMARK_REPLAYS[b.level.id];
    if (!witness) continue;
    assert.equal(witness.lateMargins.length, witness.commands.length);
    for (const c of witness.commands) {
      assert.ok(Number.isInteger(c.ticks) && c.ticks > 0);
      assert.ok([-1, 0, 1].includes(c.x) && [-1, 0, 1].includes(c.y));
    }
    const state = run(b.level, witness.commands);
    assert.equal(state.won, true, b.level.id);
    assert.equal(state.deaths, 0, b.level.id);
    assert.equal(state.tick, witness.ticks, b.level.id);
    assert.deepEqual(run(b.level, witness.commands), state);
    for (let at = 0; at < witness.commands.length; at++) {
      let margin = 0;
      for (let delta = 1; delta <= 24; delta++) {
        const commands = witness.commands.map((c, i) => ({ ...c, ticks: c.ticks + (i === at - 1 ? delta : 0) }));
        if (at === 0) commands.unshift({ ticks: delta, x: 0, y: 0 });
        const changed = run(b.level, commands);
        if (changed.deaths || !changed.won) break;
        margin = delta;
      }
      assert.equal(margin, witness.lateMargins[at], `${b.level.id} decision ${at}`);
    }
    t.diagnostic(`${b.level.id}: ${state.tick} ticks; late-input margins ${witness.lateMargins.join(',')} (cap 24)`);
  }
});

test('Benchmarks_NecessityProbes_ExposeTimingOrSteeringFailuresWithoutChangingPhysics', () => {
  assert.equal(BENCHMARK_PROBES.length, 6);
  for (const probe of BENCHMARK_PROBES) {
    const b = BENCHMARKS.find(b => b.level.id === probe.id)!;
    assert.ok(b, probe.id);
    const state = run(b.level, probe.commands);
    assert.equal(state.won, false, probe.id);
    assert.equal(state.deaths > 0 ? 'death' : 'unfinished', probe.outcome, probe.id);
    if (probe.outcome === 'death') {
      const without = run(parseLevel({ ...b.level, hazards: [] }), probe.commands);
      assert.equal(without.won, true, `${probe.id}: hazard-removal comparator must really finish`);
    }
  }
});
