import type { BenchmarkCommand } from './benchmark-replays.ts';

/**
 * Exact deathless witnesses for the ice escapes with per-switch timing windows,
 * capped at WINDOW_CAP. Switch model: one key change happens N ticks early
 * (`early`) or late (`late`) while every later key change keeps its tick, so a
 * mistimed turn shifts the path. Leaving a rest on normal ground (no input on
 * walkable ground stops at once) instead shifts the whole slide, and the next
 * rest absorbs the difference. Windows describe
 * these routes only; they do not prove a level is fun or humanly comfortable.
 */
export const ICE_WINDOW_CAP = 16;
export type IceWitness = Readonly<{
  ticks: number;
  windows: readonly (readonly [early: number, late: number])[];
  commands: readonly BenchmarkCommand[];
}>;
type Input = readonly [ticks: number, x: number, y: number];
const commands = (inputs: readonly Input[]) => Object.freeze(inputs.map(([ticks, x, y]) => Object.freeze({ ticks, x, y })));
const witness = (ticks: number, windows: readonly (readonly [number, number])[], inputs: readonly Input[]): IceWitness =>
  Object.freeze({ ticks, windows: Object.freeze(windows.map(w => Object.freeze([w[0], w[1]] as const))), commands: commands(inputs) });

export const ICE_ESCAPE_WITNESSES: Readonly<Record<string, IceWitness>> = Object.freeze({
  'ice-snow-line': witness(1582, [[16,16],[8,16],[14,8],[16,14],[13,16],[12,16],[16,12]],
    [[20,0,0],[285,1,0],[287,-1,0],[44,0,1],[243,1,0],[287,-1,0],[58,0,1],[358,1,0]]),
  'ice-wolf-lanes': witness(957, [[16,16],[10,5],[5,10],[6,7],[7,6],[7,6],[6,7],[5,9],[9,5]],
    [[216,0,0],[87,1,0],[29,1,1],[157,1,0],[25,-1,-1],[75,1,0],[31,-1,1],[84,1,0],[36,-1,-1],[217,1,0]]),
  'ice-safe-zones': witness(1457, [[9,9],[6,6],[9,9],[6,7],[9,10],[6,6],[9,9],[7,6],[9,9]],
    [[98,0,0],[203,1,0],[75,0,0],[203,0,1],[43,0,0],[236,1,0],[65,0,0],[197,0,-1],[133,0,0],[204,1,0]]),
  'ice-bumper-alley': witness(1650, [[16,16],[8,16],[16,14],[4,16],[6,16],[16,16],[14,16],[16,4]],
    [[20,0,0],[32,1,1],[501,0,0],[79,0,1],[216,1,0],[89,1,-1],[540,0,0],[52,0,-1],[121,-1,0]]),
  'ice-spiral': witness(2231, [[12,12],[5,16],[11,15],[6,5],[15,11],[5,15],[11,15],[16,5],[16,11],[5,16],[16,11]],
    [[65,0,0],[5,1,1],[385,1,0],[376,0,1],[310,-1,0],[283,0,-1],[228,1,0],[201,0,1],[146,-1,0],[113,0,-1],[102,1,0],[17,1,-1]]),
  'ice-wardens-run': witness(1779, [[11,11],[10,16],[16,16],[16,16],[11,11],[11,11],[11,11],[11,11],[16,16],[16,16],[11,8],[16,16],[8,16]],
    [[20,0,0],[176,1,0],[178,-1,0],[44,0,1],[273,1,0],[71,0,0],[226,1,0],[19,0,0],[193,1,0],[20,0,0],[97,1,0],[76,1,-1],[302,0,0],[84,1,0]]),
});

/** Warden's Run: reach checkpoint 1, then launch straight into the first chute's creeps. */
export const WARDENS_RUN_DEATH = commands([[20, 0, 0], [176, 1, 0], [178, -1, 0], [44, 0, 1], [273, 1, 0], [295, 1, 0]]);
/** After Restart at checkpoint 1: a deathless finish with the reset creep pattern. */
export const WARDENS_RUN_RECOVERY = commands([[58, 0, 0], [223, 1, 0], [19, 0, 0], [192, 1, 0], [20, 0, 0], [98, 1, 0], [56, 1, -1], [322, 0, 0], [86, 1, 0]]);
