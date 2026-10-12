import { open } from 'node:fs/promises';
import { constants } from 'node:fs';
import { LEVELS } from '../data/levels.ts';
import { REPLAYS } from '../data/replays.ts';
import { createState, step, ascii, DT, hazardTick, hazardEnabled } from '../core/simulation.ts';
import { importLevel, type Point } from '../core/level.ts';
import { worldSectionIndex } from '../core/world.ts';
import { V2_LIMITS } from '../data/level-limits.ts';

// Read only regular, bounded JSON files. Never import a module or accept state setters.
async function readJSON(path: string, maxBytes: number): Promise<string> {
  const file = await open(path, constants.O_RDONLY | constants.O_NONBLOCK);
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > maxBytes) throw new Error(`JSON input must be a regular file of at most ${maxBytes} bytes.`);
    const buffer = Buffer.alloc(maxBytes + 1);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await file.read(buffer, length, buffer.length - length);
      if (!bytesRead) break;
      length += bytesRead;
    }
    if (length > maxBytes) throw new Error(`JSON input exceeds ${maxBytes} bytes.`);
    return buffer.toString('utf8', 0, length);
  } finally { await file.close(); }
}

type Command = Point & { ticks: number };
function commandsFrom(value: unknown): Command[] {
  if (!Array.isArray(value) || value.length > 1000) throw new Error('Expected at most 1000 input commands.');
  let total = 0;
  return value.map(command => {
    if (!command || typeof command !== 'object' || Array.isArray(command)
      || Object.keys(command).some(key => !['ticks', 'x', 'y'].includes(key))
      || !Number.isInteger(command.ticks) || command.ticks < 0 || command.ticks > 100_000
      || !['x', 'y'].every(key => typeof command[key] === 'number' && Number.isFinite(command[key])
        && Math.abs(command[key]) <= 1)) throw new Error('Each command needs ticks (0-100000) and finite x/y input (-1..1), with no other fields.');
    total += command.ticks;
    if (total > 100_000) throw new Error('Input commands exceed 100000 total ticks.');
    return { ticks: command.ticks, x: command.x, y: command.y };
  });
}

const args = process.argv.slice(2);
let worldPath: string | undefined, commandPath: string | undefined, replay = false, json = false, index = 0;
let indexed = false;
const usage = `Usage: npm run inspect -- <0..${LEVELS.length - 1}> [--replay] [--json], or --world world.json [--commands commands.json] [--json]`;
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if ((arg === '--world' && !worldPath || arg === '--commands' && !commandPath) && args[i + 1] && !args[i + 1].startsWith('--')) {
    if (arg === '--world') worldPath = args[++i]; else commandPath = args[++i];
  } else if (arg === '--replay' && !replay) replay = true;
  else if (arg === '--json' && !json) json = true;
  else if (/^\d+$/.test(arg) && !indexed) { index = Number(arg); indexed = true; }
  else throw new Error(usage);
}
if (!Number.isSafeInteger(index) || !LEVELS[index] || worldPath && (indexed || replay) || commandPath && replay)
  throw new Error(usage);
const level = worldPath ? importLevel(await readJSON(worldPath, V2_LIMITS.importBytes)) : LEVELS[index];
const commands = commandPath ? commandsFrom(JSON.parse(await readJSON(commandPath, 100_000))) : replay ? REPLAYS[index] : [];
let state = createState(level);
function inspectState() {
  const index = level.version === 2 ? worldSectionIndex(level, state.visited) : null;
  const section = level.version === 2 && index !== null ? level.sections[index] : null;
  return { tick: state.tick, seconds: state.tick * DT, hazardTick: hazardTick(state),
    patternOffset: state.patternOffset, won: state.won, deaths: state.deaths, respawnTicks: state.respawnTicks,
    position: state.position, checkpoints: state.visited,
    hazards: { enabled: level.hazards.filter(h => hazardEnabled(level, h, state)).length,
      dormant: level.hazards.filter(h => !hazardEnabled(level, h, state)).length },
    section: section ? { index, id: section.id, name: section.name } : null };
}
const trace = [inspectState()];
for (const command of commands) {
  for (let i = 0; i < command.ticks && !state.won; i++) state = step(level, state, command);
  trace.push(inspectState());
}
if (!json) console.log(`${level.name}\n${ascii(level, state)}\n`);
console.log(JSON.stringify({ ...inspectState(),
  identity: { version: level.version, id: level.id,
    ...(level.version === 2 ? { revision: level.revision } : {}) },
  trace }, null, 2));
