import { TERRAIN, RULES, type Tile } from '../data/terrain.ts';
import { V1_LIMITS, V2_LIMITS } from '../data/level-limits.ts';
import { DEFAULT_EXPLOSION_STYLE, EXPLOSION_STYLE_IDS, isExplosionStyle, type ExplosionStyleId } from '../data/explosion-styles.ts';
import { parseWorldMetadata, type World } from './world.ts';

export type { World, WorldCheckpoint, Section, Bounds, SectionCamera, SectionCompletion } from './world.ts';

export type Point = Readonly<{ x: number; y: number }>;
export type Checkpoint = Point & Readonly<{ radius?: number }>;
/** `style` is cosmetic; absent means the default (Ember) and is the canonical form. */
export type Pulse = Readonly<{ kind: 'pulse'; x: number; y: number; period: number; on: number; phase: number; sectionId?: string;
  style?: ExplosionStyleId }>;
export type Saw = Readonly<{ kind: 'saw'; from: Point; to: Point; period: number; phase: number; sectionId?: string }>;
export type Hazard = Pulse | Saw;
export type LevelV1 = Readonly<{
  version: 1;
  id: string;
  name: string;
  description: string;
  tiles: readonly string[];
  spawn: Point;
  goal: Point;
  checkpoints: readonly Checkpoint[];
  hazards: readonly Hazard[];
  resetPatternOnRetry?: boolean;
}>;
export type Level = LevelV1 | World;

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
  if (raw.version !== 1 && raw.version !== 2) throw new Error('Unsupported level version. Expected version 1 or 2.');
  const v2 = raw.version === 2, limits = v2 ? V2_LIMITS : V1_LIMITS;
  const keys = (obj: Record<string, unknown>, allowed: readonly string[], label: string) => {
    if (v2) for (const key of Object.keys(obj))
      if (!allowed.includes(key)) throw new Error(`${label}: unknown field "${key}".`);
  };
  if (v2) for (const field of ['tiles', 'hazards', 'checkpoints']) {
    const values = raw[field];
    if (Array.isArray(values)) for (let i = 0; i < values.length; i++)
      if (!Object.hasOwn(values, i)) throw new Error(`${field}[${i}] must not be a sparse array entry.`);
  }
  keys(raw, ['version', 'id', 'revision', 'name', 'description', 'tiles', 'spawn', 'goal',
    'checkpoints', 'hazards', 'resetPatternOnRetry', 'sections', 'puzzleMode'], 'World');
  if (raw.puzzleMode !== undefined && (!v2 || raw.puzzleMode !== 'checkpoint'))
    throw new Error('puzzleMode must be checkpoint and is only supported in version 2.');
  if (raw.resetPatternOnRetry !== undefined && typeof raw.resetPatternOnRetry !== 'boolean')
    throw new Error('resetPatternOnRetry must be a boolean.');
  const id = text(raw.id, 'id', 60);
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error('id must use lowercase letters, numbers and hyphens.');
  const rows = list(raw.tiles, 'tiles', limits.maxHeight);
  if (rows.length < limits.minHeight) throw new Error(`tiles must contain ${limits.minHeight}-${limits.maxHeight} rows.`);
  const tiles = rows.map((row, y) => {
    if (typeof row !== 'string' || row.length < limits.minWidth || row.length > limits.maxWidth)
      throw new Error(`tiles row ${y} needs a width of ${limits.minWidth}-${limits.maxWidth}.`);
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
  const hazards = list(raw.hazards, 'hazards', limits.hazards).map((value, i): Hazard => {
    const h = record(value, `hazards[${i}]`);
    if (Object.hasOwn(h, 'sectionId') && raw.puzzleMode !== 'checkpoint')
      throw new Error(`hazards[${i}].sectionId requires checkpoint puzzleMode.`);
    const ownership = h.sectionId === undefined ? {} : { sectionId: text(h.sectionId, `hazards[${i}].sectionId`, 60) };
    const period = integer(h.period, `hazards[${i}].period`, 120, 3600);
    const phase = integer(h.phase, `hazards[${i}].phase`, 0, period - 1);
    if (h.kind === 'pulse') {
      keys(h, ['kind', 'x', 'y', 'period', 'on', 'phase', 'sectionId', 'style'], `pulse[${i}]`);
      if (h.style !== undefined && !isExplosionStyle(h.style))
        throw new Error(`pulse[${i}].style must be one of ${EXPLOSION_STYLE_IDS.join(', ')}.`);
      const style = h.style === undefined || h.style === DEFAULT_EXPLOSION_STYLE ? {} : { style: h.style };
      // Version-1 imports keep their rhythm, but legacy flame durations become single detonations.
      integer(h.on, `pulse[${i}].on`, 1, v2 ? 1 : period - 60);
      return Object.freeze({ kind: 'pulse', ...point(h, `pulse[${i}]`), period, phase,
        on: 1, ...ownership, ...style });
    }
    if (h.kind === 'saw') {
      keys(h, ['kind', 'from', 'to', 'period', 'phase', 'sectionId'], `saw[${i}]`);
      keys(record(h.from, 'saw.from'), ['x', 'y'], 'saw.from');
      keys(record(h.to, 'saw.to'), ['x', 'y'], 'saw.to');
      return Object.freeze({ kind: 'saw', from: point(h.from, `saw[${i}].from`), to: point(h.to, `saw[${i}].to`), period, phase, ...ownership });
    }
    throw new Error(`Unknown hazard kind in hazards[${i}].`);
  });
  keys(record(raw.spawn, 'spawn'), ['x', 'y'], 'spawn');
  keys(record(raw.goal, 'goal'), ['x', 'y'], 'goal');
  const spawn = point(raw.spawn, 'spawn', true), goal = point(raw.goal, 'goal', true);
  if (spawn.x === goal.x && spawn.y === goal.y) throw new Error('spawn and goal must be different tiles.');
  const checkpoints = list(raw.checkpoints, 'checkpoints', limits.checkpoints).map((value, i): Checkpoint => {
    const label = `checkpoint[${i}]`, position = point(value, label, true), { radius } = record(value, label);
    keys(record(value, label), ['id', 'x', 'y', 'radius'], label);
    if (v2 && radius === undefined) throw new Error(`${label}.radius is required for version 2.`);
    if (radius === undefined) return position;
    if (typeof radius !== 'number' || !Number.isFinite(radius) || radius <= 0 || radius > RULES.maxCheckpointRadius)
      throw new Error(`${label}.radius must be a number greater than 0 and at most ${RULES.maxCheckpointRadius}.`);
    return Object.freeze({ ...position, radius });
  });
  const common = {
    id, name: text(raw.name, 'name', 60), description: text(raw.description, 'description', 240),
    tiles: Object.freeze(tiles), spawn, goal,
    checkpoints: Object.freeze(checkpoints),
    hazards: Object.freeze(hazards),
    resetPatternOnRetry: raw.resetPatternOnRetry === true,
  };
  return v2 ? parseWorldMetadata(raw, common) : Object.freeze({ version: 1, ...common });
}

export function importLevel(source: string): Level {
  if (source.length > V2_LIMITS.importBytes || new TextEncoder().encode(source).length > V2_LIMITS.importBytes)
    throw new Error('World JSON exceeds the 1 MB limit.');
  let raw: unknown;
  try { raw = JSON.parse(source); }
  catch (error) {
    if (source.length > V1_LIMITS.importCharacters) throw new Error('Level JSON exceeds the 100 KB limit.');
    throw error;
  }
  if (record(raw, 'Level').version !== 2 && source.length > V1_LIMITS.importCharacters)
    throw new Error('Level JSON exceeds the 100 KB limit.');
  return parseLevel(raw);
}

export function center(point: Point): Point {
  return { x: point.x + 0.5, y: point.y + 0.5 };
}
