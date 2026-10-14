import type { Pulse } from '../core/level.ts';
import type { ExplosionStyleId } from './explosion-styles.ts';
import { buildExplosionPuzzle, type ExplosionPuzzle, type PuzzleLayout } from './explosion-puzzles.ts';

/**
 * Pulse Line: an explosion level designed on paper with the user, one puzzle
 * at a time, for landscape play. The puzzles sit in one strip, ordered by
 * difficulty and joined by checkpoints. Normal ground and pulses only.
 *
 * Every puzzle is a local grid of columns over rows 1-5; joints are four tiles
 * wide (buffer, checkpoint, next entry, buffer) because a checkpoint landing or
 * section entry may not touch any pulse tile.
 */
const HEIGHT = 7, TOP = 2, MID = 3, BOTTOM = 4, JOINT = 4;
/** Shift so no pad sits in its burst frame when a puzzle is revealed (local tick 0). */
const REVEAL_OFFSET = 5;

type Rect = PuzzleLayout['floor'][number];
type Burst = Readonly<{ at: number; style?: ExplosionStyleId }>;
type Design = Readonly<{
  name: string; hint: string; columns: number; period: number;
  /** Walkable tiles of the puzzle by local column and map row. */
  floor: (column: number, y: number) => boolean;
  /** Tick of the cycle at which a floor tile bursts, or null for a safe tile. */
  burst: (column: number, y: number) => Burst | null;
}>;
const rows = (...ys: number[]) => (_c: number, y: number) => ys.includes(y);
const ALL_ROWS = [1, 2, 3, 4, 5] as const;

// Follow: columns burst left to right, 30 ticks apart, one front per 480-tick cycle.
const follow: Design = { name: 'Follow', columns: 10, period: 480, floor: rows(TOP, MID, BOTTOM),
  hint: 'Wait for the first column to burst, then follow right behind the wave.',
  burst: c => ({ at: 30 * c }) };
// Bands: 2-wide bands; A bursts at 0, B at 90, every 180 ticks.
const band = (c: number) => Math.floor(c / 2) % 2;
const bands: Design = { name: 'Bands', columns: 10, period: 180, floor: rows(TOP, MID, BOTTOM),
  hint: 'Orange and blue bands take turns. Hop into the band that just burst.',
  burst: c => band(c) ? { at: 90, style: 'plasma' } : { at: 0 } };
// Checker: the same bands with the middle row shifted by one band.
const checker: Design = { name: 'Checker', columns: 10, period: 180, floor: rows(TOP, MID, BOTTOM),
  hint: 'The middle row is shifted. Hop forward or step up and down into whichever group just burst.',
  burst: (c, y) => (band(c) + (y === MID ? 1 : 0)) % 2 ? { at: 90, style: 'plasma' } : { at: 0 } };
// Switchback: the whole top row, then the whole bottom row, back to back (20% slower than the 120 minimum).
const switchback: Design = { name: 'Switchback', columns: 10, period: 144, floor: rows(TOP, MID),
  hint: 'The whole top row, then the whole bottom row. Keep switching rows while you walk right.',
  burst: (_c, y) => y === TOP ? { at: 0, style: 'toxic' } : { at: 72, style: 'psionic' } };
// Rain: in every column a drop falls one row per 20-tick step over an 8-step cycle; neighbouring
// columns start three steps apart, so drops form slanted streaks.
const rain: Design = { name: 'Rain', columns: 10, period: 160, floor: rows(...ALL_ROWS),
  hint: 'Drops fall down every column. Step in right behind a drop and keep out of the next one.',
  burst: (c, y) => ({ at: ((3 * c + y - 1) % 8) * 20 }) };
// Duck: continuous right-to-left wave, 36 ticks per column; safe alcoves above c3 and below c7.
const DUCK_ALCOVES = [[2, TOP - 1], [6, BOTTOM + 1]] as const;
const isAlcove = (c: number, y: number) => DUCK_ALCOVES.some(([ac, ay]) => ac === c && ay === y);
const duck: Design = { name: 'Duck', columns: 10, period: 360,
  hint: 'The wave comes toward you. Duck into the alcove above, then the one below, as each wave passes.',
  floor: (c, y) => (y >= TOP && y <= BOTTOM) || isAlcove(c, y),
  burst: (c, y) => isAlcove(c, y) ? null : { at: 36 * (9 - c) } };
// Two waves: right-to-left waves in both rows, the bottom one five columns behind.
const twoWaves: Design = { name: 'Two waves', columns: 10, period: 300, floor: rows(TOP, MID),
  hint: 'A wave in each row, half a cycle apart. Switch rows just before the wave in yours reaches you.',
  burst: (c, y) => y === TOP ? { at: 30 * (9 - c) } : { at: 30 * ((14 - c) % 10), style: 'plasma' } };
// Roundabouts: four single-tile wall islands, each circled by one burst (20 ticks per tile, faster
// than walking), turning clockwise and anticlockwise in turn. Follow each burst over or under its
// island and leave before it laps you; head-on sides leave only a ~10-tick step-through window.
// Following loses (walk - burst) ticks of slack per tile, so faster bursts or longer rings run out
// of lap time. Offsets hand a follower from ring to ring (simulated: ±16 ticks intended, ±5 head-on).
const RING_STEP = 20, RING_TILES = 8, RING_OFFSETS = [0, 105, 130, 75] as const;
/** Clockwise position (0 = top-left corner) of a tile in its 3x3 ring, or -1 for an island. */
function ringIndex(column: number, y: number) {
  const c = column % 3;
  if (y === TOP) return c;
  if (y === BOTTOM) return 6 - c;
  return c === 0 ? 7 : c === 2 ? 3 : -1;
}
const roundabouts: Design = { name: 'Roundabouts', columns: 3 * RING_OFFSETS.length, period: RING_STEP * RING_TILES,
  hint: 'A burst circles each island. Pass on the side where it travels your way: step in behind it and leave before it comes round again.',
  floor: (c, y) => y >= TOP && y <= BOTTOM && ringIndex(c, y) >= 0,
  burst: (c, y) => {
    const ring = Math.floor(c / 3), clockwise = ring % 2 === 0, i = ringIndex(c, y);
    return { at: (clockwise ? i : (RING_TILES - i) % RING_TILES) * RING_STEP + RING_OFFSETS[ring], ...(clockwise ? {} : { style: 'plasma' as const }) };
  } };
// Snake (conveyor): walls leave one gap per wall column (c3 bottom, c6 top, c9 bottom; 1-based), so the
// route winds down, up, down, up. Each column group sweeps row by row (24 ticks per row, faster than
// walking) in the direction you travel; you wait in each gap for the next group's sweep.
const SNAKE_GROUPS = [
  { columns: [0, 1, 2], down: true, start: 0 },
  { columns: [3, 4, 5], down: false, start: 180, style: 'plasma' },
  { columns: [6, 7, 8], down: true, start: 180 },
  { columns: [9], down: false, start: 150, style: 'plasma' },
] as const;
const snakeWall = (c: number, y: number) => (c === 2 && y < 5) || (c === 5 && y > 1) || (c === 8 && y < 5);
const snake: Design = { name: 'Snake', columns: 10, period: 300,
  hint: 'Each column sweeps the way you travel. Ride a sweep, then wait in the gap until the next column starts.',
  floor: (c, y) => !snakeWall(c, y),
  burst: (c, y) => {
    const group = SNAKE_GROUPS.find(g => (g.columns as readonly number[]).includes(c))!;
    return { at: group.start + 24 * (group.down ? y - 1 : 5 - y), ...('style' in group ? { style: group.style } : {}) };
  } };
// Slot wave: a fast (12 ticks per column) continuous wave toward you; in each column one blue slot
// tile, zig-zagging between rows, bursts half a cycle later instead. Slower waves can be stepped
// through head-on, so the speed is what makes the slots necessary.
const SLOT_ROWS = [0, 1, 2, 1, 0, 1, 2, 1, 0, 1] as const;
const slotWave: Design = { name: 'Slot wave', columns: 10, period: 120, floor: rows(TOP, MID, BOTTOM),
  hint: 'The orange wave comes at you. Stand in the blue slot of your column as it passes, then leave before the slot bursts.',
  burst: (c, y) => SLOT_ROWS[c] === y - TOP ? { at: 12 * (9 - c) + 60, style: 'plasma' } : { at: 12 * (9 - c) } };

// Zigzag: four groups burst in turn, one every 33 ticks; group = -(column + 2 * row) mod 4 forms
// diagonal stripes sliding toward you. Both forward-diagonal tiles burst one beat after yours, but a
// diagonal step clips the two tiles beside the corner, so the route needs precise timing in sequence
// (playtest: "very hard", a late puzzle). Simulated: diagonal ±3, straight rows ±11 by stepping head-on.
const ZIGZAG_STYLES = ['ember', 'plasma', 'toxic', 'psionic'] as const;
const zigzag: Design = { name: 'Zigzag', columns: 10, period: 132, floor: rows(TOP, MID, BOTTOM),
  hint: 'Coloured stripes slide toward you. Step diagonally into the stripe that just burst, zigzagging up and down.',
  burst: (c, y) => {
    const group = ((-(c + 2 * (y - TOP))) % 4 + 4) % 4;
    return { at: group * 33, style: ZIGZAG_STYLES[group] };
  } };

const DESIGNS: readonly Design[] = [follow, bands, checker, switchback, rain, duck, twoWaves, roundabouts, snake, slotWave, zigzag];

/** First puzzle column of each design: a 2-tile start pad, then puzzles separated by joints. */
const START = DESIGNS.reduce<number[]>((s, _d, i) => [...s, i === 0 ? 3 : s[i - 1] + DESIGNS[i - 1].columns + JOINT], []);
const last = DESIGNS.length - 1;
const WIDTH = START[last] + DESIGNS[last].columns + 3;
const checkpointX = (i: number) => START[i] + DESIGNS[i].columns + 1;

const floor: Rect[] = [[1, TOP, 2, BOTTOM]];
const hazards: Pulse[] = [];
DESIGNS.forEach((design, i) => {
  for (let c = 0; c < design.columns; c++) for (const y of ALL_ROWS) {
    if (!design.floor(c, y)) continue;
    const x = START[i] + c;
    floor.push([x, y, x, y]);
    const b = design.burst(c, y);
    if (!b) continue;
    const tick = b.at + REVEAL_OFFSET, period = design.period;
    hazards.push({ kind: 'pulse', x, y, on: 1, period, phase: (period - tick % period) % period,
      sectionId: `pulse-${i + 1}`, ...(b.style && b.style !== 'ember' ? { style: b.style } : {}) });
  }
  const end = i === last ? WIDTH - 2 : START[i + 1] - 1;
  floor.push([START[i] + design.columns, TOP, end, BOTTOM]);
});

const sections = DESIGNS.map(({ name }, i) => {
  const x = i === 0 ? 0 : checkpointX(i - 1) + 1;
  const right = i === last ? WIDTH - 1 : checkpointX(i);
  const bounds = { x, y: 0, width: right - x + 1, height: HEIGHT };
  const entry = { x: i === 0 ? 1 : x, y: MID };
  return { id: `pulse-${i + 1}`, name, bounds, entry, observation: { ...entry, width: 1, height: 1 },
    completion: i < last ? { kind: 'checkpoint' as const, checkpointId: `checkpoint-${i + 1}` } : { kind: 'goal' as const },
    camera: { mode: 'fixed' as const, frame: bounds } };
});

const HINTS = DESIGNS.map(d => d.hint);
export const PULSE_LINE: ExplosionPuzzle = buildExplosionPuzzle({
  id: 'line', name: 'Pulse Line', hint: HINTS[0], hints: HINTS, width: WIDTH, height: HEIGHT,
  floor, spawn: { x: 1, y: MID }, goal: { x: WIDTH - 2, y: MID }, hazards,
  checkpoints: DESIGNS.slice(0, last).map((_d, i) => ({ id: `checkpoint-${i + 1}`, x: checkpointX(i), y: MID, radius: 1.5 })),
  sections,
}, 'pulse');
