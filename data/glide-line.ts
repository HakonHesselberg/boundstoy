import { buildIceEscape, type Creep } from './ice-escapes.ts';
import type { ExplosionPuzzle } from './explosion-puzzles.ts';

/**
 * Glide Line: the soft-ice level of the shareable prototype (BT-089), designed
 * on paper with the user one puzzle at a time, like Pulse Line. Puzzles are
 * 5- or 7-row fields between normal-ground pads inside an outer wall (walls bounce
 * soft ice, so they are safe); hazards are spikes and, from puzzle 4, slow saws.
 * Each field sits between 4-wide ground joints (pad, checkpoint, entry, pad).
 */
export type IceField = Readonly<{ name: string; hint: string; field: readonly string[];
  /** Tile above and below the field: wall (default, bounces) or spikes. */
  edge?: '#' | '!';
  /** Saws in field coordinates: x is the field column, y the map row (1 = top field row). */
  creeps?: readonly Creep[] }>;
const FIELD_ROWS = [5, 7], MID = 3, JOINT = 4, CHECKPOINT_RADIUS = 2.5;
const SOURCE = Object.freeze({ reference: 'Boundstoy co-design', credit: 'original',
  idea: 'Soft-ice fields with walls and spikes between ground pads.', adaptation: 'Prototype soft-ice level (BT-089).' });

// 1 Spike slalom: three spike bars, open at the bottom, top, bottom; steer an S through the gaps.
const SPIKE_SLALOM: IceField = { name: 'Spike slalom',
  hint: 'Soft ice never stops; hold a direction to turn. Walls bounce you, spikes do not. Weave through the gaps.',
  field: [
    '~~~~!~~~~~~~~~~~!~~~',
    '~~~~!~~~~~~~~~~~!~~~',
    '~~~~!~~~~~!~~~~~!~~~',
    '~~~~~~~~~~!~~~~~~~~~',
    '~~~~~~~~~~!~~~~~~~~~',
  ] };

// 2 Spike run: one continuous 2-wide channel jogging down, up and down, spiked on every side
// including the top and bottom edges; no stops, no walls (simulated clearance about 0.3 tiles).
const SPIKE_RUN: IceField = { name: 'Spike run', edge: '!',
  hint: 'No stops and no walls. Line up on the ground, then steer the channel in one glide.',
  field: [
    '~~~~!!!!!!!!!!!!!!',
    '~~~~!!!!~~~~~~~~!!',
    '!!~~~~!!~~~~~~~~!!',
    '!!~~~~~~~~!!!!~~~~',
    '!!!!!!~~~~!!!!~~~~',
  ] };

// 3 Hairpin: a 7-row field with three 1-wide lanes three rows apart, separated by spikes; U-turn in
// the right pocket, then the left. Spikes on every edge; 5-wide pockets because a full-speed U-turn
// needs about 2.75 tiles (simulated clearance about 0.35 tiles).
const HAIRPIN: IceField = { name: 'Hairpin', edge: '!',
  hint: 'The lanes double back. Turn round in each pocket: first turn down and back, then down and forward.',
  field: [
    '~~~~~~~~~~~~~~~~~!',
    '!!!!!!!!!!!!~~~~~!',
    '!!!!!!!!!!!!~~~~~!',
    '!~~~~~~~~~~~~~~~~!',
    '!~~~~~!!!!!!!!!!!!',
    '!~~~~~!!!!!!!!!!!!',
    '!~~~~~~~~~~~~~~~~~',
  ] };

// 4 Oncoming: the first moving hazards. An open 5-row field with spiked edges; one slow saw per row
// runs the length of the field and back (about 2 tiles/s), rows staggered by a fifth of a cycle.
// Swerve between rows (after the ice escape Wolf Lanes). Playtest: fairly easy, ok as an early level.
const ONCOMING_PERIOD = 2280;
const ONCOMING: IceField = { name: 'Oncoming', edge: '!',
  hint: 'A slow saw runs along every row. Swerve into a row whose saw is still far away.',
  creeps: [1, 2, 3, 4, 5].map((y, k): Creep => [19, y, 0, y, ONCOMING_PERIOD, Math.round(k * ONCOMING_PERIOD / 5)]),
  field: Array.from({ length: 5 }, () => '~'.repeat(20)) };

// 5 Divided road: two 2-row lanes split by a spike row with two 4-wide gaps. A side-by-side saw pair
// fills each lane (about 2.5 tiles/s), the bottom pair half a cycle behind; change lanes only at the
// gaps. Simulated: a route from 20/24 start moments; staying in one lane never survives.
const DIVIDED_PERIOD = 1800;
const DIVIDED_ROAD: IceField = { name: 'Divided road', edge: '!',
  hint: 'Saw pairs fill each lane. Cross the spikes only at the gaps, before the pair in your lane reaches you.',
  creeps: [1, 2, 4, 5].map((y): Creep => [19, y, 0, y, DIVIDED_PERIOD, y > 3 ? DIVIDED_PERIOD / 2 : 0]),
  field: [
    '~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~',
    '!!!!~~~~!!!!~~~~!!!!',
    '~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~',
  ] };

// 6 Rush hour: Oncoming's slow saws (one per row) plus three 2x2 spike islands, so you cannot swerve
// just anywhere. Simulated (coarse search): a route from 11/30 start moments, no single-row route.
const RUSH_PERIOD = 2280;
const RUSH_HOUR: IceField = { name: 'Rush hour', edge: '!',
  hint: 'The saws come down every row again, but spike islands block some swerves. Pick a gap before you need it.',
  creeps: [1, 2, 3, 4, 5].map((y, k): Creep => [19, y, 0, y, RUSH_PERIOD, Math.round(k * RUSH_PERIOD / 5)]),
  field: [
    '~~~~~~~~~~~~~~~~~~~~',
    '~~~~~!!~~~~~~~~!!~~~',
    '~~~~~!!~~~~~~~~!!~~~',
    '~~~~~~~~~~!!~~~~~~~~',
    '~~~~~~~~~~!!~~~~~~~~',
  ] };

// 7 Scissors: an open 5-row field in four 5-column blocks; in each block two saws cross corner to
// corner at the same moment (about 2.8 tiles/s), neighbouring blocks half a cycle apart.
// Simulated: a route from 22/24 start moments; a single row survives from 5/24.
const SCISSORS_PERIOD = 480;
const SCISSORS: IceField = { name: 'Scissors', edge: '!',
  hint: 'Saws cross each block like scissors. Slip through where the blades have just passed.',
  creeps: [0, 5, 10, 15].flatMap((c, k): Creep[] => {
    const at = k % 2 ? SCISSORS_PERIOD / 2 : 0;
    return [[c, 1, c + 4, 5, SCISSORS_PERIOD, at], [c, 5, c + 4, 1, SCISSORS_PERIOD, at]];
  }),
  field: Array.from({ length: 5 }, () => '~'.repeat(20)) };

/**
 * Lays out fields left to right between ground pads and builds one checkpointed world.
 * Fields may be 5 or 7 rows tall; each section's frame is its own field height plus the edges,
 * and rows below a shorter field are wall.
 */
export function buildGlideLevel(id: string, name: string, fields: readonly IceField[]): ExplosionPuzzle {
  for (const f of fields) if (!FIELD_ROWS.includes(f.field.length) || f.field.some(r => r.length !== f.field[0].length))
    throw new Error(`${f.name}: field must be ${FIELD_ROWS.join(' or ')} equal rows.`);
  // Columns left to right: owning field, and the field column (or -1 for ground pads).
  const columns: { owner: number; column: number }[] = [];
  const pad = (owner: number, n: number) => { for (let k = 0; k < n; k++) columns.push({ owner, column: -1 }); };
  const starts: number[] = [];
  pad(0, 2);
  fields.forEach((f, i) => {
    starts.push(1 + columns.length);
    for (let c = 0; c < f.field[0].length; c++) columns.push({ owner: i, column: c });
    if (i === fields.length - 1) pad(i, 2); else { pad(i, JOINT / 2); pad(i + 1, JOINT / 2); }
  });
  const width = columns.length + 2, height = Math.max(...fields.map(f => f.field.length)) + 2;
  const grid = Array.from({ length: height }, () => Array.from({ length: width }, () => '#'));
  columns.forEach(({ owner, column }, k) => {
    const f = fields[owner], x = k + 1, rows = f.field.length;
    for (let y = 1; y <= rows; y++) grid[y][x] = column < 0 ? '.' : f.field[y - 1][column];
    if (column >= 0 && f.edge === '!') grid[0][x] = grid[rows + 1][x] = '!';
  });
  grid[MID][1] = 'S'; grid[MID][width - 2] = 'G';
  const checkpointX = (i: number) => starts[i] + fields[i].field[0].length + 1;
  const puzzles = fields.map((f, i) => {
    const x = i === 0 ? 0 : checkpointX(i - 1) + 1, right = i === fields.length - 1 ? width - 1 : checkpointX(i);
    return { name: f.name, hint: f.hint, bounds: [x, 0, right - x + 1, f.field.length + 2] as const, entry: [i === 0 ? 1 : x, MID] as const,
      creeps: (f.creeps ?? []).map(([fx, fy, tx, ty, period, at]): Creep => [fx + starts[i], fy, tx + starts[i], ty, period, at]),
      ...(i < fields.length - 1 ? { checkpoint: [checkpointX(i), MID, CHECKPOINT_RADIUS] as const } : {}) };
  });
  return buildIceEscape({ id, name, width, rows: grid.map(row => row.join('')), puzzles, source: SOURCE });
}

export const GLIDE_LINE: ExplosionPuzzle = buildGlideLevel('glide-line', 'Glide Line', [SPIKE_SLALOM, SPIKE_RUN, HAIRPIN, ONCOMING, DIVIDED_ROAD, RUSH_HOUR, SCISSORS]);
