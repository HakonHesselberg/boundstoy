import type { World } from '../core/level.ts';
import { parseUniqueJSON } from './json.ts';

export type Run = Readonly<{ ticks: number; deaths: number; cleanTicks?: number }>;
export type Progress = Readonly<Record<string, Run>>;
export const PROGRESS_KEY = 'boundstoy.progress.v1';
export const DRAFT_KEY = 'boundstoy.draft.v1';

export function readProgress(source: string | null): Progress {
  if (source === null) return {};
  const value: unknown = JSON.parse(source);
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1) {
    throw new Error('Unsupported progress version.');
  }
  if (!('runs' in value) || !value.runs || typeof value.runs !== 'object' || Array.isArray(value.runs)) {
    throw new Error('Saved runs are invalid.');
  }
  const runs: Record<string, Run> = {};
  for (const [id, run] of Object.entries(value.runs)) {
    if (!/^[a-z0-9-]{1,60}$/.test(id) || !run || typeof run !== 'object'
      || !Number.isSafeInteger(run.ticks) || run.ticks < 1
      || !Number.isSafeInteger(run.deaths) || run.deaths < 0) throw new Error('Saved run is invalid.');
    runs[id] = { ticks: run.ticks, deaths: run.deaths };
    if (run.cleanTicks !== undefined) {
      if (!Number.isSafeInteger(run.cleanTicks) || run.cleanTicks < run.ticks)
        throw new Error('Saved clean time is invalid.');
      if (run.deaths > 0) runs[id] = { ...runs[id], cleanTicks: run.cleanTicks };
    }
  }
  return runs;
}
export function bestClean(run: Run | undefined): number | undefined {
  return run?.deaths === 0 ? run.ticks : run?.cleanTicks;
}
export function runRank(run: Run | undefined, target: number) {
  const clean = bestClean(run);
  return !run ? 'Uncleared' : clean === undefined ? 'Clear' : clean <= target ? 'Mastered' : 'Clean';
}
export function recordFinish(progress: Progress, id: string, ticks: number, deaths: number): Progress {
  const previous = Object.hasOwn(progress, id) ? progress[id] : undefined;
  const best = previous && (previous.ticks < ticks || previous.ticks === ticks && previous.deaths <= deaths)
    ? previous : { ticks, deaths };
  const previousClean = bestClean(previous);
  const cleanTicks = deaths === 0 ? Math.min(previousClean ?? ticks, ticks) : previousClean;
  if (best === previous && cleanTicks === previousClean) return progress;
  return { ...progress, [id]: { ticks: best.ticks, deaths: best.deaths,
    ...(best.deaths > 0 && cleanTicks !== undefined ? { cleanTicks } : {}) } };
}

/** Separate from legacy progress and snapshot schemas. No browser storage policy. */
export const WORLD_RECORDS_VERSION = 1;
export type WorldIdentity = Pick<World, 'version' | 'id' | 'revision'>;
export type WorldRecord = Readonly<{ worldId: string; revision: number; run: Run }>;
export type WorldRecords = Readonly<{
  schemaVersion: typeof WORLD_RECORDS_VERSION;
  worldVersion: 2;
  records: readonly WorldRecord[];
}>;

function requireRecord(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`Invalid world records: ${message}`);
}
function dataObject(value: unknown, required: readonly string[], optional: readonly string[] = []): Record<string, unknown> {
  requireRecord(value !== null && typeof value === 'object' && !Array.isArray(value), 'expected an object.');
  const prototype = Object.getPrototypeOf(value);
  requireRecord(prototype === Object.prototype || prototype === null, 'expected a plain object.');
  const keys = Reflect.ownKeys(value);
  requireRecord(required.every(key => keys.includes(key))
    && keys.every(key => typeof key === 'string' && [...required, ...optional].includes(key)),
  'missing or unknown fields.');
  for (const key of keys) ownData(value, key);
  return value as Record<string, unknown>;
}
function ownData(value: object, key: PropertyKey): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  requireRecord(!!descriptor && descriptor.enumerable === true && 'value' in descriptor,
    `${String(key)} must be an own data field.`);
  return descriptor.value;
}
function recordInteger(value: unknown, min: number, label: string): number {
  requireRecord(typeof value === 'number' && Number.isSafeInteger(value) && value >= min,
    `${label} must be a safe integer >= ${min}.`);
  return value === 0 ? 0 : value;
}
function worldId(value: unknown): string {
  requireRecord(typeof value === 'string' && /^[a-z0-9-]{1,60}$/.test(value), 'invalid world ID.');
  return value;
}
function identity(world: WorldIdentity): Pick<WorldRecord, 'worldId' | 'revision'> {
  requireRecord(world !== null && typeof world === 'object', 'expected a V2 world identity.');
  requireRecord(ownData(world, 'version') === 2, 'only V2 worlds are supported.');
  return { worldId: worldId(ownData(world, 'id')),
    revision: recordInteger(ownData(world, 'revision'), 1, 'revision') };
}
function worldRun(value: unknown): Run {
  const raw = dataObject(value, ['ticks', 'deaths'], ['cleanTicks']);
  const ticks = recordInteger(raw.ticks, 1, 'ticks'), deaths = recordInteger(raw.deaths, 0, 'deaths');
  if (!Object.hasOwn(raw, 'cleanTicks')) return Object.freeze({ ticks, deaths });
  const cleanTicks = recordInteger(raw.cleanTicks, 1, 'cleanTicks');
  // At equal time a clean completion would itself be the best run.
  requireRecord(deaths > 0 && cleanTicks > ticks, 'cleanTicks requires an assisted best and a strictly slower clean time.');
  return Object.freeze({ ticks, deaths, cleanTicks });
}
function canonical(records: readonly WorldRecord[]): WorldRecords {
  return Object.freeze({ schemaVersion: WORLD_RECORDS_VERSION, worldVersion: 2,
    records: Object.freeze([...records].sort((a, b) =>
      a.worldId < b.worldId ? -1 : a.worldId > b.worldId ? 1 : a.revision - b.revision)) });
}

/** Strict copy/validation boundary; throws without replacing malformed data. */
export function validateWorldRecords(value: unknown): WorldRecords {
  const raw = dataObject(value, ['schemaVersion', 'worldVersion', 'records']);
  requireRecord(raw.schemaVersion === WORLD_RECORDS_VERSION && raw.worldVersion === 2, 'unsupported version.');
  requireRecord(Array.isArray(raw.records), 'records must be an array.');
  const entries = raw.records;
  requireRecord(Reflect.ownKeys(entries).length === entries.length + 1, 'records has holes or extra fields.');
  const seen = new Set<string>(), records: WorldRecord[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = dataObject(ownData(entries, String(i)), ['worldId', 'revision', 'run']);
    const id = worldId(entry.worldId), revision = recordInteger(entry.revision, 1, 'revision');
    const key = `${id}@${revision}`;
    requireRecord(!seen.has(key), 'duplicate world ID/revision.');
    seen.add(key);
    records.push(Object.freeze({ worldId: id, revision, run: worldRun(entry.run) }));
  }
  return canonical(records);
}

/** Null alone means no save. V1 progress is not migrated or accepted here. */
export function readWorldRecords(source: string | null): WorldRecords {
  if (source === null) return canonical([]);
  requireRecord(typeof source === 'string', 'expected JSON text.');
  return validateWorldRecords(parseUniqueJSON(source));
}

/** Validates before serializing, with deterministic ID/revision ordering. */
export function encodeWorldRecords(value: unknown): string {
  return JSON.stringify(validateWorldRecords(value));
}

/** Exact identity only: no fallback to older revisions or legacy course IDs. */
export function getWorldRecord(records: WorldRecords, world: WorldIdentity): Run | undefined {
  const key = identity(world);
  return validateWorldRecords(records).records.find(entry =>
    entry.worldId === key.worldId && entry.revision === key.revision)?.run;
}

function combineRuns(previous: Run | undefined, incoming: Run): Run {
  let progress: Progress = previous ? { run: previous } : {};
  progress = recordFinish(progress, 'run', incoming.ticks, incoming.deaths);
  const clean = bestClean(incoming);
  if (clean !== undefined) progress = recordFinish(progress, 'run', clean, 0);
  return Object.freeze({ ...progress.run });
}

/** Join independent best and clean facts, not last-writer-wins replacement. */
export function mergeWorldRecords(left: WorldRecords, right: WorldRecords): WorldRecords {
  const a = validateWorldRecords(left), b = validateWorldRecords(right);
  const merged = new Map<string, WorldRecord>();
  for (const entry of [...a.records, ...b.records]) {
    const key = `${entry.worldId}@${entry.revision}`, previous = merged.get(key);
    merged.set(key, Object.freeze({ worldId: entry.worldId, revision: entry.revision,
      run: combineRuns(previous?.run, entry.run) }));
  }
  return canonical([...merged.values()]);
}

/**
 * Caller supplies a completed run's total tick/death counters (including before
 * continuation). This is personal-record selection, not win/route validation.
 */
export function recordWorldFinish(records: WorldRecords, world: WorldIdentity, ticks: number, deaths: number): WorldRecords {
  const key = identity(world), run = worldRun({ ticks, deaths });
  return mergeWorldRecords(records, canonical([Object.freeze({ ...key, run })]));
}
