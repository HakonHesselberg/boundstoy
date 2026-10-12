import type { World } from '../core/level.ts';
import { parseUniqueJSON } from './json.ts';
import { createIndexedDBPort, PersistenceError, type Transaction, type TransactionPort } from './indexeddb.ts';
import { decodeRunSnapshot, encodeRunSnapshot, MAX_RUN_SNAPSHOT_BYTES, type RunSnapshot } from './run-snapshot.ts';
import { mergeWorldRecords, PROGRESS_KEY, DRAFT_KEY, readProgress, readWorldRecords,
  recordFinish, recordWorldFinish, validateWorldRecords, type Progress, type WorldRecords } from './storage.ts';

export const RUN_STORAGE_KEY = 'boundstoy.runs.v1';
export const RUN_STORAGE_LOCK = 'boundstoy.persistence.v1';
export const RECOVERY_KEY = 'boundstoy.recovery.v1';
export const MAX_RUN_STORAGE_BYTES = 1_048_576;
export type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;
/** Native navigator.locks satisfies this port. Never substitute a storage flag. */
export type LockPort = {
  request(name: string, options: { mode: 'exclusive'; ifAvailable: true },
    callback: (lock: object | null) => Promise<void>): Promise<void>;
};
export type FailureStatus = 'busy' | 'unsupported' | 'incompatible' | 'corrupt' | 'invalid'
  | 'storage-error' | 'lock-error' | 'released' | 'stale' | 'retired' | 'too-large';
export type Result<T> = Readonly<{ status: 'ok'; value: T }>
  | Readonly<{ status: FailureStatus; reason: string }>;
export type RunView = Readonly<{ records: WorldRecords; active: RunSnapshot | null }>;
export type LegacyView = Readonly<{ progress: Progress; draft: string | null }>;
export type RecoveryBytes = Readonly<Record<string, string | null>>;
export type RunLease = Readonly<{
  /** Read under the newly acquired lock, never a startup cache. */
  initial: RunView;
  read(): Promise<Result<RunView>>;
  /** Explicit new-run action only: fresh runId and tick zero. */
  replace(snapshot: RunSnapshot): Promise<Result<RunView>>;
  save(snapshot: RunSnapshot): Promise<Result<RunView>>;
  complete(snapshot: RunSnapshot): Promise<Result<RunView>>;
  mergeRecords(records: WorldRecords): Promise<Result<RunView>>;
  readLegacy(): Promise<Result<LegacyView>>;
  writeLegacyDraft(source: string | null): Promise<Result<LegacyView>>;
  recordLegacyFinish(id: string, ticks: number, deaths: number): Promise<Result<Progress>>;
  /** Invalidates this capability synchronously; resolves after native release. */
  release(): Promise<void>;
}>;
type Receipt = Readonly<{ worldId: string; revision: number; ticks: number; deaths: number }>;
type Retirement = Readonly<{ runId: string; completion: Receipt | null }>;
type Envelope = Readonly<{ version: 1; records: WorldRecords; active: string | null; retired: readonly Retirement[] }>;
type ResolveWorld = (id: string, revision: number) => World | undefined;
/** Explicit product retirement policy; unavailable identities are NOT obsolete by default. */
export type ObsoleteWorldRevision = Readonly<{ worldId: string; revision: number }>;

class Failure extends Error {
  status: FailureStatus;
  constructor(status: FailureStatus, reason: string) { super(reason); this.status = status; }
}
function fail(status: FailureStatus, reason: string): never { throw new Failure(status, reason); }
async function result<T>(action: () => Promise<T>): Promise<Result<T>> {
  try { return Object.freeze({ status: 'ok', value: await action() }); }
  catch (error) {
    return Object.freeze({ status: error instanceof Failure ? error.status : error instanceof PersistenceError ? 'storage-error' : 'invalid',
      reason: error instanceof Error ? error.message : String(error) });
  }
}
function bounded(source: string, max = MAX_RUN_STORAGE_BYTES) {
  return source.length <= max && new TextEncoder().encode(source).length <= max;
}
function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== keys.length || !keys.every(key => Object.hasOwn(value, key)))
    fail('corrupt', 'Missing or unknown storage fields.');
  return value as Record<string, unknown>;
}
const idValid = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.length <= max && /^[a-z0-9-]+$/.test(value);
const integer = (value: unknown, min: number): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= min;

/**
 * All cooperating writers use ONE lock, held throughout play AND pause.
 * Nonowners get busy (including record writers); retry explicitly, never drop
 * pending facts. No timers, unload acquisition, lock stealing or startup cache.
 */
export function createRunStorage(ports: { database?: TransactionPort; legacyStorage?: Pick<Storage, 'getItem'>; locks?: LockPort },
  resolveWorld: ResolveWorld, obsoleteWorldRevisions: readonly ObsoleteWorldRevision[] = []) {
  const { database, legacyStorage, locks } = ports;
  const obsolete = obsoleteWorldRevisions.map(identity => ({ ...identity }));
  const keys = [RUN_STORAGE_KEY, PROGRESS_KEY, DRAFT_KEY];
  function legacySource(key: string): string | null {
    try { return legacyStorage?.getItem(key) ?? null; }
    catch (error) { return fail('storage-error', `Legacy import failed: ${String(error)}`); }
  }
  function transact<T>(action: (tx: Transaction) => T): Promise<T> {
    return database!.transact(keys, tx => {
      // Import once, including explicit null markers. Never project back or
      // consult localStorage again after import. Original bytes remain intact.
      for (const key of keys) if (tx.get(key) === undefined) {
        tx.put(key, legacySource(key));
      }
      return action(tx);
    });
  }
  function put(tx: Transaction, key: string, source: string) {
    if (!bounded(source)) fail('too-large', 'Storage serialization exceeds the 1 MiB UTF-8 limit.');
    tx.put(key, source);
  }
  function activeIdentity(source: string) {
    if (!bounded(source, MAX_RUN_SNAPSHOT_BYTES)) fail('corrupt', 'Oversized active snapshot.');
    let raw: Record<string, unknown>;
    try {
      raw = parseUniqueJSON(source) as Record<string, unknown>;
      if (!raw || typeof raw !== 'object') fail('corrupt', 'Invalid active snapshot.');
    } catch (error) { return fail('corrupt', String(error)); }
    if (raw.schemaVersion !== 1 || raw.worldVersion !== 2) fail('unsupported', 'Unsupported active snapshot version.');
    object(raw, ['schemaVersion', 'worldVersion', 'runId', 'worldId', 'revision', 'state']);
    if (!idValid(raw.worldId, 60) || !integer(raw.revision, 1) || !idValid(raw.runId, 128))
      fail('corrupt', 'Invalid active run/world identity.');
    return { worldId: raw.worldId, revision: raw.revision, runId: raw.runId };
  }
  function decode(source: string): RunSnapshot {
    const raw = activeIdentity(source);
    const world = resolveWorld(raw.worldId, raw.revision);
    if (!world) fail('incompatible', 'Active world ID/revision is unavailable; preserve saved bytes.');
    const decoded = decodeRunSnapshot(world, source);
    if (decoded.status !== 'valid') fail(decoded.status, decoded.reason);
    return decoded.snapshot;
  }
  function read(tx: Transaction, discardObsolete = false): { envelope: Envelope; view: RunView } {
    const source = tx.get(RUN_STORAGE_KEY) ?? null;
    let envelope: Envelope;
    if (source === null) envelope = { version: 1, records: readWorldRecords(null), active: null, retired: [] };
    else {
      if (!bounded(source)) fail('corrupt', 'Oversized storage envelope.');
      let raw: Record<string, unknown>;
      try {
        const parsed = parseUniqueJSON(source);
        if (parsed && typeof parsed === 'object' && 'version' in parsed && parsed.version !== 1)
          fail('unsupported', 'Unsupported storage envelope version.');
        raw = object(parsed, ['version', 'records', 'active', 'retired']);
        if (raw.version !== 1) fail('corrupt', 'Invalid storage envelope version.');
        if (raw.active !== null && typeof raw.active !== 'string') fail('corrupt', 'Invalid active snapshot text.');
        const records = validateWorldRecords(raw.records);
        if (!Array.isArray(raw.retired)) fail('corrupt', 'Invalid retirement list.');
        const seen = new Set<string>();
        const retired = raw.retired.map(value => {
          const entry = object(value, ['runId', 'completion']);
          if (!idValid(entry.runId, 128) || seen.has(entry.runId)) fail('corrupt', 'Invalid/duplicate retired run ID.');
          seen.add(entry.runId);
          let completion: Receipt | null = null;
          if (entry.completion !== null) {
            const receipt = object(entry.completion, ['worldId', 'revision', 'ticks', 'deaths']);
            if (!idValid(receipt.worldId, 60) || !integer(receipt.revision, 1)
              || !integer(receipt.ticks, 1) || !integer(receipt.deaths, 0)) fail('corrupt', 'Invalid completion receipt.');
            completion = { worldId: receipt.worldId, revision: receipt.revision, ticks: receipt.ticks, deaths: receipt.deaths };
          }
          return { runId: entry.runId, completion };
        });
        envelope = { version: 1, records, active: raw.active as string | null, retired };
      } catch (error) {
        if (error instanceof Failure) throw error;
        return fail('corrupt', String(error));
      }
    }
    if (discardObsolete && envelope.active !== null) {
      const identity = activeIdentity(envelope.active);
      if (obsolete.some(item => item.worldId === identity.worldId && item.revision === identity.revision)) {
        if (envelope.retired.some(entry => entry.runId === identity.runId))
          fail('corrupt', 'Retired run cannot also be active.');
        // Validate against the old world when still available. If unavailable,
        // the explicit identity policy is authority to discard, not to migrate.
        if (resolveWorld(identity.worldId, identity.revision)) decode(envelope.active);
        envelope = { ...envelope, active: null,
          retired: [...envelope.retired, { runId: identity.runId, completion: null }] };
        put(tx, RUN_STORAGE_KEY, JSON.stringify(envelope));
      }
    }
    const active = envelope.active === null ? null : decode(envelope.active);
    if (active && envelope.retired.some(entry => entry.runId === active.runId))
      fail('corrupt', 'Retired run cannot also be active.');
    return { envelope, view: Object.freeze({ records: envelope.records, active }) };
  }
  function incoming(snapshot: RunSnapshot): { snapshot: RunSnapshot; encoded: string; world: World } {
    const world = resolveWorld(snapshot.worldId, snapshot.revision);
    if (!world) fail('incompatible', 'Incoming world ID/revision is unavailable.');
    const encoded = encodeRunSnapshot(world, snapshot);
    return { snapshot: decode(encoded), encoded, world };
  }
  function advance(previous: RunSnapshot | null, next: RunSnapshot, encoded: string, old: string | null) {
    if (!previous || previous.runId !== next.runId || previous.worldId !== next.worldId
      || previous.revision !== next.revision) fail('stale', 'Save does not match the stored active run.');
    const a = previous.state, b = next.state;
    if (b.tick < a.tick || b.deaths < a.deaths || b.visited.length < a.visited.length
      || (a.won && encoded !== old) || (b.tick === a.tick && encoded !== old))
      fail('stale', 'Snapshot moves backwards or rewrites an existing tick.');
  }
  function legacy(tx: Transaction): LegacyView {
    const source = tx.get(PROGRESS_KEY) ?? null;
    try {
      if (source !== null) {
        if (!bounded(source)) fail('corrupt', 'Oversized legacy progress.');
        parseUniqueJSON(source);
      }
      return { progress: readProgress(source), draft: tx.get(DRAFT_KEY) ?? null };
    } catch (error) { return fail('corrupt', String(error)); }
  }
  async function acquire(): Promise<Result<RunLease>> {
    if (!database || !locks) return { status: 'unsupported', reason: 'IndexedDB and native Web Locks are required.' };
    let publish!: (value: Result<RunLease>) => void;
    const acquired = new Promise<Result<RunLease>>(resolve => { publish = resolve; });
    let held = false, unlock: (() => void) | undefined;
    let request: Promise<void>;
    // The callback stays pending for the lease lifetime. The outer promise
    // resolves at acquisition, NOT when the native request finishes.
    try {
      request = locks.request(RUN_STORAGE_LOCK, { mode: 'exclusive', ifAvailable: true }, async lock => {
        if (!lock) { publish({ status: 'busy', reason: 'Another tab owns persistence.' }); return; }
        const initial = await result(() => transact(tx => read(tx, true)));
        if (initial.status !== 'ok') { publish(initial); return; }
        held = true;
        const lifetime = new Promise<void>(resolve => { unlock = resolve; });
        let queue: Promise<unknown> = Promise.resolve();
        function owned<T>(action: (tx: Transaction) => T): Promise<Result<T>> {
          const operation = queue.then(() => result(async () => {
            if (!held) fail('released', 'This lease has been released.');
            return transact(action);
          }));
          queue = operation;
          return operation;
        }
        function commit(tx: Transaction, envelope: Envelope): RunView {
          // active is codec text, never stringify simulation state.
          const view = Object.freeze({ records: envelope.records,
            active: envelope.active === null ? null : decode(envelope.active) });
          put(tx, RUN_STORAGE_KEY, JSON.stringify(envelope));
          return view;
        }
        const lease: RunLease = Object.freeze({
          initial: initial.value.view,
          read: () => owned(tx => read(tx).view),
          replace: value => owned(tx => {
            const { envelope, view } = read(tx), next = incoming(value);
            if (next.snapshot.state.tick !== 0 || next.snapshot.state.won) fail('invalid', 'A new run must start at tick zero.');
            if (envelope.retired.some(entry => entry.runId === next.snapshot.runId)) fail('retired', 'Run ID is already retired.');
            if (view.active?.runId === next.snapshot.runId) fail('stale', 'Replacement requires a fresh run ID.');
            const retired = view.active
              ? [...envelope.retired, { runId: view.active.runId, completion: null }] : envelope.retired;
            return commit(tx, { ...envelope, retired, active: next.encoded });
          }),
          save: value => owned(tx => {
            const { envelope, view } = read(tx), next = incoming(value);
            advance(view.active, next.snapshot, next.encoded, envelope.active);
            if (next.snapshot.state.won) fail('invalid', 'Use complete to atomically record and retire a win.');
            if (envelope.active === next.encoded) return view;
            return commit(tx, { ...envelope, active: next.encoded });
          }),
          complete: value => owned(tx => {
            const { envelope, view } = read(tx), next = incoming(value), snapshot = next.snapshot;
            if (!snapshot.state.won) fail('invalid', 'Completion requires a validated won snapshot.');
            const receipt: Receipt = { worldId: snapshot.worldId, revision: snapshot.revision,
              ticks: snapshot.state.tick, deaths: snapshot.state.deaths };
            const prior = envelope.retired.find(entry => entry.runId === snapshot.runId);
            if (prior) {
              if (JSON.stringify(prior.completion) === JSON.stringify(receipt)) return view;
              fail('retired', 'Run ID retired with a different result, or explicitly replaced.');
            }
            advance(view.active, snapshot, next.encoded, envelope.active);
            return commit(tx, { ...envelope, active: null,
              records: recordWorldFinish(envelope.records, next.world, receipt.ticks, receipt.deaths),
              retired: [...envelope.retired, { runId: snapshot.runId, completion: receipt }] });
          }),
          mergeRecords: records => owned(tx => {
            const { envelope } = read(tx);
            return commit(tx, { ...envelope, records: mergeWorldRecords(envelope.records, records) });
          }),
          readLegacy: () => owned(legacy),
          writeLegacyDraft: source => owned(tx => {
            const previous = legacy(tx);
            if (source !== null && (typeof source !== 'string' || !bounded(source)))
              fail('too-large', 'Draft exceeds the 1 MiB UTF-8 limit.');
            tx.put(DRAFT_KEY, source);
            return { ...previous, draft: source };
          }),
          recordLegacyFinish: (id, ticks, deaths) => owned(tx => {
            if (!idValid(id, 60) || !integer(ticks, 1) || !integer(deaths, 0)) fail('invalid', 'Invalid legacy finish.');
            const progress = recordFinish(legacy(tx).progress, id, ticks, deaths);
            put(tx, PROGRESS_KEY, JSON.stringify({ version: 1, runs: progress }));
            return progress;
          }),
          release: () => {
            held = false;
            void queue.finally(() => unlock?.());
            return request;
          },
        });
        publish({ status: 'ok', value: lease });
        try { await lifetime; } finally { held = false; }
      });
      request = request.catch(error => {
        held = false;
        unlock?.();
        publish({ status: 'lock-error', reason: `Web Lock request failed: ${String(error)}` });
      });
    } catch (error) {
      held = false;
      return { status: 'lock-error', reason: `Web Lock request failed: ${String(error)}` };
    }
    const answer = await acquired;
    // Failure returns only after the callback has released its native lock.
    if (answer.status !== 'ok') await request;
    return answer;
  }
  async function temporary<T>(action: (lease: RunLease) => Promise<Result<T>>): Promise<Result<T>> {
    const acquired = await acquire();
    if (acquired.status !== 'ok') return acquired;
    try { return await action(acquired.value); } finally { await acquired.value.release(); }
  }
  /** Read-only escape hatch when validation prevents acquisition. No reset/import. */
  async function exportRecovery(): Promise<Result<RecoveryBytes>> {
    if (!database || !locks) return { status: 'unsupported', reason: 'IndexedDB and native Web Locks are required.' };
    let answer: Result<RecoveryBytes> = { status: 'busy', reason: 'Another tab owns persistence.' };
    try {
      await locks.request(RUN_STORAGE_LOCK, { mode: 'exclusive', ifAvailable: true }, async lock => {
        if (lock) answer = await result(() => database.transact([...keys, RECOVERY_KEY], tx => Object.freeze(Object.fromEntries(
          [...keys, RECOVERY_KEY].map(key => [key, tx.get(key) === undefined ? legacySource(key) : tx.get(key)!])))));
      });
    } catch (error) { return { status: 'lock-error', reason: String(error) }; }
    return answer;
  }
  /** Explicit recovery only. Archive and reset are ONE transaction, never an
   * automatic migration. Legacy progress/drafts (even future versions) stay put.
   * The archive is bounded; inability to preserve it rejects the entire reset. */
  async function resetRecovery(): Promise<Result<void>> {
    if (!database || !locks) return { status: 'unsupported', reason: 'IndexedDB and native Web Locks are required.' };
    let answer: Result<void> = { status: 'busy', reason: 'Another tab owns persistence.' };
    try {
      await locks.request(RUN_STORAGE_LOCK, { mode: 'exclusive', ifAvailable: true }, async lock => {
        if (!lock) return;
        answer = await result(() => database.transact([...keys, RECOVERY_KEY], tx => {
          const sources = Object.fromEntries(keys.map(key =>
            [key, tx.get(key) === undefined ? legacySource(key) : tx.get(key)!]));
          const previous = tx.get(RECOVERY_KEY) ?? null;
          // Nest raw previous bytes rather than decoding/reformatting originals.
          put(tx, RECOVERY_KEY, JSON.stringify({ previous, sources }));
          for (const key of keys) if (tx.get(key) === undefined) tx.put(key, sources[key]);
          tx.put(RUN_STORAGE_KEY, null);
        }));
      });
    } catch (error) { return { status: 'lock-error', reason: String(error) }; }
    return answer;
  }
  return Object.freeze({
    acquire,
    exportRecovery,
    resetRecovery,
    read: () => temporary(lease => lease.read()),
    readLegacy: () => temporary(lease => lease.readLegacy()),
    writeLegacyDraft: (source: string | null) => temporary(lease => lease.writeLegacyDraft(source)),
    mergeRecords: (records: WorldRecords) => temporary(lease => lease.mergeRecords(records)),
    recordLegacyFinish: (id: string, ticks: number, deaths: number) =>
      temporary(lease => lease.recordLegacyFinish(id, ticks, deaths)),
  });
}

/** Opening is capability detection; acquisition reports actual open/import/transaction errors. */
export function openBrowserRunStorage(resolveWorld: ResolveWorld,
  obsoleteWorldRevisions: readonly ObsoleteWorldRevision[] = []): Result<ReturnType<typeof createRunStorage>> {
  if (typeof navigator === 'undefined' || !navigator.locks || typeof window === 'undefined')
    return { status: 'unsupported', reason: 'IndexedDB and native Web Locks are required.' };
  try {
    if (!window.indexedDB) return { status: 'unsupported', reason: 'IndexedDB is required.' };
    return { status: 'ok', value: createRunStorage({ database: createIndexedDBPort(window.indexedDB),
      legacyStorage: { getItem: key => window.localStorage.getItem(key) }, locks: navigator.locks },
    resolveWorld, obsoleteWorldRevisions) };
  }
  catch (error) { return { status: 'storage-error', reason: `Storage access failed: ${String(error)}` }; }
}
