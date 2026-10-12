import { parseLevel, type Point, type Pulse, type World } from '../core/level.ts';
import { TERRAIN } from './terrain.ts';

type Rect = readonly [left: number, top: number, right: number, bottom: number];
type Family = Readonly<{
  id: string; name: string; question: string; width: number; height: number;
  floor: readonly Rect[]; field: readonly Rect[]; spawn: Point; goal: Point;
  hazards: readonly Pulse[];
}>;

function pulses(rect: Rect, period: number, flash: (x: number, y: number) => number): Pulse[] {
  const result: Pulse[] = [];
  for (let y = rect[1]; y <= rect[3]; y++) for (let x = rect[0]; x <= rect[2]; x++)
    result.push({ kind: 'pulse', x, y, period, on: 1, phase: (period - flash(x, y) % period) % period, sectionId: 'trial' });
  return result;
}

const families: readonly Family[] = [
  {
    id: 'travelling-wave', name: 'Travelling wave',
    question: 'Can you follow the wake without being caught by the next column?',
    width: 17, height: 9, floor: [[1, 3, 15, 5]], field: [[3, 3, 12, 5]],
    spawn: { x: 1, y: 4 }, goal: { x: 15, y: 4 },
    hazards: pulses([3, 3, 12, 5], 480, x => 110 + (x - 3) * 28),
  },
  {
    id: 'alternating-bands', name: 'Alternating bands',
    question: 'Can you transfer between alternating bands without relying on a brake?',
    width: 17, height: 9, floor: [[1, 3, 15, 5]], field: [[3, 3, 12, 5]],
    spawn: { x: 1, y: 4 }, goal: { x: 15, y: 4 },
    hazards: pulses([3, 3, 12, 5], 360, x => Math.floor((x - 3) / 2) % 2 ? 280 : 100),
  },
  {
    id: 'side-refuges', name: 'Side refuges',
    question: 'Can you leave the pulsing spine, use a side refuge, and rejoin with control?',
    width: 14, height: 17, floor: [[6, 1, 7, 15], [4, 4, 5, 6], [8, 9, 9, 11]],
    field: [[6, 3, 7, 13], [4, 4, 5, 6], [8, 9, 9, 11]],
    spawn: { x: 6, y: 1 }, goal: { x: 6, y: 15 },
    hazards: pulses([6, 3, 7, 13], 180, () => 120),
  },
  {
    id: 'checker-grid', name: 'Checker grid',
    question: 'Do diagonal routes or short colour changes feel readable on this surface?',
    width: 13, height: 10, floor: [[1, 6, 2, 7], [3, 2, 8, 7], [9, 2, 11, 7]],
    field: [[3, 2, 8, 7]],
    spawn: { x: 1, y: 6 }, goal: { x: 11, y: 2 },
    hazards: pulses([3, 2, 8, 7], 240, (x, y) => (x + y) % 2 ? 200 : 80),
  },
  {
    id: 'inward-rings', name: 'Inward rings',
    question: 'Can you read the shrinking pattern and choose when to cross its center?',
    width: 14, height: 11, floor: [[1, 4, 2, 6], [3, 2, 9, 8], [10, 4, 12, 6]],
    field: [[3, 2, 9, 8]],
    spawn: { x: 1, y: 5 }, goal: { x: 12, y: 5 },
    hazards: pulses([3, 2, 9, 8], 480, (x, y) => 270 - Math.max(Math.abs(x - 6), Math.abs(y - 5)) * 60),
  },
  {
    id: 'wall-slalom', name: 'Wall slalom',
    question: 'Do two wall-guided turns help you aim, or fight your momentum?',
    width: 18, height: 13, floor: [[1, 2, 8, 4], [6, 2, 8, 10], [6, 8, 16, 10]],
    field: [[3, 2, 8, 4], [6, 5, 8, 7], [6, 8, 13, 10]],
    spawn: { x: 1, y: 3 }, goal: { x: 16, y: 9 },
    hazards: [...pulses([4, 2, 4, 4], 300, () => 100),
      ...pulses([6, 6, 8, 6], 300, () => 200), ...pulses([11, 8, 11, 10], 300, () => 50)],
  },
];

export const BENCHMARK_FAMILIES = Object.freeze(families.map(({ id, name, question }) => Object.freeze({ id, name, question })));
export const BENCHMARK_SURFACES = Object.freeze([
  { id: 'normal', tile: '.' as const }, { id: 'soft', tile: '~' as const },
  { id: 'hard', tile: '=' as const }, { id: 'mud', tile: ':' as const },
].map(surface => Object.freeze({ ...surface, name: TERRAIN[surface.tile].name })));

export type Benchmark = Readonly<{
  familyId: string; surfaceId: string; question: string; level: World;
}>;

export const BENCHMARKS: readonly Benchmark[] = Object.freeze(families.flatMap(family => BENCHMARK_SURFACES.map(surface => {
  const tiles = Array.from({ length: family.height }, () => Array<string>(family.width).fill('#'));
  for (const [left, top, right, bottom] of family.floor)
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) tiles[y][x] = '.';
  for (const [left, top, right, bottom] of family.field)
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) tiles[y][x] = surface.tile;
  const bounds = { x: 1, y: 1, width: family.width - 2, height: family.height - 2 };
  const level = parseLevel({
    version: 2, revision: 1, id: `bench-${family.id}-${surface.id}`, name: `${family.name} / ${surface.name}`,
    description: `${family.question} Fixed layout and timing across all four surfaces; only the marked puzzle floor changes. Original benchmark, not a StarCraft map port.`,
    puzzleMode: 'checkpoint', resetPatternOnRetry: false, tiles: tiles.map(row => row.join('')),
    spawn: family.spawn, goal: family.goal, checkpoints: [], hazards: family.hazards,
    sections: [{
      id: 'trial', name: family.name, bounds, entry: family.spawn,
      observation: { ...family.spawn, width: 1, height: 1 },
      completion: { kind: 'goal' }, camera: { mode: 'fixed', frame: bounds },
    }],
  });
  if (level.version !== 2) throw new Error('Benchmark must be a world.');
  return Object.freeze({ familyId: family.id, surfaceId: surface.id, question: family.question, level });
})));
