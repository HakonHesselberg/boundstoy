import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { AFTERSHOCK_WORLD as world } from '../../data/aftershock-world.ts';
import { CHECKPOINT_WORLD_ROUTES as routes, type OpeningCommand } from '../../data/aftershock-world-replays.ts';
import { createState, step, restartCheckpoint, type State } from '../../core/simulation.ts';
import { createCheckpointSnapshot, createRunSnapshot, encodeRunSnapshot } from '../../application/run-snapshot.ts';
import { productionRecovery } from '../fixtures/checkpoint-production.ts';
import { completeEight } from '../fixtures/aftershock-world.ts';
import { RUN_STORAGE_KEY, RECOVERY_KEY } from '../../application/run-storage.ts';
import { PROGRESS_KEY, getWorldRecord, readWorldRecords, recordWorldFinish } from '../../application/storage.ts';
import { readStored, seedStored, settledPersistence } from './persistence.ts';
import { waitFor } from './runtime.ts';
import type { BrowserContext } from './scenarios.ts';

export function sliceRoute(commands: readonly OpeningCommand[], from: number, to = Infinity) {
  let cursor = 0;
  return commands.flatMap(command => {
    const start = cursor; cursor += command.ticks;
    const ticks = Math.max(0, Math.min(to, cursor) - Math.max(from, start));
    return ticks ? [{ ...command, ticks }] : [];
  });
}

export function worldDriver(context: BrowserContext) {
  const { page, signal, origin } = context;
  const evaluate = <T>(source: string) => page.evaluate<T>(source);
  const until = (label: string, source: string) =>
    waitFor(label, () => evaluate<boolean>(source), 15000, signal);
  const snapshot = () => evaluate<ReturnType<NonNullable<Window['__BOUNDSTOY__']>['snapshot']>>('__BOUNDSTOY__.snapshot()');
  const text = (id: string) => evaluate<string>(`document.getElementById(${JSON.stringify(id)}).textContent`);
  const click = async (id: string) => {
    const point = await evaluate<{ x: number; y: number }>(`(() => {
      const node = document.getElementById(${JSON.stringify(id)});
      node.scrollIntoView({block:'center'});
      const r = node.getBoundingClientRect();
      if (node.disabled || r.width < 43.999 || r.height < 43.999 || r.left < 0 || r.right > innerWidth
        || r.top < 0 || r.bottom > innerHeight || !node.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)))
        throw new Error('Inaccessible 44px action: ${id}');
      return {x:r.x+r.width/2,y:r.y+r.height/2};
    })()`);
    await page.call('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
    await page.call('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
  };
  const saved = async () => {
    await settledPersistence(page, signal);
    const persistence = await evaluate<{ ready: boolean; phase: string }>('__BOUNDSTOY__.persistence()');
    assert.equal(persistence.ready, true);
    assert.ok(['ready', 'saved'].includes(persistence.phase), `Not a durable save: ${persistence.phase}`);
    const source = await readStored(page, RUN_STORAGE_KEY, signal);
    assert.equal(typeof source, 'string');
    return JSON.parse(source!);
  };
  const run = async (commands: readonly OpeningCommand[]) => {
    let state = (await snapshot()).state;
    // Each advance draws the real 226-hazard scene. Bound each CDP request,
    // rather than exceeding the shared harness's per-request timeout.
    for (const c of commands)
      state = await evaluate<State>(`__BOUNDSTOY__.advance(${c.ticks},${JSON.stringify(c)})`);
    return state;
  };
  const newRun = async () => {
    // Real destructive action and real confirmation; never mutate debug state.
    await evaluate(`document.getElementById('new-run').click();
      if(document.getElementById('new-run-confirm').open) document.getElementById('new-run-accept').click()`);
    await until('New run transaction', `__BOUNDSTOY__.persistence().ready && !__BOUNDSTOY__.snapshot().paused`);
    // Reset once more, cancelling automatic play with loss of focus before commit.
    await evaluate(`document.getElementById('new-run').click();
      document.getElementById('new-run-accept').click(); window.dispatchEvent(new Event('blur'))`);
    await until('Paused exact fresh run committed', `__BOUNDSTOY__.persistence().ready && __BOUNDSTOY__.snapshot().state.tick === 0`);
    assert.equal((await snapshot()).paused, true);
    await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  };
  const restart = async () => {
    await evaluate(`document.getElementById('restart').click(); window.dispatchEvent(new Event('blur'));
      __BOUNDSTOY__.advance(0)`);
    await saved();
    return (await snapshot()).state;
  };
  let navigation = 0, loads = 0;
  page.on('Page.loadEventFired', () => { loads++; });
  const reload = async () => {
    const url = `${origin}/?debug&rough=${++navigation}`;
    const before = loads;
    await page.call('Page.navigate', { url });
    await waitFor('Production world document loaded', async () => loads > before, 15000, signal);
    await until('Production world reload', `location.href === ${JSON.stringify(url)} && Boolean(window.__BOUNDSTOY__)
      && __BOUNDSTOY__.persistence().ready && __BOUNDSTOY__.metrics().frames > 0`);
  };
  return { evaluate, until, snapshot, text, click, saved, run, newRun, restart, reload };
}

/** Production lifecycle/input/record acceptance, not a V1 replacement fixture. */
export async function checkRoughGame(context: BrowserContext) {
  const { page, signal, log, requests } = context;
  const d = worldDriver(context);
  assert.deepEqual((await d.snapshot()).level, world);
  const oldWorld = { ...completeEight, id: world.id };
  const oldSnapshot = createRunSnapshot(oldWorld, 'obsolete-aftershock', createState(oldWorld));
  const oldRecords = recordWorldFinish(readWorldRecords(null), oldWorld, 6000, 1);
  await seedStored(page, RUN_STORAGE_KEY, JSON.stringify({ version: 1, records: oldRecords,
    active: encodeRunSnapshot(oldWorld, oldSnapshot), retired: [] }), signal);
  await d.reload();
  const retired = await d.saved();
  assert.equal(retired.active, null, 'obsolete revision-1 active save is deleted on new-rule boot');
  assert.deepEqual(retired.records, oldRecords, 'revision-isolated records are retained');
  assert.deepEqual(retired.retired, [{ runId: oldSnapshot.runId, completion: null }]);
  assert.equal(await readStored(page, RECOVERY_KEY, signal), null, 'no unwanted migration/archive feature');
  log('PASS obsolete active save deletion on production boot, preserving earlier revision records.');
  assert.equal(await d.evaluate("document.getElementById('boundstoy').dataset.screen"), 'home', 'boot shows Home');
  assert.equal(await d.text('home-world-title'), world.name);
  assert.equal(await d.text('home-play'), 'Play →');
  assert.equal(await d.evaluate("document.getElementById('new-run').hidden"), true, 'no run to replace yet');
  assert.equal(await d.evaluate('document.querySelectorAll("#home-pips li").length'), 0, 'sections are never selectable');
  assert.equal(await d.evaluate("document.getElementById('mastery-target').hidden"), true);
  const legacyBefore = await readStored(page, PROGRESS_KEY, signal);
  await delay(250, undefined, { signal });
  await page.call('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  const requestCount = requests.length;
  await d.click('home-play');
  await d.until('Start commits before live play', '__BOUNDSTOY__.persistence().ready && !__BOUNDSTOY__.snapshot().paused');
  for (const [width, height] of [[1280, 900], [390, 844], [844, 390]]) {
    await page.call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await d.newRun();
    await d.click('primary-action');
    await page.call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
    await d.until('World keyboard moves', '__BOUNDSTOY__.snapshot().state.velocity.x > 0');
    await d.click('pause');
    const before = await d.snapshot();
    assert.deepEqual(before.input, { x: 0, y: 0 });
    await page.call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
    await delay(180, undefined, { signal });
    assert.deepEqual((await d.snapshot()).state, before.state);
    await d.click('overlay-exit');
    assert.equal(await d.evaluate("document.getElementById('boundstoy').dataset.screen"), 'home');
    assert.equal(await d.text('home-play'), 'Continue →');
    await d.click('new-run');
    assert.equal(await d.evaluate("document.getElementById('new-run-confirm').open"), true);
    const bytes = await readStored(page, RUN_STORAGE_KEY, signal);
    await d.click('new-run-cancel');
    assert.equal(await d.evaluate('document.activeElement.id'), 'new-run');
    assert.deepEqual((await d.snapshot()).state, before.state);
    assert.equal(await readStored(page, RUN_STORAGE_KEY, signal), bytes);
    await d.click('home-play');
    await d.until('Continue resumes the run', '!__BOUNDSTOY__.snapshot().paused');
    await page.call('Emulation.setTouchEmulationEnabled', { enabled: true });
    const point = await d.evaluate<{ x: number; y: number }>(`(() => {
      const r=document.querySelector('[data-direction="right"]').getBoundingClientRect();
      return {x:r.x+r.width/2,y:r.y+r.height/2};
    })()`);
    await page.call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, id: 1 }] });
    await d.until('World touch moves', '__BOUNDSTOY__.snapshot().input.x === 1');
    await page.call('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    assert.deepEqual((await d.snapshot()).input, { x: 0, y: 0 });
    await d.click('pause');
    assert.equal(await d.evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
    log(`PASS production ${width}x${height}: 44px navigation, keyboard/touch clearing, pause, cancelled replacement.`);
  }
  await d.newRun(); await d.saved();
  await d.evaluate(`window.__runWrites = 0;
    const nativePut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function(value, key) {
      if (key === ${JSON.stringify(RUN_STORAGE_KEY)}) window.__runWrites++;
      return nativePut.apply(this, arguments);
    };`);
  await d.run([{ ticks: 360, x: 0, y: 0 }]); await d.saved();
  assert.equal(await d.evaluate('window.__runWrites'), 0, 'no periodic writes during ordinary play');
  await d.click('overlay-settings'); await d.saved();
  assert.equal(await d.evaluate('window.__runWrites'), 1, 'pause saves elapsed totals');
  await d.click('settings-close');
  await d.newRun(); await d.saved();
  const writes = await d.evaluate<number>('window.__runWrites');
  await d.run(sliceRoute(routes.ordinary, 0, 507)); await d.saved();
  assert.equal(await d.evaluate('window.__runWrites'), writes + 1, 'collection commits exactly one boundary');
  log('PASS native write counts: no periodic saves, one pause boundary and one checkpoint boundary.');
  await d.newRun();
  const middle = await d.run(sliceRoute(routes.ordinary, 0, 850));
  await d.evaluate("document.getElementById('overlay-settings').click()");
  const stored = await d.saved();
  const durable = createCheckpointSnapshot(world, JSON.parse(stored.active).runId, middle);
  assert.deepEqual(JSON.parse(stored.active), durable);
  assert.notDeepEqual(durable.state.position, middle.position);
  assert.deepEqual((await d.snapshot()).input, { x: 0, y: 0 });
  assert.equal(requests.length, requestCount, 'loaded world needs no network');
  await page.call('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await d.reload();
  assert.deepEqual((await d.snapshot()).state, durable.state);
  assert.equal((await d.snapshot()).paused, true);
  assert.equal(await d.text('home-play'), 'Continue →');
  assert.match(await d.text('home-progress'), /^Section 2 of 8 · 00:07\.08 · 0 retries$/);
  // Every remaining puzzle is continued legally from a real checkpoint.
  let continued = durable.state;
  for (let index = 0; index < world.checkpoints.length; index++) {
    if (index > 0) {
      const expected = restartCheckpoint(world, continued);
      continued = await d.restart();
      assert.deepEqual(continued, expected);
      assert.equal(JSON.parse((await d.saved()).active).runId, durable.runId);
    }
    const recovery = productionRecovery(continued, index);
    continued = await d.run(recovery.commands);
    assert.deepEqual(continued, recovery.state);
  }
  assert.equal(continued.won, true); assert.equal(continued.deaths, 0);
  assert.match(await d.text('finish-mastery'), /Deathless completion achieved/);
  await d.saved();
  await d.newRun();
  const won = await d.run(routes.ordinary);
  assert.equal(won.won, true); assert.equal(won.deaths, 0); assert.equal(won.tick, 5752);
  assert.equal(await d.text('overlay-title'), 'World complete.');
  assert.match(await d.text('finish-mastery'), /Deathless completion achieved/);
  assert.equal(await d.evaluate("document.getElementById('mastery-target').hidden"), true);
  const first = await d.saved();
  assert.equal(first.active, null);
  assert.equal(getWorldRecord(first.records, world)?.ticks, 5752);
  assert.equal(await d.text('primary-action'), 'Home →');
  await d.click('primary-action');
  assert.equal(await d.evaluate("document.getElementById('boundstoy').dataset.screen"), 'home');
  assert.equal(await d.evaluate("document.getElementById('home-deathless').hidden"), false);
  await d.newRun();
  const fast = await d.run(routes.fast);
  assert.equal(fast.tick, 5648); assert.equal(fast.won, true); assert.equal(fast.deaths, 0);
  assert.match(await d.text('finish-comparison'), /Personal best/);
  const record = await d.saved();
  assert.equal(getWorldRecord(record.records, world)?.ticks, 5648);
  assert.equal(await readStored(page, PROGRESS_KEY, signal), legacyBefore, 'world does not rewrite old records');
  await d.reload();
  assert.equal(await d.text('home-play'), 'Play again →');
  assert.match(await d.text('home-best'), /^Best 00:47\.06 · 0 retries$/);
  log(`PASS checkpoint reload and deathless continued finish ${continued.tick}; ordinary 5752/faster 5648, persistent records and offline play.`);
}

export function roughWorldStops() {
  let state = createState(world);
  const stops = new Map<number, string>([[0, 'start'], [5752, 'complete']]);
  for (const c of routes.ordinary) for (let i = 0; i < c.ticks; i++) {
    state = step(world, state, c);
    if (state.event === 'checkpoint') {
      stops.set(state.tick, `checkpoint-${state.visited.length}`);
      stops.set(state.tick + 42, `section-${state.visited.length + 1}-pan`);
      stops.set(state.tick + 84, `section-${state.visited.length + 1}-revealed`);
    }
  }
  for (const tick of [2900, 4500, 5350]) stops.set(tick, `mixed-${tick}`);
  return [...stops].sort((a, b) => a[0] - b[0]);
}

/** Every image follows legal inputs on the actual registered production board. */
export async function captureRoughWorld(context: BrowserContext) {
  const { page, log } = context, d = worldDriver(context);
  await mkdir(resolve('artifacts/bt052'), { recursive: true });
  const out = await mkdtemp(resolve('artifacts/bt052/captures-'));
  const evidence: object[] = [];
  const total = 5752;
  const stops = roughWorldStops();
  for (const [width, height] of [[1280, 900], [390, 844], [844, 390]]) {
    await page.call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await d.newRun();
    let cursor = 0;
    for (const [tick, label] of stops) {
      const end = await d.run(sliceRoute(routes.ordinary, cursor, tick)); cursor = tick;
      assert.equal(end.tick, tick); assert.equal(end.deaths, 0);
      await d.saved();
      // HUD updates after native commits can reset hidden. Suppress only the
      // pause card for these explicitly paused, input-driven scene captures.
      await d.evaluate(`__BOUNDSTOY__.advance(0);
        document.getElementById('overlay').style.visibility = ${JSON.stringify(tick === total ? '' : 'hidden')}`);
      assert.equal(await d.evaluate(`getComputedStyle(document.getElementById('overlay')).visibility`),
        tick === total ? 'visible' : 'hidden');
      const camera = await d.evaluate('__BOUNDSTOY__.camera()');
      const image = await page.call<{ data: string }>('Page.captureScreenshot', { format: 'png' });
      const path = resolve(out, `${width}x${height}-${label}-t${tick}.png`);
      await writeFile(path, Buffer.from(image.data, 'base64'));
      evidence.push({ path, state: end, camera });
    }
    await d.evaluate("document.getElementById('overlay').style.visibility = ''");
  }
  await writeFile(resolve(out, 'endstates.json'), JSON.stringify(evidence, null, 2));
  log(`PASS production legal checkpoint/pan/reveal/mixed/completion captures: ${out}`);
}
