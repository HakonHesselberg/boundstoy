import type { Level } from '../core/level.ts';
import { terrainAt, type State, type DeathCause } from '../core/simulation.ts';
import { worldSectionIndex } from '../core/world.ts';
import { COURSE_LESSONS } from '../data/levels.ts';
import { AFTERSHOCK_WORLD, AFTERSHOCK_SECTION_HINTS } from '../data/aftershock-world.ts';

export function courseGuide(level: Level, state: State) {
  if (level.version === 2) {
    const index = worldSectionIndex(level, state.visited), section = level.sections[index];
    const objective = section.completion.kind === 'goal' ? 'Find the golden exit.' : 'Reach the next checkpoint.';
    return { index, total: level.sections.length, title: section.name,
      hint: level.id === AFTERSHOCK_WORLD.id && level.revision === AFTERSHOCK_WORLD.revision
        && section.id === AFTERSHOCK_WORLD.sections[index]?.id ? AFTERSHOCK_SECTION_HINTS[index]
        : `${objective} ${terrainAt(level, state.position).hint}` };
  }
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
  void: 'Over the edge. Stay on the floor and plan your next move.',
  spikes: 'Caught the spikes. Leave more room around the obstacles.',
  pulse: 'Caught the detonation. Move just after the blast; fading debris is harmless.',
  saw: 'Caught by the saw. Watch its return trip before you launch.',
});
export function deathMessage(cause: DeathCause): string {
  return DEATH_MESSAGES[cause];
}
