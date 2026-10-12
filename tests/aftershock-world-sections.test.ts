import assert from 'node:assert/strict';
import { test } from 'node:test';
import { center, importLevel, type Level } from '../core/level.ts';
import { createState, step, hazardSample, hazardTick, lethalAt, wallAt, reachesCheckpoint,
  STILL, type State } from '../core/simulation.ts';
import { openingPair, openingSectionWorlds, AFTERSHOCK_OPENING } from './fixtures/aftershock-world.ts';
import { OPENING_ROUTES, OPENING_PAIR_ROUTES, openingCommand as c,
  type OpeningCommand } from '../data/aftershock-world-replays.ts';
import { OPENING_FAILURES, MIDDLE_FAILURES, COMBINED_FAILURES, FINALE_FAILURES } from './fixtures/aftershock-world-failures.ts';
import { RULES, TERRAIN } from '../data/terrain.ts';
import { LEVELS } from '../data/levels.ts';
import * as aftershock from './fixtures/aftershock-world.ts';
import * as witnesses from '../data/aftershock-world-replays.ts';

test('BT-051: the final pair explicitly ends at a goal, with exactly seven retained checkpoints', () => {
  assert.ok(aftershock.AFTERSHOCK_FINALE, 'approved final pair exists');
  const world = aftershock.completeEight;
  assert.equal(world.sections.length, 8);
  assert.equal(world.checkpoints.length, 7);
  assert.deepEqual(world.sections.at(-1)!.completion, { kind: 'goal' });
  assert.deepEqual(aftershock.AFTERSHOCK_FINALE[1].section.completion, { kind: 'goal' });
  assert.ok(!('landing' in aftershock.AFTERSHOCK_FINALE[1]), 'the exit is not checkpoint metadata');
  assert.deepEqual(importLevel(JSON.stringify(world)), world);
  assert.equal(world.resetPatternOnRetry, false);
  assert.deepEqual(LEVELS.map(l => l.id), ['aftershock']);
  assert.ok(!LEVELS.some(l => l.id === world.id));
});

test('BT-051: exact input-only whole-eight routes solve all seven checkpoints and the final goal', () => {
  assert.ok(witnesses.EIGHT_SECTION_ROUTES, 'continuous final witnesses exist');
  const world = aftershock.completeEight;
  for (const kind of ['ordinary', 'fast'] as const) {
    const end = run(world, createState(world), witnesses.EIGHT_SECTION_ROUTES[kind]);
    assert.equal(end.deaths, 0);
    assert.ok(end.won, kind);
    assert.deepEqual(end.visited, world.checkpoints.map(p => `${p.x},${p.y}`));
  }
});

const finaleEntries = new Map<string, State>();
function finaleEntry(section: number, kind: 'ordinary' | 'fast'): State {
  const key = `${section}:${kind}`, world = aftershock.completeEight;
  if (!finaleEntries.has(key)) {
    const seventh = run(world, createState(world), witnesses.FINALE_APPROACHES[kind]);
    finaleEntries.set(key, section === 0 ? seventh : run(world, seventh,
      [...witnesses.FINALE_ROUTES[0][kind], c(113, 0, 1)]));
  }
  return finaleEntries.get(key)!;
}
const finaleComplete = (section: number, state: State) =>
  section === 0 ? state.visited.length === 7 : state.won;

test('BT-051: exact whole-world movement freezes on first actual goal contact, with no last-checkpoint shortcut', t => {
  const world = aftershock.completeEight;
  assert.deepEqual(world.checkpoints.slice(0, 6),
    [...AFTERSHOCK_OPENING, ...aftershock.AFTERSHOCK_MIDDLE, ...aftershock.AFTERSHOCK_COMBINED].map(f => f.landing));
  assert.deepEqual(world.goal, { x: 29, y: 44 });
  for (const kind of ['ordinary', 'fast'] as const) {
    let state = createState(world), distance = 0;
    const checkpointTicks: number[] = [];
    for (const cmd of witnesses.EIGHT_SECTION_ROUTES[kind]) for (let n = 0; n < cmd.ticks; n++) {
      assert.ok(!state.won && (cmd.x || cmd.y), 'no waiting or commands after goal');
      const before = state;
      state = step(world, state, cmd);
      const moved = Math.hypot(state.position.x - before.position.x, state.position.y - before.position.y);
      assert.ok(Math.abs(moved - 0.03) < 1e-9, `wall padding at ${state.tick}`);
      distance += moved;
      assert.equal(state.deaths, 0);
      assert.equal(hazardTick(state), state.tick);
      if (state.event === 'checkpoint') {
        checkpointTicks.push(state.tick);
        if (state.visited.length === 7) {
          assert.ok(state.position.y > 26.13, 'entire body clear of the final section-seven pulse');
          assert.equal(state.won, false);
        }
      }
      if (state.won) {
        assert.ok(Math.hypot(before.position.x - 29.5, before.position.y - 44.5) >= RULES.markerRadius);
        assert.equal(state.event, 'win');
      }
    }
    assert.equal(state.tick, kind === 'ordinary' ? 5752 : 5038);
    assert.ok(state.won);
    assert.equal(checkpointTicks.length, 7);
    assert.deepEqual(checkpointTicks.slice(0, 6), kind === 'ordinary'
      ? [507, 1339, 1872, 2539, 3272, 4072] : [507, 1235, 1701, 2216, 2885, 3551]);
    assert.equal(finaleEntry(0, kind).tick, kind === 'ordinary' ? 4199 : 3678);
    assert.equal(finaleEntry(1, kind).tick, kind === 'ordinary' ? 4899 : 4244);
    for (let n = 0; n < 1440; n++) assert.equal(step(world, state, c(1, -1, -1)), state);
    t.diagnostic(`${kind}: tick ${state.tick}, travel ${distance}, checkpoint ticks ${JSON.stringify(checkpointTicks)}, `
      + `goal ${JSON.stringify(state.position)}; final local movement ${duration(witnesses.FINALE_ROUTES[1][kind])}`);
  }
  assert.equal(duration(witnesses.EIGHT_SECTION_ROUTES.ordinary) - duration(witnesses.EIGHT_SECTION_ROUTES.fast), 714);
});

test('BT-051: full local cycles and every in-field decision have comfortable bands at BOTH real incoming states', t => {
  const world = aftershock.completeEight;
  const expected = [
    { ordinary: [[0, 30], [73, 111], [154, 192], [235, 247], [316, 325], [471, 479]],
      fast: [[0, 34], [195, 233], [357, 479]] },
    { ordinary: [[0, 50], [93, 149], [248, 275], [318, 371], [473, 479]],
      fast: [[0, 29], [111, 128], [261, 295], [350, 384], [439, 479]] },
  ];
  for (const section of [0, 1]) for (const kind of ['ordinary', 'fast'] as const) {
    const entry = finaleEntry(section, kind), route = witnesses.FINALE_ROUTES[section][kind];
    for (let at = 0; at < route.length; at++) {
      let waiting = run(world, entry, route.slice(0, at));
      const tick = waiting.tick, position = waiting.position, valid: number[] = [];
      for (let delay = 0; delay < 480; delay++) {
        if (at === 0) assert.equal(waiting.deaths, 0, 'observation survives every phase');
        if (!waiting.deaths) {
          const end = run(world, waiting, route.slice(at));
          if (!end.deaths && finaleComplete(section, end)) valid.push(delay);
        }
        waiting = step(world, waiting, STILL);
      }
      const measured = bands(valid);
      assert.ok(measured[0]?.[0] === 0 && measured[0][1] >= 23, `${section} ${kind} decision ${at}`);
      if (at === 0) {
        assert.deepEqual(measured, expected[section][kind]);
        const maximumWait = Math.max(...Array.from({ length: 480 }, (_, p) => cycleWait(p, valid, 480)));
        assert.ok(maximumWait <= 360);
        t.diagnostic(`section ${section + 7} ${kind} maximum next launch wait ${maximumWait}`);
      }
      t.diagnostic(`section ${section + 7} ${kind} boundary ${at}: ${tick} ${JSON.stringify(position)} `
        + `inclusive delay bands ${JSON.stringify(measured)}`);
    }
  }
});

test('BT-051: moving turns have early and late margins, excluding every blocked-motion attempt', t => {
  const world = aftershock.completeEight;
  for (const section of [0, 1]) for (const kind of ['ordinary', 'fast'] as const) {
    const entry = finaleEntry(section, kind), route = witnesses.FINALE_ROUTES[section][kind];
    for (let turn = 0; turn < route.length - 1; turn++) {
      if (route[turn].x === route[turn + 1].x && route[turn].y === route[turn + 1].y) continue;
      const valid: number[] = [];
      for (let delta = -30; delta <= 30; delta++) {
        const commands = [...route], cmd = route[turn];
        commands[turn] = c(cmd.ticks + delta, cmd.x, cmd.y);
        if (section === 0 && kind === 'ordinary') {
          if (turn === 0) commands[2] = c(route[2].ticks + delta, 1);
          if (turn === 1) commands[3] = c(route[3].ticks - delta, 0, 1);
        }
        if (section === 1 && kind === 'ordinary') {
          if (turn === 0) commands[2] = c(route[2].ticks - delta, 0, 1);
          if (turn === 1) commands[3] = c(route[3].ticks - delta, 1);
          if (turn === 2) commands[4] = c(route[4].ticks - delta, 0, 1);
        }
        if (section === 1 && kind === 'fast') {
          if (turn === 0) commands[3] = c(route[3].ticks - delta, 0, 1);
          if (turn === 1) {
            commands[2] = c(route[2].ticks - Math.round(delta / Math.SQRT2), 1);
            commands[3] = c(route[3].ticks - Math.round(delta / Math.SQRT2), 0, 1);
          }
        }
        const { state: end, blocked } = movingRun(world, entry, section ? throughGoal(commands) : commands);
        if (!blocked && !end.deaths && finaleComplete(section, end)) valid.push(delta);
      }
      const measured = bands(valid), nominal = measured.find(([a, b]) => a <= 0 && b >= 0);
      assert.ok(nominal && nominal[0] < 0 && nominal[1] > 0 && nominal[1] - nominal[0] + 1 >= 12,
        `${section + 7} ${kind} turn ${turn}: ${JSON.stringify(measured)}`);
      t.diagnostic(`section ${section + 7} ${kind} moving turn ${turn}: ${JSON.stringify(measured)}`);
    }
  }
});

test('BT-051: exact omitted-technique and wrong-time failures occur at actual ordinary AND faster arrivals', () => {
  const world = aftershock.completeEight;
  for (const f of FINALE_FAILURES) {
    const entry = finaleEntry(f.section, f.incoming === 'fast' ? 'fast' : 'ordinary');
    const death = run(world, entry, f.commands);
    assert.equal(death.deaths, 1, f.name);
    assert.equal(death.tick, f.tick, f.name);
    assert.equal(death.tick - entry.tick, duration(f.commands));
    assert.equal(death.deathCause, f.cause, f.name);
    assert.equal(lethalAt(world, death.position, death.tick), f.cause);
    assert.equal(death.respawnTicks, 54);
    assert.equal(death.patternOffset, 0);
    assert.deepEqual(death.visited, world.checkpoints.slice(0, f.section + 6).map(p => `${p.x},${p.y}`));
    assert.ok(!death.won);
  }
  // Focused counterfactuals supplement the ordinary-input evidence above.
  // Each removes only the named local threat and replays the complete mistake.
  for (const kind of ['ordinary', 'fast'] as const) {
    const seven = finaleEntry(0, kind);
    const direct = [c(kind === 'fast' ? 35 : 0), ...witnesses.FINALE_ROUTES[0].fast];
    assert.equal(run(world, seven, direct).deathCause, 'saw');
    const noPatrol = { ...world, hazards: world.hazards.filter(h => h.kind !== 'saw' || h.from.y !== 21) };
    assert.ok(finaleComplete(0, run(noPatrol, seven, direct)));
    const pulseMistake = [c(kind === 'ordinary' ? 31 : 0), ...witnesses.FINALE_ROUTES[0].ordinary];
    assert.equal(run(world, seven, pulseMistake).deathCause, 'pulse');
    const noGrain = { ...world, hazards: world.hazards.filter(h => h.kind !== 'pulse' || h.x > 21 || h.y < 14 || h.y >= 30) };
    const withoutPulse = run(noGrain, seven, pulseMistake);
    assert.equal(withoutPulse.deaths, 0);
    assert.ok(finaleComplete(0, withoutPulse));
    const eight = finaleEntry(1, kind), wrong = witnesses.FINALE_ROUTES[1][kind === 'ordinary' ? 'fast' : 'ordinary'];
    assert.equal(run(world, eight, wrong).deathCause, 'pulse');
    const noCurrent = { ...world, hazards: world.hazards.filter(h => h.kind !== 'pulse' || h.y < 30) };
    assert.ok(run(noCurrent, eight, throughGoal(wrong)).won);
  }
});

test('BT-051: phase-aware bank choice has real travel-versus-wait benefit, not an always-better untimed alternative', t => {
  const world = aftershock.completeEight;
  for (const section of [0, 1]) for (const kind of ['ordinary', 'fast'] as const) {
    const entry = finaleEntry(section, kind), routes = witnesses.FINALE_ROUTES[section];
    const valid: number[][] = [], travel: number[] = [];
    for (const routeKind of ['ordinary', 'fast'] as const) {
      let waiting = entry;
      const phases: number[] = [];
      for (let offset = 0; offset < 480; offset++) {
        const end = run(world, waiting, section ? throughGoal(routes[routeKind]) : routes[routeKind]);
        if (!end.deaths && finaleComplete(section, end)) {
          phases.push(offset);
          travel[valid.length] = end.tick - waiting.tick;
        }
        waiting = step(world, waiting, STILL);
      }
      assert.ok(phases.length < 480, 'each route requires phase reading');
      valid.push(phases);
    }
    const waits = valid.map(v => cycleWait(0, v, 480));
    if (kind === 'ordinary') assert.ok(waits[1] > 0, 'short route is not an untimed replacement at ordinary arrival');
    else assert.equal(waits[1], 0);
    if (kind === 'ordinary') assert.ok(travel[0] < travel[1] + waits[1],
      'the immediate ordinary route beats waiting for the short route');
    const ordinaryWins: number[] = [], fastWins: number[] = [];
    for (let phase = 0; phase < 480; phase++) {
      const a = travel[0] + cycleWait(phase, valid[0], 480);
      const b = travel[1] + cycleWait(phase, valid[1], 480);
      if (a < b) ordinaryWins.push(phase);
      if (b < a) fastWins.push(phase);
    }
    assert.ok(ordinaryWins.length >= 24 && fastWins.length >= 24);
    t.diagnostic(`section ${section + 7} ${kind}: movement ${travel}; waits ${waits}; legal ${JSON.stringify(valid.map(bands))}; `
      + `ordinary wins ${JSON.stringify(bands(ordinaryWins))}; fast wins ${JSON.stringify(bands(fastWins))}`);
  }
});

test('BT-051: continuous-radius geometry prevents seams, blind headings and cross-section exit shortcuts', () => {
  const world = aftershock.completeEight;
  assert.deepEqual([world.tiles[0].length, world.tiles.length], [65, 46]);
  assert.ok(2 * (0.5 - RULES.pulseRadius) ** 2 < RULES.radius ** 2, 'even tile corners expire');
  for (const [index, f] of aftershock.AFTERSHOCK_FINALE.entries()) {
    assert.ok(Object.isFrozen(f) && Object.isFrozen(f.tiles) && Object.isFrozen(f.hazards));
    assert.deepEqual(f.section.camera.frame, f.section.bounds);
    assert.match(f.tiles.join(''), /^[.#]+$/);
    for (const h of f.hazards) {
      assert.ok(Object.isFrozen(h));
      assert.equal(h.period, 480);
      if (h.kind !== 'pulse') continue;
      assert.equal(h.on, 1);
      const flash = (480 - h.phase) % 480;
      assert.equal(hazardSample(h, flash - 28).warning, false);
      for (let n = 1; n <= 27; n++) assert.ok(hazardSample(h, flash - n).warning);
      assert.ok(hazardSample(h, flash).active);
      for (let n = 1; n < 480; n++) assert.equal(hazardSample(h, flash + n).active, false);
    }
    f.tiles.forEach((row, dy) => [...row].forEach((tile, dx) => {
      const x = f.section.bounds.x + dx, y = f.section.bounds.y + dy;
      if (tile === '.' && (index === 0 ? y <= 25 && x <= 19 : y >= 32 && y <= 41))
        assert.ok(f.hazards.some(h => h.kind === 'pulse' && h.x === x && h.y === y), `uncovered ${x},${y}`);
    }));
  }
  // The seam at x22 is open only at the inherited outgoing floor. Below
  // that, solid walls separate earlier rooms from either final puzzle.
  for (let y = 14; y < 30; y++) assert.equal(world.tiles[y][22], y === 17 ? '.' : '#');
  for (let x = 10; x < 33; x++) {
    assert.equal(world.tiles[29][x], x === 17 ? '.' : '#');
    assert.equal(world.tiles[30][x], x === 17 ? '.' : '#');
    assert.equal(world.tiles[42][x], x === 29 ? '.' : '#');
  }
  // Every southward crossing of section seven traverses this complete
  // patrol sweep, which extends into both enclosing walls.
  for (let x = 10; x < 22; x++) assert.equal(world.tiles[21][x], x >= 15 && x <= 19 ? '.' : '#');
  const saw = aftershock.AFTERSHOCK_FINALE[0].hazards.find(h => h.kind === 'saw')!;
  assert.equal(saw.kind, 'saw');
  if (saw.kind !== 'saw') throw new Error('Expected grain patrol');
  assert.ok(saw.from.x + 0.5 < 15 + RULES.radius && saw.to.x + 0.5 > 20 - RULES.radius);
  assert.ok(2 * (saw.to.x - saw.from.x) / saw.period < 2 * (RULES.radius + RULES.sawRadius));
  for (const section of [0, 1]) for (const kind of ['ordinary', 'fast'] as const) {
    const entry = finaleEntry(section, kind);
    for (const [x, y] of [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]) {
      const end = run(world, entry, [c(1600, x, y)]);
      assert.equal(end.won, false);
      if (section === 0) assert.equal(end.visited.length, 6);
    }
    // Wrong-phase edge hugging changes position only through normal input.
    const route = witnesses.FINALE_ROUTES[section][kind];
    for (const side of [-1, 1]) {
      const end = run(world, entry, section === 1
        ? [c(9, side), c(kind === 'ordinary' ? 51 : 30), ...route]
        : [c(9, 0, side), c(kind === 'ordinary' ? 31 : 35), ...route]);
      assert.ok(!end.won && (end.deaths > 0 || !finaleComplete(section, end)));
    }
  }
});

test('BT-051: all seven full checkpoint disks remain safe against every neighboring sweep in the complete world', () => {
  const world = aftershock.completeEight;
  for (const p of world.checkpoints) {
    const landing = center(p);
    for (const h of world.hazards) {
      const from = h.kind === 'saw' ? h.from : h, to = h.kind === 'saw' ? h.to : h;
      const dx = Math.max(Math.min(from.x, to.x) + 0.5 - landing.x, landing.x - Math.max(from.x, to.x) - 0.5, 0);
      const dy = Math.max(Math.min(from.y, to.y) + 0.5 - landing.y, landing.y - Math.max(from.y, to.y) - 0.5, 0);
      assert.ok(Math.hypot(dx, dy) > p.radius + RULES.radius + (h.kind === 'saw' ? RULES.sawRadius : RULES.pulseRadius));
    }
    for (let tick = 0; tick < 1440; tick++) assert.equal(lethalAt(world, landing, tick), null);
  }
  assert.equal(world.checkpoints.filter(p => p.y >= 30).length, 0, 'no checkpoint in finale or exit approach');
  for (const f of aftershock.AFTERSHOCK_FINALE) for (let tick = 0; tick < 1440; tick++)
    assert.equal(lethalAt(world, center(f.section.entry), tick), null);
  for (const section of [0, 1]) for (const kind of ['ordinary', 'fast'] as const) {
    const route = witnesses.FINALE_ROUTES[section][kind], entry = finaleEntry(section, kind);
    const last = route.at(-1)!;
    const safe = run(world, entry, [...route.slice(0, -1), c(last.ticks - 30, last.x, last.y)]);
    for (const side of [-1, 1]) {
      const end = run(world, safe, [c(8, side), c(section ? 60 : 40, 0, 1)]);
      assert.equal(end.deaths, 0);
      assert.ok(finaleComplete(section, end));
    }
  }
});

const finaleRecoveryWindows = new Map<number, readonly number[]>();
function finaleRecovery(section: number) {
  const world = aftershock.completeEight, route = throughGoal(witnesses.FINALE_ROUTES[section].ordinary);
  const entry = finaleEntry(section, 'ordinary');
  const attempt = section === 0 ? [c(200, -1), c(480)]
    : [...witnesses.FINALE_ROUTES[1].ordinary.slice(0, 2), c(480)];
  const connector = section === 0 ? c(100, -1) : c(100, 0, 1);
  const firstDeath = run(world, entry, attempt);
  assert.equal(firstDeath.deaths, 1);
  const firstRespawn = run(world, firstDeath, [c(54)]);
  return { world, route, entry, attempt, connector, firstDeath, firstRespawn };
}
function finalePreferred(section: number): readonly number[] {
  if (!finaleRecoveryWindows.has(section)) {
    const { world, route, connector, firstRespawn } = finaleRecovery(section);
    let waiting = run(world, firstRespawn, [connector]);
    const valid: number[] = [];
    for (let offset = 0; offset < 480; offset++) {
      assert.equal(waiting.deaths, 1);
      const end = run(world, waiting, route);
      if (end.deaths === 1 && finaleComplete(section, end)) valid.push(waiting.tick % 480);
      waiting = step(world, waiting, STILL);
    }
    valid.sort((a, b) => a - b);
    finaleRecoveryWindows.set(section, Object.freeze(valid));
  }
  const valid = finaleRecoveryWindows.get(section)!;
  return valid.filter(p => Array.from({ length: 24 }, (_, n) => (p + n) % 480).every(p => valid.includes(p)));
}

test('BT-051: both new checkpoint recoveries cover every initial and release phase without resetting either clock', t => {
  for (const section of [0, 1]) {
    const { world, entry, route, attempt, connector, firstRespawn } = finaleRecovery(section);
    const preferred = finalePreferred(section);
    const maxWait = Math.max(...Array.from({ length: 480 }, (_, p) => cycleWait(p, preferred, 480)));
    assert.ok(preferred.length && maxWait <= 360);
    const recovered = new Map<number, State>(), releases = new Set<number>(), deaths = new Set<number>();
    let initial = entry, release = firstRespawn, longest = 0;
    for (let phase = 0; phase < 480; phase++) {
      const death = run(world, initial, attempt);
      assert.equal(death.deaths, 1, `${section + 7} initial phase ${phase}`);
      assert.equal(death.deathCause, 'pulse');
      assert.deepEqual(death.visited, world.checkpoints.slice(0, section + 6).map(p => `${p.x},${p.y}`));
      const respawn = run(world, death, [c(54)]);
      assert.equal(respawn.tick, death.tick + 54);
      assert.equal(respawn.respawnTicks, 0);
      assert.equal(respawn.patternOffset, 0);
      assert.deepEqual(respawn.position, center(world.checkpoints[section + 5]));
      // Reuse only the identical legally reached respawn, not a reconstructed
      // clock-equivalent state. This preserves every input-driven attempt.
      if (!recovered.has(respawn.tick)) {
        const approach = run(world, respawn, [connector]);
        const wait = cycleWait(approach.tick % 480, preferred, 480);
        recovered.set(respawn.tick, run(world, approach, [c(wait), ...route]));
      }
      const finish = recovered.get(respawn.tick)!;
      assert.equal(finish.deaths, 1);
      assert.ok(finaleComplete(section, finish));
      assert.equal(hazardTick(finish), finish.tick);
      longest = Math.max(longest, finish.tick - death.tick);
      deaths.add(death.tick % 480);
      releases.add(release.tick % 480);
      const approach = run(world, release, [connector]);
      const wait = cycleWait(approach.tick % 480, preferred, 480);
      const retry = run(world, approach, [c(wait), ...route]);
      assert.equal(retry.deaths, 1);
      assert.ok(finaleComplete(section, retry));
      assert.equal(retry.patternOffset, 0);
      release = step(world, release, STILL);
      initial = step(world, initial, STILL);
    }
    assert.equal(releases.size, 480);
    t.diagnostic(`section ${section + 7}: 480/480 initial deaths and checkpoint-release phases; legal `
      + `${JSON.stringify(bands(finaleRecoveryWindows.get(section)!))}; preferred 24-forward choices `
      + `${JSON.stringify(bands(preferred))}; maximum useful wait ${maxWait}; longest death-to-completion ${longest}; `
      + `death residues ${JSON.stringify(bands([...deaths].sort((a, b) => a - b)))}`);
  }
});

test('BT-051: every named final-pair pulse and saw failure has a legal real-checkpoint recovery', t => {
  for (const f of FINALE_FAILURES) {
    const { world, route, connector } = finaleRecovery(f.section);
    const preferred = finalePreferred(f.section);
    const entry = finaleEntry(f.section, f.incoming === 'fast' ? 'fast' : 'ordinary');
    const death = run(world, entry, f.commands);
    const respawn = run(world, death, [c(54)]);
    assert.equal(death.tick, f.tick);
    assert.equal(respawn.tick, death.tick + 54);
    assert.equal(respawn.respawnTicks, 0);
    assert.deepEqual(respawn.position, center(world.checkpoints[f.section + 5]));
    const approach = run(world, respawn, [connector]);
    assert.equal(approach.deaths, 1);
    const wait = cycleWait(approach.tick % 480, preferred, 480);
    const finish = run(world, approach, [c(wait), ...route]);
    assert.equal(finish.deaths, 1);
    assert.ok(finaleComplete(f.section, finish));
    assert.equal(hazardTick(finish), finish.tick);
    t.diagnostic(`${f.name}: death ${death.tick}; respawn ${respawn.tick}; entry ${approach.tick}; `
      + `comfortable wait ${wait}; completion ${finish.tick}`);
  }
});

test('BT-051: every expiring interior tile is legally reached, expires, and recovers from checkpoint six or seven', t => {
  for (const section of [0, 1]) {
    const { world, entry, connector, route } = finaleRecovery(section), preferred = finalePreferred(section);
    const records = [];
    for (const h of aftershock.AFTERSHOCK_FINALE[section].hazards) {
      if (h.kind !== 'pulse') continue;
      // Cardinal approaches through the actual safe observation. For the
      // basin, enter its open horizontal arm before approaching distant tiles.
      const commands = section === 0
        ? [c(Math.round((entry.position.x - h.x - 0.5) / 0.03), -1),
          c(Math.round((h.y + 0.5 - entry.position.y) / 0.03), 0, 1)]
        : [c(Math.round((h.y + 0.5 - entry.position.y) / 0.03), 0, 1),
          c(Math.round(Math.abs(h.x + 0.5 - entry.position.x) / 0.03), Math.sign(h.x + 0.5 - entry.position.x))];
      let waiting = entry, arrived: State | undefined, launchWait = 0;
      for (; launchWait < 480; launchWait++) {
        const candidate = run(world, waiting, commands);
        if (!candidate.deaths && Math.hypot(candidate.position.x - h.x - 0.5, candidate.position.y - h.y - 0.5) < 0.025) {
          arrived = candidate; break;
        }
        waiting = step(world, waiting, STILL);
      }
      assert.ok(arrived, `unreachable interior ${h.x},${h.y}`);
      const death = run(world, arrived, [c(480)]);
      assert.equal(death.deaths, 1);
      // The crossing row may meet its saw before its pulse; both expire.
      if (death.deathCause === 'pulse') assert.ok(hazardSample(h, death.tick).active);
      const respawn = run(world, death, [c(54)]);
      assert.equal(respawn.tick, death.tick + 54);
      assert.deepEqual(respawn.position, center(world.checkpoints[section + 5]));
      const approach = run(world, respawn, [connector]);
      const wait = cycleWait(approach.tick % 480, preferred, 480);
      const finish = run(world, approach, [c(wait), ...route]);
      assert.equal(finish.deaths, 1);
      assert.ok(finaleComplete(section, finish));
      records.push({ site: [h.x, h.y], launchWait, death: death.tick, cause: death.deathCause,
        respawn: respawn.tick, wait, completion: finish.tick });
    }
    t.diagnostic(`section ${section + 7} all-site expiry and recovery ${JSON.stringify(records)}`);
  }
});

test('BT-051: all 1440 whole-eight launch phases use real approaches and continuous safe waiting', t => {
  const world = aftershock.completeEight;
  for (const kind of ['ordinary', 'fast'] as const) {
    let waiting = createState(world);
    const valid: number[] = [];
    const sixSuffix = [...witnesses.COMBINED_ROUTES[0][kind], c(100, -1),
      ...witnesses.COMBINED_ROUTES[1][kind], c(114, -1)];
    const finalSuffix = [...witnesses.FINALE_ROUTES[0][kind], c(113, 0, 1), ...witnesses.FINALE_ROUTES[1][kind]];
    // Earlier prefix period 480, complete period 1440. Reuse a real safe
    // section-five arrival and WAIT to the next residue; never assign ticks.
    for (let delay = 0; delay < 480; delay++) {
      let fifth = run(world, waiting, witnesses.COMBINED_APPROACHES[kind]);
      if (!fifth.deaths) for (let lap = 0; lap < 3; lap++) {
        const seventh = run(world, fifth, sixSuffix);
        if (!seventh.deaths) {
          const end = run(world, seventh, finalSuffix);
          if (end.won && !end.deaths) valid.push(delay + lap * 480);
        }
        fifth = run(world, fifth, [c(480)]);
        assert.equal(fifth.deaths, 0);
      }
      waiting = step(world, waiting, STILL);
    }
    valid.sort((a, b) => a - b);
    assert.ok(valid.includes(0));
    const measured = bands(valid);
    assert.ok(measured[0][0] === 0 && measured[0][1] >= 23);
    assert.deepEqual(measured, kind === 'ordinary'
      ? [[0, 30], [93, 99], [318, 322], [475, 510], [798, 802], [955, 990], [1053, 1059], [1435, 1439]]
      : [[0, 23], [859, 864], [955, 983], [1339, 1344], [1435, 1439]]);
    t.diagnostic(`${kind}: complete 1440-cycle joined launch ${JSON.stringify(measured)}; max fixed-script wait `
      + `${Math.max(...Array.from({ length: 1440 }, (_, p) => cycleWait(p, valid, 1440)))}`);
  }
});

test('BT-051: representative recoveries from ALL seven checkpoints still work in the complete composition', t => {
  const world = aftershock.completeEight;
  // Every entry is reached from world spawn through its real preceding route.
  // The older exhaustive bounded regressions remain unchanged; these cases
  // additionally exercise their real markers after the final pair is appended.
  for (const [index, f] of aftershock.CHECKPOINT_RECOVERIES.entries()) {
    const entry = run(world, createState(world), f.prefix), death = run(world, entry, f.attempt);
    assert.equal(death.deaths, 1, `checkpoint ${index + 1}`);
    const respawn = run(world, death, [c(54)]);
    assert.equal(respawn.tick, death.tick + 54);
    assert.deepEqual(respawn.position, center(world.checkpoints[index]));
    let waiting = run(world, respawn, [f.connector]), finish: State | undefined, wait = 0;
    for (; wait < f.cycle; wait++) {
      const candidate = run(world, waiting, throughGoal(f.route));
      if (candidate.deaths === 1 && (f.count === 8 ? candidate.won : candidate.visited.length === f.count)) {
        finish = candidate; break;
      }
      waiting = step(world, waiting, STILL);
    }
    assert.ok(finish);
    assert.equal(finish.patternOffset, 0);
    t.diagnostic(`complete-world checkpoint ${index + 1}: death ${death.tick}, respawn ${respawn.tick}, `
      + `safe wait ${wait}, next completion ${finish.tick}`);
  }
});

test('BT-050: combined appointments and route commitment append without discarding any landing', () => {
  assert.ok(aftershock.AFTERSHOCK_COMBINED, 'the approved fifth and sixth fragments exist');
  const pair = aftershock.AFTERSHOCK_COMBINED;
  assert.equal(pair.length, 2);
  assert.ok(pair[0].hazards.some(h => h.kind === 'saw'));
  assert.ok(pair[0].hazards.some(h => h.kind === 'pulse'));
  const world = aftershock.firstSix;
  assert.equal(world.sections.length, 6);
  assert.deepEqual(world.checkpoints, [...AFTERSHOCK_OPENING, ...aftershock.AFTERSHOCK_MIDDLE,
    pair[0]].map(f => f.landing));
  assert.equal(world.resetPatternOnRetry, false);
  assert.deepEqual(importLevel(JSON.stringify(world)), world);
  assert.deepEqual(LEVELS.map(l => l.id), ['aftershock']);
  assert.ok(!LEVELS.some(l => l.id === world.id));
});

test('BT-050: both continuous six-section witnesses finish with five ordered checkpoints', () => {
  assert.ok(witnesses.SIX_SECTION_ROUTES, 'legal continuous witnesses exist');
  const world = aftershock.firstSix;
  for (const kind of ['ordinary', 'fast'] as const) {
    const end = run(world, createState(world), witnesses.SIX_SECTION_ROUTES[kind]);
    assert.equal(end.deaths, 0, `${kind}: ${end.tick}`);
    assert.ok(end.won, kind);
    assert.deepEqual(end.visited, world.checkpoints.map(p => `${p.x},${p.y}`));
  }
});

const combinedEntries = new Map<string, State>();
function combinedEntry(section: number, kind: 'ordinary' | 'fast'): State {
  const key = `${section}:${kind}`;
  if (!combinedEntries.has(key)) {
    const world = aftershock.firstSix;
    const fifth = run(world, createState(world), witnesses.COMBINED_APPROACHES[kind]);
    combinedEntries.set(key, section === 0 ? fifth : run(world, fifth,
      [...witnesses.COMBINED_ROUTES[0][kind], c(100, -1)]));
  }
  return combinedEntries.get(key)!;
}
const combinedComplete = (section: number, state: State) =>
  section === 0 ? state.visited.length === 5 : state.won;
const cycleWait = (phase: number, valid: readonly number[], cycle: number) =>
  Math.min(...valid.map(v => (v - phase + cycle) % cycle));
// Alternate approaches can differ by a fraction of a tile. Release the final
// heading at goal contact, not at the nominal other approach's fixed tick.
function throughGoal(route: readonly OpeningCommand[]): readonly OpeningCommand[] {
  const last = route.at(-1)!;
  return [...route.slice(0, -1), c(last.ticks + 30, last.x, last.y)];
}
function movingRun(world: Level, start: State, commands: readonly OpeningCommand[]) {
  let state = start, blocked = false;
  for (const command of commands) for (let n = 0; n < command.ticks; n++) {
    if (state.won || state.deaths > start.deaths) return { state, blocked };
    const previous = state;
    state = step(world, state, command);
    if (Math.hypot(state.position.x - previous.position.x, state.position.y - previous.position.y) < 0.029999)
      blocked = true;
  }
  return { state, blocked };
}

test('BT-050: exact joined movement, checkpoints and real phase-aware savings have no idle or wall padding', t => {
  const world = aftershock.firstSix;
  for (const kind of ['ordinary', 'fast'] as const) {
    let state = createState(world), distance = 0;
    const checkpoints: number[] = [];
    for (const command of witnesses.SIX_SECTION_ROUTES[kind]) for (let i = 0; i < command.ticks; i++) {
      assert.ok(!state.won, 'no commands after completion');
      assert.ok(command.x || command.y, 'no artificial witness waiting');
      const previous = state;
      state = step(world, state, command);
      const movement = Math.hypot(state.position.x - previous.position.x, state.position.y - previous.position.y);
      assert.ok(Math.abs(movement - 0.03) < 1e-9, `blocked movement at ${state.tick}`);
      distance += movement;
      assert.equal(state.deaths, 0);
      assert.equal(hazardTick(state), state.tick);
      if (state.event === 'checkpoint') {
        checkpoints.push(state.tick);
        if (state.visited.length === 5) assert.ok(state.position.x < 48.37,
          'the entire body has left the combined crossing before landing five');
      }
    }
    assert.equal(state.tick, kind === 'ordinary' ? 4085 : 3564);
    assert.ok(state.won);
    assert.equal(checkpoints.length, 5);
    assert.equal(combinedEntry(0, kind).tick, kind === 'ordinary' ? 2665 : 2343);
    assert.equal(combinedEntry(1, kind).tick, kind === 'ordinary' ? 3398 : 3010);
    t.diagnostic(`${kind}: ${state.tick} movement ticks, ${distance} tiles, checkpoints ${JSON.stringify(checkpoints)}`);
  }
});

test('BT-050: complete local launch cycles and every reached decision retain measured margins at BOTH actual arrivals', t => {
  const world = aftershock.firstSix;
  const expected = [
    { ordinary: [[0, 99], [158, 231], [302, 322], [455, 479]],
      fast: [[0, 46], [117, 229], [355, 479]] },
    { ordinary: [[0, 525], [588, 719]], fast: [[0, 337], [562, 719]] },
  ];
  for (const section of [0, 1]) for (const kind of ['ordinary', 'fast'] as const) {
    const cycle = aftershock.AFTERSHOCK_COMBINED[section].cycle;
    const route = witnesses.COMBINED_ROUTES[section][kind], entry = combinedEntry(section, kind);
    for (let at = 0; at < route.length; at++) {
      let waiting = run(world, entry, route.slice(0, at));
      const tick = waiting.tick, position = waiting.position, valid: number[] = [];
      for (let delay = 0; delay < cycle; delay++) {
        if (at === 0) assert.equal(waiting.deaths, 0, 'all-phase safe observation');
        if (!waiting.deaths) {
          const end = run(world, waiting, route.slice(at));
          if (!end.deaths && combinedComplete(section, end)) valid.push(delay);
        }
        waiting = step(world, waiting, STILL);
      }
      const measured = bands(valid);
      assert.equal(measured[0][0], 0);
      assert.ok(measured[0][1] >= 23, `section ${section + 5} ${kind} decision ${at}`);
      if (at === 0) {
        assert.deepEqual(measured, expected[section][kind]);
        const maxWait = Math.max(...Array.from({ length: cycle }, (_, p) => cycleWait(p, valid, cycle)));
        assert.ok(maxWait <= 360);
        t.diagnostic(`section ${section + 5} ${kind}: maximum next launch wait ${maxWait}`);
      }
      t.diagnostic(`section ${section + 5} ${kind} boundary ${at}: tick ${tick}, `
        + `${JSON.stringify(position)}, inclusive delays ${JSON.stringify(measured)}`);
    }
  }
});

test('BT-050: all 1440 joined launch phases preserve continuous six-section opportunities', t => {
  const world = aftershock.firstSix;
  for (const kind of ['ordinary', 'fast'] as const) {
    let waiting = createState(world);
    const valid: number[] = [];
    const suffix = [...witnesses.COMBINED_ROUTES[0][kind], c(100, -1), ...witnesses.COMBINED_ROUTES[1][kind]];
    // The entire prefix repeats after 480 ticks. Reuse its legally reached
    // safe observation, then wait 480 ticks there to cover the next residue
    // of the 720-tick arc. No manufactured clock/position state. These inputs
    // produce exactly the same arrival as waiting that cycle at spawn.
    for (let delay = 0; delay < 480; delay++) {
      let entry = run(world, waiting, witnesses.COMBINED_APPROACHES[kind]);
      if (!entry.deaths) for (let lap = 0; lap < 3; lap++) {
        const end = run(world, entry, suffix);
        if (end.won && !end.deaths) valid.push(delay + lap * 480);
        entry = run(world, entry, [c(480)]);
        assert.equal(entry.deaths, 0);
      }
      waiting = step(world, waiting, STILL);
    }
    valid.sort((a, b) => a - b);
    const measured = bands(valid);
    assert.deepEqual(measured, kind === 'ordinary'
      ? [[0, 35], [92, 99], [158, 230], [302, 322], [475, 515], [638, 710],
        [782, 802], [955, 995], [1052, 1059], [1118, 1190], [1435, 1439]]
      : [[0, 23], [145, 151], [194, 202], [625, 631], [674, 682],
        [859, 872], [955, 983], [1339, 1352], [1435, 1439]]);
    t.diagnostic(`${kind}: complete 1440-cycle launch bands ${JSON.stringify(measured)}; `
      + `max next joined wait ${Math.max(...Array.from({ length: 1440 }, (_, p) => cycleWait(p, valid, 1440)))}`);
  }
});

test('BT-050: every ordinary movement turn has early AND late legal choices, not just delay tolerance', t => {
  const world = aftershock.firstSix;
  for (const section of [0, 1]) {
    const entry = combinedEntry(section, 'ordinary'), route = witnesses.COMBINED_ROUTES[section].ordinary;
    for (let turn = 0; turn < route.length - 1; turn++) {
      const valid: number[] = [];
      for (let delta = -30; delta <= 30; delta++) {
        const commands = [...route], cmd = commands[turn];
        commands[turn] = c(cmd.ticks + delta, cmd.x, cmd.y);
        if (!section && turn === 1) commands[3] = c(route[3].ticks - delta, -1);
        if (!section && turn === 2) commands[4] = c(route[4].ticks + delta, 0, -1);
        if (!section && turn === 3) commands[5] = c(route[5].ticks - delta, -1);
        if (section && turn === 0) commands[4] = c(route[4].ticks - delta, -1);
        if (section && turn === 1) commands[3] = c(route[3].ticks + delta, 0, -1);
        if (section && turn === 2) commands[4] = c(route[4].ticks - delta, -1);
        const { state: end, blocked } = movingRun(world, entry, section ? throughGoal(commands) : commands);
        if (!blocked && !end.deaths && combinedComplete(section, end)) valid.push(delta);
      }
      const measured = bands(valid), nominal = measured.find(([a, b]) => a <= 0 && b >= 0);
      assert.ok(nominal && nominal[0] < 0 && nominal[1] > 0 && nominal[1] - nominal[0] + 1 >= 12,
        `section ${section + 5} turn ${turn}: ${JSON.stringify(measured)}`);
      t.diagnostic(`section ${section + 5} turn ${turn}: early/late bands ${JSON.stringify(measured)}`);
    }
  }
  // Fast section five has only one actual turn; its split straight leg is
  // separately exercised by the complete local-delay regression above.
  const entry = combinedEntry(0, 'fast'), valid: number[] = [];
  for (let delta = -30; delta <= 30; delta++) {
    const { state: end, blocked } = movingRun(world, entry, [c(100 + delta, 0, 1), c(467, -1)]);
    if (!blocked && !end.deaths && combinedComplete(0, end)) valid.push(delta);
  }
  const nominal = bands(valid).find(([a, b]) => a <= 0 && b >= 0);
  assert.ok(nominal && nominal[0] < 0 && nominal[1] > 0 && nominal[1] - nominal[0] + 1 >= 12);
  t.diagnostic(`section 5 fast elbow early/late: ${JSON.stringify(bands(valid))}`);
});

test('BT-050: actual wrong-choice and omitted-technique failures identify both constituent threats', () => {
  const world = aftershock.firstSix;
  for (const f of COMBINED_FAILURES) {
    const entry = combinedEntry(f.section, f.incoming === 'fast' ? 'fast' : 'ordinary');
    const death = run(world, entry, f.commands);
    assert.equal(death.deaths, 1, f.name);
    assert.equal(death.tick, f.tick, f.name);
    assert.equal(death.tick - entry.tick, duration(f.commands), 'ends on FIRST death');
    assert.equal(death.deathCause, f.cause, f.name);
    assert.equal(lethalAt(world, death.position, death.tick), f.cause);
    assert.equal(death.respawnTicks, 54);
    assert.equal(death.patternOffset, 0);
    assert.deepEqual(death.visited, world.checkpoints.slice(0, f.section + 4).map(p => `${p.x},${p.y}`));
  }
  // Supplement (never replace) the real failures: removing only the named
  // threat makes the same complete legal movement succeed at the same arrival.
  for (const kind of ['ordinary', 'fast'] as const) for (const remove of ['saw', 'pulse'] as const) {
    const entry = combinedEntry(0, kind);
    const commands = remove === 'saw'
      ? [c(kind === 'fast' ? 47 : 0), ...witnesses.COMBINED_ROUTES[0].fast]
      : [c(kind === 'ordinary' ? 100 : 0), ...witnesses.COMBINED_ROUTES[0].ordinary];
    const death = run(world, entry, commands);
    assert.equal(death.deathCause, remove);
    // parseLevel clones data, so identify this bounded room geometrically.
    const counterfactual = { ...world, hazards: world.hazards.filter(h => h.kind !== remove ||
      (h.kind === 'saw' ? h.from.y < 14 : h.y < 14 || h.x < 42)) };
    const end = run(counterfactual, entry, commands);
    assert.equal(end.deaths, 0, `${kind} without ${remove}`);
    assert.ok(combinedComplete(0, end));
  }
});

test('BT-050: short and long arcs exchange the advantage across the ENTIRE cycle, including actual arrivals', t => {
  const world = aftershock.firstSix, cycle = 720;
  for (const kind of ['ordinary', 'fast'] as const) {
    const entry = combinedEntry(1, kind);
    const valid: number[][] = [], travel: number[] = [];
    for (const routeKind of ['ordinary', 'fast'] as const) {
      const route = throughGoal(witnesses.COMBINED_ROUTES[1][routeKind]);
      let waiting = entry;
      const phases: number[] = [];
      for (let delay = 0; delay < cycle; delay++) {
        const end = run(world, waiting, route);
        if (!end.deaths && end.won) {
          phases.push(delay);
          if (!travel[valid.length]) travel[valid.length] = end.tick - waiting.tick;
        }
        waiting = step(world, waiting, STILL);
      }
      valid.push(phases);
    }
    assert.ok(valid.every(v => v.length));
    const longBetter: number[] = [], shortBetter: number[] = [];
    for (let phase = 0; phase < cycle; phase++) {
      const long = cycleWait(phase, valid[0], cycle) + travel[0];
      const short = cycleWait(phase, valid[1], cycle) + travel[1];
      if (long < short) longBetter.push(phase);
      if (short < long) shortBetter.push(phase);
    }
    assert.ok(longBetter.length >= 24 && shortBetter.length >= 24,
      'neither route is an always-better untimed replacement');
    assert.equal(travel[0] - travel[1], 134, 'the solid island creates four extra tiles of travel');
    const waits = valid.map(v => cycleWait(0, v, cycle));
    if (kind === 'ordinary') {
      assert.deepEqual(waits, [0, 175]);
      assert.ok(travel[0] < travel[1] + waits[1], 'long route beats necessary short wait at REAL arrival');
    } else {
      assert.equal(waits[1], 0);
      assert.ok(travel[1] < travel[0] + waits[0]);
    }
    t.diagnostic(`${kind}: long/short movement ${travel}; launch waits ${waits}; `
      + `long wins at offsets ${JSON.stringify(bands(longBetter))}; short wins ${JSON.stringify(bands(shortBetter))}; `
      + `long/short legal bands ${JSON.stringify(valid.map(bands))}`);
  }
});

test('BT-050: continuous-radius cuts prevent safe seams, island switching and premature checkpoint shortcuts', () => {
  const world = aftershock.firstSix, [crossing, arc] = aftershock.AFTERSHOCK_COMBINED;
  assert.deepEqual([crossing.cycle, arc.cycle], [480, 720]);
  assert.ok(2 * (0.5 - RULES.pulseRadius) ** 2 < RULES.radius ** 2,
    'a pulsed tile covers even continuous corner/seam centers');
  for (let y = 14; y < world.tiles.length; y++)
    assert.equal(world.tiles[y][52], y >= 16 && y <= 18 ? '.' : '#');
  const saw = crossing.hazards.find(h => h.kind === 'saw')!;
  assert.equal(saw.kind, 'saw');
  if (saw.kind !== 'saw') throw new Error('Expected saw');
  assert.ok(saw.from.y + 0.5 < 16 + RULES.radius);
  assert.ok(saw.to.y + 0.5 > 19 - RULES.radius);
  assert.ok(2 * (saw.to.y - saw.from.y) / saw.period < 2 * (RULES.radius + RULES.sawRadius));
  for (let y = 16; y <= 18; y++) for (let x = 49; x <= 56; x++)
    assert.ok(crossing.hazards.some(h => h.kind === 'pulse' && h.x === x && h.y === y));
  // Both arcs must cross x33.5. The island is a full tile thick, far more
  // than a player diameter; no midpoint turn or diagonal corner joins them.
  for (let y = 14; y < world.tiles.length; y++)
    assert.equal(world.tiles[y][33], y === 17 || y === 19 ? '.' : '#');
  for (let x = 30; x <= 36; x++) {
    assert.equal(world.tiles[18][x], '#');
    for (const y of [17, 19])
      assert.ok(arc.hazards.some(h => h.kind === 'pulse' && h.x === x && h.y === y));
  }
  for (const f of aftershock.AFTERSHOCK_COMBINED) {
    assert.ok(Object.isFrozen(f) && Object.isFrozen(f.tiles) && Object.isFrozen(f.hazards));
    assert.ok(f.hazards.every(Object.isFrozen));
    assert.match(f.tiles.join(''), /^[.#]+$/);
    assert.equal(f.section.completion.kind, 'checkpoint');
    assert.deepEqual(f.section.camera.frame, f.section.bounds);
    for (const h of f.hazards) {
      assert.equal(h.period, f.cycle);
      if (h.kind !== 'pulse') continue;
      assert.equal(h.on, 1);
      const flash = (h.period - h.phase) % h.period;
      assert.equal(hazardSample(h, flash - 28).warning, false);
      for (let n = 1; n <= 27; n++) assert.equal(hazardSample(h, flash - n).warning, true);
      assert.equal(hazardSample(h, flash).active, true);
      for (let n = 1; n < h.period; n++) assert.equal(hazardSample(h, flash + n).active, false);
    }
  }
  // No unintended edge seam back into the previous floor, or around the cut.
  for (let x = 42; x < 65; x++) {
    assert.equal(world.tiles[14][x], x === 58 ? '.' : '#');
    assert.equal(world.tiles[20][x], '#');
  }
  assert.equal(world.tiles[17][22], '.', 'west-facing outgoing connector for section seven');
});

test('BT-050: wrong-phase seam hugging cannot skip either crossing or short-arc commitment', () => {
  const world = aftershock.firstSix;
  const ordinary = combinedEntry(0, 'ordinary');
  for (const dy of [-1, 1]) {
    const direct = run(world, ordinary, [c(100, 0, 1), c(9, 0, dy), c(467, -1)]);
    assert.equal(direct.deaths, 1);
    assert.ok(!combinedComplete(0, direct));
  }
  for (const kind of ['ordinary', 'fast'] as const) {
    const entry = combinedEntry(1, kind);
    for (const dy of [-1, 1]) {
      const death = run(world, entry, [c(kind === 'ordinary' ? 0 : 338),
        c(9, 0, dy), c(560, -1)]);
      assert.equal(death.deaths, 1);
      assert.equal(death.deathCause, 'pulse');
      assert.equal(death.won, false);
    }
  }
});

test('BT-050: complete landing disks and both intended edge approaches are safe through all 1440 phases', () => {
  const world = aftershock.firstSix;
  for (const f of [...aftershock.AFTERSHOCK_MIDDLE.slice(1), ...aftershock.AFTERSHOCK_COMBINED]) {
    const landing = center(f.landing);
    for (const h of world.hazards) {
      const from = h.kind === 'saw' ? h.from : h, to = h.kind === 'saw' ? h.to : h;
      const dx = Math.max(Math.min(from.x, to.x) + 0.5 - landing.x,
        landing.x - Math.max(from.x, to.x) - 0.5, 0);
      const dy = Math.max(Math.min(from.y, to.y) + 0.5 - landing.y,
        landing.y - Math.max(from.y, to.y) - 0.5, 0);
      const reach = RULES.radius + f.landing.radius + (h.kind === 'saw' ? RULES.sawRadius : RULES.pulseRadius);
      assert.ok(Math.hypot(dx, dy) > reach, 'entire trigger disk separated from every neighboring hazard');
    }
    for (let phase = 0; phase < 1440; phase++) {
      assert.equal(lethalAt(world, landing, phase), null);
      assert.equal(lethalAt(world, center(f.section.entry), phase), null);
      for (const edge of [-0.29, 0, 0.29]) {
        const point = f.landing.y === 11 ? { x: landing.x + edge, y: landing.y }
          : { x: landing.x, y: landing.y + edge };
        assert.equal(wallAt(world, point), false);
        assert.ok(reachesCheckpoint(world, point, f.landing));
        assert.equal(lethalAt(world, point, phase), null);
      }
    }
  }
  for (const kind of ['ordinary', 'fast'] as const) for (const section of [0, 1]) {
    const route = witnesses.COMBINED_ROUTES[section][kind];
    const entry = combinedEntry(section, kind);
    // Shift up/down only after solving all hazards; walk into the marker
    // along both corridor edges. Actual input, no position assignment.
    const prefix = section === 0 ? route.slice(0, -1)
      : kind === 'ordinary' ? route.slice(0, -1) : [c(434, -1)];
    const safe = run(world, entry, prefix);
    for (const dy of [-1, 1]) {
      const finish = run(world, safe, [c(8, 0, dy), c(250, -1)]);
      assert.equal(finish.deaths, 0);
      assert.ok(combinedComplete(section, finish));
    }
  }
});

test('BT-050: real preceding checkpoints recover ALL initial and release phases with comfortable forward windows', t => {
  const world = aftershock.firstSix;
  for (const section of [0, 1]) {
    const cycle = aftershock.AFTERSHOCK_COMBINED[section].cycle;
    const entry = combinedEntry(section, 'ordinary');
    const route = throughGoal(witnesses.COMBINED_ROUTES[section].ordinary);
    const attempt = section === 0
      ? [...witnesses.COMBINED_ROUTES[0].ordinary.slice(0, 3), c(cycle)]
      : [c(100, -1), c(67, 0, 1), c(167, -1), c(cycle)];
    const connector = section === 0 ? c(100, 0, 1) : c(100, -1);
    const firstDeath = run(world, entry, attempt);
    assert.equal(firstDeath.deaths, 1);
    const firstRespawn = run(world, firstDeath, [c(54)]);
    let waiting = run(world, firstRespawn, [connector]);
    const valid: number[] = [];
    for (let delay = 0; delay < cycle; delay++) {
      assert.equal(waiting.deaths, 1);
      const finish = run(world, waiting, route);
      if (finish.deaths === 1 && combinedComplete(section, finish)) valid.push(waiting.tick % cycle);
      waiting = step(world, waiting, STILL);
    }
    valid.sort((a, b) => a - b);
    const preferred = valid.filter(p => Array.from({ length: 24 },
      (_, n) => (p + n) % cycle).every(v => valid.includes(v)));
    assert.ok(preferred.length);
    const maxWait = Math.max(...Array.from({ length: cycle }, (_, p) => cycleWait(p, preferred, cycle)));
    assert.ok(maxWait <= 360);
    let initial = entry, longest = 0;
    const recovered = new Map<number, State>();
    const releases = new Set<number>(), deathPhases = new Set<number>();
    for (let phase = 0; phase < cycle; phase++) {
      const death = run(world, initial, attempt);
      assert.equal(death.deaths, 1, `section ${section + 5} initial phase ${phase}`);
      assert.deepEqual(death.visited, world.checkpoints.slice(0, section + 4).map(p => `${p.x},${p.y}`));
      const respawn = run(world, death, [c(54)]);
      assert.equal(respawn.tick, death.tick + 54);
      assert.equal(respawn.respawnTicks, 0);
      assert.equal(respawn.patternOffset, 0);
      assert.deepEqual(respawn.position, center(world.checkpoints[section + 3]));
      // Many initial phases lead to the identical death and actual respawn.
      // Reuse those exact reached states, never a synthetic phase equivalent.
      if (!recovered.has(respawn.tick)) {
        const approach = run(world, respawn, [connector]);
        const wait = cycleWait(approach.tick % cycle, preferred, cycle);
        recovered.set(respawn.tick, run(world, approach, [c(wait), ...route]));
      }
      const finish = recovered.get(respawn.tick)!;
      assert.equal(finish.deaths, 1);
      assert.ok(combinedComplete(section, finish));
      assert.equal(hazardTick(finish), finish.tick);
      longest = Math.max(longest, finish.tick - death.tick);
      deathPhases.add(death.tick % cycle);
      // A real checkpoint respawn followed by safe legal waiting reaches
      // every release phase, even phases not in this failure family's residues.
      const release = run(world, firstRespawn, [c(phase)]);
      releases.add(release.tick % cycle);
      const reentry = run(world, release, [connector]);
      const releaseWait = cycleWait(reentry.tick % cycle, preferred, cycle);
      const retry = run(world, reentry, [c(releaseWait), ...route]);
      assert.equal(retry.deaths, 1);
      assert.ok(combinedComplete(section, retry));
      initial = step(world, initial, STILL);
    }
    assert.equal(releases.size, cycle);
    t.diagnostic(`section ${section + 5}: ${cycle}/${cycle} initial deaths and checkpoint releases; `
      + `legal entry phases ${JSON.stringify(bands(valid))}, preferred 24-forward choices ${JSON.stringify(bands(preferred))}; `
      + `maximum useful wait ${maxWait}, longest death-to-completion ${longest}; death residues ${JSON.stringify(bands([...deathPhases].sort((a, b) => a - b)))}`);
  }
});

test('BT-050: each named pulse AND saw failure recovers through its actual preceding checkpoint', t => {
  const world = aftershock.firstSix;
  const preferred = [expand([[240, 341], [423, 473]]), expand([[0, 300], [386, 719]])];
  for (const f of COMBINED_FAILURES) {
    const entry = combinedEntry(f.section, f.incoming === 'fast' ? 'fast' : 'ordinary');
    const death = run(world, entry, f.commands);
    assert.equal(death.deaths, 1);
    const respawn = run(world, death, [c(54)]);
    assert.equal(respawn.tick, death.tick + 54);
    assert.equal(respawn.respawnTicks, 0);
    assert.deepEqual(respawn.position, center(world.checkpoints[f.section + 3]));
    const approach = run(world, respawn, [f.section === 0 ? c(100, 0, 1) : c(100, -1)]);
    const wait = cycleWait(approach.tick % aftershock.AFTERSHOCK_COMBINED[f.section].cycle,
      preferred[f.section], aftershock.AFTERSHOCK_COMBINED[f.section].cycle);
    const finish = run(world, approach, [c(wait), ...throughGoal(witnesses.COMBINED_ROUTES[f.section].ordinary)]);
    assert.equal(finish.deaths, 1, f.name);
    assert.ok(combinedComplete(f.section, finish));
    assert.equal(hazardTick(finish), finish.tick);
    t.diagnostic(`${f.name}: death ${death.tick}, respawn ${respawn.tick}, entry ${approach.tick}, `
      + `comfortable wait ${wait}, finish ${finish.tick}`);
  }
});

test('BT-049: unregistered middle fragments join all four sections without replacing checkpoint two', () => {
  assert.ok(aftershock.AFTERSHOCK_MIDDLE, 'saw crossing and lateral transfer are authored');
  assert.equal(aftershock.AFTERSHOCK_MIDDLE.length, 2);
  const world = aftershock.firstFour;
  assert.equal(world.sections.length, 4);
  assert.equal(world.checkpoints.length, 3);
  assert.deepEqual(world.checkpoints.slice(0, 2), AFTERSHOCK_OPENING.map(f => f.landing));
  assert.equal(world.resetPatternOnRetry, false);
  assert.ok(world.tiles[0].length < 100, 'leave horizontal budget for later composition');
  assert.ok(aftershock.AFTERSHOCK_MIDDLE[0].hazards.every(h => h.kind === 'saw'));
  assert.ok(aftershock.AFTERSHOCK_MIDDLE[1].hazards.every(h => h.kind === 'pulse'));
  assert.deepEqual(importLevel(JSON.stringify(world)), world);
  assert.deepEqual(LEVELS.map(l => l.id), ['aftershock']);
  assert.ok(!LEVELS.some(level => level.id === world.id));
});

test('BT-049: exact continuous four-section inputs collect three real landings and save meaningful travel', () => {
  assert.ok(witnesses.FOUR_SECTION_ROUTES, 'continuous ordinary and faster witnesses exist');
  const results = [];
  for (const kind of ['ordinary', 'fast'] as const) {
    const world = aftershock.firstFour;
    const route = witnesses.FOUR_SECTION_ROUTES[kind];
    let state = createState(world);
    for (const command of route) for (let n = 0; n < command.ticks; n++) {
      assert.equal(state.won, false, 'no padding after goal');
      state = step(world, state, command);
      assert.equal(state.deaths, 0, `${kind} tick ${state.tick}`);
      assert.equal(hazardTick(state), state.tick);
    }
    assert.ok(state.won);
    assert.deepEqual(state.visited, world.checkpoints.map(p => `${p.x},${p.y}`));
    results.push(state.tick);
  }
  assert.ok(results[0] - results[1] > 105, 'middle pair adds a real benefit beyond the accepted opening');
});

test('BT-049: ordinary fan turn has at least 24 contiguous input-tick choices at actual arrival', t => {
  const world = aftershock.firstFour;
  const entry = run(world, createState(world), witnesses.FOUR_SECTION_ROUTES.ordinary.slice(0, -4));
  const valid: number[] = [];
  for (let delta = -30; delta <= 30; delta++) {
    // Shift the east-to-south turn and compensate the later westward leg.
    // This varies the crossing line, not a teleported start or idle padding.
    const end = run(world, entry, [c(200 + delta, 1), c(100, 0, 1),
      c(100 + delta, -1), c(153, 0, 1)]);
    if (end.won && !end.deaths) valid.push(delta);
  }
  const measured = bands(valid), nominal = measured.find(([a, b]) => a <= 0 && b >= 0);
  t.diagnostic(`ordinary fan turn deltas: ${JSON.stringify(measured)}`);
  assert.ok(nominal && nominal[1] - nominal[0] + 1 >= 24);
});

const duration = (commands: readonly OpeningCommand[]) => commands.reduce((n, c) => n + c.ticks, 0);
function run(world: Level, state: State, commands: readonly OpeningCommand[]): State {
  const initialDeaths = state.deaths;
  for (const command of commands) for (let n = 0; n < command.ticks; n++) {
    if (state.won || state.deaths > initialDeaths) return state;
    state = step(world, state, command);
  }
  return state;
}
function bands(values: readonly number[]): number[][] {
  const result: number[][] = [];
  for (const value of values) {
    const last = result.at(-1);
    if (last && last[1] === value - 1) last[1] = value;
    else result.push([value, value]);
  }
  return result;
}
function expand(ranges: readonly (readonly number[])[]): number[] {
  return ranges.flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => a + i));
}
function nextWait(phase: number, valid: readonly number[]) {
  return Math.min(...valid.map(v => (v - phase + 480) % 480));
}
const launch = [
  { section: 0, kind: 'ordinary', bands: [[0, 392], [475, 479]], wait: 82 },
  { section: 0, kind: 'fast', bands: [[0, 392], [475, 479]], wait: 82 },
  { section: 1, kind: 'ordinary', bands: [[0, 55], [128, 188], [245, 479]], wait: 72 },
  { section: 1, kind: 'fast', bands: [[0, 69], [146, 176], [263, 479]], wait: 86 },
] as const;

const local = [
  { section: 0, kind: 'ordinary', at: 1, bands: [[0, 392]] },
  { section: 1, kind: 'ordinary', at: 1, bands: [[0, 55]] },
  { section: 1, kind: 'ordinary', at: 2, bands: [[0, 55], [119, 188]] },
  { section: 1, kind: 'ordinary', at: 3, bands: [[0, 55], [119, 188]] },
  { section: 1, kind: 'ordinary', at: 4, bands: [[0, 55]] },
  { section: 1, kind: 'ordinary', at: 5, bands: [[0, 55]] },
  { section: 1, kind: 'ordinary', at: 6, bands: [[0, 74], [119, 193]] },
  { section: 1, kind: 'ordinary', at: 7, bands: [[0, 74], [119, 193]] },
  { section: 1, kind: 'ordinary', at: 8, bands: [[0, 74]] },
  { section: 1, kind: 'fast', at: 1, bands: [[0, 69]] },
  { section: 1, kind: 'fast', at: 2, bands: [[0, 94], [146, 179]] },
  { section: 1, kind: 'fast', at: 3, bands: [[0, 94], [146, 179]] },
  { section: 1, kind: 'fast', at: 4, bands: [[0, 94]] },
] as const;

test('BT-048: two unregistered appendable fragments retain continuous V2 clocks', () => {
  assert.equal(AFTERSHOCK_OPENING.length, 2);
  assert.equal(openingPair.version, 2);
  assert.equal(openingPair.resetPatternOnRetry, false);
  assert.equal(openingPair.checkpoints.length, 1);
  for (const fragment of AFTERSHOCK_OPENING) {
    assert.equal(fragment.section.completion.kind, 'checkpoint');
    assert.ok(Object.isFrozen(fragment));
    assert.ok(fragment.cycle <= 1440);
    assert.ok(Object.isFrozen(fragment.tiles) && Object.isFrozen(fragment.hazards));
    assert.equal(fragment.cycle, 480);
    assert.match(fragment.tiles.join(''), /^[.#]+$/);
    assert.ok(fragment.hazards.every(h => h.on === 1 && h.period === 480));
  }
  for (const world of [openingPair, ...openingSectionWorlds]) {
    assert.deepEqual(importLevel(JSON.stringify(world)), world);
    assert.ok(!LEVELS.some(level => level.id === world.id), 'never register a partial campaign');
  }
  assert.deepEqual(AFTERSHOCK_OPENING.map(f => f.section.entry), [{ x: 1, y: 3 }, { x: 20, y: 3 }]);
  assert.deepEqual(AFTERSHOCK_OPENING.map(f => [f.landing.x, f.landing.y, f.landing.radius]),
    [[17, 3, 0.8], [38, 3, 0.8]]);
  for (const f of AFTERSHOCK_OPENING)
    assert.equal(f.tiles[3].at(-1), '.', 'outgoing corridor must meet the next patch without cutting a wall');
});

test('BT-048: fast transfer saves real movement, not an idle-padded comparator', () => {
  assert.ok(OPENING_ROUTES[1].ordinary.every(c => c.x || c.y));
  assert.ok(duration(OPENING_ROUTES[1].ordinary) - duration(OPENING_ROUTES[1].fast) >= 60);
});

test('BT-048: exact ordinary and fast inputs solve distinct opening traversals without deaths', () => {
  openingSectionWorlds.forEach((world, i) => {
    for (const kind of ['ordinary', 'fast'] as const) {
      let state = createState(world);
      const route = OPENING_ROUTES[i][kind];
      for (const command of route) for (let tick = 0; tick < command.ticks; tick++) {
        assert.equal(state.won, false, 'no padded inputs after completion');
        state = step(world, state, command);
        assert.equal(state.deaths, 0, `section ${i + 1}: death at ${state.tick}`);
        assert.equal(state.patternOffset, 0);
      }
      assert.equal(state.won, true);
      assert.equal(state.tick, [[520, 520], [718, 614]][i][kind === 'ordinary' ? 0 : 1]);
    }
  });
});

test('BT-048: joined routes collect the intermediate landing through geometry, saving 105 movement ticks', t => {
  const ends = [];
  for (const kind of ['ordinary', 'fast'] as const) {
    let state = createState(openingPair), checkpointTick = 0, travelled = 0;
    for (const command of OPENING_PAIR_ROUTES[kind]) for (let n = 0; n < command.ticks; n++) {
      assert.equal(state.won, false);
      const prior = state, saved = structuredClone(prior);
      Object.freeze(prior); Object.freeze(prior.position); Object.freeze(prior.visited);
      state = step(openingPair, prior, command);
      assert.deepEqual(prior, saved, 'immutable input state');
      assert.equal(state.deaths, 0);
      assert.equal(hazardTick(state), state.tick);
      travelled += Math.hypot(state.position.x - prior.position.x, state.position.y - prior.position.y);
      if (state.event === 'checkpoint') {
        checkpointTick = state.tick;
        assert.ok(state.position.x > 16.13, 'whole body has left the last blast before collection');
      }
    }
    assert.equal(state.won, true);
    assert.deepEqual(state.visited, ['17,3']);
    assert.equal(checkpointTick, 507);
    assert.equal(state.tick, duration(OPENING_PAIR_ROUTES[kind]));
    ends.push({ ticks: state.tick, travelled });
    t.diagnostic(`${kind}: ${JSON.stringify(ends.at(-1))}, finish ${JSON.stringify(state.position)}`);
    assert.deepEqual(run(openingPair, createState(openingPair), OPENING_PAIR_ROUTES[kind]), state);
  }
  assert.deepEqual(ends.map(e => e.ticks), [1352, 1247]);
  assert.ok(ends[0].travelled - ends[1].travelled > 3.1);
  assert.ok(OPENING_PAIR_ROUTES.ordinary.every(c => c.x || c.y), 'no padded waiting');
});

test('BT-048: complete launch cycles and nearest useful waits, using only safe waiting states', t => {
  for (const e of launch) {
    const world = openingSectionWorlds[e.section], route = OPENING_ROUTES[e.section][e.kind];
    const valid: number[] = [];
    let entry = createState(world);
    for (let offset = 0; offset < 480; offset++) {
      assert.equal(entry.tick, offset);
      assert.equal(entry.deaths, 0);
      const end = run(world, entry, route);
      if (end.won && end.deaths === 0) valid.push(offset);
      else assert.equal(end.deathCause, 'pulse');
      entry = step(world, entry, STILL);
    }
    assert.deepEqual(bands(valid), e.bands);
    const largestWait = Math.max(...Array.from({ length: 480 }, (_, p) => nextWait(p, valid)));
    assert.equal(largestWait, e.wait);
    assert.ok(largestWait <= 360);
    const first = e.bands[0], last = e.bands.at(-1)!;
    assert.ok(first[1] + 1 + 480 - last[0] >= 24, 'cyclic contiguous band around authored phase');
    t.diagnostic(`section ${e.section + 1} ${e.kind}: ${JSON.stringify(e.bands)}, max wait ${largestWait}`);
  }
});

test('BT-048: actual joined arrival requires the refuge decisions, not blind forward input', () => {
  const straight = run(openingPair, createState(openingPair), [c(2000, 1)]);
  assert.equal(straight.won, false, 'blind forward travel must not replace the second puzzle');
  assert.equal(straight.deaths, 1);
  assert.equal(straight.deathCause, 'pulse');
  assert.deepEqual(straight.visited, ['17,3'], 'failure is beyond the first checkpoint');
  const entry = run(openingPair, createState(openingPair), OPENING_PAIR_ROUTES.ordinary.slice(0, 1));
  const omittedUpper = run(openingPair, entry, [...OPENING_ROUTES[1].ordinary.slice(0, 4), c(600, 1)]);
  assert.equal(omittedUpper.won, false);
  assert.equal(omittedUpper.deaths, 1, 'the ordinary lower transfer alone cannot omit the upper decision');
  assert.equal(omittedUpper.deathCause, 'pulse');
});

test('BT-048: actual joined in-field decisions retain full-cycle measured input margins', t => {
  for (const kind of ['ordinary', 'fast'] as const) {
    const route = OPENING_PAIR_ROUTES[kind];
    for (let at = 2; at < route.length; at++) {
      let reached = run(openingPair, createState(openingPair), route.slice(0, at));
      const tick = reached.tick, point = reached.position, valid: number[] = [];
      assert.equal(reached.deaths, 0);
      for (let delay = 0; delay < 480; delay++) {
        if (!reached.deaths) {
          const end = run(openingPair, reached, route.slice(at));
          if (end.won && !end.deaths) valid.push(delay);
        }
        reached = step(openingPair, reached, STILL);
      }
      const measured = bands(valid);
      assert.equal(measured[0]?.[0], 0);
      assert.ok(measured[0][1] >= 23, `${kind} decision ${at}: ${JSON.stringify(measured)}`);
      t.diagnostic(`joined ${kind} before ${at}, tick ${tick}, ${JSON.stringify(point)}: ${JSON.stringify(measured)}`);
    }
  }
});

test('BT-048: the joined pair also has complete continuous-clock launch bands', t => {
  for (const kind of ['ordinary', 'fast'] as const) {
    const valid: number[] = [];
    let entry = createState(openingPair);
    for (let phase = 0; phase < 480; phase++) {
      const end = run(openingPair, entry, OPENING_PAIR_ROUTES[kind]);
      if (end.won && !end.deaths) valid.push(phase);
      else assert.equal(end.deathCause, 'pulse');
      entry = step(openingPair, entry, STILL);
    }
    const expected = kind === 'ordinary' ? [[0, 35], [92, 382], [475, 479]]
      : [[0, 23], [109, 392], [475, 479]];
    const wait = Math.max(...Array.from({ length: 480 }, (_, p) => nextWait(p, valid)));
    assert.deepEqual(bands(valid), expected);
    assert.equal(wait, kind === 'ordinary' ? 92 : 85);
    t.diagnostic(`joined ${kind}: ${JSON.stringify(expected)}, max wait ${wait}`);
  }
});

test('BT-048: every local decision has exhaustive delay bands, including actual deaths during waiting', t => {
  for (const e of local) {
    const world = openingSectionWorlds[e.section], route = OPENING_ROUTES[e.section][e.kind];
    let reached = run(world, createState(world), route.slice(0, e.at));
    const point = reached.position, tick = reached.tick, valid: number[] = [];
    for (let delay = 0; delay < 480; delay++) {
      // Once this stationary prefix dies, every longer delay is invalid; do
      // not accidentally accept a respawn and call it a local input margin.
      if (!reached.deaths) {
        const end = run(world, reached, route.slice(e.at));
        if (end.won && !end.deaths) valid.push(delay);
      }
      reached = step(world, reached, STILL);
    }
    assert.deepEqual(bands(valid), e.bands);
    assert.ok(e.bands[0][1] >= 23);
    t.diagnostic(`${e.section + 1} ${e.kind} before ${e.at}, tick ${tick}, `
      + `${JSON.stringify(point)}: ${JSON.stringify(e.bands)}`);
  }
});

test('BT-048: intentional stationary, omitted-transfer and mistimed inputs fail at the intended pulse', () => {
  for (const f of OPENING_FAILURES) {
    const world = openingSectionWorlds[f.section];
    const death = run(world, createState(world), f.commands);
    assert.equal(death.tick, f.tick, f.name);
    assert.equal(death.tick, duration(f.commands), 'fixture stops exactly at first death');
    assert.equal(death.deaths, 1, f.name);
    assert.equal(death.deathCause, 'pulse', f.name);
    assert.deepEqual(death.visited, []);
    const site = world.hazards.find(h => h.kind === 'pulse' && h.x === f.site[0] && h.y === f.site[1])!;
    assert.equal(hazardSample(site, death.tick).active, true, f.name);
    assert.equal(lethalAt(world, death.position, death.tick), 'pulse');
    assert.equal(death.respawnTicks, 54);
  }
});

test('BT-048: warnings, one-tick lethality and harmless aftermath are unchanged', () => {
  assert.equal(TERRAIN['.'].speed, 3.6);
  assert.deepEqual([RULES.tickRate, RULES.radius, RULES.pulseWarningTicks, RULES.pulseEffectTicks,
    RULES.respawnTicks], [120, 0.2, 27, 36, 54]);
  for (const world of openingSectionWorlds) for (const h of world.hazards) {
    const flash = h.period - h.phase;
    assert.equal(hazardSample(h, flash - 28).warning, false);
    for (let tick = flash - 27; tick < flash; tick++) assert.equal(hazardSample(h, tick).warning, true);
    const active = Array.from({ length: 480 }, (_, tick) => hazardSample(h, tick).active).filter(Boolean);
    assert.equal(active.length, 1);
    for (let tick = 1; tick <= 36; tick++) assert.equal(hazardSample(h, flash + tick).active, false);
  }
  const world = openingSectionWorlds[0];
  const spent = run(world, createState(world), [c(67, 1)]);
  assert.equal(spent.deaths, 0);
  assert.ok(Math.abs(spent.position.x - 3.5) < 0.02);
  assert.equal(spent.tick - 40, 27, 'ordinary input actually enters spent visual aftermath');
});

test('BT-048: continuous-radius geometry excludes phase-independent seams and corner bypasses', () => {
  // Every point in a unit floor tile lies inside its pulse's rounded lethal
  // footprint at that pulse's own phase, including the worst-case corner.
  // This is an analytic cover, not a tile BFS or finite sampling claim.
  assert.ok(2 * (0.5 - RULES.pulseRadius) ** 2 < RULES.radius ** 2);
  for (const [i, f] of AFTERSHOCK_OPENING.entries()) {
    const world = openingSectionWorlds[i];
    const minX = i === 0 ? 3 : 22, maxX = i === 0 ? 15 : 36;
    for (let x = minX; x <= maxX; x++) for (let y = 0; y < world.tiles.length; y++) {
      if (world.tiles[y][x] !== '.') continue;
      assert.ok(f.hazards.some(h => h.x === x && h.y === y), `uncovered interior tile ${x},${y}`);
    }
    // A continuous path from entry to landing must cross this vertical
    // section of the world. Everything except its single pulse tile is wall;
    // the walls join both board edges. Radius erosion only shrinks the route.
    for (let y = 0; y < world.tiles.length; y++)
      assert.equal(world.tiles[y][minX], y === 3 ? '.' : '#');
    assert.ok(f.section.entry.x < minX && f.landing.x > maxX);
    assert.ok(f.landing.x + 0.5 - f.landing.radius > maxX + 0.5 + RULES.pulseRadius + RULES.radius);
    // No external-floor wraparound: the entire bounding top/bottom is solid.
    assert.match(world.tiles[0], /^#+$/);
    assert.match(world.tiles.at(-1)!, /^#+$/);
  }
});

test('BT-048: landing trigger and recovery area are safe at every phase, including edge routes', () => {
  for (const [i, f] of AFTERSHOCK_OPENING.entries()) {
    const world = openingSectionWorlds[i], landing = center(f.landing);
    // The complete trigger disk plus player footprint is separated from
    // every pulse's swept AABB. Check this stronger geometric bound first.
    for (const h of f.hazards) {
      const dx = Math.max(Math.abs(landing.x - h.x - 0.5) - RULES.pulseRadius, 0);
      const dy = Math.max(Math.abs(landing.y - h.y - 0.5) - RULES.pulseRadius, 0);
      assert.ok(Math.hypot(dx, dy) > f.landing.radius + RULES.radius);
    }
    for (let phase = 0; phase < 480; phase++) {
      for (const y of [3.2, 3.5, 3.8]) {
        const p = { x: landing.x, y };
        assert.equal(lethalAt(world, p, phase), null);
        assert.ok(reachesCheckpoint(world, p, f.landing), 'trigger covers corridor edge-to-edge');
      }
    }
  }
  // Both wall-hugging routes are legal input trajectories, not positioned
  // states. They must encounter the actual marker after the complete wake.
  for (const dy of [-1, 1]) {
    const state = run(openingPair, createState(openingPair), [c(10, 0, dy), c(540, 1)]);
    assert.equal(state.deaths, 0);
    assert.deepEqual(state.visited, ['17,3']);
  }
});

test('BT-048: wrong-phase seam hugging and corner-cut inputs still die in the real simulation', () => {
  for (const dy of [-1, 1]) {
    const wake = run(openingSectionWorlds[0], createState(openingSectionWorlds[0]),
      [c(383), c(10, 0, dy), c(520, 1)]);
    assert.equal(wake.deaths, 1);
    assert.equal(wake.deathCause, 'pulse');
    const refuge = run(openingSectionWorlds[1], createState(openingSectionWorlds[1]),
      [c(153), c(10, 0, dy), c(800, 1)]);
    assert.equal(refuge.deaths, 1);
    assert.equal(refuge.deathCause, 'pulse');
    const cornerCut = run(openingSectionWorlds[1], createState(openingSectionWorlds[1]),
      [c(153), c(1200, 1, dy)]);
    assert.equal(cornerCut.deaths, 1);
    assert.equal(cornerCut.deathCause, 'pulse');
  }
});

test('BT-048: every interior pulse site has a legal stationary failure and actual all-death-phase recovery', t => {
  for (const [index, fragment] of AFTERSHOCK_OPENING.entries()) {
    // Section two is recovered from the REAL intermediate checkpoint in the
    // joined world, not from a standalone substitute spawn.
    const world = index === 0 ? openingSectionWorlds[0] : openingPair;
    const entry = index === 0 ? createState(world) : run(world, createState(world), [c(633, 1)]);
    const valid = expand(launch.find(e => e.section === index && e.kind === 'ordinary')!.bands);
    const deathPhases = new Set<number>(), respawnPhases = new Set<number>();
    const records = [];
    for (const h of fragment.hazards) {
      const approach = [c(Math.round((h.x + 0.5 - entry.position.x) / 0.03), 1)];
      if (h.y !== 3) approach.push(c(33, 0, Math.sign(h.y - 3)));
      let waiting = entry, arrived: State | undefined, launchWait = 0;
      // Search the complete entry cycle with legal safe waiting states. Keep
      // the first successful ordinary-input approach to this particular tile.
      for (; launchWait < 480; launchWait++) {
        const candidate = run(world, waiting, approach);
        if (!candidate.deaths && Math.hypot(candidate.position.x - h.x - 0.5,
          candidate.position.y - h.y - 0.5) < 0.02) { arrived = candidate; break; }
        waiting = step(world, waiting, STILL);
      }
      assert.ok(arrived, `cannot legally reach ${h.x},${h.y}`);
      assert.equal(wallAt(world, arrived.position), false);
      const death = run(world, arrived, [c(480)]);
      assert.equal(death.deaths, 1);
      assert.equal(death.deathCause, 'pulse');
      assert.equal(hazardSample(h, death.tick).active, true, 'the occupied tile itself expires');
      const respawn = run(world, death, [c(54)]);
      assert.equal(respawn.tick, death.tick + 54);
      assert.equal(respawn.respawnTicks, 0);
      assert.equal(respawn.patternOffset, 0);
      assert.equal(hazardTick(respawn), respawn.tick);
      assert.deepEqual(respawn.position, center(index === 0 ? world.spawn : openingPair.checkpoints[0]));
      // The connector is an actual 100-tick walk from checkpoint center.
      const recoveryEntry = index === 0 ? respawn : run(world, respawn, [c(100, 1)]);
      const wait = nextWait(recoveryEntry.tick % 480, valid);
      const finish = run(world, recoveryEntry, [c(wait), ...OPENING_ROUTES[index].ordinary]);
      assert.equal(finish.deaths, 1, `recovery failed for ${h.x},${h.y}`);
      assert.equal(finish.won, true);
      assert.equal(finish.patternOffset, 0);
      if (index === 1) assert.deepEqual(finish.visited, ['17,3']);
      deathPhases.add(death.tick % 480);
      respawnPhases.add(respawn.tick % 480);
      records.push({ site: [h.x, h.y], launchWait, death: death.tick, respawn: respawn.tick,
        recoveryEntry: recoveryEntry.tick, wait, finish: finish.tick });
    }
    const expected = [...new Set(fragment.hazards.map(h => (480 - h.phase) % 480))].sort((a, b) => a - b);
    assert.deepEqual([...deathPhases].sort((a, b) => a - b), expected,
      'all possible pulse death residues, not just a zero-phase retry');
    assert.deepEqual([...respawnPhases].sort((a, b) => a - b),
      [...new Set(expected.map(p => (p + 54) % 480))].sort((a, b) => a - b));
    t.diagnostic(`section ${index + 1} recovery: ${JSON.stringify(records)}`);
    t.diagnostic(`section ${index + 1} respawn phases: ${JSON.stringify([...respawnPhases].sort((a, b) => a - b))}`);
  }
});

test('BT-048: all 480 initial phases produce real failure-to-respawn-to-success paths', t => {
  for (const index of [0, 1]) {
    const world = openingSectionWorlds[index];
    const valid = expand(launch.find(e => e.section === index && e.kind === 'ordinary')!.bands);
    // Every attempt either dies on approach or stops in an expiring interior
    // tile. No branch is allowed to finish and silently count as recovery.
    const attempt = index === 0 ? [c(200, 1), c(480)]
      : [...OPENING_ROUTES[1].ordinary.slice(0, 6), c(480)];
    let entry = createState(world);
    const phases = new Set<number>();
    let largestWait = 0, longestRecovery = 0;
    for (let offset = 0; offset < 480; offset++) {
      const death = run(world, entry, attempt);
      assert.equal(death.deaths, 1, `initial offset ${offset}`);
      assert.equal(death.deathCause, 'pulse');
      const respawn = run(world, death, [c(54)]);
      assert.equal(respawn.tick, death.tick + 54);
      assert.equal(respawn.patternOffset, 0);
      assert.equal(respawn.respawnTicks, 0);
      const wait = nextWait(respawn.tick % 480, valid);
      const finish = run(world, respawn, [c(wait), ...OPENING_ROUTES[index].ordinary]);
      assert.ok(finish.won && finish.deaths === 1);
      phases.add(respawn.tick % 480);
      largestWait = Math.max(largestWait, wait);
      longestRecovery = Math.max(longestRecovery, finish.tick - death.tick);
      entry = step(world, entry, STILL);
    }
    t.diagnostic(`section ${index + 1}: 480/480 recoveries; respawn residues `
      + `${JSON.stringify([...phases].sort((a, b) => a - b))}; largest wait ${largestWait}; `
      + `longest death-to-finish ${longestRecovery}`);
  }
});

function middleEntry(section: number, kind: 'ordinary' | 'fast'): State {
  const world = aftershock.firstFour;
  const patrol = run(world, createState(world), witnesses.MIDDLE_APPROACHES[kind]);
  return section === 0 ? patrol : run(world, patrol, [...witnesses.MIDDLE_ROUTES[0][kind], c(113, 1)]);
}
const middleComplete = (section: number, state: State) =>
  section === 0 ? state.visited.length === 3 : state.won;

test('BT-049: actual ordinary AND faster incoming phases retain full-cycle launch and local decision margins', t => {
  for (const kind of ['ordinary', 'fast'] as const) for (const section of [0, 1]) {
    const world = aftershock.firstFour, route = witnesses.MIDDLE_ROUTES[section][kind];
    const entry = middleEntry(section, kind), valid: number[] = [];
    let waiting = entry;
    for (let delay = 0; delay < 480; delay++) {
      assert.equal(waiting.deaths, 0, 'safe observation for the entire cycle');
      const end = run(world, waiting, route);
      if (!end.deaths && middleComplete(section, end)) valid.push(delay);
      waiting = step(world, waiting, STILL);
    }
    const measured = bands(valid), wait = Math.max(...Array.from({ length: 480 }, (_, p) => nextWait(p, valid)));
    const expected = section === 0
      ? (kind === 'ordinary' ? [[0, 230], [301, 351], [422, 479]] : [[0, 68], [139, 308], [379, 479]])
      : (kind === 'ordinary' ? [[0, 335], [378, 385], [455, 479]] : [[0, 94], [145, 151], [194, 202], [285, 479]]);
    assert.deepEqual(measured, expected);
    assert.equal(measured[0][0], 0);
    assert.ok(measured[0][1] >= 23);
    assert.ok(wait <= 360);
    t.diagnostic(`middle ${section + 3} ${kind}: entry ${entry.tick} ${JSON.stringify(entry.position)}, `
      + `launch delays ${JSON.stringify(measured)}, max wait ${wait}`);
    for (let at = 1; at < route.length; at++) {
      let reached = run(world, entry, route.slice(0, at));
      assert.equal(reached.deaths, 0);
      const tick = reached.tick, position = reached.position, choices: number[] = [];
      for (let delay = 0; delay < 480; delay++) {
        if (!reached.deaths) {
          const end = run(world, reached, route.slice(at));
          if (!end.deaths && middleComplete(section, end)) choices.push(delay);
        }
        reached = step(world, reached, STILL);
      }
      const measured = bands(choices);
      assert.equal(measured[0][0], 0);
      assert.ok(measured[0][1] >= 23, `middle ${section + 3} ${kind} decision ${at}`);
      t.diagnostic(`middle ${section + 3} ${kind} decision ${at}: tick ${tick}, `
        + `${JSON.stringify(position)}, delay bands ${JSON.stringify(measured)}`);
    }
  }
});

test('BT-049: patrol turn and inside diagonal have measured early/late movement-input bands', t => {
  for (const [section, kind] of [[0, 'ordinary'], [1, 'fast']] as const) {
    const world = aftershock.firstFour, entry = middleEntry(section, kind);
    const route = witnesses.MIDDLE_ROUTES[section][kind], valid: number[] = [];
    // Bounded turn perturbations, not a claim about offsets beyond +/-30.
    for (let delta = -30; delta <= 30; delta++) {
      const commands = [...route];
      if (section === 0) {
        commands[0] = c(route[0].ticks + delta, 1);
        commands[2] = c(route[2].ticks - delta, 1);
      } else {
        commands[1] = c(route[1].ticks + delta, 0, 1);
        commands[3] = c(route[3].ticks - delta, 0, 1);
      }
      const end = run(world, entry, commands);
      if (!end.deaths && middleComplete(section, end)) valid.push(delta);
    }
    const measured = bands(valid), nominal = measured.find(([a, b]) => a <= 0 && b >= 0);
    assert.ok(nominal && nominal[1] - nominal[0] + 1 >= 24);
    t.diagnostic(`middle ${section + 3} ${kind} turn delta bands: ${JSON.stringify(measured)}`);
  }
});

test('BT-049: all four joined sections have full continuous launch bands and unpadded exact totals', t => {
  const world = aftershock.firstFour;
  for (const kind of ['ordinary', 'fast'] as const) {
    let entry = createState(world), distance = 0, travelled = createState(world);
    const valid: number[] = [], checkpointTicks: number[] = [];
    const route = witnesses.FOUR_SECTION_ROUTES[kind];
    assert.ok(route.every(c => c.x || c.y), 'no artificial comparison waits');
    for (const command of route) for (let n = 0; n < command.ticks; n++) {
      const prior = travelled;
      travelled = step(world, prior, command);
      distance += Math.hypot(travelled.position.x - prior.position.x, travelled.position.y - prior.position.y);
      if (travelled.event === 'checkpoint') checkpointTicks.push(travelled.tick);
    }
    assert.equal(travelled.tick, kind === 'ordinary' ? 2551 : 2229);
    assert.ok(Math.abs(distance - travelled.tick * 0.03) < 1e-8, 'every witness tick is real travel, not wall padding');
    for (let delay = 0; delay < 480; delay++) {
      const end = run(world, entry, route);
      if (end.won && !end.deaths) valid.push(delay);
      entry = step(world, entry, STILL);
    }
    const measured = bands(valid), wait = Math.max(...Array.from({ length: 480 }, (_, p) => nextWait(p, valid)));
    assert.ok(measured[0][0] === 0 && measured[0][1] >= 23);
    assert.ok(wait <= 360);
    t.diagnostic(`four-section ${kind}: ${travelled.tick} ticks, ${distance} tiles, checkpoints `
      + `${JSON.stringify(checkpointTicks)}, launch ${JSON.stringify(measured)}, max wait ${wait}`);
  }
});

test('BT-049: exact wrong-time, wrong-position and omitted-transfer inputs die after real checkpoints', () => {
  const world = aftershock.firstFour;
  for (const f of MIDDLE_FAILURES) {
    const entry = middleEntry(f.section, f.incoming === 'fast' ? 'fast' : 'ordinary');
    const death = run(world, entry, f.commands);
    assert.equal(death.deaths, 1, f.name);
    assert.equal(death.tick, f.tick, f.name);
    assert.equal(death.tick - entry.tick, duration(f.commands), 'fixture ends on first death');
    assert.equal(death.deathCause, f.cause, f.name);
    assert.equal(lethalAt(world, death.position, death.tick), f.cause);
    assert.equal(death.respawnTicks, 54);
    assert.equal(death.patternOffset, 0);
    assert.deepEqual(death.visited, world.checkpoints.slice(0, f.section + 2).map(p => `${p.x},${p.y}`));
  }
});

test('BT-049: no blind heading or omitted lateral decision replaces the puzzle at either normal arrival', () => {
  const world = aftershock.firstFour;
  for (const kind of ['ordinary', 'fast'] as const) {
    const entry = middleEntry(1, kind);
    for (const [x, y] of [[1, 0], [1, 1], [1, -1]]) {
      const death = run(world, entry, [c(1600, x, y)]);
      assert.equal(death.won, false);
      assert.equal(death.deaths, 1, `fan ${kind} heading ${x},${y}`);
      assert.equal(death.deathCause, 'pulse');
    }
    // The ordinary and diagonal routes must leave their chosen column.
    const omitted = run(world, entry, [...witnesses.MIDDLE_ROUTES[1][kind].slice(0, 2), c(600, 0, 1)]);
    assert.equal(omitted.deaths, 1);
    assert.equal(omitted.deathCause, 'pulse');
    // Wall-hugging is input-driven too, not a sampled or repositioned start.
    for (const dy of [-1, 1]) {
      const death = run(world, entry, [c(10, 0, dy), c(1000, 1)]);
      assert.equal(death.deaths, 1);
      assert.equal(death.deathCause, 'pulse');
    }
  }
});

test('BT-049: swept saw cut and complete fan footprint cover continuous seams, not just tile connectivity', () => {
  const [patrol, fan] = aftershock.AFTERSHOCK_MIDDLE, world = aftershock.firstFour;
  const saw = patrol.hazards[0];
  assert.equal(saw.kind, 'saw');
  if (saw.kind !== 'saw') throw new Error('Expected a patrol');
  assert.equal(saw.from.x, 46);
  assert.equal(saw.to.x, 46);
  // Every continuous left-to-right path crosses x=46.5. At that cut,
  // all non-wall centers lie in [2.2,4.8]; the patrol reaches beyond both
  // ends. Discrete sample spacing is smaller than its lethal diameter.
  for (let y = 0; y < world.tiles.length; y++)
    assert.equal(world.tiles[y][46], y >= 2 && y <= 4 ? '.' : '#');
  assert.ok(saw.from.y + 0.5 < 2 + RULES.radius);
  assert.ok(saw.to.y + 0.5 > 5 - RULES.radius);
  assert.ok(2 * (saw.to.y - saw.from.y) / saw.period < 2 * (RULES.radius + RULES.sawRadius));
  // For pulses even the worst unit-tile corner is inside the rounded lethal
  // footprint. Thus covering every interior tile covers all continuous
  // corner and seam paths; walls only erode that set further.
  assert.ok(2 * (0.5 - RULES.pulseRadius) ** 2 < RULES.radius ** 2);
  for (let y = 3; y <= 9; y++) for (let x = 57; x <= 63; x++) {
    if (world.tiles[y][x] !== '.') continue;
    assert.ok(fan.hazards.some(h => h.kind === 'pulse' && h.x === x && h.y === y), `uncovered ${x},${y}`);
  }
  // Both lateral boundaries are geometry, not checkpoint order. The entry
  // corridor ends east of x62, and the lower exit narrows to x58.
  assert.equal(world.tiles[3][63], '#');
  for (let x = 55; x < 65; x++) assert.equal(world.tiles[10][x], x === 58 ? '.' : '#');
  for (const h of fan.hazards) {
    assert.equal(h.kind, 'pulse');
    if (h.kind !== 'pulse') throw new Error('Expected fan pulse');
    assert.equal(h.on, 1);
    assert.equal(h.period, 480);
    const flash = (480 - h.phase) % 480;
    assert.equal(hazardSample(h, flash - 28).warning, false);
    for (let n = 1; n <= 27; n++) assert.equal(hazardSample(h, flash - n).warning, true);
    assert.equal(hazardSample(h, flash).active, true);
    for (let n = 1; n < 480; n++) assert.equal(hazardSample(h, flash + n).active, false);
  }
  for (const f of aftershock.AFTERSHOCK_MIDDLE) {
    assert.ok(Object.isFrozen(f) && Object.isFrozen(f.tiles) && Object.isFrozen(f.hazards));
    assert.match(f.tiles.join(''), /^[.#]+$/);
    assert.ok(f.hazards.every(Object.isFrozen));
    assert.deepEqual(f.section.camera.frame, f.section.bounds);
    assert.equal(f.section.completion.kind, 'checkpoint');
  }
});

test('BT-049: the entire landing trigger and observation remain safe through all local phases', () => {
  const world = aftershock.firstFour;
  for (const f of aftershock.AFTERSHOCK_MIDDLE) {
    const landing = center(f.landing);
    for (const h of f.hazards) {
      const from = h.kind === 'saw' ? h.from : h, to = h.kind === 'saw' ? h.to : h;
      const dx = Math.max(from.x + 0.5 - landing.x, landing.x - to.x - 0.5, 0);
      const dy = Math.max(from.y + 0.5 - landing.y, landing.y - to.y - 0.5, 0);
      const reach = RULES.radius + f.landing.radius + (h.kind === 'saw' ? RULES.sawRadius : RULES.pulseRadius);
      assert.ok(Math.hypot(dx, dy) > reach, 'whole trigger disk separated from swept hazard');
    }
    for (let phase = 0; phase < 480; phase++) {
      assert.equal(lethalAt(world, center(f.section.entry), phase), null);
      assert.equal(lethalAt(world, landing, phase), null);
      for (const offset of [-0.29, 0, 0.29]) {
        const p = f.landing.y === 3 ? { x: landing.x, y: landing.y + offset }
          : { x: landing.x + offset, y: landing.y };
        assert.equal(wallAt(world, p), false);
        assert.ok(reachesCheckpoint(world, p, f.landing));
        assert.equal(lethalAt(world, p, phase), null);
      }
    }
  }
});

test('BT-049: actual checkpoint failure, 54-tick respawn and successful recovery cover every launch phase', t => {
  const world = aftershock.firstFour;
  for (const section of [0, 1]) {
    const route = witnesses.MIDDLE_ROUTES[section].ordinary;
    const attempt = section === 0 ? [c(167, 1), c(480)] : [...route.slice(0, 2), c(480)];
    const entry = middleEntry(section, 'ordinary');
    const firstDeath = run(world, entry, attempt);
    const firstRespawn = run(world, firstDeath, [c(54)]);
    const recoveryEntry = run(world, firstRespawn, [c(100, 1)]);
    const valid: number[] = [];
    let waiting = recoveryEntry;
    for (let delay = 0; delay < 480; delay++) {
      const end = run(world, waiting, route);
      if (end.deaths === 1 && middleComplete(section, end)) valid.push(waiting.tick % 480);
      waiting = step(world, waiting, STILL);
    }
    valid.sort((a, b) => a - b);
    assert.ok(valid.length);
    // Prefer a window with 24 forward launch choices. Do not turn a legal
    // eight-tick secondary band into the recommended ordinary retry.
    const comfortable = valid.filter(p => Array.from({ length: 24 },
      (_, n) => (p + n) % 480).every(p => valid.includes(p)));
    assert.ok(comfortable.length);
    const maximumComfortWait = Math.max(...Array.from({ length: 480 }, (_, p) => nextWait(p, comfortable)));
    assert.ok(maximumComfortWait <= 360);
    let initial = entry, maxWait = 0, longest = 0;
    const deaths = new Set<number>(), respawns = new Set<number>(), releases = new Set<number>();
    for (let phase = 0; phase < 480; phase++) {
      const death = run(world, initial, attempt);
      assert.equal(death.deaths, 1, `section ${section + 3} launch ${phase}`);
      assert.equal(death.deathCause, section === 0 ? 'saw' : 'pulse');
      const respawn = run(world, death, [c(54)]);
      assert.equal(respawn.tick, death.tick + 54);
      assert.equal(respawn.respawnTicks, 0);
      assert.equal(respawn.patternOffset, 0);
      assert.deepEqual(respawn.position, center(world.checkpoints[section + 1]));
      const approach = run(world, respawn, [c(100, 1)]);
      assert.equal(approach.deaths, 1);
      const wait = nextWait(approach.tick % 480, comfortable);
      const finish = run(world, approach, [c(wait), ...route]);
      assert.equal(finish.deaths, 1);
      assert.ok(middleComplete(section, finish));
      assert.equal(hazardTick(finish), finish.tick);
      maxWait = Math.max(maxWait, wait);
      longest = Math.max(longest, finish.tick - death.tick);
      deaths.add(death.tick % 480); respawns.add(respawn.tick % 480);
      // Also release from a REAL respawn at every clock phase. The legal wait
      // is on the checkpoint, not a synthetic initial state or phase setter.
      const release = run(world, firstRespawn, [c(phase)]);
      assert.equal(release.deaths, 1);
      releases.add(release.tick % 480);
      const reentry = run(world, release, [c(100, 1)]);
      const releaseWait = nextWait(reentry.tick % 480, comfortable);
      maxWait = Math.max(maxWait, releaseWait);
      const retry = run(world, reentry, [c(releaseWait), ...route]);
      assert.equal(retry.deaths, 1);
      assert.ok(middleComplete(section, retry));
      initial = step(world, initial, STILL);
    }
    assert.equal(releases.size, 480);
    assert.ok(maxWait <= 360);
    t.diagnostic(`middle ${section + 3}: 480/480 initial-phase recoveries AND 480/480 checkpoint-release phases; `
      + `legal recovery entry phases ${JSON.stringify(bands(valid))}; max wait ${maxWait}; longest death-to-completion ${longest}; `
      + `24-choice recovery phases ${JSON.stringify(bands(comfortable))}, maximum comfortable wait ${maximumComfortWait}; `
      + `death residues ${JSON.stringify(bands([...deaths].sort((a, b) => a - b)))}; `
      + `respawn residues ${JSON.stringify(bands([...respawns].sort((a, b) => a - b)))}`);
  }
});

test('BT-049: every fan tile expires after a legal approach and recovers from checkpoint three at every death residue', t => {
  const world = aftershock.firstFour, entry = middleEntry(1, 'ordinary');
  const fan = aftershock.AFTERSHOCK_MIDDLE[1], records = [];
  const valid = expand([[53, 390]]); // At least 24 choices remain in the broad ordinary launch band.
  const deathPhases = new Set<number>(), respawnPhases = new Set<number>();
  for (const h of fan.hazards) {
    assert.equal(h.kind, 'pulse');
    if (h.kind !== 'pulse') throw new Error('Expected a fan pulse');
    // These are cardinal waypoints, not positioned states. Each move uses
    // the reached position to choose a whole number of ordinary input ticks.
    // The outer elbow reaches even the tiles not used by either witness.
    const points: readonly (readonly [number, number])[] = h.y === 3 ? [[h.x, 3]]
      : h.y <= 5 ? [[62, 3], [62, h.y], [h.x, h.y]]
      : h.y <= 7 ? [[61, 3], [61, 6], [h.x, 6], [h.x, h.y]]
      : [[61, 3], [61, 6], [58, 6], [58, h.y], [h.x, h.y]];
    let waiting = entry, reached: State | undefined, launchWait = 0;
    for (; launchWait < 480; launchWait++) {
      let candidate = waiting;
      for (const [x, y] of points) {
        const dx = x + 0.5 - candidate.position.x, dy = y + 0.5 - candidate.position.y;
        candidate = run(world, candidate, [c(Math.round(Math.abs(dx) / 0.03), Math.sign(dx)),
          c(Math.round(Math.abs(dy) / 0.03), 0, Math.sign(dy))]);
        if (candidate.deaths) break;
      }
      if (!candidate.deaths && Math.hypot(candidate.position.x - h.x - 0.5,
        candidate.position.y - h.y - 0.5) < 0.025) { reached = candidate; break; }
      waiting = step(world, waiting, STILL);
    }
    assert.ok(reached, `no legal approach to ${h.x},${h.y}`);
    const death = run(world, reached, [c(480)]);
    assert.equal(death.deaths, 1);
    assert.equal(death.deathCause, 'pulse');
    assert.equal(hazardSample(h, death.tick).active, true, 'occupied tile itself expires');
    const respawn = run(world, death, [c(54)]);
    assert.deepEqual(respawn.position, center(world.checkpoints[2]));
    assert.equal(respawn.respawnTicks, 0);
    assert.equal(respawn.tick, death.tick + 54);
    const approach = run(world, respawn, [c(100, 1)]);
    const wait = nextWait(approach.tick % 480, valid);
    const finish = run(world, approach, [c(wait), ...witnesses.MIDDLE_ROUTES[1].ordinary]);
    assert.equal(finish.deaths, 1);
    assert.ok(finish.won);
    assert.equal(hazardTick(finish), finish.tick);
    deathPhases.add(death.tick % 480); respawnPhases.add(respawn.tick % 480);
    records.push({ site: [h.x, h.y], launchWait, death: death.tick, respawn: respawn.tick,
      entry: approach.tick, wait, finish: finish.tick });
  }
  const expected = [...new Set(fan.hazards.map(h => (480 - h.phase) % 480))].sort((a, b) => a - b);
  assert.deepEqual([...deathPhases].sort((a, b) => a - b), expected);
  assert.deepEqual([...respawnPhases].sort((a, b) => a - b),
    [...new Set(expected.map(p => (p + 54) % 480))].sort((a, b) => a - b));
  t.diagnostic(`fan all-site recovery: ${JSON.stringify(records)}`);
  t.diagnostic(`fan all death residues: ${JSON.stringify(expected)}`);
});
