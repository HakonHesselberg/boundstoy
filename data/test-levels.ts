import type { Pulse } from '../core/level.ts';
import { buildExplosionPuzzle, type ExplosionPuzzle } from './explosion-puzzles.ts';

/**
 * Single-puzzle playtest drafts with no verified routes.
 * TEST_LEVELS: puzzles being tried out for the current level; approved ones
 * move into Pulse Line (data/pulse-line.ts).
 * TENTATIVE: shelved ideas. Propeller (BT-085 playtest) was fine alone but
 * played as a straight run; revisit once locks and keys exist (BT-087).
 */

// Propeller: a two-bladed sweep turns clockwise around a 3x1 wall pillar in a
// 9x5 arena. Blades point left/right at step 0 and up/down at step 4.
const ARENA = Object.freeze({ left: 3, top: 1, width: 9, height: 5 });
const PIVOT = Object.freeze({ x: ARENA.left + 4, y: ARENA.top + 2 });
const PILLAR = Object.freeze([PIVOT.x - 1, PIVOT.x, PIVOT.x + 1]);
const STEPS_PER_HALF_TURN = 8, TICKS_PER_STEP = 24, REVEAL_OFFSET = 5;
const PERIOD = STEPS_PER_HALF_TURN * TICKS_PER_STEP;

function propellerPulses(): Pulse[] {
  const pulses: Pulse[] = [];
  for (let y = ARENA.top; y < ARENA.top + ARENA.height; y++) for (let x = ARENA.left; x < ARENA.left + ARENA.width; x++) {
    if (y === PIVOT.y && PILLAR.includes(x)) continue;
    // Clockwise on screen, starting from the left: west, north, east, south.
    const turn = ((Math.atan2(y - PIVOT.y, x - PIVOT.x) - Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    const step = Math.floor(turn / (2 * Math.PI) * 2 * STEPS_PER_HALF_TURN) % STEPS_PER_HALF_TURN;
    const tick = step * TICKS_PER_STEP + REVEAL_OFFSET;
    pulses.push({ kind: 'pulse', x, y, on: 1, period: PERIOD, phase: (PERIOD - tick % PERIOD) % PERIOD, sectionId: 'trial' });
  }
  return pulses;
}

const right = ARENA.left + ARENA.width;
const PROPELLER = buildExplosionPuzzle({
  id: 'propeller', name: 'Propeller', width: right + 3, height: 7,
  hint: 'Two blades sweep clockwise around the pillar. Go over the top behind the upper blade and hug the pillar.',
  floor: [[1, 2, 2, 4], [right, 2, right + 1, 4],
    // The arena around the pillar: rows above and below, then the row's two ends.
    [ARENA.left, ARENA.top, right - 1, PIVOT.y - 1], [ARENA.left, PIVOT.y + 1, right - 1, ARENA.top + ARENA.height - 1],
    [ARENA.left, PIVOT.y, PILLAR[0] - 1, PIVOT.y], [PILLAR[2] + 1, PIVOT.y, right - 1, PIVOT.y]],
  spawn: { x: 1, y: PIVOT.y }, goal: { x: right + 1, y: PIVOT.y },
  hazards: propellerPulses(),
}, 'test');

export const TENTATIVE: readonly ExplosionPuzzle[] = Object.freeze([PROPELLER]);

export const TEST_LEVELS: readonly ExplosionPuzzle[] = Object.freeze([]);
