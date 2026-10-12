import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main } from '../../scripts/browser-check.ts';
import { EXPLOSION_PUZZLES } from '../../data/explosion-puzzles.ts';
import { EXPLOSION_REPLAYS, COMBINATION_RECOVERY } from '../../data/explosion-replays.ts';
import { createState, restartCheckpoint } from '../../core/simulation.ts';
import { DRAFT_KEY, PROGRESS_KEY } from '../../application/storage.ts';
import { RUN_STORAGE_KEY } from '../../application/run-storage.ts';
import { readStored, settledPersistence } from './persistence.ts';
import { worldDriver } from './rough-world.ts';
import type { BrowserContext } from './scenarios.ts';

export async function checkExplosionPuzzles(context: BrowserContext) {
  const { page, signal, log } = context, d = worldDriver(context);
  await mkdir(resolve('artifacts/explosion-puzzles'), { recursive: true });
  const out = await mkdtemp(resolve('artifacts/explosion-puzzles/run-'));
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
  await d.click('puzzles-open');
  assert.match(await d.text('menu-title'), /Explosion puzzles/);
  assert.equal(await d.evaluate("document.querySelector('#benchmark-family, #benchmarks-open')"), null);
  assert.equal(await d.evaluate("document.querySelectorAll('[data-puzzle]').length"), 6);
  await page.call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', modifiers: 8, windowsVirtualKeyCode: 9 });
  await page.call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', modifiers: 8, windowsVirtualKeyCode: 9 });
  assert.equal(await d.evaluate('document.activeElement.id'), 'menu-close');
  const select = async (id: string) => {
    const b = EXPLOSION_PUZZLES.find(b => b.level.id === id)!;
    await d.click(`choose-${id}`);
    const snapshot = await d.snapshot();
    assert.deepEqual(snapshot.level, b.level);
    assert.deepEqual(snapshot.state, createState(b.level), 'selection reveals the complete puzzle before starting');
    assert.equal(snapshot.testing, true);
    assert.equal(snapshot.paused, true);
    assert.equal(await d.evaluate("document.getElementById('overlay').hidden"), true, 'ready reveal must not obscure the puzzle');
    assert.equal(await d.evaluate('__BOUNDSTOY__.persistence().runId'), null);
    assert.match(await d.text('course-number'), /PUZZLE/);
    assert.match(await d.text('puzzle-status'), /Verified route/);
    assert.equal(await d.evaluate("document.getElementById('editor-return').hidden"), true);
  };
  for (const b of EXPLOSION_PUZZLES) {
    await select(b.level.id);
    if (b === EXPLOSION_PUZZLES[0]) {
      await d.click('puzzle-start');
      await page.call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
      await d.until('Live puzzle keyboard movement', '__BOUNDSTOY__.snapshot().state.velocity.x > 0');
      await page.call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
      await d.click('pause');
      assert.equal((await d.snapshot()).paused, true);
    }
    await d.click('puzzle-return');
  }
  log('PASS all six exact definitions selectable, correctly labelled and paused at a fresh reveal.');
  for (const [width, height] of [[1280, 900], [390, 844], [844, 390]]) {
    await page.call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    for (const { level } of EXPLOSION_PUZZLES) {
      assert.equal(await d.evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
      await select(level.id);
      await d.evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
      assert.equal(await d.evaluate(`(() => {
        const b=__BOUNDSTOY__.snapshot().level.sections[0].camera.frame;
        const r=document.querySelector('#viewport canvas').getBoundingClientRect();
        return [[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]].every(([x,y])=>{
          const p=__BOUNDSTOY__.project({x:x-.5,y:y-.5});
          return p.x>=r.left && p.x<=r.right && p.y>=r.top && p.y<=r.bottom;
        });
      })()`), true, `${level.id}: whole puzzle at ${width}x${height}`);
      const image = await page.call<{ data: string }>('Page.captureScreenshot', { format: 'png' });
      await writeFile(resolve(out, `${level.id}-${width}x${height}.png`), Buffer.from(image.data, 'base64'));
      if (level.sections.length > 1) {
        await d.run([{ ticks: 89, x: 0, y: 0 }, { ticks: 321, x: 1, y: 0 }, { ticks: 100, x: 0, y: 0 }]);
        assert.equal((await d.snapshot()).state.visited.length, 1);
        assert.match(await d.text('route-hint'), /alternating grid/);
        assert.equal(await d.evaluate(`(() => {
          const {level}=__BOUNDSTOY__.snapshot(), b=level.sections[1].camera.frame;
          const r=document.querySelector('#viewport canvas').getBoundingClientRect();
          return [[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]].every(([x,y])=>{
            const p=__BOUNDSTOY__.project({x:x-.5,y:y-.5});
            return p.x>=r.left && p.x<=r.right && p.y>=r.top && p.y<=r.bottom;
          }) && __BOUNDSTOY__.camera().hazards.every((h,i)=>h.enabled === (level.hazards[i].sectionId==='checker'));
        })()`), true, `checkpoint reveal and active hazards at ${width}x${height}`);
      }
      await d.click('puzzle-return');
    }
  }
  log('PASS six whole-puzzle reveals and menu touch targets at desktop, portrait and landscape sizes.');
  for (const { level } of EXPLOSION_PUZZLES) {
    await select(level.id);
    const result = await d.run(EXPLOSION_REPLAYS[level.id].commands);
    assert.equal(result.won, true, level.id);
    assert.equal(result.deaths, 0, level.id);
    assert.equal(result.tick, EXPLOSION_REPLAYS[level.id].ticks);
    await d.click('primary-action');
  }
  await select('puzzle-combination');
  await d.run([{ ticks: 89, x: 0, y: 0 }, { ticks: 321, x: 1, y: 0 }]);
  assert.match(await d.text('game-feedback'), /reached/);
  const checkpointDeath = await d.run([{ ticks: 340, x: 1, y: 0 }]);
  assert.equal(checkpointDeath.deaths, 1);
  await d.evaluate("document.getElementById('restart').click(); window.dispatchEvent(new Event('blur'))");
  assert.deepEqual((await d.snapshot()).state, restartCheckpoint(EXPLOSION_PUZZLES[5].level, checkpointDeath));
  const recovery = await d.run(COMBINATION_RECOVERY);
  assert.equal(recovery.won, true);
  assert.equal(recovery.deaths, 1);
  await d.click('primary-action');
  const id = 'puzzle-wave';
  await select(id);
  const witness = EXPLOSION_REPLAYS[id];
  const won = await d.run(witness.commands);
  assert.equal(won.won, true); assert.equal(won.deaths, 0); assert.equal(won.tick, witness.ticks);
  assert.match(await d.text('primary-action'), /Choose a puzzle/);
  await d.evaluate("document.getElementById('retry-course').click(); window.dispatchEvent(new Event('blur'))");
  assert.deepEqual((await d.snapshot()).state, createState(EXPLOSION_PUZZLES[0].level));
  await d.run(witness.commands);
  await d.click('primary-action');
  assert.match(await d.text('puzzle-list'), /This session/);
  await select(id);
  const death = await d.run([{ ticks: 453, x: 1, y: 0 }]);
  assert.ok(death.deaths > 0);
  await d.evaluate("document.getElementById('restart').click(); window.dispatchEvent(new Event('blur'))");
  assert.deepEqual((await d.snapshot()).state, restartCheckpoint(EXPLOSION_PUZZLES[0].level, death));
  await d.click('puzzle-return');
  await d.click('puzzles-back');
  await d.click('editor-tab');
  assert.deepEqual((await d.snapshot()).level, editorDraft, 'puzzle exit does not load its level into the editor');
  await d.click('playtest');
  assert.equal(await d.evaluate("document.getElementById('puzzle-return').hidden"), true);
  assert.equal(await d.evaluate("document.getElementById('editor-return').hidden"), false);
  await d.click('editor-return');
  await d.evaluate("document.getElementById('play-tab').click(); window.dispatchEvent(new Event('blur'))");
  await d.click('menu-toggle');
  await d.click('menu-close');
  await d.click('menu-toggle');
  await d.evaluate("document.querySelector('[data-level=\"0\"]').click(); window.dispatchEvent(new Event('blur'))");
  assert.deepEqual((await d.snapshot()).state, worldState, 'world live state survived puzzle selection, finish and restart');
  await settledPersistence(page, signal);
  assert.equal(await readStored(page, RUN_STORAGE_KEY, signal), storedBefore);
  assert.equal(await readStored(page, DRAFT_KEY, signal), draftBefore);
  assert.equal(await readStored(page, PROGRESS_KEY, signal), recordsBefore);
  await d.click('menu-toggle'); await d.click('puzzles-open'); await select('puzzle-refuges');
  await d.reload();
  assert.equal((await d.snapshot()).level.id, 'aftershock');
  assert.equal((await d.snapshot()).state.tick, worldState.tick);
  log('PASS witness completion, trial results, cost-preserving restart, world/draft/record isolation and reload.');
  log(`Explosion puzzle screenshots: ${out}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main(process.argv.slice(2), checkExplosionPuzzles);
