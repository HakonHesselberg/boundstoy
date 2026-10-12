import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main } from '../../scripts/browser-check.ts';
import { BENCHMARKS, BENCHMARK_FAMILIES } from '../../data/benchmarks.ts';
import { BENCHMARK_REPLAYS } from '../../data/benchmark-replays.ts';
import { createState, restartCheckpoint } from '../../core/simulation.ts';
import { DRAFT_KEY, PROGRESS_KEY } from '../../application/storage.ts';
import { RUN_STORAGE_KEY } from '../../application/run-storage.ts';
import { readStored, settledPersistence } from './persistence.ts';
import { worldDriver } from './rough-world.ts';
import type { BrowserContext } from './scenarios.ts';

export async function checkBenchmarks(context: BrowserContext) {
  const { page, signal, log } = context, d = worldDriver(context);
  await mkdir(resolve('artifacts/benchmarks'), { recursive: true });
  const out = await mkdtemp(resolve('artifacts/benchmarks/run-'));
  await d.newRun();
  await d.run([{ ticks: 80, x: 1, y: 0 }]);
  const worldState = (await d.snapshot()).state;
  await d.click('menu-toggle');
  await d.click('editor-tab');
  await d.click('new-course');
  await d.evaluate(`document.getElementById('level-name').value = 'Benchmark isolation draft';
    document.getElementById('level-name').dispatchEvent(new Event('change', {bubbles:true}))`);
  await settledPersistence(page, signal);
  const editorDraft = (await d.snapshot()).level;
  await d.evaluate("document.getElementById('play-tab').click(); window.dispatchEvent(new Event('blur'))");
  assert.deepEqual((await d.snapshot()).state, worldState);
  await d.click('menu-toggle');
  await settledPersistence(page, signal);
  const storedBefore = await readStored(page, RUN_STORAGE_KEY, signal);
  const draftBefore = await readStored(page, DRAFT_KEY, signal);
  assert.match(draftBefore!, /Benchmark isolation draft/);
  const recordsBefore = await readStored(page, PROGRESS_KEY, signal);
  await d.click('benchmarks-open');
  assert.match(await d.text('menu-title'), /Benchmarks/);
  assert.equal(await d.evaluate("document.querySelectorAll('#benchmark-family option').length"), 6);
  assert.equal(await d.evaluate("document.querySelectorAll('[data-benchmark]').length"), 4);
  await page.call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 });
  await page.call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 });
  assert.equal(await d.evaluate("document.getElementById('benchmark-family').value"), BENCHMARK_FAMILIES[1].id);
  await page.call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', modifiers: 8, windowsVirtualKeyCode: 9 });
  await page.call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', modifiers: 8, windowsVirtualKeyCode: 9 });
  assert.equal(await d.evaluate('document.activeElement.id'), 'menu-close');
  const family = async (id: string) => {
    await d.evaluate(`(() => {
      const select = document.getElementById('benchmark-family');
      select.value = ${JSON.stringify(id)}; select.dispatchEvent(new Event('change',{bubbles:true}));
    })()`);
  };
  const select = async (id: string) => {
    const b = BENCHMARKS.find(b => b.level.id === id)!;
    await family(b.familyId);
    await d.click(`choose-${id}`);
    const snapshot = await d.snapshot();
    assert.deepEqual(snapshot.level, b.level);
    assert.deepEqual(snapshot.state, createState(b.level), 'selection reveals the complete puzzle before starting');
    assert.equal(snapshot.testing, true);
    assert.equal(snapshot.paused, true);
    assert.equal(await d.evaluate("document.getElementById('overlay').hidden"), true, 'ready reveal must not obscure the puzzle');
    assert.equal(await d.evaluate('__BOUNDSTOY__.persistence().runId'), null);
    assert.match(await d.text('course-number'), /BENCHMARK/);
    assert.match(await d.text('benchmark-status'), BENCHMARK_REPLAYS[id] ? /Verified route/ : /No verified route/);
    assert.equal(await d.evaluate("document.getElementById('editor-return').hidden"), true);
  };
  for (const b of BENCHMARKS) {
    await select(b.level.id);
    if (b === BENCHMARKS[0]) {
      await d.click('benchmark-start');
      await page.call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
      await d.until('Live benchmark keyboard movement', '__BOUNDSTOY__.snapshot().state.velocity.x > 0');
      await page.call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
      await d.click('pause');
      assert.equal((await d.snapshot()).paused, true);
    }
    await d.click('benchmark-return');
  }
  log('PASS all 24 exact definitions selectable, correctly labelled and paused at a fresh reveal.');
  for (const [width, height] of [[1280, 900], [390, 844], [844, 390]]) {
    await page.call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    for (const f of BENCHMARK_FAMILIES) {
      await family(f.id);
      assert.equal(await d.evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
      await select(`bench-${f.id}-normal`);
      await d.evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
      assert.equal(await d.evaluate(`(() => {
        const b=__BOUNDSTOY__.snapshot().level.sections[0].camera.frame;
        const r=document.querySelector('#viewport canvas').getBoundingClientRect();
        return [[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]].every(([x,y])=>{
          const p=__BOUNDSTOY__.project({x:x-.5,y:y-.5});
          return p.x>=r.left && p.x<=r.right && p.y>=r.top && p.y<=r.bottom;
        });
      })()`), true, `${f.id}: whole puzzle at ${width}x${height}`);
      const image = await page.call<{ data: string }>('Page.captureScreenshot', { format: 'png' });
      await writeFile(resolve(out, `${f.id}-${width}x${height}.png`), Buffer.from(image.data, 'base64'));
      await d.click('benchmark-return');
    }
  }
  log('PASS six whole-puzzle reveals and menu touch targets at desktop, portrait and landscape sizes.');
  const id = 'bench-travelling-wave-normal';
  await select(id);
  const witness = BENCHMARK_REPLAYS[id];
  const won = await d.run(witness.commands);
  assert.equal(won.won, true); assert.equal(won.deaths, 0); assert.equal(won.tick, witness.ticks);
  assert.match(await d.text('primary-action'), /Compare surfaces/);
  await d.evaluate("document.getElementById('retry-course').click(); window.dispatchEvent(new Event('blur'))");
  assert.deepEqual((await d.snapshot()).state, createState(BENCHMARKS[0].level));
  await d.run(witness.commands);
  await d.click('primary-action');
  assert.match(await d.text('benchmark-list'), /This session/);
  await select(id);
  const death = await d.run([{ ticks: 453, x: 1, y: 0 }]);
  assert.ok(death.deaths > 0);
  await d.evaluate("document.getElementById('restart').click(); window.dispatchEvent(new Event('blur'))");
  assert.deepEqual((await d.snapshot()).state, restartCheckpoint(BENCHMARKS[0].level, death));
  await d.click('benchmark-return');
  await d.click('benchmarks-back');
  await d.click('editor-tab');
  assert.deepEqual((await d.snapshot()).level, editorDraft, 'benchmark exit does not load its level into the editor');
  await d.click('playtest');
  assert.equal(await d.evaluate("document.getElementById('benchmark-return').hidden"), true);
  assert.equal(await d.evaluate("document.getElementById('editor-return').hidden"), false);
  await d.click('editor-return');
  await d.evaluate("document.getElementById('play-tab').click(); window.dispatchEvent(new Event('blur'))");
  await d.click('menu-toggle');
  await d.click('menu-close');
  await d.click('menu-toggle');
  await d.evaluate("document.querySelector('[data-level=\"0\"]').click(); window.dispatchEvent(new Event('blur'))");
  assert.deepEqual((await d.snapshot()).state, worldState, 'world live state survived benchmark selection, finish and restart');
  await settledPersistence(page, signal);
  assert.equal(await readStored(page, RUN_STORAGE_KEY, signal), storedBefore);
  assert.equal(await readStored(page, DRAFT_KEY, signal), draftBefore);
  assert.equal(await readStored(page, PROGRESS_KEY, signal), recordsBefore);
  await d.click('menu-toggle'); await d.click('benchmarks-open'); await select('bench-side-refuges-hard');
  await d.reload();
  assert.equal((await d.snapshot()).level.id, 'aftershock');
  assert.equal((await d.snapshot()).state.tick, worldState.tick);
  log('PASS witness completion, trial results, cost-preserving restart, world/draft/record isolation and reload.');
  log(`Benchmark screenshots: ${out}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main(process.argv.slice(2), checkBenchmarks);
