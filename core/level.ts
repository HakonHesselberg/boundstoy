import { TERRAIN, type Tile } from '../data/terrain.ts';

export type Point = Readonly<{ x: number; y: number }>;
export type Pulse = Readonly<{ kind: 'pulse'; x: number; y: number; period: number; on: number; phase: number }>;
export type Saw = Readonly<{ kind: 'saw'; from: Point; to: Point; period: number; phase: number }>;
export type Hazard = Pulse | Saw;
export type Level = Readonly<{
  version: 1;
  id: string;
  name: string;
  description: string;
  tiles: readonly string[];
  spawn: Point;
  goal: Point;
  checkpoints: readonly Point[];
  hazards: readonly Hazard[];
  resetPatternOnRetry?: boolean;
}>;

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}
function text(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`${label} must be 1-${max} characters.`);
  return value;
}
function integer(value: unknown, label: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label} must be an integer from ${min} to ${max}.`);
  }
  return value;
}
function list(value: unknown, label: string, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) throw new Error(`${label} must be an array with at most ${max} entries.`);
  return value;
}
export function isTile(value: string): value is Tile {
  return Object.hasOwn(TERRAIN, value);
}

export function parseLevel(value: unknown): Level {
  const raw = record(value, 'Level');
  if (raw.version !== 1) throw new Error('Unsupported level version. Expected version 1.');
  if (raw.resetPatternOnRetry !== undefined && typeof raw.resetPatternOnRetry !== 'boolean')
    throw new Error('resetPatternOnRetry must be a boolean.');
  const id = text(raw.id, 'id', 60);
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error('id must use lowercase letters, numbers and hyphens.');
  const rows = list(raw.tiles, 'tiles', 32);
  if (rows.length < 6) throw new Error('tiles must contain 6-32 rows.');
  const tiles = rows.map((row, y) => {
    if (typeof row !== 'string' || row.length < 8 || row.length > 40) throw new Error(`tiles row ${y} needs a width of 8-40.`);
    for (const char of row) if (!isTile(char)) throw new Error(`Unknown terrain "${char}" in row ${y}.`);
    return row;
  });
  if (tiles.some(row => row.length !== tiles[0].length)) throw new Error('All tiles rows must have the same width.');
  const point = (value: unknown, label: string, safe = false): Point => {
    const p = record(value, label);
    const x = integer(p.x, `${label}.x`, 0, tiles[0].length - 1);
    const y = integer(p.y, `${label}.y`, 0, tiles.length - 1);
    const char = tiles[y][x] as Tile;
    if (safe && (TERRAIN[char].solid || TERRAIN[char].lethal)) throw new Error(`${label} must be on safe ground.`);
    return Object.freeze({ x, y });
  };
  const hazards = list(raw.hazards, 'hazards', 80).map((value, i): Hazard => {
    const h = record(value, `hazards[${i}]`);
    const period = integer(h.period, `hazards[${i}].period`, 120, 3600);
    const phase = integer(h.phase, `hazards[${i}].phase`, 0, period - 1);
    if (h.kind === 'pulse') {
      // Version-1 imports keep their rhythm, but legacy flame durations become single detonations.
      integer(h.on, `pulse[${i}].on`, 1, period - 60);
      return Object.freeze({ kind: 'pulse', ...point(h, `pulse[${i}]`), period, phase,
        on: 1 });
    }
    if (h.kind === 'saw') {
      return Object.freeze({ kind: 'saw', from: point(h.from, `saw[${i}].from`), to: point(h.to, `saw[${i}].to`), period, phase });
    }
    throw new Error(`Unknown hazard kind in hazards[${i}].`);
  });
  const spawn = point(raw.spawn, 'spawn', true), goal = point(raw.goal, 'goal', true);
  if (spawn.x === goal.x && spawn.y === goal.y) throw new Error('spawn and goal must be different tiles.');
  return Object.freeze({
    version: 1, id, name: text(raw.name, 'name', 60), description: text(raw.description, 'description', 240),
    tiles: Object.freeze(tiles), spawn, goal,
    checkpoints: Object.freeze(list(raw.checkpoints, 'checkpoints', 30).map((p, i) => point(p, `checkpoint[${i}]`, true))),
    hazards: Object.freeze(hazards),
    resetPatternOnRetry: raw.resetPatternOnRetry === true,
  });
}

export function importLevel(source: string): Level {
  if (source.length > 100_000) throw new Error('Level JSON exceeds the 100 KB limit.');
  return parseLevel(JSON.parse(source));
}

export function center(point: Point): Point {
  return { x: point.x + 0.5, y: point.y + 0.5 };
}
