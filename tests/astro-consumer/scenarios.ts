import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { LEVELS } from '../../data/levels.ts';
import { REPLAYS } from '../../data/replays.ts';
import { PROGRESS_KEY } from '../../application/storage.ts';
import { Cdp, waitFor } from '../browser/runtime.ts';
import type { Inventory } from './fixture.ts';

type Snapshot = ReturnType<NonNullable<Window['__BOUNDSTOY__']>['snapshot']>;
type Context = {
  page: Cdp; origin: string; base: string; files: Inventory; signal: AbortSignal;
  requests: string[]; evidence: string; log: (message: string) => void; settled: () => Promise<unknown>;
};

export async function checkConsumer({ page, origin, base, files, signal, requests, evidence, log, settled }: Context) {
  const frame = 'document.querySelector("iframe")';
  const game = <T>(source: string) => page.evaluate<T>(
    `(() => { const window = globalThis.${frame}.contentWindow, document = window.document; return (${source}); })()`);
  const snapshot = () => game<Snapshot>('window.__BOUNDSTOY__.snapshot()');
  const text = (id: string) => game<string>(`document.getElementById(${JSON.stringify(id)}).textContent`);
  const saved = () => game<string | null>(`window.localStorage.getItem(${JSON.stringify(PROGRESS_KEY)})`);
  const pause = (ms: number) => delay(ms, undefined, { signal });
  const until = <T>(label: string, probe: () => Promise<T | false | null>) => waitFor(label, probe, 10_000, signal);
  const keyCodes: Record<string, [string, number]> = {
    ArrowRight: ['ArrowRight', 39], KeyD: ['d', 68], KeyR: ['r', 82],
    Space: [' ', 32], Escape: ['Escape', 27], Tab: ['Tab', 9], Enter: ['Enter', 13],
  };
  async function key(code: string, down: boolean) {
    const [key, virtualKey] = keyCodes[code];
    await page.call('Input.dispatchKeyEvent', {
      type: down ? 'keyDown' : 'keyUp', code, key,
      windowsVirtualKeyCode: virtualKey, nativeVirtualKeyCode: virtualKey,
      ...(down && code === 'Enter' ? { text: '\r', unmodifiedText: '\r' } : {}),
    });
  }
  async function press(code: string) { await key(code, true); await key(code, false); }
  async function click(selector: string, inside = true) {
    const point = await page.evaluate<{ x: number; y: number }>(`(() => {
      const frame = ${frame}, doc = ${inside ? 'frame.contentDocument' : 'document'};
      const node = doc.querySelector(${JSON.stringify(selector)});
      if (!node || node.disabled || !node.getClientRects().length) throw new Error('Unavailable control: ${selector}');
      ${inside ? "frame.scrollIntoView({block: 'center'});" : ''}
      node.scrollIntoView({block: 'center'});
      const r = node.getBoundingClientRect(), f = ${inside ? 'frame.getBoundingClientRect()' : '{x: 0, y: 0}'};
      const localX = r.x + r.width / 2, localY = r.y + r.height / 2;
      const x = f.x + localX, y = f.y + localY;
      if (!node.contains(doc.elementFromPoint(localX, localY))) throw new Error('Obscured control: ${selector}');
      if (x < 0 || x >= innerWidth || y < 0 || y >= innerHeight) throw new Error('Clipped control: ${selector}');
      return {x, y};
    })()`);
    await page.call('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
    await page.call('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
  }
  const offline = (value: boolean) => page.call('Network.emulateNetworkConditions', {
    offline: value, latency: 0, downloadThroughput: -1, uploadThroughput: -1,
  });
  async function navigate(debug: boolean) {
    await offline(false);
    const url = `${origin}${base}${debug ? 'debug/index.html' : 'index.html'}`;
    const result = await page.call<{ errorText?: string }>('Page.navigate', { url });
    assert.equal(result.errorText, undefined);
    await until('Compiled Astro host document', () => page.evaluate<boolean>(
      `location.href === ${JSON.stringify(url)} && document.readyState === 'complete' && Boolean(${frame})`));
    await page.evaluate(`${frame}.scrollIntoView({block: 'center'})`);
    await until('Lazy production iframe boot', () => game<boolean>(
      `document.readyState === 'complete' && Boolean(document.querySelector('#viewport canvas')) &&
       !document.getElementById('primary-action').disabled &&
       ${debug ? 'Boolean(window.__BOUNDSTOY__)' : 'typeof window.__BOUNDSTOY__ === "undefined"'}`));
    await pause(300);
    await settled();
    assert.equal(await page.evaluate(`${frame}.getAttribute('src')`),
      `${base}games/boundstoy/index.html${debug ? '?debug' : ''}`);
    assert.equal(await page.evaluate(`${frame}.title`),
      debug ? 'Boundstoy Astro verification' : 'Boundstoy - a playground for momentum');
    assert.equal(await game('window.location.pathname'), `${base}games/boundstoy/index.html`);
    assert.equal(await page.evaluate(`${frame}.loading`), 'lazy');
    assert.equal(await page.evaluate(`${frame}.allowFullscreen`), true);
    assert.equal(await page.evaluate(`${frame}.allow`), 'fullscreen');
    assert.equal(await game('document.cookie'), '');
    assert.equal(await page.evaluate('document.cookie'), '');
    assert.deepEqual(await page.evaluate('navigator.serviceWorker.getRegistrations().then(items => items.map(item => item.scope))'), []);
    assert.deepEqual(await game('window.navigator.serviceWorker.getRegistrations().then(items => items.map(item => item.scope))'), []);
    await page.evaluate(`window.__hostKeys = [];
      document.addEventListener('keydown', event => window.__hostKeys.push({code: event.code, prevented: event.defaultPrevented}));`);
  }
  async function screenshot(name: string) {
    const capture = await page.call<{ data: string }>('Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: false,
    });
    await writeFile(join(evidence, name), Buffer.from(capture.data, 'base64'));
  }

  await page.call('Emulation.setDeviceMetricsOverride', {
    width: 1280, height: 1400, deviceScaleFactor: 1, mobile: false,
  });
  await navigate(false);
  assert.equal(await saved(), null, 'Fresh origin has no inherited progress.');
  for (const [name, hash] of Object.entries(files)) {
    const response = await fetch(`${origin}${base}games/boundstoy/${name}`, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
    });
    assert.equal(response.status, 200, `${base}: ${name} is actually served`);
    assert.equal(createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'), hash, name);
    if (/\.(js|css)$/.test(name)) assert.ok(requests.includes(`${origin}${base}games/boundstoy/${name}`));
  }
  assert.ok(requests.some(url => new URL(url).pathname.startsWith(`${base}_astro/`)), 'Astro compiled and served the host stylesheet.');
  await offline(true);
  const ordinaryRequests = requests.length;
  await click('#primary-action');
  assert.equal(await game('document.activeElement.id'), 'viewport');
  const timer = await text('timer');
  await key('ArrowRight', true);
  await until('Ordinary non-debug offline game runs', async () => await text('timer') !== timer);
  await key('ArrowRight', false); await press('Space');
  const pausedTimer = await text('timer');
  await pause(150);
  assert.equal(await text('timer'), pausedTimer);
  assert.equal(await game('typeof window.__BOUNDSTOY__'), 'undefined');
  assert.equal(requests.length, ordinaryRequests, 'Ordinary play has no additional network dependency.');
  await screenshot('ordinary.png');
  log(`PASS ${base}: default wrapper, lazy non-debug iframe, all production bytes/notices and Astro CSS; ordinary offline play.`);

  await navigate(true);
  assert.equal(await saved(), null);
  assert.ok(await game<boolean>('window.__BOUNDSTOY__.metrics().triangles > 0'), 'The real production renderer submitted geometry.');
  await offline(true);
  const loadedRequests = requests.length;
  await click('#host-before', false);
  const initial = await snapshot();
  for (const code of ['ArrowRight', 'Space', 'KeyR', 'Escape']) await press(code);
  assert.deepEqual((await snapshot()).state, initial.state, 'Host keys cannot move/restart the iframe game.');
  assert.equal(await game("document.getElementById('game-menu').open"), false, 'Host Escape cannot open the iframe menu.');
  assert.deepEqual(await page.evaluate('window.__hostKeys.map(event => event.code)'), ['ArrowRight', 'Space', 'KeyR', 'Escape']);
  assert.equal(await page.evaluate('window.__hostKeys.some(event => event.prevented)'), false, 'Game cannot suppress host controls.');
  await press('Tab');
  assert.equal(await page.evaluate(`document.activeElement === ${frame}`), true, 'Native Tab enters the compiled iframe.');
  for (let i = 0; i < 12 && !['primary-action', 'viewport'].includes(await game<string>('document.activeElement.id')); i++) {
    await press('Tab');
  }
  assert.ok(['primary-action', 'viewport'].includes(await game<string>('document.activeElement.id')), 'Keyboard reaches Play.');
  await press('Enter');
  assert.equal((await snapshot()).started, true);
  assert.equal((await snapshot()).paused, false);
  assert.equal(await game('document.activeElement.id'), 'viewport');
  const hostKeys = await page.evaluate<number>('window.__hostKeys.length');
  const hostScroll = await page.evaluate('scrollY'), start = await snapshot();
  await key('ArrowRight', true);
  await until('Real iframe arrow movement', async () => (await snapshot()).state.position.x > start.state.position.x + 0.15);
  await key('ArrowRight', false);
  await until('Arrow release clears input', async () => (await snapshot()).state.velocity.x === 0);
  await press('Space');
  assert.equal((await snapshot()).paused, true);
  assert.equal(await page.evaluate('window.__hostKeys.length'), hostKeys, 'Iframe arrows/Space/Enter do not bubble to host shortcuts.');
  assert.equal(await page.evaluate('scrollY'), hostScroll, 'Game input does not scroll the host.');
  await press('Space');
  await key('KeyD', true);
  await until('Real iframe WASD movement', async () => (await snapshot()).state.velocity.x > 0);
  await click('#host-after', false);
  await key('KeyD', false);
  const blurred = await snapshot();
  assert.equal(blurred.paused, true, 'Leaving iframe pauses the game.');
  assert.deepEqual(blurred.input, { x: 0, y: 0 });
  await press('ArrowRight'); await press('KeyR'); await press('Escape'); await pause(150);
  assert.deepEqual((await snapshot()).state, blurred.state, 'Host focus cannot advance or restart the paused game.');
  await click('#primary-action');
  const resumed = await snapshot();
  await until('Resume runs without stuck keys', async () => (await snapshot()).state.tick > resumed.state.tick + 5);
  assert.deepEqual((await snapshot()).state.position, resumed.state.position);
  log(`PASS ${base}: native Tab/Enter focus, measured arrow/WASD movement, both keyboard isolation directions and blur/resume.`);

  await click('#menu-toggle');
  assert.equal(await game('document.fullscreenEnabled'), true, 'Supported Chromium fullscreen must not be silently skipped.');
  await click('#fullscreen');
  await until('Actual iframe fullscreen enters', () => game<boolean>(
    "document.fullscreenElement?.id === 'boundstoy' && document.getElementById('fullscreen').getAttribute('aria-label') === 'Exit fullscreen'"));
  assert.equal(await page.evaluate(`document.fullscreenElement === ${frame}`), true, 'Host fullscreen element is the iframe.');
  assert.equal(await game("document.getElementById('fullscreen').getAttribute('aria-label')"), 'Exit fullscreen');
  await click('#fullscreen');
  await until('Actual iframe fullscreen exits', () => game<boolean>(
    "document.fullscreenElement === null && document.getElementById('fullscreen').getAttribute('aria-label') === 'Enter fullscreen'"));
  assert.equal(await page.evaluate('document.fullscreenElement'), null);
  assert.equal(await game("document.getElementById('fullscreen').getAttribute('aria-label')"), 'Enter fullscreen');
  assert.equal(await game("document.getElementById('notice').hidden"), true, 'Fullscreen produced no fallback/error notice.');
  await click('#menu-close');
  log(`PASS ${base}: fullscreen permission, trusted button entry, host/child fullscreen state and trusted button exit.`);

  assert.equal(REPLAYS.length, LEVELS.length);
  const expectedRuns: Record<string, { ticks: number; deaths: number }> = {};
  for (const [index, level] of LEVELS.entries()) {
    await game(`window.__BOUNDSTOY__.load(${index})`);
    assert.deepEqual((await snapshot()).level, level, 'Copied bundle matches current source content.');
    let elapsed = 0;
    for (const [step, command] of REPLAYS[index].entries()) {
      const last = step === REPLAYS[index].length - 1, ticks = command.ticks - (last ? 1 : 0);
      await game(`window.__BOUNDSTOY__.advance(${ticks}, ${JSON.stringify({ x: command.x, y: command.y })})`);
      elapsed += ticks;
      const state = (await snapshot()).state;
      assert.equal(state.tick, elapsed);
      assert.equal(state.won, false, 'Exact replay has no premature win or padding.');
      assert.equal(state.deaths, 0);
      assert.deepEqual(state.visited, level.checkpoints.slice(0, state.visited.length).map(point => `${point.x},${point.y}`));
      if (last) await game(`window.__BOUNDSTOY__.advance(1, ${JSON.stringify({ x: command.x, y: command.y })})`);
    }
    const state = (await snapshot()).state, ticks = REPLAYS[index].reduce((sum, command) => sum + command.ticks, 0);
    assert.equal(state.won, true); assert.equal(state.tick, ticks); assert.equal(state.deaths, 0);
    assert.deepEqual(state.visited, level.checkpoints.map(point => `${point.x},${point.y}`));
    expectedRuns[level.id] = { ticks, deaths: 0 };
    log(`PASS ${base}: offline ${level.id}, ${ticks} exact ticks, zero deaths, ordered checkpoints.`);
  }
  assert.deepEqual(JSON.parse((await saved())!).runs, expectedRuns, 'Real game finishes wrote exact local records.');
  assert.equal(requests.length, loadedRequests, 'Input, fullscreen and all finishes need no post-load requests.');
  await screenshot('campaign-complete.png');
  const progress = await saved();
  await navigate(false);
  assert.equal(await saved(), progress, 'Reloaded non-debug iframe preserves local records.');
  assert.equal(await text('completion-count'), `${LEVELS.length} / ${LEVELS.length} cleared`);
  assert.deepEqual(await game('Object.keys(window.localStorage)'), [PROGRESS_KEY], 'Only local game progress was stored.');
  assert.equal(await game('window.sessionStorage.length'), 0);
  assert.equal(await game('typeof window.__BOUNDSTOY__'), 'undefined');
  log(`PASS ${base}: ordinary reload hydrates all ${LEVELS.length} records; no cookies, workers, telemetry or remote runtime assets.`);
}
