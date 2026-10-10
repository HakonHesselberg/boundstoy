import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AFTERSHOCK_LEVELS, AFTERSHOCK_LESSONS, AFTERSHOCK_TARGETS } from '../data/aftershock.ts';
import { AFTERSHOCK_REPLAYS, AFTERSHOCK_MASTERY_REPLAYS } from '../data/aftershock-replays.ts';
import { FAILURE_REPLAYS, LANDING_FAILURE_REPLAYS } from './fixtures/aftershock-failures.ts';
import { createState, step, hazardTick, hazardSample, type State } from '../core/simulation.ts';
import { type Level } from '../core/level.ts';
import { RULES } from '../data/terrain.ts';

type Command = Readonly<{ ticks: number; x: number; y: number }>;
const command = (ticks: number, x = 0, y = 0): Command => ({ ticks, x, y });
const duration = (commands: readonly Command[]) => commands.reduce((n, c) => n + c.ticks, 0);
function trace(level: Level, commands: readonly Command[]) {
  const states: State[] = [createState(level)];
  for (const c of commands) for (let i = 0; i < c.ticks; i++) {
    if (states.at(-1)!.won || states.at(-1)!.deaths) return states;
    states.push(step(level, states.at(-1)!, c));
  }
  return states;
}
function finish(level: Level, commands: readonly Command[]) {
  let state = createState(level);
  for (const c of commands) for (let i = 0; i < c.ticks; i++) {
    state = step(level, state, c);
    if (state.won || state.deaths) return state;
  }
  return state;
}
function ranges(values: readonly number[]) {
  const result: [number, number][] = [];
  for (const value of values) {
    const last = result.at(-1);
    if (last && last[1] === value - 1) last[1] = value;
    else result.push([value, value]);
  }
  return result;
}

test('BT-028 replaces the three rooms, with compact immutable ground-only contracts', () => {
  assert.deepEqual(AFTERSHOCK_LEVELS.map(l => l.name), ['Borrowed Ground', 'Crosscurrent', 'Checkerboard']);
  assert.deepEqual(AFTERSHOCK_LEVELS.map(l => l.id),
    ['aftershock-borrowed-ground-v2', 'aftershock-crosscurrent-v1', 'aftershock-checkerboard-v1']);
  for (const value of [AFTERSHOCK_LEVELS, AFTERSHOCK_LESSONS, AFTERSHOCK_TARGETS]) assert.ok(Object.isFrozen(value));
  for (const registry of [AFTERSHOCK_LESSONS, AFTERSHOCK_TARGETS])
    assert.deepEqual(Object.keys(registry), AFTERSHOCK_LEVELS.map(l => l.id));
  for (const level of AFTERSHOCK_LEVELS) {
    assert.ok(Object.isFrozen(level) && Object.isFrozen(level.hazards) && Object.isFrozen(level.tiles));
    assert.match(level.tiles.join(''), /^[.# ]+$/);
    assert.ok(level.tiles.length <= 14 && level.tiles[0].length <= 18);
    assert.equal(level.resetPatternOnRetry, true);
    assert.equal(level.checkpoints.length, 0, 'single-puzzle maps end at the exit, not a redundant checkpoint');
    const sites = new Set<string>();
    for (const h of level.hazards) {
      assert.equal(h.kind, 'pulse');
      if (h.kind !== 'pulse') continue;
      assert.ok(Object.isFrozen(h));
      assert.equal(h.on, 1);
      assert.ok(h.period >= 120 && h.phase >= 0 && h.phase < h.period);
      assert.equal(level.tiles[h.y][h.x], '.');
      assert.ok(!sites.has(`${h.x},${h.y}`));
      sites.add(`${h.x},${h.y}`);
    }
    assert.ok(sites.size);
    for (const point of [level.spawn, level.goal, ...level.checkpoints])
      assert.equal(finish({ ...level, spawn: point, goal: { x: 0, y: 0 } }, [command(7200)]).deaths, 0);
    const lessons = AFTERSHOCK_LESSONS[level.id];
    assert.ok(Object.isFrozen(lessons) && lessons.length === level.checkpoints.length + 1);
    assert.ok(Object.isFrozen(lessons[0]) && lessons[0].hint.length <= 200);
  }
});

test('Six legal, frozen, unpadded zero-death witnesses; mastery changes movement, not idle padding', () => {
  for (const collection of [AFTERSHOCK_REPLAYS, AFTERSHOCK_MASTERY_REPLAYS]) {
    assert.ok(Object.isFrozen(collection) && collection.length === 3);
    collection.forEach((commands, i) => {
      assert.ok(Object.isFrozen(commands));
      for (const c of commands) {
        assert.ok(Object.isFrozen(c) && Number.isInteger(c.ticks) && c.ticks > 0);
        assert.ok([-1, 0, 1].includes(c.x) && [-1, 0, 1].includes(c.y));
      }
      const states = trace(AFTERSHOCK_LEVELS[i], commands), last = states.at(-1)!;
      assert.equal(last.deaths, 0, `${i}: death at ${last.tick}`);
      assert.equal(last.won, true, `${i}: ${JSON.stringify(last.position)}`);
      assert.equal(last.tick, duration(commands));
      assert.deepEqual(last.visited, AFTERSHOCK_LEVELS[i].checkpoints.map(p => `${p.x},${p.y}`));
      assert.equal(states.at(-2)!.won, false);
      assert.ok(last.tick <= 1080, 'do not restore long repetitive courses');
      assert.ok(commands[0].x || commands[0].y);
    });
  }
  AFTERSHOCK_LEVELS.forEach((level, i) => {
    const clear = AFTERSHOCK_REPLAYS[i], mastery = AFTERSHOCK_MASTERY_REPLAYS[i];
    assert.ok(duration(mastery) < AFTERSHOCK_TARGETS[level.id]);
    assert.ok(AFTERSHOCK_TARGETS[level.id] < duration(clear));
    assert.notDeepEqual(clear.filter(c => c.x || c.y), mastery.filter(c => c.x || c.y));
  });
});

test('Checkerboard is a complete connected patterned rectangle: LIGHT even first, DARK odd next', () => {
  const level = AFTERSHOCK_LEVELS[2];
  const pulses = level.hazards.filter(h => h.kind === 'pulse');
  const xs = pulses.map(h => h.x), ys = pulses.map(h => h.y);
  assert.equal(pulses.length, (Math.max(...xs) - Math.min(...xs) + 1) * (Math.max(...ys) - Math.min(...ys) + 1));
  const phases = [new Set<number>(), new Set<number>()];
  for (const h of pulses) phases[(h.x + h.y) % 2].add(h.phase);
  assert.equal(phases[0].size, 1);
  assert.equal(phases[1].size, 1);
  const period = pulses[0].period;
  assert.ok(pulses.every(h => h.period === period));
  const light = (period - [...phases[0]][0]) % period;
  const dark = (period - [...phases[1]][0]) % period;
  assert.ok(light > 0 && light < dark);
  assert.equal(dark - light, period / 2);
});

test('Input-driven failure fixtures end exactly at first death and retries restart the pattern after 54 ticks', () => {
  assert.equal(FAILURE_REPLAYS.length, 3);
  FAILURE_REPLAYS.forEach((commands, i) => {
    const level = AFTERSHOCK_LEVELS[i], states = trace(level, commands);
    let last = states.at(-1)!;
    assert.equal(last.deaths, 1);
    assert.deepEqual(last.visited, []);
    assert.equal(last.deathCause, 'pulse');
    assert.equal(last.tick, duration(commands));
    assert.equal(states.at(-2)!.deaths, 0);
    for (let tick = 0; tick < 54; tick++) last = step(level, last, command(1));
    assert.equal(last.respawnTicks, 0);
    assert.equal(hazardTick(last), 0);
    assert.equal(last.deaths, 1);
    assert.equal(hazardTick(step(level, last, command(1))), 1);
  });
});

function travelled(states: readonly State[]) {
  return states.slice(1).reduce((n, s, i) => n
    + Math.hypot(s.position.x - states[i].position.x, s.position.y - states[i].position.y), 0);
}

test('Targets reward real movement savings, not manufactured idle comparators', t => {
  const ticks = [[752, 613], [620, 561], [711, 503]];
  AFTERSHOCK_LEVELS.forEach((level, i) => {
    const clear = trace(level, AFTERSHOCK_REPLAYS[i]), mastery = trace(level, AFTERSHOCK_MASTERY_REPLAYS[i]);
    assert.deepEqual([clear.at(-1)!.tick, mastery.at(-1)!.tick], ticks[i]);
    assert.ok(travelled(clear) - travelled(mastery) > 1.7, 'actual distance saved');
    assert.ok(duration(AFTERSHOCK_MASTERY_REPLAYS[i]) <= duration(AFTERSHOCK_REPLAYS[i]) * 0.91);
    if (i < 2) assert.ok(AFTERSHOCK_REPLAYS[i].every(c => c.x || c.y));
    t.diagnostic(`${level.name}: clear/mastery ${ticks[i].join('/')} ticks; `
      + `${travelled(clear).toFixed(3)}/${travelled(mastery).toFixed(3)} tiles; target ${AFTERSHOCK_TARGETS[level.id]}`);
  });
});

test('Final landing is not a checkpoint: backtracking deaths restart the short puzzle', t => {
  assert.deepEqual(LANDING_FAILURE_REPLAYS.map(f => f.index), [0, 1, 2]);
  for (const fixture of LANDING_FAILURE_REPLAYS) {
    const level = AFTERSHOCK_LEVELS[fixture.index];
    let state = finish(level, fixture.approach);
    assert.equal(state.tick, duration(fixture.approach));
    assert.equal(state.won, false);
    assert.equal(state.deaths, 0);
    assert.deepEqual(state.checkpoint, level.spawn);
    assert.deepEqual(state.visited, []);
    for (const c of fixture.failure) for (let n = 0; n < c.ticks; n++) {
      assert.equal(state.deaths, 0, 'failure must end at its FIRST death');
      state = step(level, state, c);
    }
    assert.equal(state.deaths, 1);
    assert.equal(state.deathCause, 'pulse');
    const deathTick = state.tick;
    for (let n = 0; n < RULES.respawnTicks; n++) state = step(level, state, command(1));
    assert.equal(state.tick, deathTick + RULES.respawnTicks);
    assert.equal(hazardTick(state), 0);
    assert.deepEqual(state.position, createState(level).position);
    const recovery = AFTERSHOCK_REPLAYS[fixture.index];
    for (const c of recovery) for (let n = 0; n < c.ticks; n++) {
      assert.equal(state.won, false, 'recovery also ends exactly on win');
      state = step(level, state, c);
      assert.equal(state.deaths, 1);
    }
    assert.equal(state.won, true);
    assert.equal(state.tick, deathTick + RULES.respawnTicks + duration(recovery));
    assert.equal(deathTick, [715, 530, 514][fixture.index]);
    t.diagnostic(`${level.name}: backtrack death ${deathTick}; full puzzle replay ${duration(recovery)} ticks`);
  }
});

test('Final-puzzle guidance never promises a checkpoint on the exit walk', () => {
  for (const level of AFTERSHOCK_LEVELS) {
    assert.equal(AFTERSHOCK_LESSONS[level.id].length, 1);
    assert.doesNotMatch(level.description, /bank|checkpoint/i);
    assert.doesNotMatch(AFTERSHOCK_LESSONS[level.id][0].hint, /bank|checkpoint/i);
  }
});

test('Borrowed Ground: tile sequence, expiring elbow, and an actual retreat/transfer decision', () => {
  const level = AFTERSHOCK_LEVELS[0];
  const flashAt = (x: number, y: number) => {
    const h = level.hazards.find(h => h.kind === 'pulse' && h.x === x && h.y === y)!;
    return (h.period - h.phase) % h.period;
  };
  assert.deepEqual([2, 3, 4].map(x => flashAt(x, 2)), [1, 36, 71]);
  assert.equal(flashAt(5, 2), 190);
  assert.deepEqual([3, 4, 5, 6].map(y => flashAt(5, y)), [110, 145, 180, 215]);
  assert.deepEqual([7, 8, 9].map(x => flashAt(x, 6)), [285, 320, 355]);
  const clear = trace(level, AFTERSHOCK_REPLAYS[0]), mastery = trace(level, AFTERSHOCK_MASTERY_REPLAYS[0]);
  assert.ok(clear[190].position.x < 4.3, 'borrow the spent approach while the elbow flashes');
  assert.ok(clear[233].position.x > 5.4, 'return to make the transfer');
  assert.ok(mastery[190].position.y > 4, 'direct transfer already cleared the elbow');
  const noRetreat = AFTERSHOCK_REPLAYS[0].map((c, i) => i === 1 || i === 2 ? command(c.ticks) : c);
  assert.equal(finish(level, noRetreat).tick, 190);
  assert.equal(finish(level, noRetreat).deathCause, 'pulse');
});

test('Crosscurrent: all four lanes participate, and removing lateral movement is lethal', () => {
  const level = AFTERSHOCK_LEVELS[1];
  assert.equal(level.hazards.length, 9 * 4);
  for (let x = 2; x <= 10; x++) for (let y = 2; y <= 5; y++) {
    const h = level.hazards.find(h => h.kind === 'pulse' && h.x === x && h.y === y)!;
    assert.equal((h.period - h.phase) % h.period, (80 + (x - 2) * 30 + (5 - y) * 70) % 300);
    assert.equal(level.tiles[y][x], '.');
  }
  for (const [i, commands] of [AFTERSHOCK_REPLAYS[1], AFTERSHOCK_MASTERY_REPLAYS[1]].entries()) {
    const states = trace(level, commands);
    const lanes = new Set(states.filter(s => s.position.x >= 2 && s.position.x < 11).map(s => Math.floor(s.position.y)));
    assert.deepEqual([...lanes].sort(), i === 0 ? [2, 3, 4, 5] : [2, 3, 4]);
  }
  const noLateral = AFTERSHOCK_MASTERY_REPLAYS[1].map(c => ({ ...c, y: 0 }));
  const last = finish(level, noLateral);
  assert.equal(last.deathCause, 'pulse');
  assert.equal(last.tick, 320);
});

test('Checkerboard: both group flashes matter; ordinary observations and mastery colour transfer are real', () => {
  const level = AFTERSHOCK_LEVELS[2];
  for (const commands of [AFTERSHOCK_REPLAYS[2], AFTERSHOCK_MASTERY_REPLAYS[2]]) {
    const states = trace(level, commands);
    for (const [tick, safeParity] of [[154, 1], [334, 0]]) {
      const p = states[tick].position;
      assert.equal((Math.floor(p.x) + Math.floor(p.y)) % 2, safeParity);
      assert.ok(p.x >= 2 && p.x < 10, 'both flashes occur while still in the grid');
    }
  }
  for (const [pause, death] of [[1, 154], [3, 334]]) {
    const last = finish(level, AFTERSHOCK_REPLAYS[2].filter((_, i) => i !== pause));
    assert.equal(last.deathCause, 'pulse');
    assert.equal(last.tick, death);
  }
  const wrongColour = AFTERSHOCK_MASTERY_REPLAYS[2].map((c, i) => i === 2 ? command(c.ticks) : c);
  assert.equal(finish(level, wrongColour).deathCause, 'pulse');
  assert.equal(finish(level, wrongColour).tick, 334);
});

test('No hazard-free bypass or single-direction win; damage remains one tick with harmless aftermath', () => {
  assert.equal(RULES.pulseWarningTicks, 27);
  for (const level of AFTERSHOCK_LEVELS) {
    for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1])
      assert.equal(finish(level, [command(1600, x, y)]).won, false, `${level.name}: ${x},${y}`);
    const blocked = new Set(level.hazards.filter(h => h.kind === 'pulse').map(h => `${h.x},${h.y}`));
    const pending = [level.spawn], seen = new Set<string>();
    while (pending.length) {
      const p = pending.pop()!, key = `${p.x},${p.y}`;
      if (blocked.has(key) || seen.has(key) || level.tiles[p.y]?.[p.x] !== '.') continue;
      seen.add(key);
      assert.notDeepEqual(p, level.goal, 'even diagonal connectivity must cross the pattern');
      for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1])
        if (x || y) pending.push({ x: p.x + x, y: p.y + y });
    }
    for (const h of level.hazards) {
      const flash = h.period - h.phase;
      assert.equal(hazardSample(h, flash - RULES.pulseWarningTicks).warning, true);
      assert.equal(hazardSample(h, flash).active, true);
      for (let tick = 1; tick <= 36; tick++) assert.equal(hazardSample(h, flash + tick).active, false);
    }
  }
});

// Exact COMPLETE cycles, including disconnected bands and wraparound. Extra
// local delay is real idle input at the reached decision, never a state edit.
const launchEvidence = [
  { index: 0, mastery: false, cycle: 360, bands: [[0, 36], [78, 154], [287, 295], [352, 359]] },
  { index: 0, mastery: true, cycle: 360, bands: [[0, 35], [78, 254], [352, 359]] },
  { index: 1, mastery: false, cycle: 300, bands: [[0, 18], [177, 299]] },
  { index: 1, mastery: true, cycle: 300, bands: [[0, 50], [63, 75], [236, 299]] },
  { index: 2, mastery: false, cycle: 360, bands: [[0, 29], [352, 359]] },
  { index: 2, mastery: true, cycle: 360, bands: [[0, 24], [43, 66], [109, 118], [322, 337], [350, 359]] },
];
for (const evidence of launchEvidence) {
  test(`${AFTERSHOCK_LEVELS[evidence.index].name} ${evidence.mastery ? 'mastery' : 'clear'}: complete launch-cycle evidence`, t => {
    const level = AFTERSHOCK_LEVELS[evidence.index];
    const commands = (evidence.mastery ? AFTERSHOCK_MASTERY_REPLAYS : AFTERSHOCK_REPLAYS)[evidence.index];
    assert.ok(level.hazards.every(h => h.period === evidence.cycle));
    const valid: number[] = [];
    for (let delay = 0; delay < evidence.cycle; delay++) {
      const last = finish(level, [command(delay), ...commands]);
      if (last.won && !last.deaths) valid.push(delay);
      else assert.equal(last.deathCause, 'pulse');
    }
    const bands = ranges(valid);
    assert.deepEqual(bands, evidence.bands);
    const first = bands[0], last = bands.at(-1)!;
    assert.equal(first[0], 0);
    assert.equal(last[1], evidence.cycle - 1);
    assert.ok(first[1] + 1 + evidence.cycle - last[0] >= 24, 'contiguous window around authored launch, including wrap');
    t.diagnostic(`modulo ${evidence.cycle}: ${JSON.stringify(bands)}`);
  });
}

const localEvidence = [
  { index: 0, mastery: false, point: 1, bands: [[0, 36]] },
  { index: 0, mastery: false, point: 2, bands: [[0, 154]] },
  { index: 0, mastery: false, point: 3, bands: [[0, 154], [237, 295]] },
  { index: 0, mastery: false, point: 4, bands: [[0, 154]] },
  { index: 0, mastery: true, point: 1, bands: [[0, 35]] },
  { index: 0, mastery: true, point: 2, bands: [[0, 254]] },
  { index: 1, mastery: false, point: 1, bands: [[0, 24]] },
  { index: 1, mastery: false, point: 2, bands: [[0, 108]] },
  { index: 1, mastery: true, point: 1, bands: [[0, 167]] },
  { index: 2, mastery: false, point: 2, bands: [[0, 29]] },
  { index: 2, mastery: false, point: 4, bands: [[0, 29], [72, 96], [139, 162]] },
  { index: 2, mastery: true, point: 1, bands: [[0, 24], [43, 76], [90, 118]] },
  { index: 2, mastery: true, point: 2, bands: [[0, 29], [43, 76], [90, 118]] },
  { index: 2, mastery: true, point: 3, bands: [[0, 29], [43, 76], [90, 171]] },
  { index: 2, mastery: true, point: 4, bands: [[0, 171]] },
];
test('Every in-field turn/transfer has a complete measured local-delay cycle and >=24-tick observation window', t => {
  for (const e of localEvidence) {
    const level = AFTERSHOCK_LEVELS[e.index], valid: number[] = [];
    const commands = (e.mastery ? AFTERSHOCK_MASTERY_REPLAYS : AFTERSHOCK_REPLAYS)[e.index];
    for (let delay = 0; delay < level.hazards[0].period; delay++) {
      const shifted = [...commands.slice(0, e.point), command(delay), ...commands.slice(e.point)];
      if (finish(level, shifted).won) valid.push(delay);
    }
    assert.deepEqual(ranges(valid), e.bands, `${level.name}, ${e.mastery}, command ${e.point}`);
    assert.ok(e.bands[0][0] === 0 && e.bands[0][1] >= 23);
    t.diagnostic(`${level.name} ${e.mastery ? 'mastery' : 'clear'} before command ${e.point}: ${JSON.stringify(e.bands)}`);
  }
});

test('Spatial first-turn tolerances: exhaustive -80..80 input-tick sweep, with later approach compensation', t => {
  const evidence = [
    { index: 0, mastery: false, compensate: 4, bands: [[-9, 18]] },
    { index: 0, mastery: true, compensate: 2, bands: [[-9, 35]] },
    { index: 1, mastery: false, compensate: 2, bands: [[-80, 24], [30, 54], [63, 80]] },
    { index: 1, mastery: true, compensate: 1, bands: [[-80, 80]] },
    { index: 2, mastery: false, compensate: 4, bands: [[-12, 12]] },
    { index: 2, mastery: true, compensate: 2, bands: [[-10, 24]] },
  ];
  for (const e of evidence) {
    const level = AFTERSHOCK_LEVELS[e.index], valid: number[] = [];
    const commands = (e.mastery ? AFTERSHOCK_MASTERY_REPLAYS : AFTERSHOCK_REPLAYS)[e.index];
    for (let delta = -80; delta <= 80; delta++) {
      // Change where the first turn happens and compensate time later. Ninety
      // extra safe-exit inputs let displaced lines finish; ONLY this probe has
      // that allowance, never exported winning witnesses. Diagonal variants
      // may use the room walls for alignment; this is not a no-contact claim.
      const shifted = commands.map((c, i) => ({ ...c, ticks: c.ticks
        + (i === 0 ? delta : i === e.compensate ? -delta : i === commands.length - 1 ? 90 : 0) }));
      if (shifted.some(c => c.ticks < 0)) continue;
      if (finish(level, shifted).won) valid.push(delta);
    }
    const bands = ranges(valid);
    assert.deepEqual(bands, e.bands);
    const authored = bands.find(([a, b]) => a <= 0 && b >= 0)!;
    assert.ok(authored[1] - authored[0] + 1 >= 24);
    t.diagnostic(`${level.name} ${e.mastery ? 'mastery' : 'clear'}: ${JSON.stringify(bands)} `
      + '(bounded spatial probe, not an unrestricted timing cycle)');
  }
});
