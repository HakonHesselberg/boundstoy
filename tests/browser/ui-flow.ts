import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main } from '../../scripts/browser-check.ts';
import { EXPLOSION_REPLAYS } from '../../data/explosion-replays.ts';
import { worldDriver } from './rough-world.ts';
import type { BrowserContext } from './scenarios.ts';

/** Named captures of every screen of the BT-086 flow, driven through real controls. */
export async function captureUiFlow(context: BrowserContext) {
  const { page, log } = context, d = worldDriver(context);
  const out = resolve('artifacts/ui-flow');
  await mkdir(out, { recursive: true });
  const screen = () => d.evaluate<string>("document.getElementById('boundstoy').dataset.screen");
  const frames = () => d.evaluate('new Promise(r => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(r)), 450))');
  const capture = async (name: string) => {
    await frames();
    const image = await page.call<{ data: string }>('Page.captureScreenshot', { format: 'png' });
    await writeFile(resolve(out, `${name}.png`), Buffer.from(image.data, 'base64'));
  };
  const wave = EXPLOSION_REPLAYS['puzzle-wave'].commands;
  for (const [width, height, touch] of [[1280, 800, false], [390, 844, true], [844, 390, true]] as const) {
    const tag = `${width}x${height}`;
    await page.call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: touch });
    await page.call('Emulation.setTouchEmulationEnabled', { enabled: touch });
    await d.reload();
    assert.equal(await screen(), 'home');
    await capture(`${tag}-1-home`);
    await d.click('home-play');
    await d.until('World plays', '!__BOUNDSTOY__.snapshot().paused');
    await capture(`${tag}-2-play-world`);
    const board = await d.evaluate<{ width: number; height: number }>(`(() => {
      const r = document.getElementById('viewport').getBoundingClientRect(); return { width: r.width, height: r.height };
    })()`);
    log(`${tag}: board ${board.width}x${board.height} (${Math.round(100 * board.height / height)}% height)`);
    await d.click('pause');
    await capture(`${tag}-3-pause`);
    await d.click('overlay-settings');
    await capture(`${tag}-4-settings`);
    await d.click('settings-close');
    await d.click('overlay-exit');
    await capture(`${tag}-5-home-continue`);
    await d.click('home-levels');
    await d.click('tab-ice');
    await d.click('choose-ice-bumper-alley');
    await capture(`${tag}-6-levels`);
    await d.click('level-play');
    await d.evaluate('new Promise(r => setTimeout(r, 1500))');
    await capture(`${tag}-7-play-trial`);
    await d.click('pause');
    await d.click('overlay-exit');
    await d.click('tab-explosions');
    await d.click('choose-puzzle-wave');
    await d.run(wave);
    await d.evaluate('__BOUNDSTOY__.animate(1.5)');
    await capture(`${tag}-8-results`);
  }
  log(`UI flow captures: ${out}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main(process.argv.slice(2), captureUiFlow);
