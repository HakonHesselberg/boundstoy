/** Synchronous transaction body: never await while an IDB transaction is active. */
export type Transaction = {
  get(key: string): string | null | undefined;
  put(key: string, value: string | null): void;
};
export type TransactionPort = {
  /** Resolves only at transaction complete, rejects on any abort/request error. */
  transact<T>(keys: readonly string[], action: (transaction: Transaction) => T): Promise<T>;
  close(): void;
};
export const DATABASE_NAME = 'boundstoy.persistence';
export const DATABASE_STORE = 'state';
export class PersistenceError extends Error {}

/** No connection cache across operations: versionchange/closure cannot leave a stale handle. */
export function createIndexedDBPort(factory: IDBFactory, name = DATABASE_NAME): TransactionPort {
  let closed = false;
  const connections = new Set<IDBDatabase>();
  return {
    close() {
      closed = true;
      for (const connection of connections) connection.close();
    },
    async transact<T>(keys: readonly string[], action: (transaction: Transaction) => T): Promise<T> {
      if (closed) throw new PersistenceError('IndexedDB port is closed.');
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        let rejected = false;
        const fail = (reason: string) => { rejected = true; reject(new PersistenceError(reason)); };
        let request: IDBOpenDBRequest;
        try { request = factory.open(name, 1); }
        catch (error) { fail(`IndexedDB open failed: ${String(error)}`); return; }
        request.onblocked = () => fail('IndexedDB open blocked by another connection. Close older app tabs and retry.');
        request.onerror = () => fail(`IndexedDB open failed: ${String(request.error)}`);
        request.onupgradeneeded = () => {
          if (rejected || closed) { request.transaction!.abort(); return; }
          request.result.createObjectStore(DATABASE_STORE);
        };
        request.onsuccess = () => {
          if (rejected || closed) {
            request.result.close();
            fail('IndexedDB open was cancelled or port closed.');
          } else resolve(request.result);
        };
      });
      connections.add(db);
      try {
        return await new Promise<T>((resolve, reject) => {
          let tx: IDBTransaction, value: T, failure: unknown;
          const abort = (error: unknown) => {
            failure ??= error;
            try { tx.abort(); } catch { /* Already finished; completion checks failure. */ }
          };
          db.onversionchange = () => {
            abort(new PersistenceError('IndexedDB version changed; retry with a current app.'));
            db.close();
          };
          db.onclose = () => {
            const error = new PersistenceError('IndexedDB connection unexpectedly closed.');
            abort(error);
            reject(error);
          };
          try {
            tx = db.transaction(DATABASE_STORE, 'readwrite', { durability: 'strict' });
            tx.onabort = () => reject(failure ?? new PersistenceError(`IndexedDB transaction aborted: ${String(tx.error)}`));
            tx.onerror = event => {
              const request = event.target as IDBRequest;
              failure ??= new PersistenceError(`IndexedDB request failed: ${String(request.error ?? tx.error)}`);
            };
            tx.oncomplete = () => failure ? reject(failure) : resolve(value);
            const store = tx.objectStore(DATABASE_STORE), data = new Map<string, string | null | undefined>();
            let remaining = keys.length;
            if (!remaining) throw new Error('Transaction requires keys.');
            for (const key of keys) {
              const request = store.get(key);
              request.onsuccess = () => {
                try {
                  const source: unknown = request.result;
                  if (source !== undefined && source !== null && typeof source !== 'string')
                    throw new PersistenceError(`Unexpected IndexedDB value at ${key}; bytes preserved.`);
                  data.set(key, source);
                  if (--remaining) return;
                  value = action({
                    get: key => {
                      if (!data.has(key)) throw new Error('Undeclared transaction key.');
                      return data.get(key);
                    },
                    put: (key, source) => {
                      if (!data.has(key)) throw new Error('Undeclared transaction key.');
                      try { store.put(source, key); }
                      catch (error) { throw new PersistenceError(`IndexedDB write failed: ${String(error)}`); }
                      data.set(key, source);
                    },
                  });
                  // Catch accidental async bodies rather than committing a partial operation.
                  if (value && typeof (value as { then?: unknown }).then === 'function')
                    throw new Error('Transaction bodies must be synchronous.');
                } catch (error) { abort(error); }
              };
            }
          } catch (error) {
            if (tx!) abort(new PersistenceError(`IndexedDB transaction failed: ${String(error)}`));
            else reject(new PersistenceError(`IndexedDB transaction failed: ${String(error)}`));
          }
        });
      } finally {
        connections.delete(db);
        db.close();
      }
    },
  };
}
