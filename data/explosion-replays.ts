import type { BenchmarkCommand, BenchmarkReplay } from './benchmark-replays.ts';

type Input = readonly [ticks: number, x: number, y: number];
const commands = (inputs: readonly Input[]) => Object.freeze(inputs.map(([ticks, x, y]) => Object.freeze({ ticks, x, y })));
const replay = (ticks: number, lateMargins: readonly number[], inputs: readonly Input[]): BenchmarkReplay =>
  Object.freeze({ ticks, lateMargins: Object.freeze(lateMargins), commands: commands(inputs) });

export const EXPLOSION_REPLAYS: Readonly<Record<string, BenchmarkReplay>> = Object.freeze({
  'puzzle-wave': replay(542, [24, 24], [[89, 0, 0], [493, 1, 0]]),
  'puzzle-bands': replay(613, [24, 24, 18, 24], [[67, 0, 0], [294, 1, 0], [93, 0, 0], [199, 1, 0]]),
  'puzzle-refuges': replay(796, [22, 22, 13, 13, 24, 13, 24, 13],
    [[133, 0, 1], [76, -1, 0], [76, 1, 0], [167, 0, 1], [76, 1, 0], [39, 0, 0], [76, -1, 0], [193, 0, 1]]),
  'puzzle-checker': replay(616, [24, 24, 24, 24, 24, 24, 24, 24],
    [[2, 0, 0], [133, 1, 0], [100, 0, -1], [14, 0, 0], [100, 1, 0], [80, 0, 0], [100, 0, -1], [127, 1, 0]]),
  'puzzle-crossing': replay(757, [24, 24, 14], [[137, 0, 0], [333, 1, 0], [327, 0, -1]]),
  'puzzle-combination': replay(1015, [24, 24, 24, 24, 24],
    [[89, 0, 0], [566, 1, 0], [107, 0, 0], [66, 0, -1], [227, 1, 0]]),
});

export const EXPLOSION_PROBES: readonly Readonly<{ id: string; commands: readonly BenchmarkCommand[] }>[] = Object.freeze([
  { id: 'puzzle-wave', commands: commands([[493, 1, 0]]) },
  { id: 'puzzle-bands', commands: commands([[493, 1, 0]]) },
  { id: 'puzzle-refuges', commands: commands([[133, 0, 1], [76, -1, 0], [76, 1, 0], [167, 0, 1],
    [76, 1, 0], [76, -1, 0], [193, 0, 1]]) },
  { id: 'puzzle-checker', commands: commands([[133, 1, 0], [100, 0, -1], [100, 1, 0], [100, 0, -1], [127, 1, 0]]) },
  { id: 'puzzle-crossing', commands: commands([[333, 1, 0], [327, 0, -1]]) },
  { id: 'puzzle-combination', commands: commands([[566, 1, 0], [66, 0, -1], [227, 1, 0]]) },
].map(probe => Object.freeze(probe)));

export const COMBINATION_RECOVERY = commands([[200, 1, 0], [152, 0, 0], [66, 0, -1], [227, 1, 0]]);
