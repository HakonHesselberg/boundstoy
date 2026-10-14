import assert from 'node:assert/strict';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { main } from '../../scripts/browser-check.ts';
import { waitFor } from './runtime.ts';
import type { BrowserContext } from './scenarios.ts';
import type { State } from '../../core/simulation.ts';
import { RUN_STORAGE_KEY } from '../../application/run-storage.ts';
import { readStored, seedStored } from './persistence.ts';

async function checkContinuation({ page, origin, signal, log }: BrowserContext) {
  const evaluate = <T>(expression: string) => page.evaluate<T>(expression);
  const saved = () => waitFor('Committed run', () => evaluate(
    `window.__BOUNDSTOY__.persistence().phase === 'saved'`), 5000, signal);
  const snapshot = () => evaluate<{ state: State; paused: boolean; input: { x: number; y: number } }>(
    'window.__BOUNDSTOY__.snapshot()');
  let loads = 0;
  page.on('Page.loadEventFired', () => { loads++; });
  const reload = async (ready = true) => {
    const previous = loads;
    await page.call('Page.reload');
    await waitFor('Reloaded exact run', async () => loads > previous && await evaluate(
      `Boolean(window.__BOUNDSTOY__) && ${ready ? 'window.__BOUNDSTOY__.persistence().ready' : 'true'}`), 15000, signal);
  };
  assert.equal(await evaluate(`typeof window.__BOUNDSTOY__.persistence`), 'function');
  assert.equal(await evaluate(`document.getElementById('home-best').textContent`), 'No record yet');
  assert.equal(await evaluate(`document.getElementById('mastery-target').hidden`), true);
  await evaluate(`document.getElementById('primary-action').click()`);
  await saved();
  await evaluate(`window.__BOUNDSTOY__.advance(73, {x:1,y:0}); document.getElementById('pause').click()`);
  await saved();
  const before = await snapshot();
  await reload();
  const after = await snapshot();
  assert.deepEqual(after.state, before.state);
  assert.equal(after.paused, true);
  assert.deepEqual(after.input, { x: 0, y: 0 });
  log('PASS: moving run reloads exact committed state, paused with cleared input.');
  await evaluate(`document.getElementById('restart').click()`);
  assert.equal(await evaluate(`document.getElementById('new-run-confirm').open`), true);
  await evaluate(`document.getElementById('new-run-cancel').click()`);
  assert.deepEqual((await snapshot()).state, before.state);
  await reload();
  assert.deepEqual((await snapshot()).state, before.state);
  log('PASS: cancelled new run preserves state and committed bytes across reload.');
  await delay(250, undefined, { signal });
  assert.deepEqual((await snapshot()).state, before.state, 'paused reload never catches up with wall time');
  const bytes = await readStored(page, RUN_STORAGE_KEY, signal);
  await evaluate(`document.getElementById('home-settings').click(); document.getElementById('editor-tab').click();
    document.getElementById('playtest').click(); window.__BOUNDSTOY__.advance(120);
    document.getElementById('editor-return').click(); document.getElementById('play-tab').click();
    document.getElementById('home-play').click(); document.getElementById('pause').click();`);
  await saved();
  assert.deepEqual((await snapshot()).state, before.state);
  assert.equal(await readStored(page, RUN_STORAGE_KEY, signal), bytes);
  log('PASS: editor/playtest roundtrip preserves the exact campaign run and its saved bytes.');
  const boundary = (Math.floor(before.state.tick / 120) + 1) * 120;
  await evaluate(`window.__BOUNDSTOY__.advance(${boundary + 3 - before.state.tick})`);
  await saved();
  const periodic = JSON.parse(JSON.parse((await readStored(page, RUN_STORAGE_KEY, signal))!).active);
  assert.equal(periodic.state.tick, boundary);
  assert.equal((await snapshot()).state.tick, boundary + 3);
  log('PASS: periodic saving targets exactly 120 simulation ticks, not wall-clock time or every frame.');
  const checkpoint = await evaluate<State>(`(() => {
    const d=window.__BOUNDSTOY__; let s=d.snapshot().state;
    for(let i=0;i<1000 && !s.visited.length;i++) s=d.advance(1,{x:1,y:0});
    if (!s.visited.length) throw new Error('Legal approach did not reach checkpoint');
    return s;
  })()`);
  await saved();
  assert.deepEqual(JSON.parse(JSON.parse((await readStored(page, RUN_STORAGE_KEY, signal))!).active).state, checkpoint);

  await evaluate(`window.__BOUNDSTOY__.advance(2000, {x:1,y:0})`);
  await saved();
  const finish = (await snapshot()).state;
  assert.equal(finish.won, true); assert.equal(finish.deaths, 0);
  const completed = JSON.parse((await readStored(page, RUN_STORAGE_KEY, signal))!);
  assert.equal(completed.active, null);
  assert.deepEqual(completed.records.records[0].run, { ticks: finish.tick, deaths: 0 });
  await reload();
  assert.equal((await snapshot()).state.tick, 0);
  assert.equal((await snapshot()).paused, true);
  log('PASS: a continued zero-death finish atomically records deathless completion and retires the active save.');

  await evaluate(`document.getElementById('primary-action').click()`);
  await saved();
  const death = await evaluate<State>(`(() => {
    const d = window.__BOUNDSTOY__; let s = d.snapshot().state;
    for (let i=0; i<200 && !s.deaths && s.position.x<4.5; i++) s=d.advance(1,{x:1,y:0});
    for (let i=0; i<200 && !s.deaths && s.position.y<5.5; i++) s=d.advance(1,{x:0,y:1});
    for (let i=0; i<240 && !s.deaths; i++) s=d.advance(1);
    if (!s.deaths) throw new Error('The legal hazard approach did not die');
    return s;
  })()`);
  await saved();
  assert.deepEqual(JSON.parse(JSON.parse((await readStored(page, RUN_STORAGE_KEY, signal))!).active).state, death);
  const dying = await evaluate<State>(`(() => {
    const s=window.__BOUNDSTOY__.advance(17); document.getElementById('pause').click(); return s;
  })()`);
  assert.ok(dying.respawnTicks > 0); assert.equal(dying.deaths, 1); assert.equal(dying.patternOffset, 0);
  await saved(); await reload();
  assert.deepEqual((await snapshot()).state, dying);
  await evaluate(`window.__BOUNDSTOY__.advance(5);
    window.loseExtension = document.querySelector('#viewport canvas').getContext('webgl2').getExtension('WEBGL_lose_context');
    window.loseExtension.loseContext();`);
  await waitFor('Graphics gate freezes run', () => evaluate(`window.__BOUNDSTOY__.graphics().status === 'lost'`), 5000, signal);
  await saved();
  const lost = (await snapshot()).state;
  assert.equal(lost.tick, dying.tick + 5);
  assert.deepEqual(JSON.parse(JSON.parse((await readStored(page, RUN_STORAGE_KEY, signal))!).active).state, lost);
  await evaluate(`document.getElementById('primary-action').click()`);
  assert.deepEqual((await snapshot()).state, lost);
  await delay(150, undefined, { signal });
  await evaluate(`window.loseExtension.restoreContext()`);
  await waitFor('Restored graphics stay paused', () => evaluate(`window.__BOUNDSTOY__.graphics().status === 'restored'`), 5000, signal);
  assert.deepEqual((await snapshot()).state, lost);
  await reload();
  assert.deepEqual((await snapshot()).state, lost);
  log('PASS: mid-respawn and context-loss snapshots preserve exact ticks, phase, deaths and position.');

  await evaluate(`window.continuationCacheProbe = true`);
  const { targetInfo } = await page.call<{ targetInfo: { targetId: string } }>('Target.getTargetInfo');
  const other = await page.call<{ targetId: string }>('Target.createTarget', { url: `${origin}/?debug&second-tab`, background: false });
  const second = await page.connectTarget(other.targetId, signal);
  try {
    await second.call('Runtime.enable');
    await waitFor('Second tab sees ownership conflict', () => second.evaluate(
      `document.getElementById('save-recovery')?.open && document.getElementById('save-copy').textContent.includes('busy')`), 15000, signal);
    const hidden = (await snapshot()).state;
    await delay(200, undefined, { signal });
    assert.deepEqual((await snapshot()).state, hidden);
    await second.evaluate(`document.getElementById('primary-action').click()`);
    assert.equal(await second.evaluate(`window.__BOUNDSTOY__.snapshot().state.tick`), 0);
    await page.call('Page.navigate', { url: 'about:blank' });
    await waitFor('Closed owner releases its native lock', () => second.evaluate(
      `navigator.locks.query().then(value => value.held.length === 0)`), 5000, signal);
    await second.evaluate(`document.getElementById('save-retry').click()`);
    await waitFor('Next owner restores committed run', () => second.evaluate(
      `window.__BOUNDSTOY__.persistence().ready && !document.getElementById('save-recovery').open`), 5000, signal);
    assert.deepEqual(await second.evaluate(`window.__BOUNDSTOY__.snapshot().state`), hidden);
    assert.equal(await second.evaluate(`window.__BOUNDSTOY__.snapshot().paused`), true);
    log('PASS: a real second tab cannot write or resume; after owner closure it acquires and restores the latest state.');
  } finally {
    second.close();
    await page.call('Target.closeTarget', { targetId: other.targetId });
    await page.call('Target.activateTarget', { targetId: targetInfo.targetId });
  }
  const history = await page.call<{ currentIndex: number; entries: { id: number }[] }>('Page.getNavigationHistory');
  await page.call('Page.navigateToHistoryEntry', { entryId: history.entries[history.currentIndex - 1].id });
  await waitFor('Original tab reacquires', () => evaluate(`Boolean(window.__BOUNDSTOY__?.persistence().ready)`), 15000, signal);
  assert.deepEqual((await snapshot()).state, lost);
  const cached = await evaluate(`window.continuationCacheProbe === true`);
  log(cached ? 'PASS: native BFCache restoration reacquires ownership and restores the exact paused run.'
    : 'SKIP: Chromium did not retain this document in BFCache; history navigation reloaded the exact paused save.');
  await evaluate(`window.dispatchEvent(new PageTransitionEvent('pagehide', {persisted:true}));
    window.dispatchEvent(new PageTransitionEvent('pageshow', {persisted:true}));`);
  await waitFor('Persisted lifecycle handlers reacquire', () => evaluate(`window.__BOUNDSTOY__.persistence().ready`), 5000, signal);
  assert.deepEqual((await snapshot()).state, lost);
  assert.equal((await snapshot()).paused, true);
  log('PASS: explicit persisted pagehide/pageshow handlers drain saves and reacquire without changing state (not a native BFCache claim).');

  await evaluate(`(() => {
    const original = IDBObjectStore.prototype.put;
    window.restoreWrite = () => { IDBObjectStore.prototype.put = original; };
    IDBObjectStore.prototype.put = function(...args) { throw new DOMException('Injected quota rejection', 'QuotaExceededError'); };
    window.__BOUNDSTOY__.advance(121); document.getElementById('pause').click();
  })()`);
  await waitFor('Write failure remains visible', () => evaluate(
    `window.__BOUNDSTOY__.persistence().phase === 'error' && document.getElementById('save-recovery').open`), 5000, signal);
  const failed = (await snapshot()).state;
  assert.match(await evaluate<string>(`document.getElementById('save-copy').textContent`), /QuotaExceededError/);
  await evaluate(`window.restoreWrite(); document.getElementById('save-retry').click()`);
  await saved();
  assert.deepEqual(JSON.parse(JSON.parse((await readStored(page, RUN_STORAGE_KEY, signal))!).active).state, failed);
  await reload();
  assert.deepEqual((await snapshot()).state, failed);
  log('PASS: injected write rejection visibly freezes play; retry commits the latest safe state without resetting deaths.');
  const oldId = await evaluate<string>(`window.__BOUNDSTOY__.persistence().runId`);
  await evaluate(`document.getElementById('restart').click()`);
  assert.equal(await evaluate(`document.getElementById('new-run-confirm').open`), true);
  await evaluate(`document.getElementById('new-run-accept').click(); window.dispatchEvent(new Event('blur'));`);
  await saved();
  const replacement = JSON.parse((await readStored(page, RUN_STORAGE_KEY, signal))!);
  assert.notEqual(JSON.parse(replacement.active).runId, oldId);
  assert.ok(replacement.retired.some((item: { runId: string }) => item.runId === oldId));
  assert.equal((await snapshot()).state.tick, 0);
  assert.equal((await snapshot()).state.deaths, 0);
  assert.equal((await snapshot()).paused, true, 'blur invalidates a pending post-commit resume intent');
  log('PASS: confirmed replacement retires its old identity; focus loss during the commit prevents automatic play.');

  const intact = await readStored(page, RUN_STORAGE_KEY, signal);
  await seedStored(page, RUN_STORAGE_KEY, '{broken original', signal);
  await reload(false);
  assert.equal(await evaluate(`document.getElementById('save-recovery').open`), true);
  assert.equal(await readStored(page, RUN_STORAGE_KEY, signal), '{broken original');
  await seedStored(page, RUN_STORAGE_KEY, intact, signal);
  await evaluate(`document.getElementById('save-retry').click()`);
  await waitFor('Repaired save reacquired', () => evaluate(`window.__BOUNDSTOY__.persistence().ready`), 5000, signal);
  const incompatible = JSON.parse(intact!), active = JSON.parse(incompatible.active);
  active.revision++; incompatible.active = JSON.stringify(active);
  await seedStored(page, RUN_STORAGE_KEY, JSON.stringify(incompatible), signal);
  await reload(false);
  assert.match(await evaluate<string>(`document.getElementById('save-copy').textContent`), /incompatible/);
  assert.equal(await readStored(page, RUN_STORAGE_KEY, signal), JSON.stringify(incompatible));
  await evaluate(`document.getElementById('save-memory').click()`);
  await waitFor('Explicit memory-only choice', () => evaluate(`window.__BOUNDSTOY__.persistence().phase === 'memory'`), 5000, signal);
  await evaluate(`document.getElementById('primary-action').click(); window.__BOUNDSTOY__.advance(121)`);
  assert.equal((await snapshot()).state.tick, 121);
  assert.equal(await readStored(page, RUN_STORAGE_KEY, signal), JSON.stringify(incompatible));
  log('PASS: corrupt/incompatible data stays intact; explicit memory-only play never claims or writes a save.');
  await evaluate(`document.getElementById('save-status').click()`);
  let confirming = false;
  page.on('Page.javascriptDialogOpening', () => { confirming = true; });
  const reset = evaluate(`document.getElementById('save-reset').click()`);
  await waitFor('Explicit reset confirmation', async () => confirming, 5000, signal);
  await page.call('Page.handleJavaScriptDialog', { accept: true });
  await reset;
  await waitFor('Reset reopens saving', () => evaluate(`window.__BOUNDSTOY__.persistence().ready
    && window.__BOUNDSTOY__.persistence().phase !== 'memory' && !document.getElementById('save-recovery').open`), 5000, signal);
  assert.equal(await readStored(page, RUN_STORAGE_KEY, signal), null);
  const archive = JSON.parse((await readStored(page, 'boundstoy.recovery.v1', signal))!);
  assert.equal(archive.sources[RUN_STORAGE_KEY], JSON.stringify(incompatible));
  assert.equal((await snapshot()).state.tick, 0);
  log('PASS: explicit reset archives original bytes atomically and starts no run automatically.');

  const injected = await page.call<{ identifier: string }>('Page.addScriptToEvaluateOnNewDocument', { source: `
    Object.defineProperty(window, 'indexedDB', { configurable: true, get() {
      throw new DOMException('Injected denied storage', 'SecurityError');
    } });
  ` });
  try {
    await reload(false);
    assert.match(await evaluate<string>(`document.getElementById('save-copy').textContent`), /Storage access failed/);
    assert.equal(await evaluate(`document.getElementById('save-export').disabled`), true);
    await evaluate(`document.getElementById('save-memory').click()`);
    await waitFor('Denied storage permits explicit memory play', () => evaluate(`window.__BOUNDSTOY__.persistence().phase === 'memory'`), 5000, signal);
    await evaluate(`document.getElementById('primary-action').click(); window.__BOUNDSTOY__.advance(120)`);
    assert.equal((await snapshot()).state.tick, 120);
  } finally {
    await page.call('Page.removeScriptToEvaluateOnNewDocument', injected);
  }
  log('PASS: denied storage has an explicit working memory-only path, never a saved claim. Native quota exhaustion is not certified.');
}

const root = fileURLToPath(new URL('../../', import.meta.url));
await mkdir(join(root, 'artifacts/continuation'), { recursive: true });
const evidence = await mkdtemp(join(root, 'artifacts/continuation/run-'));
const bundle = join(evidence, 'bundle');
await build({
  root, configFile: false, logLevel: 'warn',
  plugins: [{
    name: 'continuation-test-registry',
    load(id) {
      if (id === join(root, 'data/levels.ts')) return `
        import { worldFixture } from ${JSON.stringify(join(root, 'tests/fixtures/world.ts'))};
        export const LEVELS = [worldFixture({ id: 'constructor' })];
        export const MASTERY_TARGETS = {};
        export const COURSE_LESSONS = {};
      `;
    },
  }],
  build: { outDir: bundle },
});
console.log(`Continuation application fixture: ${evidence}`);
await main(process.argv.slice(2), checkContinuation, bundle);
