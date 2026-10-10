import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEVELS } from '../../data/levels.ts';
import { AFTERSHOCK_TARGETS } from '../../data/aftershock.ts';
import { AFTERSHOCK_MASTERY_REPLAYS } from '../../data/aftershock-replays.ts';
import { REPLAYS } from '../../data/replays.ts';
import { PROGRESS_KEY } from '../../application/storage.ts';
import { FAILURE_REPLAYS } from '../fixtures/aftershock-failures.ts';
import { main } from '../../scripts/browser-check.ts';
import { waitFor } from './runtime.ts';
import type { State } from '../../core/simulation.ts';
import type { BrowserContext } from './scenarios.ts';

export async function checkAftershock({ page, origin, signal, log }: BrowserContext) {
  const artifacts = resolve('artifacts/aftershock');
  await mkdir(artifacts, { recursive: true });
  const text = (id: string) => page.evaluate<string>(`document.getElementById(${JSON.stringify(id)}).textContent`);
  const capture = async (name: string) => {
    const image = await page.call<{ data: string }>('Page.captureScreenshot', { format: 'png' });
    await writeFile(resolve(artifacts, `${name}.png`), Buffer.from(image.data, 'base64'));
  };
  const reload = async (suffix: string) => {
    const url = `${origin}/?debug&aftershock=${suffix}`;
    await page.call('Page.navigate', { url });
    await waitFor('Aftershock production boot', () => page.evaluate(
      `location.href === ${JSON.stringify(url)} && Boolean(window.__BOUNDSTOY__) && window.__BOUNDSTOY__.metrics().frames > 0`),
    15000, signal);
  };
  const run = (commands: readonly { ticks: number; x: number; y: number }[]) =>
    page.evaluate<State>(`(() => {
      let state = window.__BOUNDSTOY__.snapshot().state;
      for (const command of ${JSON.stringify(commands)}) state = window.__BOUNDSTOY__.advance(command.ticks, command);
      return state;
    })()`);
  assert.deepEqual(LEVELS.map(level => level.name), ['Slipstream', 'Borrowed Ground', 'The Cut']);
  await page.call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  assert.deepEqual(await page.evaluate("[...document.querySelectorAll('.course-card strong')].map(node => node.textContent)"),
    LEVELS.map(level => level.name), 'only the new levels appear in the playable selector');

  for (const [index, level] of LEVELS.entries()) {
    await page.evaluate(`window.__BOUNDSTOY__.load(${index}); document.getElementById('overlay').hidden = true;`);
    await capture(`${level.id}-board`);
    const ordinary = await run(REPLAYS[index]);
    assert.equal(ordinary.won, true);
    assert.equal(ordinary.deaths, 0);
    assert.ok(ordinary.tick > AFTERSHOCK_TARGETS[level.id], 'ordinary route is not automatically mastered');
    assert.match(await text('finish-mastery'), /Clean.*Mastery/);
    await capture(`${level.id}-clean`);

    await page.evaluate(`window.__BOUNDSTOY__.load(${index})`);
    const master = await run(AFTERSHOCK_MASTERY_REPLAYS[index]);
    assert.equal(master.won, true);
    assert.equal(master.deaths, 0);
    assert.ok(master.tick <= AFTERSHOCK_TARGETS[level.id]);
    assert.match(await text('finish-mastery'), /Mastered/);
    await capture(`${level.id}-mastered`);

    await page.evaluate(`window.__BOUNDSTOY__.load(${index})`);
    const died = await run(FAILURE_REPLAYS[index]);
    assert.equal(died.deaths, 1);
    assert.equal(died.event, 'death');
    const respawn = await page.evaluate<State>('window.__BOUNDSTOY__.advance(54)');
    assert.equal(respawn.tick - respawn.patternOffset, 0);
    const assisted = await run(REPLAYS[index]);
    assert.equal(assisted.deaths, 1);
    assert.equal(assisted.won, true);
    assert.equal(assisted.tick, respawn.tick + ordinary.tick);
    assert.match(await text('finish-mastery'), /Assisted clear/);
    const saved = await page.evaluate<Record<string, { ticks: number; deaths: number; cleanTicks?: number }>>(
      `JSON.parse(localStorage.getItem(${JSON.stringify(PROGRESS_KEY)})).runs`);
    assert.equal(saved[level.id].ticks, master.tick, 'slower assisted clear cannot replace clean mastery');
    assert.equal(saved[level.id].deaths, 0);
    log(`PASS: ${level.name}: clear ${ordinary.tick}, mastery ${master.tick}, target ${AFTERSHOCK_TARGETS[level.id]}; real retry preserves run costs.`);
  }
  await reload('records');
  for (const level of LEVELS) {
    const card = await page.evaluate<string>(`[...document.querySelectorAll('.course-card')]
      .find(node => node.querySelector('strong').textContent === ${JSON.stringify(level.name)}).textContent`);
    assert.match(card, /Mastered.*Clean/);
  }
  for (const [width, height] of [[390, 844], [844, 390]]) {
    await page.call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    for (const [index, level] of LEVELS.entries()) {
      await page.evaluate(`window.__BOUNDSTOY__.load(${index})`);
      await run(AFTERSHOCK_MASTERY_REPLAYS[index]);
      assert.equal(await page.evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
      assert.equal(await page.evaluate(`(() => {
        const node = document.getElementById('finish-mastery');
        node.scrollIntoView({ block: 'nearest' });
        const r = node.getBoundingClientRect(), overlay = document.getElementById('overlay').getBoundingClientRect();
        return r.width > 0 && r.left >= 0 && r.right <= innerWidth
          && r.top >= overlay.top && r.bottom <= overlay.bottom;
      })()`), true, `${level.name}: mastery outcome remains visible on ${width}x${height}`);
      await capture(`${level.id}-mastered-${width}x${height}`);
    }
  }
  log(`PASS: new playable selection, clean/mastery results and persisted records; desktop and mobile evidence: ${artifacts}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main(process.argv.slice(2), checkAftershock);
