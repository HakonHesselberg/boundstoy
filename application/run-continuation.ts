import type { State } from '../core/simulation.ts';
import type { Level } from '../core/level.ts';
import { checkpointPuzzles } from '../core/world.ts';
import type { RunSnapshot } from './run-snapshot.ts';
import type { Result, RunLease, RunView } from './run-storage.ts';

export const SAVE_INTERVAL_TICKS = 120;
export function shouldSave(before: State, after: State, level?: Level): boolean {
  return after.tick !== before.tick && (['death', 'checkpoint', 'win'].includes(after.event)
    || !(level && checkpointPuzzles(level)) && (after.tick % SAVE_INTERVAL_TICKS === 0
      || before.respawnTicks > 0 && after.respawnTicks === 0));
}
export type SaveStatus = Readonly<{
  phase: 'ready' | 'saving' | 'saved' | 'error' | 'closing' | 'closed';
  reason?: string;
}>;
type Operation = () => Promise<Result<unknown>>;
const released = { status: 'released', reason: 'Persistence is closing or closed.' } as const;

/**
 * Serial application queue above the lease queue. close() rejects NEW work,
 * drains all accepted boundaries, THEN releases the native capability. Calling
 * lease.release immediately would cancel meaningful, not-yet-started saves.
 * No timers, renderer, input, wall clock, or unhandled fire-and-forget failures.
 */
export class RunContinuation {
  readonly lease: RunLease;
  view: RunView;
  status: SaveStatus = { phase: 'ready' };
  private tail: Promise<unknown> = Promise.resolve();
  private accepting = true;
  private pending = 0;
  private failed: Operation[] = [];
  private failure: Exclude<Result<unknown>, { status: 'ok' }> | null = null;
  private closing?: Promise<void>;
  private changed: (status: SaveStatus) => void;

  constructor(lease: RunLease, changed: (status: SaveStatus) => void = () => {}) {
    this.lease = lease; this.view = lease.initial; this.changed = changed;
  }
  private publish(status: SaveStatus) { this.status = Object.freeze(status); this.changed(this.status); }
  execute<T>(action: (lease: RunLease) => Promise<Result<T>>): Promise<Result<T>> {
    if (!this.accepting) return Promise.resolve(released);
    this.pending++;
    if (!this.failure) this.publish({ phase: 'saving' });
    const operation = () => action(this.lease);
    const result = this.tail.then(async (): Promise<Result<T>> => {
      let answer: Result<T>;
      if (this.failure) answer = this.failure;
      else {
        try { answer = await operation(); }
        catch (error) { answer = { status: 'storage-error', reason: String(error) }; }
      }
      if (answer.status !== 'ok') {
        this.failed.push(operation); this.failure = answer;
      }
      this.pending--;
      if (this.failure) this.publish({ phase: 'error', reason: `${this.failure.status}: ${this.failure.reason}` });
      else if (!this.pending) this.publish({ phase: 'saved' });
      return answer;
    });
    this.tail = result;
    return result;
  }
  private update(action: (lease: RunLease) => Promise<Result<RunView>>) {
    return this.execute(async lease => {
      const result = await action(lease);
      if (result.status === 'ok') this.view = result.value;
      return result;
    });
  }
  replace(snapshot: RunSnapshot) { return this.update(lease => lease.replace(snapshot)); }
  save(snapshot: RunSnapshot) {
    return this.update(lease => snapshot.state.won ? lease.complete(snapshot) : lease.save(snapshot));
  }
  retry(): Promise<Result<unknown>> {
    if (!this.accepting) return Promise.resolve(released);
    this.pending++;
    const result = this.tail.then(async (): Promise<Result<unknown>> => {
      const actions = this.failed.splice(0);
      this.failure = null;
      this.publish({ phase: 'saving' });
      let answer: Result<unknown> = { status: 'ok', value: undefined };
      for (const action of actions) {
        if (this.failure) { this.failed.push(action); continue; }
        try { answer = await action(); }
        catch (error) { answer = { status: 'storage-error', reason: String(error) }; }
        if (answer.status !== 'ok') { this.failure = answer; this.failed.push(action); }
      }
      this.pending--;
      if (this.failure) this.publish({ phase: 'error', reason: `${this.failure.status}: ${this.failure.reason}` });
      else if (!this.pending) this.publish({ phase: 'saved' });
      return answer;
    });
    this.tail = result;
    return result;
  }
  close(): Promise<void> {
    if (this.closing) return this.closing;
    this.accepting = false;
    this.closing = this.tail.then(async () => {
      this.publish({ phase: 'closing' });
      await this.lease.release();
      this.publish({ phase: 'closed' });
    });
    return this.closing;
  }
}
