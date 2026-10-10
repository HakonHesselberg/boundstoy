import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main } from '../../scripts/browser-check.ts';
import { DRAFT_KEY } from '../../application/storage.ts';
import type { State } from '../../core/simulation.ts';
import { waitFor } from './runtime.ts';
import type { BrowserContext } from './scenarios.ts';

export async function checkExplosions({ page, origin, signal, log }: BrowserContext) {
  const artifacts = resolve('artifacts/explosions');
  await mkdir(artifacts, { recursive: true });
  const fixture = (spawnX: number, resetPatternOnRetry = false) => ({
    version: 1, id: 'explosion-check', name: 'Explosion check', description: 'One detonation, harmless aftermath.',
    resetPatternOnRetry,
    tiles: ['########', '#......#', '#......#', '#......#', '#......#', '########'],
    spawn: { x: spawnX, y: 3 }, goal: { x: 6, y: 1 }, checkpoints: [],
    hazards: [{ kind: 'pulse', x: 3, y: 3, period: 240, on: 90, phase: 195 }],
  });
  const prepare = async (spawnX = 1, resetPatternOnRetry = false) => {
    const result = await page.evaluate<{ on: number; notice: string }>(`(() => {
      document.getElementById('editor-tab').click();
      document.getElementById('level-json').value = ${JSON.stringify(JSON.stringify(fixture(spawnX, resetPatternOnRetry)))};
      document.getElementById('import').click();
      const notice = document.getElementById('notice-text').textContent;
      document.getElementById('playtest').click();
      window.__BOUNDSTOY__.advance(0);
      return { on: window.__BOUNDSTOY__.snapshot().level.hazards[0].on, notice };
    })()`);
    assert.equal(result.on, 1);
    assert.match(result.notice, /legacy on durations are converted/);
  };
  const advance = (ticks: number, x = 0) => page.evaluate<State>(
    `window.__BOUNDSTOY__.advance(${ticks}, { x: ${x}, y: 0 })`);
  const screenshot = async (name: string) => {
    await page.evaluate(`document.getElementById('overlay').hidden = true;
      document.getElementById('notice').hidden = true;`);
    const image = await page.call<{ data: string }>('Page.captureScreenshot', { format: 'png' });
    await writeFile(resolve(artifacts, `${name}.png`), Buffer.from(image.data, 'base64'));
    return image.data;
  };
  for (const reduced of [false, true]) {
    const prefix = reduced ? 'reduced' : 'full';
    await page.call('Emulation.setDeviceMetricsOverride', { width: 1060, height: 800, deviceScaleFactor: 1, mobile: false });
    await page.call('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }],
    });
    const url = `${origin}/?debug&explosions=${prefix}`;
    await page.call('Page.navigate', { url });
    await waitFor('Explosion production boot', () => page.evaluate(
      `location.href === ${JSON.stringify(url)} && Boolean(window.__BOUNDSTOY__) && window.__BOUNDSTOY__.metrics().frames > 0`),
    15000, signal);
    await prepare();
    await advance(41, 1);
    await screenshot(`${prefix}-warning-t41`);
    const detonation = await advance(4, 1);
    assert.equal(detonation.tick, 45);
    assert.equal(detonation.deaths, 0, 'outside the expanded footprint on ignition');
    await screenshot(`${prefix}-detonation-t45`);
    const entered = await advance(1, 1);
    assert.equal(entered.tick, 46);
    assert.ok(entered.position.x > 2.87, 'inside the expanded footprint immediately afterwards');
    assert.equal(entered.deaths, 0, 'aftermath is harmless');
    await advance(3);
    const first = await screenshot(`${prefix}-safe-aftermath-t49`);
    const tick = entered.tick + 3;
    await page.evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    assert.equal(await page.evaluate('window.__BOUNDSTOY__.snapshot().state.tick'), tick);
    assert.equal(await screenshot(`${prefix}-paused-t49`), first, 'pause freezes the actual rendered effect');
    await advance(31);
    await screenshot(`${prefix}-fading-t80`);
    await advance(1);
    await screenshot(`${prefix}-clear-t81`);

    const safe = await advance(203);
    assert.equal(safe.tick, 284);
    assert.equal(safe.deaths, 0);
    const hit = await advance(1);
    assert.equal(hit.tick, 285);
    assert.equal(hit.deathCause, 'pulse', 'remaining on the pad meets the next distinct ignition');
    // First death uploads its own geometry; compare only after that separate effect is primed.
    const metrics = await page.evaluate<{ geometries: number }>('window.__BOUNDSTOY__.metrics()');
    await advance(2400);
    const after = await page.evaluate<{ geometries: number }>('window.__BOUNDSTOY__.metrics()');
    assert.equal(after.geometries, metrics.geometries, 'repeated explosions allocate no new geometry');

    await prepare(2);
    const caught = await advance(48, 1);
    assert.equal(caught.deaths, 1, 'batched stepping catches ignition even without rendering that tick');
    assert.equal(caught.respawnTicks, 51, 'death occurred at exactly tick 45');
    await screenshot(`${prefix}-batched-death-t48`);
    await prepare();
    await advance(49, 1);
    await screenshot(`${prefix}-skipped-ignition-t49`);
    assert.equal((await advance(0)).deaths, 0);
    await prepare(2, true);
    assert.equal((await advance(45, 1)).deaths, 1);
    const respawn = await advance(54);
    assert.equal(respawn.tick, 99);
    assert.equal(respawn.patternOffset, 99);
    assert.equal((await advance(44, 1)).deaths, 1);
    await screenshot(`${prefix}-retry-warning-t143`);
    const repeated = await advance(1, 1);
    assert.equal(repeated.tick, 144, 'the elapsed timer includes the failed attempt');
    assert.equal(repeated.deaths, 2);
    assert.equal(repeated.tick - repeated.patternOffset, 45, 'same action hits the same ignition after retry');
    await screenshot(`${prefix}-retry-detonation-t144`);
    log(`PASS: ${prefix} motion: exact collision, next-tick entry, skipped ignition render, paused pixels and bounded resources.`);
  }

  await page.evaluate(`localStorage.setItem(${JSON.stringify(DRAFT_KEY)}, ${JSON.stringify(JSON.stringify(fixture(1)))})`);
  await page.call('Page.navigate', { url: `${origin}/?debug&explosions=restore` });
  await waitFor('Legacy draft restore boot', () => page.evaluate(
    'location.search.includes("restore") && Boolean(window.__BOUNDSTOY__)'), 15000, signal);
  const restored = await page.evaluate<{ on: number; notice: string }>(`(() => {
    document.getElementById('editor-tab').click();
    return { on: window.__BOUNDSTOY__.snapshot().level.hazards[0].on,
      notice: document.getElementById('notice-text').textContent };
  })()`);
  assert.equal(restored.on, 1);
  assert.match(restored.notice, /one tick.*harmless/);
  log(`PASS: legacy editor import and draft restore disclose the one-tick conversion. Screenshots: ${artifacts}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main(process.argv.slice(2), checkExplosions);
