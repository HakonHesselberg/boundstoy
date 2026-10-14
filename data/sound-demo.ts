import { parseLevel, type Pulse } from '../core/level.ts';
import type { ExplosionPuzzle } from './explosion-puzzles.ts';

const rows = Array.from({ length: 9 }, () => Array<string>(25).fill('#'));
for (let y = 3; y <= 5; y++) for (let x = 1; x <= 23; x++)
  rows[y][x] = x >= 3 && x <= 4 ? ':' : x >= 6 && x <= 8 ? '~' : x >= 10 && x <= 12 ? '=' : '.';
const hazards: Pulse[] = [];
for (let y = 3; y <= 5; y++) for (let x = 18; x <= 20; x++)
  hazards.push({ kind: 'pulse', x, y, period: 360, phase: 360 - (100 + (x - 18) * 40),
    on: 1, style: x % 2 ? 'plasma' : 'ember', sectionId: 'rhythm' });
const level = parseLevel({
  version: 2, id: 'sound-garden', revision: 1, name: 'Sound garden',
  description: 'Listen to four surfaces, brush a wall, then cross a short wave to the exit. Sound is optional; every danger remains visible.',
  puzzleMode: 'checkpoint', resetPatternOnRetry: false,
  tiles: rows.map(row => row.join('')), spawn: { x: 1, y: 4 }, goal: { x: 23, y: 4 },
  checkpoints: [{ id: 'listening-landing', x: 14, y: 4, radius: 1.4 }], hazards,
  sections: [
    { id: 'materials', name: 'Feel the materials', bounds: { x: 1, y: 1, width: 14, height: 7 },
      entry: { x: 1, y: 4 }, observation: { x: 1, y: 4, width: 1, height: 1 },
      completion: { kind: 'checkpoint', checkpointId: 'listening-landing' },
      camera: { mode: 'fixed', frame: { x: 1, y: 1, width: 14, height: 7 } } },
    { id: 'rhythm', name: 'Hear the rhythm', bounds: { x: 15, y: 1, width: 9, height: 7 },
      entry: { x: 15, y: 4 }, observation: { x: 15, y: 4, width: 2, height: 1 },
      completion: { kind: 'goal' }, camera: { mode: 'fixed', frame: { x: 14, y: 1, width: 10, height: 7 } } },
  ],
});
if (level.version !== 2) throw new Error('Sound garden must be a world.');
export const SOUND_DEMO: ExplosionPuzzle = Object.freeze({
  level,
  question: 'A little listening walk: four surfaces, one safe landing, then a short explosion wave.',
  hints: Object.freeze([
    'Move right: stone contacts, granular mud, then soft and hard ice. Choose among twelve ice sounds below, or enter the ice room.',
    'A rising fuse follows the visible warning, then a pressure crack. Cross after the wave; the exit opens with a warm release.',
  ]),
});
export const SOUND_DEMO_REPLAY = Object.freeze([Object.freeze({ ticks: 769, x: 1, y: 0 })]);
export const SOUND_DEMO_RECOVERY = Object.freeze([
  Object.freeze({ ticks: 48, x: 0, y: 0 }), Object.freeze({ ticks: 286, x: 1, y: 0 }),
]);

const iceLevel = parseLevel({
  version: 2, id: 'sound-ice-room', revision: 1, name: 'Ice sound garden',
  description: 'Compare twelve ice sounds while gliding. Soft ice above, hard ice below; a normal-ground path leads to the exit.',
  puzzleMode: 'checkpoint', resetPatternOnRetry: false,
  tiles: Array.from({ length: 13 }, (_, y) => y === 0 || y === 12 ? '#'.repeat(25)
    : `#${Array.from({ length: 23 }, (_, i) => i === 0 || y === 6 ? '.' : y < 6 ? '~' : '=').join('')}#`),
  spawn: { x: 1, y: 3 }, goal: { x: 23, y: 6 }, checkpoints: [],
  hazards: [2, 9].flatMap(y => [18, 19, 20].map((x, i) => ({
    kind: 'pulse', x, y, period: 360, phase: 360 - (180 + i * 40),
    on: 1, style: 'plasma', sectionId: 'ice-room',
  }))),
  sections: [{
    id: 'ice-room', name: 'Ice sound garden', bounds: { x: 1, y: 1, width: 23, height: 11 },
    entry: { x: 1, y: 3 }, observation: { x: 1, y: 3, width: 1, height: 1 },
    completion: { kind: 'goal' }, camera: { mode: 'fixed', frame: { x: 1, y: 1, width: 23, height: 11 } },
  }],
});
if (iceLevel.version !== 2) throw new Error('Ice room must be a world.');
export const SOUND_ICE_DEMO: ExplosionPuzzle = Object.freeze({
  level: iceLevel,
  question: 'Which of the twelve ice sounds fits your glide? Compare while moving, not just as short samples.',
  hints: Object.freeze([
    'Soft ice above, hard ice below. Release the keys and keep gliding; turn or touch a wall. Choose sounds below. The middle path is safe.',
  ]),
});
export const SOUND_DEMOS = Object.freeze([SOUND_DEMO, SOUND_ICE_DEMO]);
export const isSoundDemo = (puzzle: ExplosionPuzzle | null) => puzzle !== null && SOUND_DEMOS.includes(puzzle);
export const SOUND_ICE_REPLAY = Object.freeze([
  Object.freeze({ ticks: 100, x: 0, y: 1 }), Object.freeze({ ticks: 760, x: 1, y: 0 }),
]);
