import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AFTERSHOCK_LEVELS, AFTERSHOCK_LESSONS, AFTERSHOCK_TARGETS } from '../data/aftershock.ts';
import { AFTERSHOCK_REPLAYS, AFTERSHOCK_MASTERY_REPLAYS } from '../data/aftershock-replays.ts';
import { createState, step, type State } from '../core/simulation.ts';
import { type Level } from '../core/level.ts';

type Command = Readonly<{ ticks: number; x: number; y: number }>;
function trace(level: Level, commands: readonly Command[]) {
  const states: State[] = [createState(level)];
  for (const command of commands) for (let i = 0; i < command.ticks; i++) {
    if (states.at(-1)!.won || states.at(-1)!.deaths) return states;
    states.push(step(level, states.at(-1)!, command));
  }
  return states;
}
const duration = (commands: readonly Command[]) => commands.reduce((n, c) => n + c.ticks, 0);
function finish(level: Level, commands: readonly Command[]) {
  let state = createState(level);
  for (const command of commands) for (let i = 0; i < command.ticks; i++) {
    state = step(level, state, command);
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

test('Aftershock contract: only three distinct compact normal-ground pulse encounters', () => {
  assert.deepEqual(AFTERSHOCK_LEVELS.map(l => l.name), ['Slipstream', 'Borrowed Ground', 'The Cut']);
  assert.equal(new Set(AFTERSHOCK_LEVELS.map(l => l.id)).size, 3);
  assert.equal(new Set(AFTERSHOCK_LEVELS.map(l => l.tiles.join('\n'))).size, 3);
  assert.ok(Object.isFrozen(AFTERSHOCK_LEVELS));
  assert.ok(Object.isFrozen(AFTERSHOCK_LESSONS) && Object.isFrozen(AFTERSHOCK_TARGETS));
  assert.deepEqual(Object.keys(AFTERSHOCK_LESSONS), AFTERSHOCK_LEVELS.map(l => l.id));
  assert.deepEqual(Object.keys(AFTERSHOCK_TARGETS), AFTERSHOCK_LEVELS.map(l => l.id));
  for (const level of AFTERSHOCK_LEVELS) {
    assert.ok(Object.isFrozen(level) && Object.isFrozen(level.tiles) && Object.isFrozen(level.hazards));
    assert.match(level.tiles.join(''), /^[.# ]+$/);
    assert.equal(level.checkpoints.length, 0, 'whole-encounter retry, not checkpoint fragments');
    assert.ok(level.tiles.length >= 6 && level.tiles.length <= 32);
    assert.ok(level.tiles[0].length >= 8 && level.tiles[0].length <= 40);
    assert.ok(level.hazards.length > 0 && level.hazards.length <= 80);
    const sites = new Set<string>();
    for (const h of level.hazards) {
      assert.equal(h.kind, 'pulse');
      if (h.kind !== 'pulse') continue;
      assert.equal(h.on, 1);
      assert.ok(h.period >= 120 && h.period <= 3600 && h.phase >= 0 && h.phase < h.period);
      assert.equal(level.tiles[h.y][h.x], '.');
      assert.ok(!sites.has(`${h.x},${h.y}`), 'no stacked pulses');
      sites.add(`${h.x},${h.y}`);
    }
    const lessons = AFTERSHOCK_LESSONS[level.id];
    assert.equal(lessons.length, level.checkpoints.length + 1);
    assert.ok(Object.isFrozen(lessons));
    for (const lesson of lessons) {
      assert.ok(Object.isFrozen(lesson));
      assert.ok(lesson.title.length && lesson.hint.length && lesson.hint.length <= 200);
    }
    // A start and goal must remain safe at every possible phase, not just at arrival.
    for (const point of [level.spawn, level.goal]) {
      const levelAtSite = { ...level, spawn: point, goal: level.spawn === point ? level.goal : level.spawn };
      const states = trace(levelAtSite, [{ ticks: 7200, x: 0, y: 0 }]);
      assert.equal(states.at(-1)!.deaths, 0);
    }
  }
});

test('All six witnesses use legal keys, zero deaths, and end exactly on the winning tick', () => {
  for (const collection of [AFTERSHOCK_REPLAYS, AFTERSHOCK_MASTERY_REPLAYS]) {
    assert.ok(Object.isFrozen(collection));
    assert.equal(collection.length, 3);
    for (const [i, commands] of collection.entries()) {
      assert.ok(Object.isFrozen(commands));
      for (const c of commands) {
        assert.ok(Object.isFrozen(c));
        assert.ok(Number.isInteger(c.ticks) && c.ticks > 0);
        assert.ok([-1, 0, 1].includes(c.x) && [-1, 0, 1].includes(c.y));
      }
      const states = trace(AFTERSHOCK_LEVELS[i], commands), last = states.at(-1)!;
      assert.equal(last.deaths, 0, `${i}: death at ${last.tick}`);
      assert.equal(last.won, true, `${i}: stopped at ${JSON.stringify(last.position)}`);
      assert.equal(last.tick, duration(commands), 'no post-win padding');
      assert.equal(states.at(-2)!.won, false);
      assert.ok(last.tick >= 1200 && last.tick <= 2400, `${i}: 10–20 second encounter`);
    }
  }
});

test('Mastery earns meaningful gains; targets separate clean clears from the technique witnesses', () => {
  AFTERSHOCK_LEVELS.forEach((level, i) => {
    const clear = AFTERSHOCK_REPLAYS[i], mastery = AFTERSHOCK_MASTERY_REPLAYS[i];
    assert.ok(duration(mastery) <= duration(clear) * (i === 2 ? 0.8 : 0.9));
    if (i === 2) assert.ok(duration(clear) - duration(mastery) >= 240);
    assert.ok(duration(mastery) < AFTERSHOCK_TARGETS[level.id]);
    assert.ok(AFTERSHOCK_TARGETS[level.id] < duration(clear));
    assert.ok(clear[0].x || clear[0].y, 'clear starts moving, not artificially padded at spawn');
    assert.ok(mastery[0].x || mastery[0].y);
    assert.notDeepEqual(clear.filter(c => c.x || c.y), mastery.filter(c => c.x || c.y),
      'technique must change movement, not just delete arbitrary waits');
  });

});

test('Borrowed Ground: the first refuge expires before a wait-for-flash transfer can clear it', () => {
  const level = AFTERSHOCK_LEVELS[1];
  const camp = trace(level, [{ ticks: 133, x: 1, y: 0 }, { ticks: 120, x: 0, y: 0 }]).at(-1)!;
  assert.equal(camp.deathCause, 'pulse');
  assert.equal(camp.tick, 175);
  // Reach the first refuge at 133, watch the next field flash at 155,
  // THEN move. This apparently cautious strategy fails on the refuge at 175.
  const late = trace(level, [
    { ticks: 133, x: 1, y: 0 }, { ticks: 22, x: 0, y: 0 }, { ticks: 234, x: 0, y: 1 },
  ]).at(-1)!;
  assert.equal(late.deathCause, 'pulse');
  assert.equal(late.tick, 175);
  assert.ok(late.position.y < 3.14, 'the refuge, not the distant next field, catches the late transfer');
});

test('Slipstream: blindly running, ignoring cadence changes, or omitting bends cannot clear', () => {
  const level = AFTERSHOCK_LEVELS[0], commands = AFTERSHOCK_MASTERY_REPLAYS[0];
  const blind = trace(level, [{ ticks: 2400, x: 1, y: 0 }]).at(-1)!;
  assert.equal(blind.deathCause, 'pulse');
  assert.equal(blind.tick, 197);
  assert.equal(trace(level, commands.filter(c => c.x || c.y)).at(-1)!.deathCause, 'pulse');
  for (const index of [1, 5, 9]) {
    const missedRetime = trace(level, commands.filter((_, i) => i !== index)).at(-1)!;
    assert.equal(missedRetime.deathCause, 'pulse', `cadence change ${index} is necessary`);
  }
  for (const index of [3, 4, 7, 8]) {
    const missedTurn = commands.map((c, i) => i === index ? { ...commands[index - 1], ticks: c.ticks } : c);
    assert.equal(trace(level, missedTurn).at(-1)!.won, false, `bend ${index} is necessary`);
  }
});

test('Slipstream clear: observation stops are not padded by removable whole cycles', () => {
  const level = AFTERSHOCK_LEVELS[0], commands = AFTERSHOCK_REPLAYS[0];
  for (const [index, c] of commands.entries()) {
    if (c.x || c.y) continue;
    assert.ok(c.ticks < 132, 'no whole-cycle idle padding');
    if (c.ticks < 20) continue;
    const impatient = commands.map((command, i) => i === index ? { ...command, ticks: 4 } : command);
    assert.equal(finish(level, impatient).deathCause, 'pulse', `observation stop ${index} cannot be skipped`);
  }
});

test('Borrowed Ground: ordinary recovery really shuttles between two expiring floors', () => {
  const level = AFTERSHOCK_LEVELS[1], clear = AFTERSHOCK_REPLAYS[1], states = trace(level, clear);
  assert.ok(states[133].position.x > 6.4);
  assert.ok(states[175].position.x < 5.6, 'refuge flash is survived by retreat, not by camping');
  assert.ok(states[240].position.x > 6.2, 'return before the spent field detonates again');
  assert.ok(states[395].position.y < 2.87, 'next field flashes just before body entry');
  assert.ok(states[415].position.y > 3.13, 'clear the refuge before its next expiry');
  const noRetreat = clear.map((c, i) => i === 1 || i === 3 ? { ...c, x: 0, y: 0 } : c);
  assert.equal(trace(level, noRetreat).at(-1)!.deathCause, 'pulse');
  const noTransferWait = clear.filter((_, i) => i !== 4);
  const earlyTransfer = trace(level, noTransferWait).at(-1)!;
  assert.equal(earlyTransfer.deathCause, 'pulse',
    'the recovery wait is coupled to the long next field, not arbitrary time padding');
  assert.equal(earlyTransfer.tick, 395);
  // All non-terminal ground is temporary, including every bend; no unmarked
  // interior cell lets the player opt out of the transfer sequence indefinitely.
  const sites = new Set(level.hazards.filter(h => h.kind === 'pulse').map(h => `${h.x},${h.y}`));
  for (let y = 0; y < level.tiles.length; y++) for (let x = 0; x < level.tiles[0].length; x++) {
    if (level.tiles[y][x] !== '.' || (x === level.spawn.x && y === level.spawn.y)
      || (x === level.goal.x && y === level.goal.y)) continue;
    assert.ok(sites.has(`${x},${y}`), `unmarked permanent refuge at ${x},${y}`);
  }
});

function travelled(states: readonly State[]) {
  return states.slice(1).reduce((n, s, i) => n
    + Math.hypot(s.position.x - states[i].position.x, s.position.y - states[i].position.y), 0);
}

test('The Cut: time saving is shorter geometry, not idle padding of the outside comparator', () => {
  const level = AFTERSHOCK_LEVELS[2], clear = AFTERSHOCK_REPLAYS[2], mastery = AFTERSHOCK_MASTERY_REPLAYS[2];
  assert.ok(clear.every(c => c.x || c.y), 'outside comparator never waits');
  const outside = trace(level, clear), inside = trace(level, mastery);
  const outsideDistance = travelled(outside), insideDistance = travelled(inside);
  assert.ok(outsideDistance - insideDistance >= 11, 'more than eleven tiles of actual travel saved');
  assert.ok(insideDistance <= outsideDistance * 0.8);
  assert.ok(outside.some(s => s.position.x > 28));
  assert.ok(!inside.some(s => s.position.x > 27));
  assert.ok(inside.some(s => s.position.x > 10 && s.position.x < 14 && s.position.y > 12 && s.position.y < 17));
  assert.ok(!outside.some(s => s.position.x > 10 && s.position.x < 14 && s.position.y > 12 && s.position.y < 17));
  const wrongPhase = trace(level, [{ ticks: 30, x: 0, y: 0 }, ...mastery]).at(-1)!;
  assert.equal(wrongPhase.deathCause, 'pulse');
  assert.equal(wrongPhase.tick, 370);
  const wrongCut = trace(level, [{ ticks: 133, x: 1, y: 0 }, { ticks: 200, x: 0, y: -1 }]).at(-1)!;
  assert.equal(wrongCut.deathCause, 'void', 'taking the fork north instead of northeast leaves the ribbon');
  assert.equal(wrongCut.tick, 183);
  for (const index of [2, 5])
    assert.equal(trace(level, mastery.filter((_, i) => i !== index)).at(-1)!.deathCause, 'pulse');
});

test('No encounter can be cleared by holding a single direction', () => {
  for (const level of AFTERSHOCK_LEVELS) for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1])
    assert.equal(trace(level, [{ ticks: 3000, x, y }]).at(-1)!.won, false, `${level.name}: ${x},${y}`);
});

// Every launch tick over the COMPLETE combined pattern cycle, not a handful of
// cherry-picked passing offsets. Input delay is real idle stepping from tick 0.
// Wrapping ranges are one window: e.g. Slipstream mastery [-6,+6] = 13 ticks.
const launchEvidence = [
  { index: 0, mastery: false, cycle: 132, ticks: 1664, bands: [[0, 3], [119, 131]] },
  { index: 0, mastery: true, cycle: 132, ticks: 1401, bands: [[0, 6], [126, 131]] },
  { index: 1, mastery: false, cycle: 240, ticks: 1912, bands: [[0, 4], [234, 239]] },
  { index: 1, mastery: true, cycle: 240, ticks: 1672, bands: [[0, 4], [234, 239]] },
  // The outside route uses only the 180-tick rail. The 132-tick gate is confined
  // to the cut, whose complete joint schedule is LCM(180,132) = 1980.
  { index: 2, mastery: false, cycle: 180, ticks: 1587, bands: [[0, 58], [169, 179]] },
  { index: 2, mastery: true, cycle: 1980, ticks: 1231,
    bands: [[0, 14], [532, 542], [1443, 1454], [1972, 1979]] },
] as const;

for (const evidence of launchEvidence) {
  const level = AFTERSHOCK_LEVELS[evidence.index];
  const commands = (evidence.mastery ? AFTERSHOCK_MASTERY_REPLAYS : AFTERSHOCK_REPLAYS)[evidence.index];
  test(`${level.name} ${evidence.mastery ? 'mastery' : 'clear'}: measured complete launch window`, t => {
    const valid: number[] = [];
    for (let delay = 0; delay < evidence.cycle; delay++) {
      const last = finish(level, [{ ticks: delay, x: 0, y: 0 }, ...commands]);
      if (last.won && !last.deaths) valid.push(delay);
      else assert.equal(last.deathCause, 'pulse', `phase ${delay}: failure is timing, not lost geometry`);
    }
    assert.deepEqual(ranges(valid), evidence.bands);
    assert.equal(duration(commands), evidence.ticks);
    t.diagnostic(`${evidence.ticks} ticks = ${(evidence.ticks / 120).toFixed(3)}s; `
      + `${travelled(trace(level, commands)).toFixed(2)} tiles; valid launch ticks modulo ${evidence.cycle}: `
      + JSON.stringify(ranges(valid)));
  });
}

test('Local launch adjustments: every mastery cadence decision has a measured multi-tick window', t => {
  const evidence = [
    { index: 0, pause: 1, bands: [[-6, 6]] },
    { index: 0, pause: 5, bands: [[-6, 6]] },
    { index: 0, pause: 9, bands: [[-16, 6]] },
    { index: 1, pause: 1, bands: [[-6, 4]] },
    { index: 1, pause: 4, bands: [[-8, 13]] },
    { index: 1, pause: 8, bands: [[-10, 17]] },
    { index: 2, pause: 2, bands: [[-9, 14]] },
    { index: 2, pause: 5, bands: [[-9, 14]] },
  ];
  for (const { index, pause, bands } of evidence) {
    const level = AFTERSHOCK_LEVELS[index], commands = AFTERSHOCK_MASTERY_REPLAYS[index], valid: number[] = [];
    for (let delta = -commands[pause].ticks; delta <= 60; delta++) {
      const shifted = commands.map((c, i) => i === pause ? { ...c, ticks: c.ticks + delta } : c);
      if (finish(level, shifted).won) valid.push(delta);
    }
    assert.deepEqual(ranges(valid), bands, `${level.name}: pause ${pause}`);
    assert.ok(bands.every(([first, last]) => last - first + 1 >= 10), 'not single-frame precision');
    t.diagnostic(`${level.name}, pause ${pause}, ${commands[pause].ticks} ticks: valid delta ${JSON.stringify(bands)}`);
  }
});

test('Full-width bottlenecks: no non-hazard route and no side-skimming cells in the diagonal fields', () => {
  for (const level of AFTERSHOCK_LEVELS) {
    const blocked = new Set(level.hazards.filter(h => h.kind === 'pulse').map(h => `${h.x},${h.y}`));
    const pending = [level.spawn], seen = new Set<string>();
    while (pending.length) {
      const p = pending.pop()!, key = `${p.x},${p.y}`;
      if (blocked.has(key) || seen.has(key) || level.tiles[p.y]?.[p.x] !== '.') continue;
      seen.add(key);
      assert.notDeepEqual(p, level.goal, `${level.name}: hazard-free bypass`);
      // Even an over-permissive diagonal walk graph may not bypass all fields.
      for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1])
        if (x || y) pending.push({ x: p.x + x, y: p.y + y });
    }
  }
  const cut = AFTERSHOCK_LEVELS[2];
  for (const x of [8, 9, 10, 12, 13, 14]) for (let y = 3; y < 20; y++) {
    if (cut.tiles[y][x] !== '.') continue;
    assert.ok(cut.hazards.some(h => h.kind === 'pulse' && h.x === x && h.y === y));
  }
});

test('The Cut: the diagonal fork has a measured spatial input margin, not pixel aiming', t => {
  const level = AFTERSHOCK_LEVELS[2], commands = AFTERSHOCK_MASTERY_REPLAYS[2], valid: number[] = [];
  for (let delta = -20; delta <= 20; delta++) {
    // Change the east approach length, compensate its time at the middle seam.
    // Extra final movement lets a shifted approach reach the goal; finish stops
    // on win. The exported witness itself remains exact and unpadded.
    const shifted = commands.map((c, i) => ({ ...c,
      ticks: c.ticks + (i === 0 ? delta : i === 2 ? -delta : i === commands.length - 1 ? 30 : 0) }));
    if (finish(level, shifted).won) valid.push(delta);
  }
  assert.deepEqual(ranges(valid), [[-10, 8]]);
  t.diagnostic('East approach 123–141 ticks all clear after seam-time compensation (19 input timings).');
});
