import { DATABASE_NAME, DATABASE_STORE } from '../../application/indexeddb.ts';
import { waitFor, type Cdp } from './runtime.ts';

export async function settledPersistence(page: Cdp, signal: AbortSignal) {
  await waitFor('Persistence transaction completion', () => page.evaluate(`(() => {
    const text = document.getElementById('save-status')?.textContent;
    return text && text !== 'Saving...' && text !== 'Loading save...';
  })()`), 5000, signal);
}

function transaction(key: string, write: boolean, value: string | null = null) {
  return `new Promise((resolve, reject) => {
    const open = indexedDB.open(${JSON.stringify(DATABASE_NAME)});
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result, tx = db.transaction(${JSON.stringify(DATABASE_STORE)}, ${JSON.stringify(write ? 'readwrite' : 'readonly')});
      const store = tx.objectStore(${JSON.stringify(DATABASE_STORE)});
      const request = ${write ? `store.put(${JSON.stringify(value)}, ${JSON.stringify(key)})` : `store.get(${JSON.stringify(key)})`};
      tx.oncomplete = () => { db.close(); resolve(${write ? 'null' : 'request.result ?? null'}); };
      tx.onabort = () => { db.close(); reject(tx.error || new Error('Transaction aborted')); };
    };
  })`;
}

export async function readStored(page: Cdp, key: string, signal: AbortSignal): Promise<string | null> {
  await settledPersistence(page, signal);
  return page.evaluate(transaction(key, false));
}

/** Test setup only: seed committed prior-version data before reloading the app. */
export async function seedStored(page: Cdp, key: string, value: string | null, signal: AbortSignal) {
  await settledPersistence(page, signal);
  await page.evaluate(transaction(key, true, value));
}
