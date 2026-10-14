import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CLASSIC_BOUNDS } from '../data/classic-bounds.ts';
import { CLASSIC_BOUND_WITNESSES, WINDOW_CAP, type BoundWitness } from '../data/classic-bound-replays.ts';
import { EXPLOSION_PUZZLES } from '../data/explosion-puzzles.ts';
import { LEVELS } from '../data/levels.ts';
import { parseLevel, type Level, type Pulse } from '../core/level.ts';
import { createState, step, type State } from '../core/simulation.ts';
import type { BenchmarkCommand } from '../data/benchmark-replays.ts';

type Command = BenchmarkCommand;
const isWait = (c: Command) => c.x === 0 && c.y === 0;

function run(level: Level, commands: readonly Command[], initial: State = createState(level)) {
  let state = initial;
  for (const c of commands) for (let i = 0; i < c.ticks && !state.won && state.deaths === initial.deaths; i++)
    state = step(level, state, c);
  return state;
}
/** Re-sync model: start one move-from-rest `delta` ticks late (or early); the next pause absorbs it. */
function shifted(commands: readonly Command[], at: number, delta: number): Command[] | null {
  const result = commands.map(c => ({ ...c }));
  result[at - 1].ticks += delta;
  const pause = result.findIndex((c, i) => i > at && isWait(c));
  if (pause >= 0) result[pause].ticks -= delta;
  return result.every(c => c.ticks >= 0) ? result : null;
}
function windows(level: Level, commands: readonly Command[]) {
  const result: [number, number][] = [];
  for (let at = 1; at < commands.length; at++) {
    if (isWait(commands[at]) || !isWait(commands[at - 1])) continue;
    const side = (sign: number) => {
      let margin = 0;
      for (let delta = 1; delta <= WINDOW_CAP; delta++) {
        const changed = shifted(commands, at, sign * delta);
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
const witnessFor = (id: string): BoundWitness => {
  const witness = CLASSIC_BOUND_WITNESSES[id];
  assert.ok(witness, `${id} has a witness`);
  return witness;
};

test('ClassicBounds_Registry_SixImmutableNormalGroundPulseTrials', () => {
  assert.equal(CLASSIC_BOUNDS.length, 6);
  const ids = CLASSIC_BOUNDS.map(b => b.level.id);
  assert.equal(new Set(ids).size, 6);
  assert.ok(Object.isFrozen(CLASSIC_BOUNDS));
  for (const { level, hints, question, source } of CLASSIC_BOUNDS) {
    assert.match(level.id, /^bound-[a-z-]+$/);
    assert.equal(EXPLOSION_PUZZLES.some(p => p.level.id === level.id), false);
    assert.equal(LEVELS.some(l => l.id === level.id), false);
    assert.ok(Object.isFrozen(level) && Object.isFrozen(level.hazards) && Object.isFrozen(source));
    assert.deepEqual(parseLevel(JSON.parse(JSON.stringify(level))), level);
    assert.ok(level.tiles.every(row => /^[.#]+$/.test(row)), `${level.id}: normal ground and walls only`);
    assert.ok(level.hazards.length > 0 && level.hazards.every(h => h.kind === 'pulse' && h.on === 1));
    assert.ok(level.hazards.every(h => h.phase !== 0), `${level.id}: no pad shows its burst on the ready reveal`);
    assert.equal(level.puzzleMode, 'checkpoint');
    assert.equal(level.checkpoints.length, 0);
    assert.equal(level.sections.length, 1);
    assert.deepEqual(hints, [question]);
    assert.ok(question.length <= 160, `${level.id}: hint fits the overlay`);
    let idle = createState(level);
    for (let i = 0; i < 1200; i++) idle = step(level, idle, { x: 0, y: 0 });
    assert.equal(idle.deaths, 0, `${level.id}: waiting at the start is safe`);
  }
});

test('ClassicBounds_Sources_CreditDecodedMechanismsAsAdaptations', () => {
  const maps = new Set<string>();
  for (const { level, source } of CLASSIC_BOUNDS) {
    assert.ok(['Beginner Bound', 'Level Up Bound'].includes(source.map), level.id);
    assert.equal(source.author, source.map === 'Beginner Bound' ? 'NewRecord' : 'Mp(U)');
    assert.ok(source.obstacle.trim() && source.adaptation.trim(), level.id);
    maps.add(source.map);
  }
  assert.equal(maps.size, 2);
});

test('ClassicBounds_Styles_EachBurstRegionHasOneStyleAndGroupsContrast', () => {
  for (const { level } of CLASSIC_BOUNDS) {
    const pulses = level.hazards as readonly Pulse[];
    const at = new Map(pulses.map(p => [`${p.x},${p.y}`, p]));
    for (const p of pulses) for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const n = at.get(`${p.x + dx},${p.y + dy}`);
      if (n && n.period === p.period && n.phase === p.phase)
        assert.equal(n.style, p.style, `${level.id}: one burst region mixes styles at ${p.x},${p.y}`);
    }
    assert.ok(new Set(pulses.map(p => p.style ?? 'ember')).size >= 2, `${level.id}: groups contrast`);
  }
});

test('ClassicBounds_Witnesses_ExactDeathlessRoutesWithMeasuredTightWindows', t => {
  for (const { level } of CLASSIC_BOUNDS) {
    const witness = witnessFor(level.id);
    const result = run(level, witness.commands);
    assert.equal(result.won, true, level.id);
    assert.equal(result.deaths, 0, level.id);
    assert.equal(result.tick, witness.ticks, level.id);
    const measured = windows(level, witness.commands);
    assert.deepEqual(measured, witness.windows.map(w => [...w]), `${level.id} recorded windows`);
    const sides = measured.map(([early, late]) => Math.min(early, late));
    assert.ok(Math.min(...sides) >= 8, `${level.id}: every decision keeps at least 8 ticks each side`);
    assert.ok(sides.filter(side => side <= 15).length >= 6, `${level.id}: at least six timed decisions within 15 ticks`);
    t.diagnostic(`${level.id}: ${result.tick} ticks, windows ${measured.map(w => w.join('/')).join(' ')}`);
  }
});

test('ClassicBounds_Beeline_RunningThePathWithoutPausesIsNeverEasier', () => {
  for (const { level } of CLASSIC_BOUNDS) {
    const witness = witnessFor(level.id);
    const path = witness.commands.filter(c => !isWait(c));
    const period = Math.max(...(level.hazards as readonly Pulse[]).map(p => p.period));
    assert.equal(run(parseLevel({ ...level, hazards: [] }), path).won, true, `${level.id}: path is walkable`);
    let survivors = 0;
    for (let wait = 0; wait < period; wait++) {
      const outcome = run(level, [{ ticks: wait, x: 0, y: 0 }, ...path]);
      if (outcome.won && !outcome.deaths) survivors++;
    }
    const tightest = Math.min(...witness.windows.map(([early, late]) => early + late + 1));
    assert.ok(survivors < tightest, `${level.id}: a pause-free run survives ${survivors} start phases`);
    assert.ok(survivors <= 6, `${level.id}: a pause-free run is at most a ${survivors}-tick trick`);
  }
});

test('ClassicBounds_Readability_RunItShowsOneFrontAndTheCornerSeamBurstsAlone', () => {
  const fire = (p: Pulse) => (p.period - p.phase) % p.period;
  const circular = (a: number, b: number, period: number) => Math.min(Math.abs(a - b), period - Math.abs(a - b));
  const runIt = CLASSIC_BOUNDS.find(b => b.level.id === 'bound-run-it')!.level;
  const blocks = (runIt.hazards as readonly Pulse[]).filter(p => !p.style && p.y === 3 && p.x % 3 === 0).sort((a, b) => a.x - b.x);
  assert.equal(blocks.length, 8, 'one sample pad per block');
  const period = blocks[0].period;
  let span = 0;
  for (let i = 1; i < blocks.length; i++) {
    const step = (fire(blocks[i]) - fire(blocks[i - 1]) + period) % period;
    assert.ok(step > 0 && step < period / 4, 'the orange wave only moves right');
    span += step;
  }
  assert.ok(span <= period - 60, `run-it wave spans ${span} of ${period}: one front at a time with a pause`);
  const corners = CLASSIC_BOUNDS.find(b => b.level.id === 'bound-closing-corners')!.level;
  const pads = corners.hazards as readonly Pulse[], at = new Map(pads.map(p => [`${p.x},${p.y}`, p]));
  for (const seam of pads.filter(p => p.style === 'psionic')) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const n = at.get(`${seam.x + dx},${seam.y + dy}`);
    if (n && n.style !== 'psionic')
      assert.ok(circular(fire(seam), fire(n), seam.period) >= 35, `seam at ${seam.x},${seam.y} bursts too close to its neighbour`);
  }
});
