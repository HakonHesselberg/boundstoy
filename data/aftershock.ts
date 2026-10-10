import { parseLevel, type Level, type Pulse } from '../core/level.ts';

type Rect = readonly [number, number, number, number];
function board(width: number, height: number, ground: readonly Rect[]) {
  const rows = Array.from({ length: height }, () => Array<string>(width).fill('#'));
  for (const [left, top, right, bottom] of ground)
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) rows[y][x] = '.';
  return rows.map(row => row.join(''));
}
// A flash is one absolute tick modulo period, never a sustained damage window.
function pulse(x: number, y: number, period: number, flash: number): Pulse {
  return { kind: 'pulse', x, y, period, on: 1, phase: (period - flash % period) % period };
}

const borrowedPulses: Pulse[] = [];
for (let x = 2; x <= 4; x++) for (let y = 2; y <= 3; y++)
  borrowedPulses.push(pulse(x, y, 360, 1 + (x - 2) * 35));
for (let x = 5; x <= 6; x++) {
  borrowedPulses.push(pulse(x, 2, 360, 190));
  for (let y = 3; y <= 6; y++) borrowedPulses.push(pulse(x, y, 360, 110 + (y - 3) * 35));
}
for (let x = 7; x <= 9; x++) for (let y = 5; y <= 6; y++)
  borrowedPulses.push(pulse(x, y, 360, 285 + (x - 7) * 35));

const borrowedGround = {
  version: 1, id: 'aftershock-borrowed-ground-v2', name: 'Borrowed Ground',
  description: 'Follow individual flashes to the elbow. Transfer off its expiring floor, or retreat onto spent ground and return. Cross the broad landing to the exit.',
  resetPatternOnRetry: true,
  tiles: board(17, 9, [[1, 2, 6, 3], [5, 2, 6, 6], [5, 5, 12, 6], [13, 3, 15, 7]]),
  spawn: { x: 1, y: 2 }, goal: { x: 14, y: 3 },
  checkpoints: [],
  hazards: borrowedPulses,
};

const crossPulses: Pulse[] = [];
for (let x = 2; x <= 10; x++) for (let y = 2; y <= 5; y++)
  crossPulses.push(pulse(x, y, 300, 80 + (x - 2) * 30 + (5 - y) * 70));
const crosscurrent = {
  version: 1, id: 'aftershock-crosscurrent-v1', name: 'Crosscurrent',
  description: 'A wave traverses four lanes. Move across its wake instead of waiting in its path; choose where to change lanes before reaching the safe landing.',
  resetPatternOnRetry: true,
  tiles: board(17, 8, [[1, 2, 11, 5], [12, 2, 15, 4]]),
  spawn: { x: 1, y: 5 }, goal: { x: 15, y: 4 },
  checkpoints: [],
  hazards: crossPulses,
};

const checkerPulses: Pulse[] = [];
for (let y = 2; y <= 7; y++) for (let x = 2; x <= 9; x++)
  checkerPulses.push(pulse(x, y, 360, (x + y) % 2 === 0 ? 154 : 334));
const checkerboard = {
  version: 1, id: 'aftershock-checkerboard-v1', name: 'Checkerboard',
  description: 'Light tiles flash together, then dark tiles. Choose the other colour before each flash; diagonals keep your colour, straight steps change it.',
  resetPatternOnRetry: true,
  tiles: board(16, 10, [[1, 7, 1, 7], [2, 2, 9, 7], [10, 2, 11, 7], [12, 2, 12, 4], [13, 1, 14, 4]]),
  spawn: { x: 1, y: 7 }, goal: { x: 14, y: 1 },
  checkpoints: [],
  hazards: checkerPulses,
};

export const AFTERSHOCK_LEVELS: readonly Level[] = Object.freeze([borrowedGround, crosscurrent, checkerboard].map(parseLevel));
function lessons(title: string, hint: string) {
  return Object.freeze([
    Object.freeze({ title, hint }),
  ]);
}
export const AFTERSHOCK_LESSONS: Readonly<Record<string, readonly Readonly<{ title: string; hint: string }>[]>> = Object.freeze({
  'aftershock-borrowed-ground-v2': lessons('Borrow, then transfer',
    'The elbow expires. Turn onto the spent tiles, or back onto the approach while it flashes and return. Cross the broad landing to reach the exit.'),
  'aftershock-crosscurrent-v1': lessons('Use the width',
    'The flashes travel along and across four lanes. Change lanes into the wake; standing in the same lane lets the next wave catch you.'),
  'aftershock-checkerboard-v1': lessons('Light, then dark',
    'Light tiles flash first, dark tiles next. Stand on dark for the light flash, then step onto light for the dark flash. Diagonal steps keep your colour.'),
});
// Clean technique targets, not claims of global optimality.
export const AFTERSHOCK_TARGETS: Readonly<Record<string, number>> = Object.freeze({
  'aftershock-borrowed-ground-v2': 690,
  'aftershock-crosscurrent-v1': 590,
  'aftershock-checkerboard-v1': 540,
});
