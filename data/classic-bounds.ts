import type { Pulse } from '../core/level.ts';
import type { ExplosionStyleId } from './explosion-styles.ts';
import { buildExplosionPuzzle, type ExplosionPuzzle, type PuzzleLayout } from './explosion-puzzles.ts';

/**
 * Hard normal-ground explosion trials adapted from mechanisms decoded in BT-068
 * from two archived StarCraft: Brood War bounds. Only the idea of each obstacle
 * is borrowed: every layout, rhythm and timing below is an original Boundstoy
 * adaptation, tuned with exact replays. No source map data is shipped.
 */
export type BoundSource = Readonly<{ map: string; author: string; obstacle: string; adaptation: string }>;
export type ClassicBound = ExplosionPuzzle & Readonly<{ source: BoundSource }>;

type Rect = PuzzleLayout['floor'][number];
const BEGINNER = 'Beginner Bound', LEVEL_UP = 'Level Up Bound';
/** Shifts every rhythm so no pad sits in its burst frame on the ready reveal (pattern tick 0). */
const REVEAL_OFFSET = 5;

/** One pulse that bursts at pattern ticks congruent to `at + REVEAL_OFFSET` (mod `period`). */
function burst(x: number, y: number, period: number, at: number, style: ExplosionStyleId): Pulse {
  const tick = at + REVEAL_OFFSET, phase = (period - (tick % period + period) % period) % period;
  return { kind: 'pulse', x, y, on: 1, period, phase, sectionId: 'trial', ...(style === 'ember' ? {} : { style }) };
}
/** A square region of pulses sharing one rhythm group, like a source kill location. */
function region(left: number, top: number, size: number, period: number, at: number, style: ExplosionStyleId): Pulse[] {
  const result: Pulse[] = [];
  for (let y = top; y < top + size; y++) for (let x = left; x < left + size; x++) result.push(burst(x, y, period, at, style));
  return result;
}

// Run-It: eight 2x2 blocks with one-tile gaps; the wave runs away from the start.
// One orange front at a time; the blue gap wave follows half a cycle later (BT-081).
const RUN = Object.freeze({ blocks: 8, period: 360, step: 40, gapDelay: 180 });
function runIt(): PuzzleLayout {
  const hazards: Pulse[] = [];
  for (let b = 0; b < RUN.blocks; b++) {
    const at = b * RUN.step, x = 3 + 3 * b;
    hazards.push(...region(x, 3, 2, RUN.period, at, 'ember'));
    if (b < RUN.blocks - 1) for (const y of [3, 4]) hazards.push(burst(x + 2, y, RUN.period, at + RUN.gapDelay, 'plasma'));
  }
  return { id: 'run-it', name: 'Run-It', revision: 2, width: 30, height: 8, floor: [[1, 3, 28, 4]],
    spawn: { x: 1, y: 4 }, goal: { x: 28, y: 4 }, hazards,
    hint: 'An orange wave sweeps right through the blocks; half a beat later a blue wave sweeps the gaps. Hop between the two waves.' };
}

// Side Pockets: the whole spine bursts together; pockets alternate sides on their own beats.
const POCKETS = Object.freeze({ count: 8, period: 240, left: -40, right: 40 });
function sidePockets(): PuzzleLayout {
  const last = 3 + 2 * POCKETS.count, hazards: Pulse[] = [];
  for (let y = 3; y <= last + 1; y++) for (const x of [6, 7]) hazards.push(burst(x, y, POCKETS.period, 0, 'ember'));
  const floor: Rect[] = [[6, 1, 7, last + 3]];
  for (let k = 0; k < POCKETS.count; k++) {
    const left = k % 2 === 0, x = left ? 4 : 8, y = 4 + 2 * k;
    floor.push([x, y, x + 1, y + 1]);
    hazards.push(...region(x, y, 2, POCKETS.period, left ? POCKETS.left : POCKETS.right, left ? 'toxic' : 'plasma'));
  }
  return { id: 'side-pockets', name: 'Side Pockets', revision: 2, width: 14, height: last + 5, floor,
    spawn: { x: 6, y: 1 }, goal: { x: 6, y: last + 3 }, hazards,
    hint: 'The whole spine bursts at once. Green pockets burst just before it, blue just after: zigzag between them.' };
}

// Checker Flip: ember squares burst, plasma squares burst late, so ember re-bursts soon after.
const CHECKER = Object.freeze({ columns: 7, rows: 5, period: 150, shortGap: 40 });
function checkerFlip(): PuzzleLayout {
  const hazards: Pulse[] = [], right = 4 + 2 * CHECKER.columns;
  for (let cy = 0; cy < CHECKER.rows; cy++) for (let cx = 0; cx < CHECKER.columns; cx++) {
    const plasma = (cx + cy) % 2 === 1;
    hazards.push(...region(4 + 2 * cx, 2 + 2 * cy, 2, CHECKER.period,
      plasma ? CHECKER.period - CHECKER.shortGap : 0, plasma ? 'plasma' : 'ember'));
  }
  return { id: 'checker-flip', name: 'Checker Flip', revision: 2, width: right + 4, height: 14,
    floor: [[4, 2, right - 1, 11], [1, 10, 3, 11], [right, 2, right + 2, 3]],
    spawn: { x: 1, y: 10 }, goal: { x: right + 2, y: 2 }, hazards,
    hint: 'Blue squares burst just before orange ones. Step from orange onto blue in that short gap; blue to orange is easier.' };
}

// Slalom: each block of four fires top-right, bottom-left, top-left, bottom-right; lower blocks lag,
// so bursts read as two lanes travelling up toward the player (BT-081 playtest).
const SLALOM = Object.freeze({ blocks: 4, period: 150, lag: 94 });
const SLALOM_STYLES: readonly ExplosionStyleId[] = ['ember', 'plasma', 'toxic', 'psionic'];
function slalom(): PuzzleLayout {
  const hazards: Pulse[] = [], rows = 2 * SLALOM.blocks, bottom = 3 + 2 * rows;
  for (let r = 0; r < rows; r++) for (let lane = 0; lane < 2; lane++) {
    const top = r % 2 === 0, slot = top ? (lane ? 0 : 2) : (lane ? 3 : 1);
    const at = Math.round(slot * SLALOM.period / 4 + Math.floor(r / 2) * SLALOM.lag);
    hazards.push(...region(4 + 2 * lane, 3 + 2 * r, 2, SLALOM.period, at, SLALOM_STYLES[slot]));
  }
  return { id: 'slalom', name: 'Slalom', revision: 2, width: 12, height: bottom + 4, floor: [[4, 1, 7, bottom + 1]],
    spawn: { x: 5, y: 1 }, goal: { x: 6, y: bottom + 1 }, hazards,
    hint: 'Bursts climb both lanes toward you. Weave between the lanes, and sometimes step back diagonally to let a burst pass.' };
}

// Closing Corners: nested L rings close from the start corner and from the exit corner.
// The seam bursts alone between the two sweeps so their meeting has a visible opening (BT-081).
const CORNERS = Object.freeze({ period: 270, startStep: 30, exitOrigin: 160, exitStep: 30, seam: 125 });
function closingCorners(): PuzzleLayout {
  const hazards: Pulse[] = [];
  for (let cy = 0; cy < 5; cy++) for (let cx = 0; cx < 5; cx++) {
    const near = cx + cy < 4, far = cx + cy > 4;
    const at = near ? Math.max(cx, cy) * CORNERS.startStep
      : far ? CORNERS.exitOrigin + Math.max(4 - cx, 4 - cy) * CORNERS.exitStep : CORNERS.seam;
    hazards.push(...region(4 + 2 * cx, 2 + 2 * cy, 2, CORNERS.period, at, near ? 'ember' : far ? 'plasma' : 'psionic'));
  }
  return { id: 'closing-corners', name: 'Closing Corners', revision: 2, width: 18, height: 14,
    floor: [[4, 2, 13, 11], [1, 2, 3, 3], [14, 10, 16, 11]], spawn: { x: 1, y: 2 }, goal: { x: 16, y: 11 }, hazards,
    hint: 'Orange rings sweep out from your corner, then the violet seam bursts alone, then blue rings sweep in. Cross the seam after it bursts.' };
}

// Convergence: the square collapses inward, outer corners first and the centre last.
const CONVERGENCE = Object.freeze({ period: 150, bursts: [0, 10, 30, 60, 70] });
const CONVERGENCE_STYLES: readonly ExplosionStyleId[] = ['ember', 'plasma', 'toxic', 'psionic', 'ember'];
function convergenceGroup(cx: number, cy: number): number {
  const ring = Math.max(Math.abs(cx - 2), Math.abs(cy - 2));
  if (ring === 0) return 4;
  const corner = Math.abs(cx - 2) === ring && Math.abs(cy - 2) === ring;
  return ring === 2 ? (corner ? 0 : 1) : (corner ? 2 : 3);
}
function convergence(): PuzzleLayout {
  const hazards: Pulse[] = [];
  for (let cy = 0; cy < 5; cy++) for (let cx = 0; cx < 5; cx++) {
    const group = convergenceGroup(cx, cy);
    hazards.push(...region(4 + 2 * cx, 2 + 2 * cy, 2, CONVERGENCE.period, CONVERGENCE.bursts[group], CONVERGENCE_STYLES[group]));
  }
  return { id: 'convergence', name: 'Convergence', width: 18, height: 14,
    floor: [[4, 2, 13, 11], [1, 6, 3, 7], [14, 6, 16, 7]], spawn: { x: 1, y: 6 }, goal: { x: 16, y: 6 }, hazards,
    hint: 'The square collapses inward: outer corners, outer edges, inner corners, inner edges, centre. Circle the centre on the inner ring.' };
}

const SOURCES: Readonly<Record<string, BoundSource>> = {
  'run-it': { map: BEGINNER, author: 'NewRecord', obstacle: 'Obstacles 1 and 5 (triggers 20, 28)',
    adaptation: 'A run-it sequence of 2x2 regions; obstacle 5 separates them with one-tile gaps. Here the gaps burst too.' },
  'side-pockets': { map: BEGINNER, author: 'NewRecord', obstacle: 'Obstacle 3 (trigger 24)',
    adaptation: 'One long kill strip with alternating side recesses. Here each pocket keeps its own beat.' },
  'checker-flip': { map: LEVEL_UP, author: 'Mp(U)', obstacle: 'Switch 46, with Beginner Bound obstacle 2',
    adaptation: 'A 5x5 checker that flips, waits, flips back and repeats at once. Here on a 7x5 board.' },
  slalom: { map: BEGINNER, author: 'NewRecord', obstacle: 'Obstacle 4 (trigger 26)',
    adaptation: 'Four rooms fire top-right, bottom-left, top-left, bottom-right. Here lagging quads become two lanes of bursts.' },
  'closing-corners': { map: LEVEL_UP, author: 'Mp(U)', obstacle: 'Switches 40-41 and 51',
    adaptation: 'Nested L shapes sweep diagonally across the arena. Here two sweeps meet on a seam.' },
  convergence: { map: LEVEL_UP, author: 'Mp(U)', obstacle: 'Switch 23',
    adaptation: 'Corners, then inner diagonals, then the centre. Here every square joins the collapse.' },
};

export const CLASSIC_BOUNDS: readonly ClassicBound[] = Object.freeze(
  [runIt(), sidePockets(), checkerFlip(), slalom(), closingCorners(), convergence()].map(layout => {
    const built = buildExplosionPuzzle(layout, 'bound');
    return Object.freeze({ ...built, source: Object.freeze({ ...SOURCES[layout.id] }) });
  }));
