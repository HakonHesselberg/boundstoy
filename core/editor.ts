import { TERRAIN, RULES, type Tile } from '../data/terrain.ts';
import { isTile, parseLevel, type Level, type Point, type Hazard } from './level.ts';
import { DEFAULT_EXPLOSION_STYLE, type ExplosionStyleId } from '../data/explosion-styles.ts';
import { checkpointPuzzles } from './world.ts';

export type Brush = Tile | 'spawn' | 'goal' | 'checkpoint' | 'pulse' | 'saw' | 'erase';
export const sameTile = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
const startsAt = (h: Hazard, p: Point) => sameTile(h.kind === 'pulse' ? h : h.from, p);

function ownership(level: Level, point: Point, sectionId?: string) {
  if (!checkpointPuzzles(level)) return {};
  if (sectionId !== undefined) {
    if (!level.sections.some(s => s.id === sectionId)) throw new Error('Select an existing owning section.');
    return { sectionId };
  }
  const owners = level.sections.filter(({ bounds: b }) =>
    point.x >= b.x && point.x < b.x + b.width && point.y >= b.y && point.y < b.y + b.height);
  if (owners.length !== 1) throw new Error('Connector placement needs an explicit owning section.');
  return { sectionId: owners[0].id };
}

export function paint(level: Level, point: Point, brush: Exclude<Brush, 'saw'>, sectionId?: string,
  style: ExplosionStyleId = DEFAULT_EXPLOSION_STYLE): Level {
  if (!Number.isInteger(point.x) || !Number.isInteger(point.y) || !level.tiles[point.y]?.[point.x]) {
    throw new Error('Select a tile inside the board.');
  }
  if (level.version === 2 && (brush === 'spawn' || brush === 'goal' || brush === 'checkpoint'
    || brush === 'erase' && level.checkpoints.some(p => sameTile(p, point)))) {
    throw new Error('World start, exit and checkpoints belong to section metadata. Edit them together in validated JSON.');
  }
  const tiles = level.tiles.map(row => [...row]);
  let spawn = level.spawn, goal = level.goal;
  let checkpoints = [...level.checkpoints], hazards = [...level.hazards];
  if (isTile(brush)) {
    tiles[point.y][point.x] = brush;
    if (TERRAIN[brush].solid || TERRAIN[brush].lethal) hazards = hazards.filter(h => !startsAt(h, point));
  } else if (brush === 'erase') {
    hazards = hazards.filter(h => !startsAt(h, point));
    checkpoints = checkpoints.filter(p => !sameTile(p, point));
  } else if (brush === 'pulse') {
    // Repainting a pad restyles it; its authored rhythm and ownership stay.
    const existing = hazards.find(h => h.kind === 'pulse' && startsAt(h, point));
    const { style: _previous, ...base } = existing?.kind === 'pulse' ? existing
      : { kind: 'pulse' as const, ...point, period: 360, on: 1, phase: 0, ...ownership(level, point, sectionId) };
    hazards = [...hazards.filter(h => h !== existing && !startsAt(h, point)), { ...base, style }];
  } else {
    if (brush === 'spawn') spawn = point;
    else if (brush === 'goal') goal = point;
    else checkpoints = [...checkpoints.filter(p => !sameTile(p, point)), { ...point, radius: RULES.checkpointRadius }];
    const tile = tiles[point.y][point.x] as Tile;
    if (TERRAIN[tile].solid || TERRAIN[tile].lethal) tiles[point.y][point.x] = '.';
  }
  return parseLevel({ ...level, tiles: tiles.map(row => row.join('')), spawn, goal, checkpoints, hazards });
}

export function placeSaw(level: Level, from: Point, to: Point, sectionId?: string): Level {
  return parseLevel({ ...level, hazards: [...level.hazards.filter(h => !startsAt(h, from)),
    { kind: 'saw', from, to, period: 360, phase: 0, ...ownership(level, from, sectionId) }] });
}

export function blankLevel(): Level {
  return parseLevel({
    version: 1, id: 'my-course', name: 'Untitled course', description: 'A little experiment in momentum.',
    tiles: Array.from({ length: 17 }, (_, y) => y < 2 || y > 14 ? ' '.repeat(24) : `  ${'.'.repeat(20)}  `),
    spawn: { x: 3, y: 13 }, goal: { x: 20, y: 3 }, checkpoints: [], hazards: [],
  });
}
