import type { ExplosionPuzzle } from '../data/explosion-puzzles.ts';
import { EXPLOSION_PUZZLES } from '../data/explosion-puzzles.ts';
import { CLASSIC_BOUNDS } from '../data/classic-bounds.ts';
import { ICE_ESCAPES } from '../data/ice-escapes.ts';
import { SOUND_DEMOS } from '../data/sound-demo.ts';
import { PULSE_LINE } from '../data/pulse-line.ts';
import { GLIDE_LINE } from '../data/glide-line.ts';
import { TEST_LEVELS, TENTATIVE } from '../data/test-levels.ts';

/** A level-select tab. Every set must fit one tile grid without scrolling; empty sets are hidden. */
export type TrialSet = Readonly<{ id: string; title: string; summary: string; items: readonly ExplosionPuzzle[] }>;
export type TrialEntry = Readonly<{ set: TrialSet; index: number; puzzle: ExplosionPuzzle }>;

export const MAX_TRIALS_PER_SET = 9;

const PLAYER_SETS: readonly TrialSet[] = Object.freeze([
  Object.freeze({ id: 'designed', title: 'Designed together', items: Object.freeze([PULSE_LINE, GLIDE_LINE]),
    summary: 'Playtest drafts: an explosion level and a soft-ice level, puzzles joined by checkpoints.' }),
  Object.freeze({ id: 'test', title: 'Test levels', items: TEST_LEVELS,
    summary: 'Single puzzles being tried out before they join the level.' }),
  Object.freeze({ id: 'tentative', title: 'Tentative', items: TENTATIVE,
    summary: 'Shelved puzzle ideas, kept to revisit later (for example once locks and keys exist).' }),
  Object.freeze({ id: 'explosions', title: 'Explosions', items: EXPLOSION_PUZZLES,
    summary: 'Read the blast pattern, choose your moment and reach the exit.' }),
  Object.freeze({ id: 'classic', title: 'Classic bounds', items: CLASSIC_BOUNDS,
    summary: 'Hard timing trials on normal ground, after classic StarCraft bounds.' }),
  Object.freeze({ id: 'ice', title: 'Ice escapes', items: ICE_ESCAPES,
    summary: 'Soft ice never stops. Walls bounce you; leaving the track is a fall.' }),
].filter(set => set.items.length > 0));
const DEV_SETS: readonly TrialSet[] = Object.freeze([
  Object.freeze({ id: 'sound', title: 'Sound garden', items: SOUND_DEMOS,
    summary: 'Developer listening rooms for surfaces, ice sounds and explosion cues.' }),
]);

export function trialSets(options: Readonly<{ dev: boolean }>): readonly TrialSet[] {
  return options.dev ? [...PLAYER_SETS, ...DEV_SETS] : PLAYER_SETS;
}

export function findTrial(sets: readonly TrialSet[], id: string): TrialEntry | undefined {
  for (const set of sets) {
    const index = set.items.findIndex(item => item.level.id === id);
    if (index >= 0) return { set, index, puzzle: set.items[index] };
  }
  return undefined;
}

export function nextTrial(sets: readonly TrialSet[], id: string): ExplosionPuzzle | null {
  const entry = findTrial(sets, id);
  return entry?.set.items[entry.index + 1] ?? null;
}

type Sourced = Readonly<{ source: Readonly<Record<string, string>> }>;
/** A short attribution for adapted levels; original levels have none. */
export function trialCredit(puzzle: ExplosionPuzzle): string | null {
  if (!('source' in puzzle)) return null;
  const { source } = puzzle as ExplosionPuzzle & Sourced;
  if (source.map && source.author) return `After ${source.map} by ${source.author}`;
  if (source.reference && source.credit) return `After ${source.reference} · ${source.credit}`;
  return null;
}

/** Developer tools (editor, sound garden) are exposed only by an explicit query flag. */
export function isDevMode(search: string): boolean {
  const params = new URLSearchParams(search);
  return params.has('dev') || params.has('debug');
}
