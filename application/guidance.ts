import type { Level } from '../core/level.ts';
import { terrainAt, type State, type DeathCause } from '../core/simulation.ts';
import { COURSE_LESSONS } from '../data/levels.ts';

export function courseGuide(level: Level, state: State) {
  const next = level.checkpoints.findIndex(p => !state.visited.includes(`${p.x},${p.y}`));
  const index = next < 0 ? level.checkpoints.length : next;
  const lesson = COURSE_LESSONS[level.id]?.[index];
  return {
    index,
    total: level.checkpoints.length + 1,
    title: lesson?.title ?? (next < 0 ? 'Find the golden exit' : `Reach checkpoint ${index + 1}`),
    hint: lesson?.hint ?? terrainAt(level, state.position).hint,
  };
}

const DEATH_MESSAGES: Readonly<Record<DeathCause, string>> = Object.freeze({
  void: 'Over the edge. Turn earlier; green ice has no brakes.',
  spikes: 'Caught the spikes. Give your turning arc more room.',
  pulse: 'Caught the blast. Wait on solid ground for a safe window.',
  saw: 'Caught by the saw. Watch its return trip before you launch.',
});
export function deathMessage(cause: DeathCause): string {
  return DEATH_MESSAGES[cause];
}
