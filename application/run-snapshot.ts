import { center, type Level, type Point, type World } from '../core/level.ts';
import { distance, DT, lethalAt, reachesCheckpoint, restartCheckpoint, terrainAt, wallAt, type State } from '../core/simulation.ts';
import { checkpointPuzzles } from '../core/world.ts';
import { RULES, TERRAIN } from '../data/terrain.ts';
import { parseUniqueJSON } from './json.ts';

/** Snapshot schema version is independent of the authored world's version/revision. */
export const RUN_SNAPSHOT_VERSION = 1;
export const MAX_RUN_SNAPSHOT_BYTES = 16_384;
export type RunSnapshot = Readonly<{
  schemaVersion: typeof RUN_SNAPSHOT_VERSION;
  worldVersion: 2;
  runId: string;
  worldId: string;
  revision: number;
  state: State;
}>;
export type RunSnapshotResult =
  | Readonly<{ status: 'valid'; snapshot: RunSnapshot }>
  | Readonly<{ status: 'corrupt' | 'unsupported' | 'incompatible'; reason: string }>;

const MAX_SPEED = Math.max(...Object.values(TERRAIN).map(t => t.speed));
const MAX_TRAVEL = MAX_SPEED * DT;
// Only floating-point arithmetic tolerance, never a clamp or position adjustment.
const EPSILON = 1e-12;
const STATE_KEYS = ['tick', 'patternOffset', 'position', 'velocity', 'checkpoint', 'visited',
  'deaths', 'respawnTicks', 'won', 'event', 'deathCause'];
const ENVELOPE_KEYS = ['schemaVersion', 'worldVersion', 'runId', 'worldId', 'revision', 'state'];

function requireValue(condition: boolean, reason: string): asserts condition {
  if (!condition) throw new Error(reason);
}
function record(value: unknown, label: string): Record<string, unknown> {
  requireValue(value !== null && typeof value === 'object' && !Array.isArray(value), `${label} must be an object.`);
  const prototype = Object.getPrototypeOf(value);
  requireValue(prototype === Object.prototype || prototype === null, `${label} must be a plain object.`);
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, expected: readonly string[], label: string) {
  const own = Reflect.ownKeys(value);
  requireValue(own.length === expected.length && own.every(key => typeof key === 'string' && expected.includes(key)),
    `${label} has missing or unknown fields.`);
  for (const key of expected) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    requireValue(!!descriptor && descriptor.enumerable === true && 'value' in descriptor,
      `${label}.${key} must be an own data field.`);
  }
}
function integer(value: unknown, label: string, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  requireValue(typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max,
    `${label} must be a safe integer from ${min} to ${max}.`);
  return value;
}
function finite(value: unknown, label: string): number {
  requireValue(typeof value === 'number' && Number.isFinite(value), `${label} must be finite.`);
  return value;
}
function point(value: unknown, label: string): Point {
  const raw = record(value, label);
  keys(raw, ['x', 'y'], label);
  return Object.freeze({ x: finite(raw.x, `${label}.x`), y: finite(raw.y, `${label}.y`) });
}
function id(value: unknown, label: string, max: number): string {
  requireValue(typeof value === 'string' && value.length <= max && /^[a-z0-9-]+$/.test(value),
    `${label} must contain 1-${max} lowercase letters, numbers or hyphens.`);
  return value;
}
const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
const stopped = (p: Point) => p.x === 0 && p.y === 0;

function nearSafeFloor(world: World, p: Point): boolean {
  // Death stops at the first lethal movement segment. It cannot originate deep
  // inside a void/spike region, even if that region is inside the board.
  for (let y = Math.floor(p.y - MAX_TRAVEL); y <= Math.floor(p.y + MAX_TRAVEL); y++) {
    for (let x = Math.floor(p.x - MAX_TRAVEL); x <= Math.floor(p.x + MAX_TRAVEL); x++) {
      const terrain = terrainAt(world, { x, y });
      if (terrain.solid || terrain.lethal) continue;
      const dx = Math.max(x - p.x, 0, p.x - x - 1);
      const dy = Math.max(y - p.y, 0, p.y - y - 1);
      if (Math.hypot(dx, dy) <= terrain.speed * DT + EPSILON) return true;
    }
  }
  return false;
}

function stateFrom(value: unknown, world: World): State {
  const raw = record(value, 'state');
  keys(raw, STATE_KEYS, 'state');
  const tick = integer(raw.tick, 'tick');
  const patternOffset = integer(raw.patternOffset, 'patternOffset', 0, checkpointPuzzles(world) ? tick : 0);
  const deaths = integer(raw.deaths, 'deaths');
  const respawnTicks = integer(raw.respawnTicks, 'respawnTicks', 0, RULES.respawnTicks);
  const position = point(raw.position, 'position'), velocity = point(raw.velocity, 'velocity');
  requireValue(Math.hypot(velocity.x, velocity.y) <= MAX_SPEED + EPSILON, 'Velocity exceeds the movement rules.');
  requireValue(typeof raw.won === 'boolean', 'won must be boolean.');
  const won = raw.won;
  requireValue(raw.event === 'none' || raw.event === 'death' || raw.event === 'checkpoint' || raw.event === 'win',
    'Unknown event.');
  const event = raw.event;
  requireValue(raw.deathCause === null || raw.deathCause === 'void' || raw.deathCause === 'spikes'
    || raw.deathCause === 'pulse' || raw.deathCause === 'saw', 'Unknown deathCause.');
  const deathCause = raw.deathCause;
  requireValue(Array.isArray(raw.visited) && raw.visited.length <= world.checkpoints.length,
    'visited must be a bounded checkpoint prefix.');
  const history = raw.visited;
  requireValue(Reflect.ownKeys(history).length === history.length + 1, 'visited has unknown fields or holes.');
  const visited: string[] = [];
  for (let i = 0; i < history.length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(history, String(i));
    const checkpoint = world.checkpoints[i], key = `${checkpoint.x},${checkpoint.y}`;
    requireValue(!!descriptor && 'value' in descriptor && descriptor.value === key,
      'visited must be the exact ordered checkpoint prefix.');
    visited.push(key);
  }
  const expected = visited.length ? world.checkpoints[visited.length - 1] : world.spawn;
  const checkpointRaw = record(raw.checkpoint, 'checkpoint');
  keys(checkpointRaw, visited.length ? ['x', 'y', 'id', 'radius'] : ['x', 'y'], 'checkpoint');
  for (const key of Object.keys(expected)) {
    requireValue(checkpointRaw[key] === (expected as Record<string, unknown>)[key],
      'checkpoint must match the latest visited marker, or spawn.');
  }
  // Keep id/radius too: step stores the complete named marker, not just x/y.
  const checkpoint = Object.freeze({ ...checkpointRaw }) as Point;
  requireValue((deaths === 0) === (deathCause === null), 'Death count and persistent cause disagree.');
  requireValue(won === (event === 'win'), 'Win and event disagree.');
  requireValue((event === 'death') === (respawnTicks === RULES.respawnTicks), 'Death event and countdown disagree.');
  requireValue(!respawnTicks || (deaths > 0 && !won && stopped(velocity)
    && (event === 'none' || event === 'death')), 'Invalid respawn state.');
  requireValue(!won || stopped(velocity), 'A finished run must be stopped.');
  // Legacy deaths require full recovery intervals. Checkpoint Restart can skip
  // recovery without consuming a tick, but deaths and collections still consume
  // separate simulation ticks. Avoid unsafe products.
  const deathTick = respawnTicks ? tick - (RULES.respawnTicks - respawnTicks) : tick;
  const maximumDeaths = checkpointPuzzles(world) ? deathTick - visited.length - Number(won) : respawnTicks
    ? Math.floor((deathTick - 1 - visited.length) / (RULES.respawnTicks + 1)) + 1
    : Math.floor((tick - visited.length) / (RULES.respawnTicks + 1));
  requireValue(deathTick >= (respawnTicks ? 1 : 0) && deaths <= maximumDeaths
    && (!respawnTicks || patternOffset < deathTick),
    'Clock cannot contain the claimed deaths/recovery.');
  requireValue(visited.length <= tick, 'Clock cannot contain the claimed checkpoint history.');
  if (tick === 0) {
    requireValue(same(position, center(world.spawn)) && stopped(velocity) && !visited.length
      && !deaths && !respawnTicks && !won && event === 'none', 'Tick zero must be the initial state.');
  }

  const width = world.tiles[0].length, height = world.tiles.length;
  const outside = position.x < 0 || position.y < 0 || position.x >= width || position.y >= height;
  const overshoot = Math.hypot(Math.max(-position.x, 0, position.x - width),
    Math.max(-position.y, 0, position.y - height));
  requireValue(!outside || (respawnTicks > 0 && deathCause === 'void' && overshoot <= MAX_TRAVEL + EPSILON),
    'Position is outside reachable boundary-fall bounds.');
  requireValue(!wallAt(world, position), 'Position intersects a wall.');
  const state: State = Object.freeze({ tick, patternOffset, position, velocity, checkpoint,
    visited: Object.freeze(visited), deaths, respawnTicks, won, event, deathCause });
  if (respawnTicks) {
    requireValue(nearSafeFloor(world, position), 'Death position is unreachable from live floor in one step.');
    requireValue(lethalAt(world, position, deathTick - patternOffset, state) === deathCause,
      'Death cause does not match the death tick/position.');
  } else {
    // Respawn ticks skip hazard evaluation, but V2 spawn/checkpoint landings
    // are validated all-phase safe. Persistent deathCause need not be null.
    requireValue(!lethalAt(world, position, tick - patternOffset, state), 'Live position is lethal at this tick.');
  }
  if (event === 'checkpoint') {
    const latest = world.checkpoints[visited.length - 1];
    requireValue(!!latest && !respawnTicks && reachesCheckpoint(world, position, latest),
      'Checkpoint event is not at the latest eligible marker.');
  }
  const atUnlockedExit = visited.length === world.checkpoints.length
    && distance(position, center(world.goal)) < RULES.markerRadius;
  requireValue(won ? atUnlockedExit : !atUnlockedExit || respawnTicks > 0,
    'Finish position/progression and win flag disagree.');
  return state;
}

/**
 * Pure validation/copy boundary. Supply a world already validated by parseLevel.
 * Failure never returns a fallback state; callers retain the original source.
 */
export function validateRunSnapshot(world: Level, value: unknown): RunSnapshotResult {
  try {
    const raw = record(value, 'snapshot');
    const schemaVersion = integer(raw.schemaVersion, 'schemaVersion', 1);
    const worldVersion = integer(raw.worldVersion, 'worldVersion', 1);
    if (schemaVersion !== RUN_SNAPSHOT_VERSION || worldVersion !== 2 || world.version !== 2)
      return Object.freeze({ status: 'unsupported', reason: 'Unsupported snapshot schema or world version; V1 is legacy.' });
    keys(raw, ENVELOPE_KEYS, 'snapshot');
    const runId = id(raw.runId, 'runId', 128), worldId = id(raw.worldId, 'worldId', 60);
    const revision = integer(raw.revision, 'revision', 1);
    if (worldId !== world.id || revision !== world.revision)
      return Object.freeze({ status: 'incompatible', reason: 'Saved world ID/revision does not match the supplied world.' });
    const state = stateFrom(raw.state, world);
    return Object.freeze({ status: 'valid', snapshot: Object.freeze({
      schemaVersion, worldVersion, runId, worldId, revision, state,
    }) });
  } catch (error) {
    return Object.freeze({ status: 'corrupt', reason: error instanceof Error ? error.message : 'Invalid snapshot.' });
  }
}

/** The caller creates a stable run ID once, not on every save. No clock/RNG/I/O. */
export function createRunSnapshot(world: Level, runId: string, state: State): RunSnapshot {
  const result = validateRunSnapshot(world, { schemaVersion: RUN_SNAPSHOT_VERSION, worldVersion: world.version,
    runId, worldId: world.id, revision: world.version === 2 ? world.revision : 1, state });
  if (result.status !== 'valid') throw new Error(`${result.status}: ${result.reason}`);
  return result.snapshot;
}

/** Durable resume boundary, not the live pause/editor-return representation.
 * Validate BEFORE normalizing so Restart cannot conceal corrupt input.
 * Won and legacy snapshots retain their exact codec semantics. */
export function createCheckpointSnapshot(world: Level, runId: string, state: State): RunSnapshot {
  const live = createRunSnapshot(world, runId, state);
  return checkpointPuzzles(world) && !live.state.won
    ? createRunSnapshot(world, runId, restartCheckpoint(world, live.state)) : live;
}

// JSON.stringify loses -0, which step can legitimately produce with finite
// analog input. JSON number syntax supports -0 and JSON.parse preserves it.
function exactJSON(value: unknown): string {
  if (typeof value === 'number') return Object.is(value, -0) ? '-0' : JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(exactJSON).join(',')}]`;
  if (value !== null && typeof value === 'object')
    return `{${Object.entries(value).map(([key, item]) => `${JSON.stringify(key)}:${exactJSON(item)}`).join(',')}}`;
  return JSON.stringify(value);
}
function withinSize(source: string): boolean {
  return source.length <= MAX_RUN_SNAPSHOT_BYTES && new TextEncoder().encode(source).length <= MAX_RUN_SNAPSHOT_BYTES;
}
/** Revalidates before writing; invalid values throw, never become a new run. */
export function encodeRunSnapshot(world: Level, snapshot: unknown): string {
  const result = validateRunSnapshot(world, snapshot);
  if (result.status !== 'valid') throw new Error(`${result.status}: ${result.reason}`);
  const source = exactJSON(result.snapshot);
  requireValue(withinSize(source), 'Snapshot exceeds the 16 KiB UTF-8 limit.');
  return source;
}

/** Bounded JSON parsing; no migration, storage, input, or lifecycle side effects. */
export function decodeRunSnapshot(world: Level, source: string): RunSnapshotResult {
  if (typeof source !== 'string' || !withinSize(source))
    return Object.freeze({ status: 'corrupt', reason: 'Snapshot exceeds the 16 KiB UTF-8 limit or is not text.' });
  let value: unknown;
  try { value = parseUniqueJSON(source); }
  catch (error) {
    return Object.freeze({ status: 'corrupt', reason: error instanceof Error ? error.message : 'Invalid JSON.' });
  }
  return validateRunSnapshot(world, value);
}
