import { parseLevel, type World, type Level, type Point } from '../../core/level.ts';
import { step, type State } from '../../core/simulation.ts';

/** Small open joined world: permits intentional bypasses, not release content. */
export function worldFixture(overrides: Partial<World> = {}): World {
  const world = parseLevel({
    version: 2, revision: 1, id: 'progression-fixture', name: 'Progression fixture',
    description: 'Three joined sections for runtime regression tests.', resetPatternOnRetry: false,
    tiles: ['########################', ...Array(6).fill('#......................#'),
      '########################'],
    spawn: { x: 1, y: 2 }, goal: { x: 22, y: 2 },
    checkpoints: [{ id: 'first-landing', x: 6, y: 2, radius: 0.42 },
      { id: 'second-landing', x: 14, y: 2, radius: 0.42 }],
    hazards: [
      { kind: 'pulse', x: 4, y: 5, period: 120, on: 1, phase: 17 },
      { kind: 'saw', from: { x: 11, y: 5 }, to: { x: 13, y: 5 }, period: 240, phase: 30 },
    ],
    sections: [1, 9, 17].map((x, i) => ({
      id: `section-${i + 1}`, name: `Section ${i + 1}`,
      bounds: { x, y: 1, width: 6, height: 6 }, entry: { x, y: 2 },
      observation: { x, y: 2, width: 1, height: 1 },
      completion: i < 2 ? { kind: 'checkpoint', checkpointId: i === 0 ? 'first-landing' : 'second-landing' }
        : { kind: 'goal' },
      camera: { mode: 'fixed', frame: { x, y: 1, width: 6, height: 6 } },
    })),
    ...overrides,
  });
  if (world.version !== 2) throw new Error('Expected world fixture.');
  return world;
}

/** Cardinal keyboard movement only; fails rather than teleporting or silently dying. */
export function walkTo(level: Level, state: State, target: Point): State {
  for (const axis of ['x', 'y'] as const) {
    let ticks = 0;
    while (Math.abs(target[axis] - state.position[axis]) > 0.016) {
      if (++ticks > 1000 || state.won || state.respawnTicks)
        throw new Error(`Cannot walk to ${JSON.stringify(target)} from ${JSON.stringify(state)}`);
      state = step(level, state, { x: axis === 'x' ? Math.sign(target.x - state.position.x) : 0,
        y: axis === 'y' ? Math.sign(target.y - state.position.y) : 0 });
    }
  }
  return state;
}
