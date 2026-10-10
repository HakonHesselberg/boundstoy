import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEVELS } from '../../data/levels.ts';
import { REPLAYS } from '../../data/replays.ts';
import { PROGRESS_KEY } from '../../application/storage.ts';
import { PREFERENCES_KEY } from '../../application/preferences.ts';
import { main } from '../../scripts/browser-check.ts';
import { waitFor } from './runtime.ts';
import type { BrowserContext } from './scenarios.ts';

export async function checkJourney({ page, origin, signal, log }: BrowserContext) {
  let navigation = 0;
  const reload = async () => {
    const url = `${origin}/?debug&journey=${++navigation}`;
    await page.call('Page.navigate', { url });
    await waitFor('Journey production boot', () => page.evaluate(`location.href === ${JSON.stringify(url)} && Boolean(window.__BOUNDSTOY__)`), 15000, signal);
    await waitFor('Journey first rendered frame', () => page.evaluate('window.__BOUNDSTOY__.metrics().frames > 0'), 5000, signal);
  };
  const text = (id: string) => page.evaluate<string>(`document.getElementById(${JSON.stringify(id)}).textContent`);
  const click = async (id: string) => {
    const point = await page.evaluate<{ x: number; y: number }>(`(() => {
      const button = document.getElementById(${JSON.stringify(id)});
      button.scrollIntoView({ block: 'center' });
      const r = button.getBoundingClientRect();
      if (button.disabled || !r.width || !r.height) throw new Error('Unavailable journey action: ${id}');
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    })()`);
    await page.call('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
    await page.call('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
  };
  const save = (runs: Record<string, { ticks: number; deaths: number }>) => page.evaluate(
    `localStorage.setItem(${JSON.stringify(PROGRESS_KEY)}, ${JSON.stringify(JSON.stringify({ version: 1, runs }))})`);
  const replay = async (index: number) => {
    const state = await page.evaluate<{ won: boolean; deaths: number }>(`(() => {
      window.__BOUNDSTOY__.load(${index});
      let state;
      for (const command of ${JSON.stringify(REPLAYS[index])}) state = window.__BOUNDSTOY__.advance(command.ticks, command);
      return state;
    })()`);
    assert.equal(state.won, true);
    assert.equal(state.deaths, 0);
  };
  const total = (index: number) => REPLAYS[index].reduce((sum, command) => sum + command.ticks, 0);
  await page.evaluate('localStorage.clear()');
  await reload();
  assert.match(await text('overlay-copy'), /WASD.*golden EXIT.*retry repeats the pattern/);
  assert.equal(await text('course-title'), LEVELS[0].name);
  assert.equal(await page.evaluate("document.getElementById('intro-audio').getAttribute('aria-pressed')"), 'false');
  log('PASS: first encounter exposes controls, goal, recovery and sound opt-in.');

  const legacy = { 'retired-prototype-v0': { ticks: 484, deaths: 0 } };
  const missing = Math.min(1, LEVELS.length - 1);
  const partial = { ...legacy, ...Object.fromEntries(LEVELS.flatMap((level, i) =>
    i === missing ? [] : [[level.id, { ticks: total(i) + 120, deaths: 0 }]])) };
  await save(partial);
  await reload();
  assert.equal(await text('course-title'), LEVELS[missing].name);
  assert.match(await text('primary-action'), /Continue/);
  await replay(missing);
  assert.equal(await text('overlay-title'), 'Campaign complete.');
  assert.match(await text('finish-comparison'), /First clear/);
  const preserved = await page.evaluate<Record<string, { ticks: number }>>(`JSON.parse(localStorage.getItem(${JSON.stringify(PROGRESS_KEY)})).runs`);
  assert.equal(preserved['retired-prototype-v0'].ticks, 484);
  assert.equal(preserved[LEVELS[missing].id].ticks, total(missing));
  await click('primary-action');
  assert.equal(await page.evaluate("document.getElementById('game-menu').open"), true);
  await click('menu-close');
  log('PASS: legacy scores remain separate, Continue finds missing course and out-of-order completion opens level selection.');

  await replay(0);
  assert.match(await text('finish-comparison'), /Personal best! 1\.00s faster/);
  await replay(0);
  assert.equal(await text('finish-comparison'), 'Matched your personal best.');
  const faster = { ...partial, [LEVELS[0].id]: { ticks: total(0) - 120, deaths: 0 } };
  await save(faster);
  await reload();
  await replay(0);
  assert.match(await text('finish-comparison'), /1\.00s from your best/);
  log('PASS: first clears, faster/equal/slower results compare against the prior record.');

  await reload();
  await click('intro-audio');
  await waitFor('Sound preference saved', () => page.evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(PREFERENCES_KEY)}))?.sound === true`), 5000, signal);
  assert.equal(await page.evaluate('document.activeElement.id'), 'intro-audio', 'Sound toggle must retain keyboard focus');
  await click('menu-toggle');
  await page.evaluate(`(() => {
    const slider = document.getElementById('sound-volume');
    slider.value = '25';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    slider.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await page.call('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__audioContexts = 0;
    const NativeAudioContext = window.AudioContext;
    window.AudioContext = class extends NativeAudioContext {
      constructor(...args) { super(...args); window.__audioContexts++; }
    };
  ` });
  await reload();
  assert.equal(await page.evaluate("document.getElementById('intro-audio').getAttribute('aria-pressed')"), 'true');
  assert.equal(await page.evaluate("document.getElementById('sound-volume').value"), '25');
  assert.equal(await page.evaluate('window.__audioContexts'), 0, 'Saved sound does not autoplay on page load');
  await click('restart');
  await waitFor('Restart activates remembered sound', () => page.evaluate('window.__audioContexts === 1'), 5000, signal);
  await click('menu-toggle');
  await click('audio');
  await waitFor('Mute settles', () => page.evaluate("document.getElementById('audio').getAttribute('aria-pressed') === 'false'"), 5000, signal);
  assert.equal(await page.evaluate('document.activeElement.id'), 'audio', 'Menu sound toggle must retain keyboard focus');
  await click('menu-close');
  log('PASS: explicit sound opt-in and volume survive reload; mute remains available.');

  const directory = fileURLToPath(new URL('../../artifacts/release/', import.meta.url));
  await mkdir(directory, { recursive: true });
  await page.call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  for (let index = 0; index < LEVELS.length; index++) {
    await page.evaluate(`window.__BOUNDSTOY__.load(${index})`);
    await click('primary-action');
    await page.evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    const capture = await page.call<{ data: string }>('Page.captureScreenshot', { format: 'png' });
    await writeFile(`${directory}${LEVELS[index].id}.png`, Buffer.from(capture.data, 'base64'));
  }
  for (const [width, height] of [[390, 844], [844, 390], [720, 450]]) {
    await page.call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await reload();
    await page.evaluate("document.getElementById('primary-action').scrollIntoView({ block: 'center' })");
    const layout = await page.evaluate<{ width: number; scroll: number; buttonVisible: boolean }>(`(() => {
      const r = document.getElementById('primary-action').getBoundingClientRect();
      return { width: innerWidth, scroll: document.documentElement.scrollWidth,
        buttonVisible: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth };
    })()`);
    assert.ok(layout.scroll <= layout.width + 1, `Horizontal overflow at ${width}x${height}`);
    assert.ok(layout.buttonVisible, `Primary action inaccessible at ${width}x${height}`);
    const capture = await page.call<{ data: string }>('Page.captureScreenshot', { format: 'png' });
    await writeFile(`${directory}entry-${width}x${height}.png`, Buffer.from(capture.data, 'base64'));
  }
  log(`PASS: all course screenshots and portrait/landscape/reduced-viewport entry checks. Evidence: ${directory}`);

  await page.call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await page.call('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
  await page.evaluate('window.__BOUNDSTOY__.load(0)');
  await click('primary-action');
  const touchPoints = await page.evaluate<{ x: number; y: number; id: number }[]>(`['up', 'right'].map((direction, id) => {
    const button = document.querySelector('[data-direction="' + direction + '"]');
    const r = button.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, id };
  })`);
  await page.call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints });
  assert.deepEqual(await page.evaluate('window.__BOUNDSTOY__.snapshot().input'), { x: 1, y: -1 });
  await page.call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37 });
  assert.deepEqual(await page.evaluate('window.__BOUNDSTOY__.snapshot().input'), { x: 0, y: -1 });
  await page.call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'r', code: 'KeyR', windowsVirtualKeyCode: 82 });
  assert.deepEqual(await page.evaluate('window.__BOUNDSTOY__.snapshot().input'), { x: 0, y: 0 });
  await page.call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37 });
  await page.call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'r', code: 'KeyR', windowsVirtualKeyCode: 82 });
  assert.deepEqual(await page.evaluate('window.__BOUNDSTOY__.snapshot().input'), { x: 0, y: 0 });
  log('PASS: simultaneous two-finger and keyboard input combines correctly and restart clears every held source.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main(process.argv.slice(2), checkJourney);
