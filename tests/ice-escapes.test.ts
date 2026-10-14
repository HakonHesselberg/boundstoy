import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ICE_ESCAPES } from '../data/ice-escapes.ts';
import { ICE_ESCAPE_WITNESSES, ICE_WINDOW_CAP, WARDENS_RUN_DEATH, WARDENS_RUN_RECOVERY, type IceWitness } from '../data/ice-escape-replays.ts';
import { EXPLOSION_PUZZLES } from '../data/explosion-puzzles.ts';
import { CLASSIC_BOUNDS } from '../data/classic-bounds.ts';
import { LEVELS } from '../data/levels.ts';
import { TERRAIN, type Tile } from '../data/terrain.ts';
import { parseLevel, type Level, type Saw } from '../core/level.ts';
import { createState, step, lethalAt, restartCheckpoint, reachesCheckpoint, type State } from '../core/simulation.ts';
import type { BenchmarkCommand } from '../data/benchmark-replays.ts';

type Command = BenchmarkCommand;

function run(level: Level, commands: readonly Command[], initial: State = createState(level)) {
  let state = initial;
  for (const c of commands) for (let i = 0; i < c.ticks && !state.won && state.deaths === initial.deaths; i++)
    state = step(level, state, c);
  return state;
}
/** No input on walkable ground stops at once, so it is a pause; on ice no input means gliding. */
function rests(level: Level, commands: readonly Command[]) {
  let state = createState(level);
  return commands.map(c => {
    const tile = level.tiles[Math.floor(state.position.y)][Math.floor(state.position.x)] as Tile;
    const rest = c.x === 0 && c.y === 0 && TERRAIN[tile].model === 'walk';
    for (let i = 0; i < c.ticks && !state.won; i++) state = step(level, state, c);
    return rest;
  });
}
/** Switch model (see data/ice-escape-replays.ts): move one key change; leaving a rest shifts the slide to the next rest. */
function shifted(commands: readonly Command[], at: number, delta: number, rest: readonly boolean[]): Command[] | null {
  const result = commands.map(c => ({ ...c }));
  result[at - 1].ticks += delta;
  if (rest[at - 1]) {
    const pause = rest.findIndex((r, i) => i > at && r);
    if (pause >= 0) result[pause].ticks -= delta;
  } else result[at].ticks -= delta;
  if (result.some(c => c.ticks < 0)) return null;
  result[result.length - 1].ticks += 60;
  return result;
}
function windows(level: Level, commands: readonly Command[]) {
  const rest = rests(level, commands), result: [number, number][] = [];
  for (let at = 1; at < commands.length; at++) {
    const side = (sign: number) => {
      let margin = 0;
      for (let delta = 1; delta <= ICE_WINDOW_CAP; delta++) {
        const changed = shifted(commands, at, sign * delta, rest);
        if (!changed) break;
        const outcome = run(level, changed);
        if (outcome.deaths || !outcome.won) break;
        margin = delta;
      }
      return margin;
    };
    result.push([side(-1), side(1)]);
  }
  return result;
}
const witnessFor = (id: string): IceWitness => {
  const witness = ICE_ESCAPE_WITNESSES[id];
  assert.ok(witness, `${id} has a witness`);
  return witness;
};
const byId = (id: string) => ICE_ESCAPES.find(e => e.level.id === id)!.level;

test('IceEscapes_Registry_SixImmutableSoftIceCoursesWithCreepsOnly', () => {
  assert.equal(ICE_ESCAPES.length, 6);
  const ids = ICE_ESCAPES.map(e => e.level.id);
  assert.equal(new Set(ids).size, 6);
  assert.ok(Object.isFrozen(ICE_ESCAPES));
  const others = [...EXPLOSION_PUZZLES, ...CLASSIC_BOUNDS].map(p => p.level.id);
  for (const { level, hints, question } of ICE_ESCAPES) {
    assert.match(level.id, /^ice-[a-z-]+$/);
    assert.ok(!others.includes(level.id) && !LEVELS.some(l => l.id === level.id));
    assert.ok(Object.isFrozen(level) && Object.isFrozen(level.hazards));
    assert.deepEqual(parseLevel(JSON.parse(JSON.stringify(level))), level);
    assert.ok(level.tiles.every(row => /^[~.# ]+$/.test(row)), `${level.id}: soft ice, ground, walls and void only`);
    const count = (ch: string) => level.tiles.join('').split(ch).length - 1;
    assert.ok(count('~') > count('.'), `${level.id}: soft ice is the main surface`);
    assert.ok(level.hazards.every(h => h.kind === 'saw'), `${level.id}: creeps are saws`);
    assert.equal(level.puzzleMode, 'checkpoint');
    assert.equal(hints.length, level.sections.length);
    assert.equal(question, hints[0]);
    assert.ok(hints.every(h => h.length <= 160));
    let idle = createState(level);
    for (let i = 0; i < 1200; i++) idle = step(level, idle, { x: 0, y: 0 });
    assert.equal(idle.deaths, 0, `${level.id}: the start pad is safe`);
  }
});

test('IceEscapes_Sources_CreditDocumentedWarcraftIIIIdeas', () => {
  for (const { level, source } of ICE_ESCAPES) {
    assert.ok(Object.isFrozen(source));
    assert.match(source.reference, /Ice Escape Template|Slide Kitty Slide|Warden Ice Escape/, level.id);
    for (const field of [source.credit, source.idea, source.adaptation]) assert.ok(field.trim(), level.id);
  }
});

test('IceEscapes_Witnesses_ExactDeathlessRoutesWithTightSwitchWindows', t => {
  for (const { level } of ICE_ESCAPES) {
    const witness = witnessFor(level.id);
    const result = run(level, witness.commands);
    assert.equal(result.won, true, level.id);
    assert.equal(result.deaths, 0, level.id);
    assert.equal(result.tick, witness.ticks, level.id);
    const measured = windows(level, witness.commands);
    assert.deepEqual(measured, witness.windows.map(w => [...w]), `${level.id} recorded windows`);
    const sides = measured.map(([early, late]) => Math.min(early, late));
    assert.ok(Math.min(...sides) >= 4 && Math.min(...sides) <= 8, `${level.id}: tightest switch keeps 4-8 ticks each side`);
    assert.ok(sides.filter(side => side <= 8).length >= 2, `${level.id}: several tight switches`);
    t.diagnostic(`${level.id}: ${result.tick} ticks, windows ${measured.map(w => w.join('/')).join(' ')}`);
  }
});

test('IceEscapes_Creeps_AMistimedDepartureFailsForMostOfTheCycle', () => {
  for (const { level } of ICE_ESCAPES.filter(e => e.level.hazards.length)) {
    const commands = witnessFor(level.id).commands, rest = rests(level, commands);
    assert.equal(run(parseLevel({ ...level, hazards: [] }), commands).won, true, `${level.id}: route is geometric without creeps`);
    const period = Math.max(...(level.hazards as readonly Saw[]).map(h => h.period));
    // Vary the first rest whose departure meets creeps (later puzzles restart their creeps at a checkpoint).
    let measured = false;
    for (let at = 0; at < commands.length && !measured; at++) {
      if (!rest[at]) continue;
      let survivors = 0;
      for (let ticks = 0; ticks < period; ticks++) {
        const changed = commands.map(c => ({ ...c }));
        changed[at].ticks = ticks; changed[changed.length - 1].ticks += 60;
        const outcome = run(level, changed);
        if (outcome.won && !outcome.deaths) survivors++;
      }
      if (survivors === period) continue;
      measured = true;
      assert.ok(survivors < period / 2, `${level.id}: ${survivors} of ${period} departure ticks survive`);
    }
    assert.ok(measured, `${level.id}: some departure is timed by creeps`);
  }
});

test('IceEscapes_SnowLine_LeftHairpinsNeedDownBeforeRightBecauseReverseSwingsClockwise', () => {
  const level = byId('ice-snow-line'), commands = witnessFor(level.id).commands;
  const down = commands.findIndex((c, i) => c.x === 0 && c.y === 1 && commands[i - 1]?.x === -1 && commands[i + 1]?.x === 1);
  assert.ok(down > 0, 'the witness turns down before turning right');
  const reversed = commands.map(c => ({ ...c }));
  reversed[down + 1].ticks += reversed[down].ticks;
  reversed.splice(down, 1);
  const outcome = run(parseLevel({ ...level, hazards: [] }), reversed);
  assert.ok(outcome.deaths > 0 && outcome.deathCause === 'void', 'pressing right directly swings up off the track');
});

test('IceEscapes_WardensRun_CheckpointsAreWideSafeAndRecoverAfterADownstreamDeath', () => {
  const level = byId('ice-wardens-run');
  assert.equal(level.checkpoints.length, 2);
  for (const checkpoint of level.checkpoints) {
    assert.equal(level.tiles[checkpoint.y][checkpoint.x], '.');
    for (const y of [7.21, 7.5, 8, 8.5, 8.79])
      assert.equal(reachesCheckpoint(level, { x: checkpoint.x + 0.5, y }, checkpoint), true, `${checkpoint.id} covers lane y ${y}`);
  }
  let state = createState(level);
  const chute = { x: 16.5, y: 7.5 };
  for (let tick = 1; tick <= 120; tick++) assert.equal(lethalAt(level, chute, tick, state), null, 'future creeps are dormant');
  state = run(level, WARDENS_RUN_DEATH);
  assert.equal(state.visited.length, 1);
  assert.equal(state.deaths, 1, 'input-only death after the first checkpoint');
  const reset = restartCheckpoint(level, state);
  assert.equal(reset.tick, state.tick);
  assert.equal(reset.deaths, 1);
  assert.equal(reset.patternOffset, reset.tick);
  assert.deepEqual(reset.position, { x: 12.5, y: 7.5 });
  const recovered = run(level, WARDENS_RUN_RECOVERY, reset);
  assert.equal(recovered.won, true);
  assert.equal(recovered.deaths, 1);
  assert.equal(recovered.tick - reset.tick, 1074);
});

test('IceEscapes_Playtest_FastCreepsStayOutOfTightTracksAndTheSpiralExitCannotBeSkipped', () => {
  // BT-082: fast saws in tight soft-ice corridors felt unfair; these courses keep creeps only in chutes and open lanes.
  for (const id of ['ice-snow-line', 'ice-bumper-alley']) assert.equal(byId(id).hazards.length, 0, id);
  assert.deepEqual(byId('ice-wardens-run').hazards.map(h => h.sectionId), ['part-2', 'part-2', 'part-2', 'part-2']);
  const spiral = byId('ice-spiral'), { goal, tiles } = spiral;
  for (let y = goal.y - 1; y <= goal.y + 2; y++) for (let x = goal.x + 1; x <= goal.x + 1; x++)
    assert.equal(tiles[y][x], ' ', `void separates the exit from the earlier arm at ${x},${y}`);
  const pad = [{ x: goal.x, y: goal.y }, { x: goal.x, y: goal.y + 1 }];
  const entries = pad.flatMap(p => [[-1, 0], [1, 0], [0, -1], [0, 1]].map(([dx, dy]) => ({ x: p.x + dx, y: p.y + dy })))
    .filter(p => tiles[p.y][p.x] === '~');
  assert.ok(entries.length > 0 && entries.every(p => p.x < goal.x), 'only the innermost arm reaches the exit');
});
