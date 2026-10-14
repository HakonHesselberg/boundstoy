import type { BenchmarkCommand } from './benchmark-replays.ts';

/**
 * Exact deathless witnesses for the classic-bounds trials, with timing windows
 * measured under a re-sync model: one move that starts from rest begins up to
 * N ticks early (`early`) or late (`late`), and the next pause absorbs the
 * difference, as a player re-reads the pattern while waiting. Values are capped
 * at WINDOW_CAP. Windows describe these routes only; other routes may differ,
 * and positive windows do not prove a level is fun or humanly comfortable.
 */
export const WINDOW_CAP = 16;
export type BoundWitness = Readonly<{
  ticks: number;
  windows: readonly (readonly [early: number, late: number])[];
  commands: readonly BenchmarkCommand[];
}>;
type Input = readonly [ticks: number, x: number, y: number];
const witness = (ticks: number, windows: readonly (readonly [number, number])[], inputs: readonly Input[]): BoundWitness =>
  Object.freeze({ ticks, windows: Object.freeze(windows.map(w => Object.freeze([w[0], w[1]] as const))),
    commands: Object.freeze(inputs.map(([t, x, y]) => Object.freeze({ ticks: t, x, y }))) });

export const CLASSIC_BOUND_WITNESSES: Readonly<Record<string, BoundWitness>> = Object.freeze({
  'bound-run-it': witness(1170, [[8,13],[8,8],[8,8],[8,16],[8,16],[8,9],[16,16],[16,16]],
    [[8,0,0],[133,1,0],[13,0,0],[100,1,0],[8,0,0],[100,1,0],[8,0,0],[100,1,0],[51,0,0],[100,1,0],[53,0,0],[100,1,0],[24,0,0],[100,1,0],[119,0,0],[167,1,0]]),
  'bound-side-pockets': witness(2088, [[15,16],[15,15],[15,16],[14,16],[15,15],[15,16],[15,16],[15,16],[16,16],[15,16],[15,15],[15,16],[15,16]],
    [[15,0,0],[24,1,1],[100,0,1],[52,0,0],[67,-1,0],[15,0,0],[33,1,0],[95,1,1],[33,1,0],[37,0,0],[66,-1,0],[66,0,1],[68,0,0],[67,-1,0],[15,0,0],[33,1,0],[95,1,1],[33,1,0],[37,0,0],[67,-1,0],[66,0,1],[67,0,0],[66,-1,0],[16,0,0],[33,1,0],[94,1,1],[34,1,0],[37,0,0],[67,-1,0],[67,0,1],[66,0,0],[67,-1,0],[15,0,0],[34,1,0],[94,1,1],[33,1,0],[37,0,0],[67,-1,0],[100,0,1],[10,-1,1]]),
  'bound-checker-flip': witness(1119, [[15,16],[15,16],[14,16],[15,16],[15,16],[15,15],[15,16]],
    [[74,0,0],[17,0,1],[117,1,0],[43,0,0],[134,0,-1],[16,0,0],[133,0,-1],[17,0,0],[133,1,0],[17,0,0],[133,1,0],[17,0,0],[134,1,0],[15,0,0],[116,1,0],[3,0,-1]]),
  'bound-slalom': witness(1283, [[9,16],[9,9],[9,8],[8,10],[9,16],[10,9],[9,8],[8,9],[10,16],[9,9],[9,8],[8,10]],
    [[36,0,0],[24,-1,1],[66,0,1],[47,0,0],[67,0,1],[9,0,0],[95,1,1],[8,0,0],[66,0,1],[22,0,0],[95,-1,-1],[32,0,0],[67,0,1],[9,0,0],[95,1,1],[8,0,0],[67,0,1],[21,0,0],[95,-1,-1],[32,0,0],[67,0,1],[9,0,0],[95,1,1],[8,0,0],[133,0,1],[10,-1,1]]),
  'bound-closing-corners': witness(1166, [[11,11],[11,12],[12,11],[11,11],[11,11],[11,16],[11,16],[10,11],[16,16]],
    [[190,0,0],[17,0,1],[117,1,0],[11,0,0],[66,1,0],[12,0,0],[67,1,0],[11,0,0],[67,1,0],[11,0,0],[94,1,1],[11,0,0],[67,-1,0],[24,0,0],[95,1,1],[30,0,0],[133,0,1],[24,0,0],[116,1,0],[3,0,1]]),
  'bound-convergence': witness(826, [[9,9],[9,16],[9,12],[9,8],[8,10],[10,10],[16,16]],
    [[78,0,0],[17,0,1],[117,1,0],[9,0,0],[66,1,0],[28,0,0],[67,0,-1],[16,0,0],[134,1,0],[8,0,0],[67,0,1],[10,0,0],[66,1,0],[22,0,0],[117,1,0],[4,0,-1]]),
});
