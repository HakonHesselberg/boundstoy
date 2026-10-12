export type BenchmarkCommand = Readonly<{ ticks: number; x: number; y: number }>;
export type BenchmarkReplay = Readonly<{
  commands: readonly BenchmarkCommand[]; ticks: number; lateMargins: readonly number[];
}>;

type Input = readonly [ticks: number, x: number, y: number];
const commands = (inputs: readonly Input[]) => Object.freeze(inputs.map(([ticks, x, y]) => Object.freeze({ ticks, x, y })));
const replay = (ticks: number, lateMargins: readonly number[], inputs: readonly Input[]): BenchmarkReplay =>
  Object.freeze({ ticks, lateMargins: Object.freeze(lateMargins), commands: commands(inputs) });

// Actual finish ticks, not target times. Late-input tolerances are measured
// independently at each command boundary, capped at 24 ticks; not proof of fun.
export const BENCHMARK_REPLAYS: Readonly<Record<string, BenchmarkReplay>> = Object.freeze({
  'bench-travelling-wave-normal': replay(530, [24, 24], [[77, 0, 0], [483, 1, 0]]),
  'bench-travelling-wave-soft': replay(393, [24], [[423, 1, 0]]),
  'bench-travelling-wave-hard': replay(370, [24], [[400, 1, 0]]),
  'bench-alternating-bands-normal': replay(613, [24, 24, 13, 24], [[67, 0, 0], [299, 1, 0], [93, 0, 0], [184, 1, 0]]),
  'bench-alternating-bands-soft': replay(463, [24, 24], [[70, 0, 0], [423, 1, 0]]),
  'bench-alternating-bands-hard': replay(453, [24, 24], [[83, 0, 0], [400, 1, 0]]),
  'bench-alternating-bands-mud': replay(1073, [24, 24], [[154, 0, 0], [949, 1, 0]]),
  'bench-side-refuges-normal': replay(674, [18, 18, 17, 8, 17, 18, 19, 13, 24, 24],
    [[87, 0, 0], [133, 0, 1], [33, -1, 0], [33, 0, 1], [10, 0, 0], [154, 1, 1],
      [10, 1, 0], [33, 0, 1], [93, -1, 1], [118, 0, 1]]),
  'bench-checker-grid-normal': replay(487, [11, 11, 24], [[34, 0, 0], [333, 1, 0], [150, 0, -1]]),
  'bench-checker-grid-soft': replay(462, [19, 19, 24], [[45, 0, 0], [297, 1, 0], [150, 0, -1]]),
  'bench-checker-grid-hard': replay(411, [13, 13, 24], [[8, 0, 0], [283, 1, 0], [150, 0, -1]]),
  'bench-checker-grid-mud': replay(866, [7, 7, 12, 24, 24],
    [[54, 0, 0], [346, 1, 0], [80, 0, 0], [266, 1, 0], [150, 0, -1]]),
  'bench-inward-rings-normal': replay(490, [24, 24], [[137, 0, 0], [383, 1, 0]]),
  'bench-inward-rings-soft': replay(453, [24, 24], [[142, 0, 0], [341, 1, 0]]),
  'bench-inward-rings-hard': replay(443, [24, 24], [[148, 0, 0], [325, 1, 0]]),
  'bench-inward-rings-mud': replay(743, [24, 24], [[64, 0, 0], [709, 1, 0]]),
  'bench-wall-slalom-normal': replay(720, [24, 24, 24, 14],
    [[33, 0, 0], [200, 1, 0], [200, 0, 1], [317, 1, 0]]),
  'bench-wall-slalom-soft': replay(577, [24, 24, 24, 21],
    [[28, 0, 0], [125, 1, 0], [137, 0, 1], [400, 1, 0]]),
  'bench-wall-slalom-hard': replay(767, [24, 24, 24, 24, 24, 24],
    [[28, 0, 0], [260, 1, 0], [240, 0, 1], [200, 1, 0], [43, 0, -1], [80, 1, 0]]),
  'bench-wall-slalom-mud': replay(1583, [24, 24, 24, 24],
    [[407, 1, 0], [479, 0, 1], [105, 0, 0], [622, 1, 0]]),
});

export const BENCHMARK_PROBES: readonly Readonly<{
  id: string; commands: readonly BenchmarkCommand[]; outcome: 'death' | 'unfinished';
}>[] = Object.freeze([
  { id: 'bench-travelling-wave-normal', commands: commands([[453, 1, 0]]) },
  { id: 'bench-alternating-bands-normal', commands: commands([[453, 1, 0]]) },
  { id: 'bench-side-refuges-normal', commands: commands([[133, 0, 1], [33, -1, 0], [33, 0, 1],
    [154, 1, 1], [10, 1, 0], [33, 0, 1], [93, -1, 1], [88, 0, 1]]) },
  { id: 'bench-checker-grid-normal', commands: commands([[333, 1, 0], [120, 0, -1]]) },
  { id: 'bench-inward-rings-normal', commands: commands([[353, 1, 0]]) },
  { id: 'bench-wall-slalom-normal', commands: commands([[200, 1, 0], [200, 0, 1], [287, 1, 0]]) },
].map(probe => Object.freeze({ ...probe, outcome: 'death' as const })));
