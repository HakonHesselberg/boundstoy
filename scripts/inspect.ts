import { LEVELS } from '../data/levels.ts';
import { REPLAYS } from '../data/replays.ts';
import { createState, step, ascii, DT } from '../core/simulation.ts';

const index = Number(process.argv[2] ?? 0);
if (!Number.isInteger(index) || !LEVELS[index]) {
  throw new Error(`Invalid course index. Usage: npm run inspect -- <0..${LEVELS.length - 1}> [--replay]`);
}
const level = LEVELS[index];
let state = createState(level);
if (process.argv.includes('--replay')) {
  for (const command of REPLAYS[index]) for (let i = 0; i < command.ticks; i++) state = step(level, state, command);
}
console.log(`${level.name}\n${ascii(level, state)}\n`);
console.log(JSON.stringify({ tick: state.tick, seconds: state.tick * DT, won: state.won,
  deaths: state.deaths, position: state.position, checkpoints: state.visited }, null, 2));
