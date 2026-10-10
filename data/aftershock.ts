import { parseLevel, type Level, type Pulse } from '../core/level.ts';

type Rect = readonly [number, number, number, number];

// Inclusive rectangles keep the playable footprint and each full-width blast
// field auditable together. Nothing depends on a renderer or a replay at load time.
function board(width: number, height: number, ground: readonly Rect[], voids: readonly Rect[] = []) {
  const rows = Array.from({ length: height }, () => Array<string>(width).fill('#'));
  for (const [rects, tile] of [[voids, ' '], [ground, '.']] as const)
    for (const [left, top, right, bottom] of rects)
      for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) rows[y][x] = tile;
  return rows.map(row => row.join(''));
}

// `flash` is an absolute tick on the repeating schedule, not a damage duration.
function field(rect: Rect, period: number, flash: number): Pulse[] {
  const result: Pulse[] = [], phase = (period - flash % period) % period;
  for (let y = rect[1]; y <= rect[3]; y++) for (let x = rect[0]; x <= rect[2]; x++)
    result.push({ kind: 'pulse', x, y, period, on: 1, phase });
  return result;
}

const slipstream = {
  version: 1, id: 'aftershock-slipstream-v1', name: 'Slipstream',
  description: 'Follow the flash around four bends. Chase the wave, then break cadence at three seams; the next flash will not wait for your turn.',
  resetPatternOnRetry: true,
  tiles: board(18, 14, [[2, 2, 14, 2], [14, 2, 14, 6], [4, 6, 14, 6], [4, 6, 4, 10], [4, 10, 14, 10]]),
  spawn: { x: 2, y: 2 }, goal: { x: 14, y: 10 }, checkpoints: [],
  hazards: [
    ...field([4, 2, 6, 2], 132, 36),
    ...field([8, 2, 10, 2], 132, 197),
    ...field([14, 3, 14, 5], 132, 420),
    ...field([10, 6, 12, 6], 132, 597),
    ...field([6, 6, 8, 6], 132, 766),
    ...field([4, 7, 4, 9], 132, 933),
    ...field([6, 10, 8, 10], 132, 1100),
    ...field([10, 10, 12, 10], 132, 1243),
  ],
};

const borrowedGround = {
  version: 1, id: 'aftershock-borrowed-ground-v1', name: 'Borrowed Ground',
  description: 'Every interior landing has an expiry. Transfer before the next flash, or borrow the field behind you and return.',
  resetPatternOnRetry: true,
  tiles: board(18, 21, [[2, 2, 6, 2], [6, 2, 6, 9], [6, 9, 10, 9], [10, 2, 10, 9],
    [10, 2, 14, 2], [14, 2, 14, 13], [10, 13, 14, 13], [10, 13, 10, 17], [10, 17, 14, 17]]),
  spawn: { x: 2, y: 2 }, goal: { x: 14, y: 17 }, checkpoints: [],
  hazards: [
    ...field([3, 2, 5, 2], 240, 0),
    ...field([6, 2, 6, 2], 240, 175),
    // Six-tile transfers expose the player for ~209 ticks of a 240-tick cycle.
    // Unlike a short gate, the next cycle cannot be crossed early after retreating.
    ...field([6, 3, 6, 8], 240, 155),
    ...field([6, 9, 6, 9], 240, 415),
    ...field([7, 9, 9, 9], 240, 385),
    ...field([10, 9, 10, 9], 240, 565),
    ...field([10, 3, 10, 8], 240, 530),
    ...field([10, 2, 10, 2], 240, 805),
    ...field([11, 2, 13, 2], 240, 765),
    ...field([14, 2, 14, 2], 240, 950),
    ...field([14, 3, 14, 8], 240, 900),
    ...field([14, 9, 14, 9], 240, 1190),
    ...field([14, 10, 14, 12], 240, 1150),
    ...field([14, 13, 14, 13], 240, 1330),
    ...field([11, 13, 13, 13], 240, 1285),
    ...field([10, 13, 10, 13], 240, 1460),
    ...field([10, 14, 10, 16], 240, 1420),
    ...field([10, 17, 10, 17], 240, 1600),
    ...field([11, 17, 13, 17], 240, 1552),
  ],
};

// A three-cell staircase ribbon: generous lateral room, but no invisible walls
// over the void. The two diagonal blast fields cover ALL cells of their columns.
const ribbon: Rect[] = [];
for (let x = 6; x <= 16; x++) ribbon.push([x, Math.max(10, 25 - x), x, Math.min(20, 27 - x)]);
const cut = {
  version: 1, id: 'aftershock-the-cut-v1', name: 'The Cut',
  description: 'The outside rail buys room to react. The diagonal cut saves real distance, but commits you to two narrow flash windows and an exposed turn.',
  resetPatternOnRetry: true,
  tiles: board(31, 24, [[2, 20, 28, 20], [28, 1, 28, 20], [26, 1, 28, 1], [26, 1, 26, 2],
    ...ribbon, [16, 10, 20, 10], [20, 2, 20, 10], [20, 2, 26, 2]], [[5, 3, 25, 19]]),
  spawn: { x: 2, y: 20 }, goal: { x: 26, y: 2 }, checkpoints: [],
  hazards: [
    ...field([12, 20, 14, 20], 180, 300),
    ...field([28, 8, 28, 10], 180, 1168),
    ...ribbon.filter(r => r[0] >= 8 && r[0] <= 10).flatMap(r => field(r, 180, 190)),
    ...ribbon.filter(r => r[0] >= 12 && r[0] <= 14).flatMap(r => field(r, 180, 395)),
    ...field([20, 5, 20, 7], 132, 848),
  ],
};

export const AFTERSHOCK_LEVELS: readonly Level[] = Object.freeze([slipstream, borrowedGround, cut].map(parseLevel));
export const AFTERSHOCK_LESSONS: Readonly<Record<string, readonly Readonly<{ title: string; hint: string }>[]>> = Object.freeze({
  'aftershock-slipstream-v1': Object.freeze([Object.freeze({
    title: 'Chase, turn, retime',
    hint: 'Three tiles flash together. Follow their aftermath, but read the next field before each turn. The second, fifth and last crossings need a different cadence.',
  })]),
  'aftershock-borrowed-ground-v1': Object.freeze([Object.freeze({
    title: 'Leave before you see it',
    hint: 'A landing is borrowed, never safe. Begin a transfer before the next field flashes. Miss that moment? Retreat onto the spent field, then return before it fires again.',
  })]),
  'aftershock-the-cut-v1': Object.freeze([Object.freeze({
    title: 'Distance has a price',
    hint: 'Stay east for the outside rail. Turn northeast at the first fork for the shorter cut; cross one diagonal field, retime on the seam, then read the northbound exit.',
  })]),
});
// Authored clean technique targets, not claims of globally optimal paths/times.
export const AFTERSHOCK_TARGETS: Readonly<Record<string, number>> = Object.freeze({
  'aftershock-slipstream-v1': 1500,
  'aftershock-borrowed-ground-v1': 1780,
  'aftershock-the-cut-v1': 1400,
});
