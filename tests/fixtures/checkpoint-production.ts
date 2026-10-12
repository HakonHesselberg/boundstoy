import { AFTERSHOCK_WORLD as world } from '../../data/aftershock-world.ts';
import { openingCommand as c, type OpeningCommand } from '../../data/aftershock-world-replays.ts';
import { step, type State } from '../../core/simulation.ts';
import { CHECKPOINT_RECOVERIES } from './aftershock-world.ts';

/** Never edits state: stops on first new death or win. */
export function runProduction(start: State, commands: readonly OpeningCommand[]): State {
  let state = start;
  for (const command of commands) for (let i = 0; i < command.ticks; i++) {
    state = step(world, state, command);
    if (state.deaths > start.deaths || state.won) return state;
  }
  return state;
}

/** Bounded input-only recovery from a real CP center (restart, reload or
 * ordinary respawn). Waiting occurs on the validated safe landing, not via a
 * phase setter. The extra 30 moving ticks reach the collection edge reliably. */
export function productionRecovery(start: State, index: number) {
  const fixture = CHECKPOINT_RECOVERIES[index], last = fixture.route.at(-1)!;
  const route = [fixture.connector, ...fixture.route.slice(0, -1), { ...last, ticks: last.ticks + 30 }];
  for (let wait = 0; wait < fixture.cycle; wait++) {
    const commands = [c(wait), ...route], state = runProduction(start, commands);
    if (state.deaths === start.deaths && (index === 6 ? state.won : state.visited.length === index + 2))
      return { commands, state, wait };
  }
  throw new Error(`No recovery in one local cycle at checkpoint ${index + 1}`);
}
