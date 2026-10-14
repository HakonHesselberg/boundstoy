import type { World } from '../core/level.ts';
import type { State } from '../core/simulation.ts';
import { DT } from '../core/simulation.ts';
import { worldSectionIndex } from '../core/world.ts';
import { bestClean, type Run } from './storage.ts';

export type SectionProgress = Readonly<{ index: number; total: number; title: string }>;
export type WorldSummary = Readonly<{
  status: 'new' | 'continue' | 'complete';
  primaryLabel: 'Play' | 'Continue' | 'Play again';
  canNewRun: boolean;
  section: SectionProgress | null;
  progressLine: string;
  bestLine: string;
  deathless: boolean;
}>;

export function formatTime(ticks: number): string {
  const hundredths = Math.floor(ticks * DT * 100);
  return `${String(Math.floor(hundredths / 6000)).padStart(2, '0')}:${String(Math.floor(hundredths / 100) % 60).padStart(2, '0')}.${String(hundredths % 100).padStart(2, '0')}`;
}

const retries = (count: number) => `${count} ${count === 1 ? 'retry' : 'retries'}`;

export function sectionProgress(world: World, state: State): SectionProgress {
  const index = worldSectionIndex(world, state.visited);
  return { index, total: world.sections.length, title: world.sections[index].name };
}

/** The home screen's world card: a saved run continues; sections are never selectable. */
export function worldSummary(world: World, active: Readonly<{ state: State }> | null, record: Run | undefined): WorldSummary {
  const section = active ? sectionProgress(world, active.state) : null;
  const status = active ? 'continue' : record ? 'complete' : 'new';
  return {
    status,
    primaryLabel: status === 'continue' ? 'Continue' : status === 'complete' ? 'Play again' : 'Play',
    canNewRun: active !== null,
    section,
    progressLine: active && section
      ? `Section ${section.index + 1} of ${section.total} · ${formatTime(active.state.tick)} · ${retries(active.state.deaths)}`
      : record ? 'Cleared · try for a faster time' : `${world.sections.length} sections · one continuous run`,
    bestLine: record ? `Best ${formatTime(record.ticks)} · ${retries(record.deaths)}` : 'No record yet',
    deathless: bestClean(record) !== undefined,
  };
}

export function sectionPips(section: SectionProgress | null): ('done' | 'current' | 'ahead')[] {
  if (!section) return [];
  return Array.from({ length: section.total }, (_, i) => i < section.index ? 'done' : i === section.index ? 'current' : 'ahead');
}

export function controlsHint(coarsePointer: boolean): string {
  return coarsePointer
    ? 'Hold the arrows to move. Reach the golden exit.'
    : 'Move with WASD or arrow keys. Space pauses, R restarts. Reach the golden exit.';
}

/** How long a section's route hint stays on the board after the section starts. */
export const ROUTE_HINT_TICKS = Math.round(8 / DT);
