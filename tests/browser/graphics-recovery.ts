import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { main } from '../../scripts/browser-check.ts';
import { waitFor } from './runtime.ts';
import type { BrowserContext } from './scenarios.ts';

export async function checkGraphics({ page, origin, signal, log }: BrowserContext) {
  const root = fileURLToPath(new URL('../..', import.meta.url));
  await mkdir(resolve(root, 'artifacts/graphics-recovery'), { recursive: true });
  const out = await mkdtemp(resolve(root, 'artifacts/graphics-recovery/run-'));
  log(`Graphics recovery evidence: ${out}`);
  const evidence: object[] = [];
  const evaluate = <T>(source: string) => page.evaluate<T>(source);
  const wait = (ms = 200) => delay(ms, undefined, { signal });
  const until = (name: string, expression: string) => waitFor(name, () => evaluate<boolean>(expression), 15000, signal);
  const click = (id: string) => evaluate(`document.getElementById(${JSON.stringify(id)}).click()`);
  const probe = () => evaluate<{
    snapshot: ReturnType<NonNullable<Window['__BOUNDSTOY__']>['snapshot']>;
    graphics: { status: string; visualTime: number; accumulator: number };
    camera: { view: unknown; levelBuilds: number; player: { x: number; y: number } };
    metrics: { frames: number; geometries: number; textures: number };
  }>(`({ snapshot: __BOUNDSTOY__.snapshot(), graphics: __BOUNDSTOY__.graphics(),
    camera: __BOUNDSTOY__.camera(), metrics: __BOUNDSTOY__.metrics() })`);
  let navigation = 0, loads = 0;
  page.on('Page.loadEventFired', () => { loads++; });
  const loadedAfter = (before: number) =>
    waitFor('New graphics document loaded', async () => loads > before, 15000, signal);
  const reload = async () => {
    const url = `${origin}/?debug&graphics=${++navigation}`;
    const before = loads;
    await page.call('Page.navigate', { url });
    await loadedAfter(before);
    await until('Fresh production graphics boot', `location.href === ${JSON.stringify(url)} &&
      Boolean(window.__BOUNDSTOY__) && __BOUNDSTOY__.metrics().frames > 0`);
  };
  const key = (code: string, down: boolean, autoRepeat = false) => page.call('Input.dispatchKeyEvent', {
    type: down ? 'keyDown' : 'keyUp', code, key: code === 'Space' ? ' ' : code,
    windowsVirtualKeyCode: code === 'ArrowRight' ? 39 : code === 'Enter' ? 13 : 32, autoRepeat,
  });
  const lose = async () => {
    assert.equal(await evaluate(`(() => {
      const canvas = document.querySelector('#viewport canvas');
      window.originalCanvas = canvas;
      window.loseExtension = canvas.getContext('webgl2').getExtension('WEBGL_lose_context');
      if (!window.loseExtension) return false;
      window.loseExtension.loseContext(); return true;
    })()`), true, 'native WEBGL_lose_context is required');
    await until('Loss reached main gate', `__BOUNDSTOY__.graphics().status === 'lost'`);
    await wait();
  };
  const restore = async () => {
    await evaluate('window.loseExtension.restoreContext()');
    await until('Native resources restored and current state redrawn', `__BOUNDSTOY__.graphics().status === 'restored'`);
    await wait();
    assert.equal(await evaluate(`document.querySelector('#viewport canvas') === window.originalCanvas`), true,
      'native lifecycle retains the original renderer canvas');
  };
  const capture = async (name: string) => {
    const image = await page.call<{ data: string }>('Page.captureScreenshot', { format: 'png' });
    await writeFile(resolve(out, `${name}.png`), Buffer.from(image.data, 'base64'));
    return image.data;
  };
  const attackEntries = async () => {
    // Dispatch rather than .click alone: disabled UI is not sufficient protection.
    await evaluate(`(() => {
      for (const id of ['primary-action', 'retry-course', 'restart', 'pause', 'play-tab', 'overlay-exit', 'overlay-settings',
        'editor-return', 'home-play', 'new-run', 'home-levels', 'level-play', 'levels-back', 'editor-tab', 'sounds-open',
        'playtest', 'undo', 'new-course', 'copy-course', 'import']) {
        document.getElementById(id).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      }
      for (const b of document.querySelectorAll('[data-puzzle], [data-set]')) b.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      const v = document.getElementById('viewport');
      for (const code of ['Space', 'Enter', 'KeyR', 'ArrowRight', 'KeyW', 'Escape', 'KeyZ'])
        v.dispatchEvent(new KeyboardEvent('keydown', { code, ctrlKey: code === 'KeyZ', bubbles: true, cancelable: true }));
      for (const b of document.querySelectorAll('[data-direction]'))
        b.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 72, bubbles: true, cancelable: true }));
      document.querySelector('#viewport canvas').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
      __BOUNDSTOY__.load(1); __BOUNDSTOY__.advance(100, { x: 1, y: 0 }); __BOUNDSTOY__.animate(1);
    })()`);
    await key('ArrowRight', true);
    await key('ArrowRight', false);
    await wait();
  };
  for (const mode of ['play', 'pause', 'editor', 'initial-menu', 'touch']) {
    await page.call('Emulation.setDeviceMetricsOverride', {
      width: mode === 'touch' ? 390 : 1280, height: mode === 'touch' ? 844 : 900,
      deviceScaleFactor: 1, mobile: mode === 'touch',
    });
    await page.call('Emulation.setTouchEmulationEnabled', { enabled: mode === 'touch' });
    await reload();
    if (mode === 'initial-menu') await click('home-settings');
    else if (mode === 'editor') await evaluate(`document.getElementById('home-settings').click(); document.getElementById('editor-tab').click()`);
    else {
      await click('home-play');
      if (mode === 'touch') {
        const point = await evaluate<{ x: number; y: number }>(`(() => {
          const r = document.querySelector('[data-direction="right"]').getBoundingClientRect();
          return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        })()`);
        await page.call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, id: 7 }] });
        assert.deepEqual((await probe()).snapshot.input, { x: 1, y: 0 }, 'native touch is held before loss');
      } else await key('ArrowRight', true);
      await wait(100);
      if (mode === 'pause') { await key('ArrowRight', false); await click('pause'); await wait(); }
    }
    await lose();
    const frozen = await probe();
    assert.equal(frozen.snapshot.paused, true);
    assert.deepEqual(frozen.snapshot.input, { x: 0, y: 0 });
    await attackEntries();
    assert.deepEqual(await probe(), frozen, `${mode}: all state, camera, clocks and frames frozen through every entry`);
    await capture(`${mode}-lost`);
    await restore();
    const restored = await probe();
    assert.deepEqual(restored.snapshot, frozen.snapshot, `${mode}: exact state restored, still paused`);
    assert.equal(restored.graphics.visualTime, frozen.graphics.visualTime);
    assert.deepEqual(restored.camera.view, frozen.camera.view, 'camera frame preserved');
    assert.equal(restored.camera.levelBuilds, frozen.camera.levelBuilds, 'no level rebuild');
    if (restored.snapshot.mode === 'edit' && restored.snapshot.level.version === 2) {
      assert.deepEqual(restored.camera.player, frozen.camera.player,
        'world editor retains its presentation-only section focus, not the simulation spawn');
    } else assert.deepEqual(restored.camera.player, restored.snapshot.state.position,
      'restoration draws current tick, not the previous live interpolated position');
    await key('Enter', true, true); await key('Space', true, true);
    await key('Enter', false); await key('Space', false); await key('ArrowRight', false);
    if (mode === 'touch') await page.call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await wait(350);
    assert.deepEqual(await probe(), restored, 'held/repeated keys cannot resume or catch up');
    await capture(`${mode}-restored-paused`);
    evidence.push({ mode, frozen, restored });
    if (mode === 'initial-menu') { await click('settings-close'); await click('home-play'); } else await click('primary-action');
    await wait(100);
    const resumed = await probe();
    assert.equal(resumed.graphics.status, 'ready');
    assert.deepEqual(resumed.snapshot.input, { x: 0, y: 0 });
    if (mode !== 'editor') assert.ok(resumed.snapshot.state.tick > restored.snapshot.state.tick);
  }

  // Pin the scene for pixel comparisons and repeat restoration without rebuilding
  // levels. A lost PMREM target would change these pixels even if geometry drew.
  await page.call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await page.call('Emulation.setTouchEmulationEnabled', { enabled: false });
  await reload();
  await evaluate('__BOUNDSTOY__.advance(12)');
  await wait();
  await evaluate(`document.getElementById('overlay').style.visibility = 'hidden'`);
  const beforeImage = await capture('resource-baseline');
  const baseline = await probe();
  const listeners = async () => {
    const { result } = await page.call<{ result: { objectId: string } }>('Runtime.evaluate', {
      expression: `document.querySelector('#viewport canvas')`, objectGroup: 'graphics-listeners',
    });
    const { listeners } = await page.call<{ listeners: { type: string }[] }>('DOMDebugger.getEventListeners', { objectId: result.objectId });
    await page.call('Runtime.releaseObjectGroup', { objectGroup: 'graphics-listeners' });
    return listeners.map(listener => listener.type).sort();
  };
  const baselineListeners = await listeners();
  let restoredResources: { geometries: number; textures: number } | undefined;
  for (let i = 0; i < 3; i++) {
    await lose(); await restore();
    const current = await probe();
    assert.deepEqual(current.snapshot, baseline.snapshot);
    assert.deepEqual(current.camera, baseline.camera);
    // Native cache reset drops previously uploaded but now-invisible meshes.
    const resources = { geometries: current.metrics.geometries, textures: current.metrics.textures };
    assert.ok(resources.geometries <= baseline.metrics.geometries);
    assert.ok(resources.textures <= baseline.metrics.textures);
    if (restoredResources) assert.deepEqual(resources, restoredResources);
    restoredResources = resources;
    assert.equal(await evaluate(`document.querySelectorAll('#viewport canvas').length`), 1);
    assert.deepEqual(await listeners(), baselineListeners, 'native and app canvas listeners remain bounded');
    assert.equal(await capture(`resource-restored-${i}`), beforeImage, 'restored GPU resources draw identical paused pixels');
    evidence.push({ cycle: i, current });
  }
  await evaluate(`document.getElementById('overlay').style.visibility = ''`);
  log('PASS: play/pause/editor/initial-menu loss, all entries, fresh resume, exact clocks/state/pixels and bounded repeated resources.');

  await lose();
  const { targetInfo } = await page.call<{ targetInfo: { targetId: string } }>('Target.getTargetInfo');
  const other = await page.call<{ targetId: string }>('Target.createTarget', { url: 'about:blank', background: false });
  try {
    await until('Lost game hidden by owned tab', 'document.hidden');
    const hidden = await probe();
    await evaluate('window.loseExtension.restoreContext()');
    await until('Native context restored while hidden', `!document.querySelector('#viewport canvas').getContext('webgl2').isContextLost()`);
    await wait();
    const after = await probe();
    assert.deepEqual(after.snapshot, hidden.snapshot);
    assert.deepEqual(after.graphics, hidden.graphics, 'app gate stays closed until a visible recovery draw');
    // Three resets info counters, but no app frame is rendered in the background.
    assert.equal(after.metrics.frames, 0);
  } finally {
    await page.call('Target.closeTarget', { targetId: other.targetId });
    await page.call('Target.activateTarget', { targetId: targetInfo.targetId });
  }
  await until('Visible recovery draws but remains paused', `!document.hidden && __BOUNDSTOY__.graphics().status === 'restored'`);
  assert.equal((await probe()).snapshot.paused, true);
  log('PASS: hidden native restoration defers app GPU work and keeps the play gate closed until visible.');

  // Fault only the app's GPU target rebake, not Three's native context event.
  await lose();
  await evaluate(`(() => {
    const original = WebGL2RenderingContext.prototype.createFramebuffer;
    window.restoreGpuFault = () => { WebGL2RenderingContext.prototype.createFramebuffer = original; };
    let calls = 0;
    // Pinned Three 0.186.1 initializes three scratch framebuffers first.
    // Fail the subsequent application PMREM allocation, not the native listener.
    WebGL2RenderingContext.prototype.createFramebuffer = function() {
      if (++calls > 3) throw new Error('Injected GPU allocation failure');
      return original.call(this);
    };
    window.loseExtension.restoreContext();
  })()`);
  try {
    await until('Failed restoration stays gated', `__BOUNDSTOY__.graphics().status === 'failed'`);
    const failed = await probe();
    await attackEntries();
    assert.deepEqual(await probe(), failed);
    assert.match(await evaluate<string>(`document.getElementById('graphics-copy').textContent`), /could not be restored.*Reload/);
    await capture('failed-restore');
  } finally { await evaluate('window.restoreGpuFault()'); }
  const beforeRecoveryReload = loads;
  await click('graphics-reload');
  await loadedAfter(beforeRecoveryReload);
  await until('Reload action recovers failed renderer', `Boolean(window.__BOUNDSTOY__) && __BOUNDSTOY__.graphics().status === 'ready'`);

  // Isolated profile + new-document override, restored and removed even on failure.
  for (const fault of ['unsupported', 'init-error']) {
    const script = await page.call<{ identifier: string }>('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
      const original = HTMLCanvasElement.prototype.getContext, error = console.error;
      window.expectedGraphicsErrors = [];
      console.error = (...args) => {
        if (String(args[0]).startsWith('THREE.WebGLRenderer:')) window.expectedGraphicsErrors.push(args.map(String).join(' '));
        else error(...args);
      };
      HTMLCanvasElement.prototype.getContext = function(type, ...args) {
        if (type === 'webgl2') ${fault === 'unsupported' ? 'return null;' : "throw new Error('Injected renderer initialization failure');"}
        return original.call(this, type, ...args);
      };
      window.restoreStartupFault = () => { HTMLCanvasElement.prototype.getContext = original; console.error = error; };
    })()` });
    try {
      const url = `${origin}/?debug&fault=${fault}`;
      const before = loads;
      await page.call('Page.navigate', { url });
      await loadedAfter(before);
      await until('Actionable startup failure', `location.href === ${JSON.stringify(url)} && document.getElementById('graphics-recovery').open`);
      assert.equal(await evaluate('Boolean(window.__BOUNDSTOY__)'), false);
      assert.equal(await evaluate(`document.getElementById('graphics-reload').disabled`), false);
      assert.match(await evaluate<string>(`document.getElementById('graphics-copy').textContent`), /WebGL2.*reload/);
      await evaluate(`document.getElementById('primary-action').dispatchEvent(new MouseEvent('click', { bubbles: true }))`);
      assert.equal(await evaluate('Boolean(window.__BOUNDSTOY__)'), false);
      evidence.push({ fault, expectedErrors: await evaluate('window.expectedGraphicsErrors') });
      await capture(fault);
    } finally {
      await evaluate('window.restoreStartupFault()');
      await page.call('Page.removeScriptToEvaluateOnNewDocument', { identifier: script.identifier });
    }
    const beforeStartupReload = loads;
    await click('graphics-reload');
    await loadedAfter(beforeStartupReload);
    await until('Startup reload works after fault removal', `Boolean(window.__BOUNDSTOY__) && __BOUNDSTOY__.metrics().frames > 0`);
  }
  await writeFile(resolve(out, 'evidence.json'), JSON.stringify(evidence, null, 2));
  log('PASS: failed restore, unsupported WebGL2 and renderer initialization errors offer a working reload; injected prototypes restored.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main(process.argv.slice(2), checkGraphics);
