import { TERRAIN, type Tile } from '../data/terrain.ts';
import { isTile, parseLevel, type Level, type Point, type Hazard } from './level.ts';

export type Brush = Tile | 'spawn' | 'goal' | 'checkpoint' | 'pulse' | 'saw' | 'erase';
export const sameTile = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
const startsAt = (h: Hazard, p: Point) => sameTile(h.kind === 'pulse' ? h : h.from, p);

export function paint(level: Level, point: Point, brush: Exclude<Brush, 'saw'>): Level {
  if (!Number.isInteger(point.x) || !Number.isInteger(point.y) || !level.tiles[point.y]?.[point.x]) {
    throw new Error('Select a tile inside the board.');
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
    hazards = [...hazards.filter(h => !startsAt(h, point)),
      { kind: 'pulse', ...point, period: 360, on: 90, phase: 0 }];
  } else {
    if (brush === 'spawn') spawn = point;
    else if (brush === 'goal') goal = point;
    else checkpoints = [...checkpoints.filter(p => !sameTile(p, point)), point];
    const tile = tiles[point.y][point.x] as Tile;
    if (TERRAIN[tile].solid || TERRAIN[tile].lethal) tiles[point.y][point.x] = '.';
  }
  return parseLevel({ ...level, tiles: tiles.map(row => row.join('')), spawn, goal, checkpoints, hazards });
}

export function placeSaw(level: Level, from: Point, to: Point): Level {
  return parseLevel({ ...level, hazards: [...level.hazards.filter(h => !startsAt(h, from)),
    { kind: 'saw', from, to, period: 360, phase: 0 }] });
}

export function blankLevel(): Level {
  return parseLevel({
    version: 1, id: 'my-course', name: 'Untitled course', description: 'A little experiment in momentum.',
    tiles: Array.from({ length: 17 }, (_, y) => y < 2 || y > 14 ? ' '.repeat(24) : `  ${'.'.repeat(20)}  `),
    spawn: { x: 3, y: 13 }, goal: { x: 20, y: 3 }, checkpoints: [], hazards: [],
  });
}
