import { TERRAIN, RULES, type Tile, type Terrain } from '../data/terrain.ts';
import { center, type Level, type Hazard, type Point } from './level.ts';

export const DT = 1 / RULES.tickRate;
export type DeathCause = 'void' | 'spikes' | 'pulse' | 'saw';
export type State = Readonly<{
  tick: number;
  patternOffset: number;
  position: Point;
  velocity: Point;
  checkpoint: Point;
  visited: readonly string[];
  deaths: number;
  respawnTicks: number;
  won: boolean;
  event: 'none' | 'death' | 'checkpoint' | 'win';
  deathCause: DeathCause | null;
}>;
export const STILL: Point = Object.freeze({ x: 0, y: 0 });

export function createState(level: Level): State {
  return { tick: 0, patternOffset: 0, position: center(level.spawn), velocity: STILL, checkpoint: level.spawn,
    visited: [], deaths: 0, respawnTicks: 0, won: false, event: 'none', deathCause: null };
}
export function hazardTick(state: State): number {
  return state.tick - state.patternOffset;
}
export function terrainAt(level: Level, position: Point): Terrain {
  const char = level.tiles[Math.floor(position.y)]?.[Math.floor(position.x)] as Tile | undefined;
  return char === undefined ? TERRAIN[' '] : TERRAIN[char];
}
export function hazardSample(hazard: Hazard, tick: number) {
  const cycle = ((tick + hazard.phase) % hazard.period + hazard.period) % hazard.period;
  if (hazard.kind === 'pulse') {
    return { position: center(hazard), active: cycle === 0, cycle,
      warning: cycle >= hazard.period - RULES.pulseWarningTicks, progress: cycle / hazard.period };
  }
  const t = 1 - Math.abs(2 * cycle / hazard.period - 1);
  return { position: { x: hazard.from.x + 0.5 + (hazard.to.x - hazard.from.x) * t,
    y: hazard.from.y + 0.5 + (hazard.to.y - hazard.from.y) * t }, active: true, warning: false, progress: t, cycle };
}
export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function wallAt(level: Level, p: Point): boolean {
  const r = RULES.radius;
  for (let y = Math.floor(p.y - r); y <= Math.floor(p.y + r); y++) {
    for (let x = Math.floor(p.x - r); x <= Math.floor(p.x + r); x++) {
      if (!terrainAt(level, { x, y }).solid) continue;
      const dx = p.x - Math.max(x, Math.min(x + 1, p.x));
      const dy = p.y - Math.max(y, Math.min(y + 1, p.y));
      if (dx * dx + dy * dy < r * r) return true;
    }
  }
  return false;
}
function lethalAt(level: Level, p: Point, tick: number): DeathCause | null {
  const terrain = terrainAt(level, p);
  if (terrain.lethal) return terrain.id === 'spikes' ? 'spikes' : 'void';
  for (const h of level.hazards) {
    const sample = hazardSample(h, tick);
    if (!sample.active) continue;
    if (h.kind === 'saw') {
      if (distance(p, sample.position) < RULES.radius + RULES.sawRadius) return 'saw';
    } else {
      const dx = Math.max(Math.abs(p.x - sample.position.x) - RULES.pulseRadius, 0);
      const dy = Math.max(Math.abs(p.y - sample.position.y) - RULES.pulseRadius, 0);
      if (dx * dx + dy * dy < RULES.radius * RULES.radius) return 'pulse';
    }
  }
  return null;
}
function die(state: State, deathCause: DeathCause): State {
  return { ...state, deaths: state.deaths + 1, respawnTicks: RULES.respawnTicks, velocity: STILL, event: 'death', deathCause };
}
export function step(level: Level, prior: State, input: Point): State {
  if (!Number.isFinite(input.x) || !Number.isFinite(input.y)) throw new Error('Movement input must be finite.');
  if (prior.won) return prior;
  let state: State = { ...prior, tick: prior.tick + 1, event: 'none' };
  if (state.respawnTicks > 0) {
    const respawnTicks = state.respawnTicks - 1;
    return { ...state, respawnTicks, position: respawnTicks === 0 ? center(state.checkpoint) : state.position,
      patternOffset: respawnTicks === 0 && level.resetPatternOnRetry ? state.tick : state.patternOffset };
  }
  const ground = terrainAt(level, state.position);
  const length = Math.hypot(input.x, input.y);
  const control = length > 1 ? { x: input.x / length, y: input.y / length } : input;
  let vx = state.velocity.x, vy = state.velocity.y;
  if (ground.model === 'locked') {
    const speed = Math.hypot(vx, vy);
    if (speed > 0.001) {
      vx = vx / speed * ground.speed; vy = vy / speed * ground.speed;
    } else {
      vx = control.x * ground.speed; vy = control.y * ground.speed;
    }
  } else if (ground.model === 'steer') {
    let heading = Math.hypot(vx, vy) > 0.001 ? Math.atan2(vy, vx) : length > 0 ? Math.atan2(control.y, control.x) : 0;
    if (length > 0.001) {
      const desired = Math.atan2(control.y, control.x);
      let turn = Math.atan2(Math.sin(desired - heading), Math.cos(desired - heading));
      // Exact reverse always takes the clockwise arc, including across the angle seam.
      if (Math.abs(Math.abs(turn) - Math.PI) < 1e-10) turn = Math.PI;
      heading += Math.max(-ground.turnRate * DT, Math.min(ground.turnRate * DT, turn));
    }
    vx = Math.cos(heading) * ground.speed;
    vy = Math.sin(heading) * ground.speed;
  } else {
    vx = control.x * ground.speed; vy = control.y * ground.speed;
  }
  let position = state.position;
  const segments = Math.max(1, Math.ceil(Math.hypot(vx, vy) * DT / RULES.collisionStep));
  for (let i = 0; i < segments; i++) {
    if (ground.model === 'steer') {
      let next = { x: position.x + vx * DT / segments, y: position.y + vy * DT / segments };
      if (wallAt(level, next)) {
        const blockedX = wallAt(level, { x: next.x, y: position.y });
        const blockedY = wallAt(level, { x: position.x, y: next.y });
        if (blockedX || !blockedY) vx = -vx;
        if (blockedY || !blockedX) vy = -vy;
        next = { x: position.x + vx * DT / segments, y: position.y + vy * DT / segments };
      }
      if (!wallAt(level, next)) position = next;
    } else if (ground.model === 'locked') {
      const next = { x: position.x + vx * DT / segments, y: position.y + vy * DT / segments };
      if (wallAt(level, next)) { vx = 0; vy = 0; }
      else position = next;
    } else {
      const xMove = { x: position.x + vx * DT / segments, y: position.y };
      if (!wallAt(level, xMove)) position = xMove;
      else vx = 0;
      const yMove = { x: position.x, y: position.y + vy * DT / segments };
      if (!wallAt(level, yMove)) position = yMove;
      else vy = 0;
    }
    const cause = lethalAt(level, position, hazardTick(state));
    if (cause) return die({ ...state, position }, cause);
  }
  state = { ...state, position, velocity: { x: vx, y: vy } };
  for (const checkpoint of level.checkpoints) {
    const key = `${checkpoint.x},${checkpoint.y}`;
    if (!state.visited.includes(key) && distance(position, center(checkpoint)) < RULES.markerRadius) {
      state = { ...state, checkpoint, visited: [...state.visited, key], event: 'checkpoint' };
    }
  }
  if (distance(position, center(level.goal)) < RULES.markerRadius) {
    return { ...state, won: true, velocity: STILL, event: 'win' };
  }
  return state;
}

export function ascii(level: Level, state: State): string {
  const rows = level.tiles.map(row => [...row]);
  for (const point of level.checkpoints) rows[point.y][point.x] = 'C';
  rows[level.goal.y][level.goal.x] = 'G';
  for (const h of level.hazards) {
    const sample = hazardSample(h, hazardTick(state)), p = sample.position;
    rows[Math.floor(p.y)][Math.floor(p.x)] = h.kind === 'saw' ? 'X' : sample.active ? '*' : 'o';
  }
  const x = Math.floor(state.position.x), y = Math.floor(state.position.y);
  if (rows[y]?.[x] !== undefined) rows[y][x] = '@';
  return rows.map(row => row.join('')).join('\n');
}
