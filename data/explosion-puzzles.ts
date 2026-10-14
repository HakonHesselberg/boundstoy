import { parseLevel, type Point, type Pulse, type World } from '../core/level.ts';

type Rect = readonly [left: number, top: number, right: number, bottom: number];
export type ExplosionPuzzle = Readonly<{ question: string; hints: readonly string[]; level: World }>;
export type PuzzleLayout = Readonly<{
  id: string; name: string; hint: string; width: number; height: number;
  floor: readonly Rect[]; spawn: Point; goal: Point; hazards: readonly Pulse[];
  checkpoints?: World['checkpoints']; sections?: World['sections'];
  hints?: readonly string[]; revision?: number;
}>;

function pulses(rect: Rect, period: number, flash: (x: number, y: number) => number, sectionId = 'trial'): Pulse[] {
  const result: Pulse[] = [];
  for (let y = rect[1]; y <= rect[3]; y++) for (let x = rect[0]; x <= rect[2]; x++)
    result.push({ kind: 'pulse', x, y, on: 1, period, phase: (period - flash(x, y) % period) % period, sectionId });
  return result;
}

const layouts: readonly PuzzleLayout[] = [
  {
    id: 'wave', name: 'Follow the wave',
    hint: 'Let the first column burst, then follow the wave across.',
    width: 17, height: 9, floor: [[1, 3, 15, 5]], spawn: { x: 1, y: 4 }, goal: { x: 15, y: 4 },
    hazards: pulses([3, 3, 12, 5], 480, x => 110 + (x - 3) * 28),
  },
  {
    id: 'bands', name: 'Alternating bands',
    hint: 'Cross into the band that just burst. Pause there while the next band clears.',
    width: 17, height: 9, floor: [[1, 3, 15, 5]], spawn: { x: 1, y: 4 }, goal: { x: 15, y: 4 },
    hazards: pulses([3, 3, 12, 5], 360, x => Math.floor((x - 3) / 2) % 2 ? 280 : 100),
  },
  {
    id: 'refuges', name: 'Changing refuges',
    hint: 'Leave the spine for a pocket. Return after the spine bursts, before your pocket does.',
    width: 15, height: 17,
    floor: [[6, 1, 8, 15], [4, 4, 5, 6], [9, 9, 10, 11]],
    spawn: { x: 7, y: 1 }, goal: { x: 7, y: 15 },
    hazards: [...pulses([6, 3, 8, 13], 360, () => 210),
      ...pulses([4, 4, 5, 6], 360, () => 30), ...pulses([9, 9, 10, 11], 360, () => 30)],
  },
  {
    id: 'checker', name: 'Checker crossing',
    hint: 'Move between alternating groups. Work across and upward toward the exit.',
    width: 13, height: 11,
    floor: [[1, 7, 2, 8], [3, 2, 8, 8], [9, 2, 11, 3]],
    spawn: { x: 1, y: 8 }, goal: { x: 11, y: 2 },
    hazards: pulses([3, 2, 8, 8], 360, (x, y) => (Math.floor((x - 3) / 2) + Math.floor((y - 2) / 2)) % 2 ? 270 : 90),
  },
  {
    id: 'crossing', name: 'Crossing waves',
    hint: 'Follow the columns right, then turn up with the travelling rows.',
    width: 16, height: 14,
    floor: [[1, 9, 13, 11], [9, 1, 13, 11]],
    spawn: { x: 1, y: 10 }, goal: { x: 11, y: 1 },
    hazards: [...pulses([3, 9, 8, 11], 480, x => 90 + (x - 3) * 28),
      ...pulses([9, 3, 13, 11], 480, (_x, y) => 330 + (11 - y) * 28)],
  },
  {
    id: 'combination', name: 'Wave into checker',
    hint: 'Follow the wave to a safe checkpoint. Then cross the alternating grid.',
    width: 27, height: 11,
    floor: [[1, 3, 15, 5], [16, 2, 21, 7], [22, 2, 24, 3]],
    spawn: { x: 1, y: 4 }, goal: { x: 24, y: 2 },
    hazards: [...pulses([3, 3, 8, 5], 480, x => 110 + (x - 3) * 28, 'wave'),
      ...pulses([16, 2, 21, 7], 480, (x, y) => (Math.floor((x - 16) / 2) + Math.floor((y - 2) / 2)) % 2 ? 340 : 100, 'checker')],
    checkpoints: [{ id: 'landing', x: 12, y: 4, radius: 1.4 }],
    hints: ['Follow the wave to the checkpoint.', 'Cross the alternating grid to the exit.'],
    sections: [
      {
        id: 'wave', name: 'Follow the wave', bounds: { x: 1, y: 1, width: 12, height: 8 },
        entry: { x: 1, y: 4 }, observation: { x: 1, y: 4, width: 1, height: 1 },
        completion: { kind: 'checkpoint', checkpointId: 'landing' },
        camera: { mode: 'fixed', frame: { x: 1, y: 1, width: 12, height: 8 } },
      },
      {
        id: 'checker', name: 'Checker crossing', bounds: { x: 13, y: 1, width: 12, height: 8 },
        entry: { x: 14, y: 4 }, observation: { x: 13, y: 4, width: 2, height: 1 },
        completion: { kind: 'goal' },
        camera: { mode: 'fixed', frame: { x: 12, y: 1, width: 13, height: 8 } },
      },
    ],
  },
];

/** Builds an isolated, normal-ground trial world from a compact layout. */
export function buildExplosionPuzzle(layout: PuzzleLayout, idPrefix = 'puzzle'): ExplosionPuzzle {
  const tiles = Array.from({ length: layout.height }, () => Array<string>(layout.width).fill('#'));
  for (const [left, top, right, bottom] of layout.floor)
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) tiles[y][x] = '.';
  const bounds = { x: 1, y: 1, width: layout.width - 2, height: layout.height - 2 };
  const level = parseLevel({
    version: 2, revision: layout.revision ?? 1, id: `${idPrefix}-${layout.id}`, name: layout.name, description: layout.hint,
    puzzleMode: 'checkpoint', resetPatternOnRetry: false, tiles: tiles.map(row => row.join('')),
    spawn: layout.spawn, goal: layout.goal, checkpoints: layout.checkpoints ?? [], hazards: layout.hazards,
    sections: layout.sections ?? [{
      id: 'trial', name: layout.name, bounds, entry: layout.spawn,
      observation: { ...layout.spawn, width: 1, height: 1 },
      completion: { kind: 'goal' }, camera: { mode: 'fixed', frame: bounds },
    }],
  });
  if (level.version !== 2) throw new Error('Explosion puzzle must be a world.');
  return Object.freeze({ question: layout.hint, hints: Object.freeze(layout.hints ?? [layout.hint]), level });
}

export const EXPLOSION_PUZZLES: readonly ExplosionPuzzle[] = Object.freeze(layouts.map(layout => buildExplosionPuzzle(layout)));
