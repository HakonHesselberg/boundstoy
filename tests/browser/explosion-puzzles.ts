import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main } from '../../scripts/browser-check.ts';
import { EXPLOSION_PUZZLES } from '../../data/explosion-puzzles.ts';
import { EXPLOSION_REPLAYS, COMBINATION_RECOVERY } from '../../data/explosion-replays.ts';
import { CLASSIC_BOUNDS } from '../../data/classic-bounds.ts';
import { CLASSIC_BOUND_WITNESSES } from '../../data/classic-bound-replays.ts';
import { ICE_ESCAPES } from '../../data/ice-escapes.ts';
import { ICE_ESCAPE_WITNESSES } from '../../data/ice-escape-replays.ts';
import { createState, restartCheckpoint } from '../../core/simulation.ts';
import { DRAFT_KEY, PROGRESS_KEY } from '../../application/storage.ts';
import { RUN_STORAGE_KEY } from '../../application/run-storage.ts';
import { readStored, settledPersistence } from './persistence.ts';
import { worldDriver } from './rough-world.ts';
import { trialSets, findTrial } from '../../application/level-catalogue.ts';
import type { BrowserContext } from './scenarios.ts';

export async function checkExplosionPuzzles(context: BrowserContext) {
  const sets = trialSets({ dev: true });
  const trials = sets.filter(set => set.id !== 'sound').flatMap(set => set.items);
  const { page, signal, log } = context, d = worldDriver(context);
  await mkdir(resolve('artifacts/explosion-puzzles'), { recursive: true });
  const out = await mkdtemp(resolve('artifacts/explosion-puzzles/run-'));
  const screen = () => d.evaluate<string>("document.getElementById('boundstoy').dataset.screen");
  await d.newRun();
  await d.run([{ ticks: 80, x: 1, y: 0 }]);
  const worldState = (await d.snapshot()).state;
  await d.click('overlay-settings');
  await d.click('editor-tab');
  await d.click('new-course');
  await d.evaluate(`document.getElementById('level-name').value = 'Benchmark isolation draft';
    document.getElementById('level-name').dispatchEvent(new Event('change', {bubbles:true}))`);
  await settledPersistence(page, signal);
  const editorDraft = (await d.snapshot()).level;
  await d.evaluate("document.getElementById('play-tab').click(); window.dispatchEvent(new Event('blur'))");
  assert.equal(await screen(), 'home', 'leaving the editor returns Home');
  assert.deepEqual((await d.snapshot()).state, worldState);
  await settledPersistence(page, signal);
  const storedBefore = await readStored(page, RUN_STORAGE_KEY, signal);
  const draftBefore = await readStored(page, DRAFT_KEY, signal);
  assert.match(draftBefore!, /Benchmark isolation draft/);
  const recordsBefore = await readStored(page, PROGRESS_KEY, signal);
  await d.click('home-levels');
  assert.equal(await screen(), 'levels');
  assert.equal(await d.evaluate("document.querySelector('#benchmark-family, #benchmarks-open')"), null);
  assert.deepEqual(await d.evaluate("[...document.querySelectorAll('#level-tabs [role=tab]')].map(t => t.dataset.set)"),
    sets.map(set => set.id), 'debug sessions expose the developer sound set after the player sets');
  for (const set of sets) {
    await d.click(`tab-${set.id}`);
    assert.equal(await d.evaluate('document.querySelectorAll("#level-grid [data-puzzle]").length'), set.items.length);
    assert.equal(await d.evaluate(`document.getElementById('tab-${set.id}').getAttribute('aria-selected')`), 'true');
  }
  await d.click('tab-classic');
  assert.match(await d.text('level-detail-credit'), /After Beginner Bound by NewRecord/);
  await d.click('tab-ice');
  assert.match(await d.text('level-detail-credit'), /After Ice Escape Template/);
  await page.call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await page.call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  assert.equal(await screen(), 'home', 'Escape leaves level select');
  assert.equal(await d.evaluate('document.activeElement.id'), 'home-play');
  await d.click('home-levels');
  const select = async (id: string) => {
    const entry = findTrial(sets, id)!;
    if (await screen() !== 'levels') await d.click('overlay-exit');
    if (await d.evaluate(`document.getElementById('tab-${entry.set.id}').getAttribute('aria-selected')`) !== 'true')
      await d.click(`tab-${entry.set.id}`);
    await d.click(`choose-${id}`);
    const snapshot = await d.snapshot();
    assert.deepEqual(snapshot.level, entry.puzzle.level);
    assert.deepEqual(snapshot.state, createState(entry.puzzle.level), 'selection previews the complete puzzle before starting');
    assert.equal(snapshot.testing, true);
    assert.equal(snapshot.paused, true);
    assert.equal(await screen(), 'levels');
    assert.equal(await d.text('level-detail-title'), entry.puzzle.level.name);
    assert.equal(await d.evaluate('__BOUNDSTOY__.persistence().runId'), null);
    assert.equal(await d.text('course-number'), `${entry.set.title} · ${entry.index + 1} / ${entry.set.items.length}`);
    assert.equal(await d.evaluate("document.getElementById('editor-return').hidden"), true);
  };
  const leave = async () => {
    // Results offer Next level plus Levels; the final level offers only All levels.
    const exit = await d.evaluate<boolean>("!document.getElementById('overlay-exit').hidden");
    await d.click(exit ? 'overlay-exit' : 'primary-action');
    assert.equal(await screen(), 'levels');
  };
  const wholePuzzle = (section: number) => d.evaluate<boolean>(`(() => {
    const b=__BOUNDSTOY__.snapshot().level.sections[${section}].camera.frame;
    const r=document.querySelector('#viewport canvas').getBoundingClientRect();
    return [[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]].every(([x,y])=>{
      const p=__BOUNDSTOY__.project({x:x-.5,y:y-.5});
      return p.x>=r.left && p.x<=r.right && p.y>=r.top && p.y<=r.bottom;
    });
  })()`);
  for (const b of trials) {
    await select(b.level.id);
    if (b === EXPLOSION_PUZZLES[0]) {
      await d.click('level-play');
      assert.equal(await screen(), 'play');
      await page.call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
      await d.until('Live puzzle keyboard movement', '__BOUNDSTOY__.snapshot().state.velocity.x > 0');
      await page.call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
      await d.click('pause');
      assert.equal((await d.snapshot()).paused, true);
      assert.equal(await d.text('overlay-exit'), 'Levels');
      await d.click('overlay-exit');
    }
  }
  log(`PASS all ${trials.length} trials selectable by set, correctly labelled and previewed at a fresh reveal.`);
  for (const [width, height] of [[1280, 900], [390, 844], [844, 390]]) {
    await page.call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    for (const { level } of trials) {
      assert.equal(await d.evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
      await select(level.id);
      assert.equal(await d.evaluate(`(() => { const r=document.getElementById('level-play').getBoundingClientRect();
        const p=document.getElementById('levels-screen'); return r.bottom <= innerHeight && p.scrollHeight <= p.clientHeight + 1; })()`), true,
        `${level.id}: level select fits without scrolling at ${width}x${height}`);
      await d.evaluate('__BOUNDSTOY__.advance(0); new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
      assert.equal(await wholePuzzle(0), true, `${level.id}: whole puzzle at ${width}x${height}`);
      const image = await page.call<{ data: string }>('Page.captureScreenshot', { format: 'png' });
      await writeFile(resolve(out, `${level.id}-${width}x${height}.png`), Buffer.from(image.data, 'base64'));
      if (level.id === 'puzzle-combination') {
        await d.run([{ ticks: 89, x: 0, y: 0 }, { ticks: 321, x: 1, y: 0 }, { ticks: 100, x: 0, y: 0 }]);
        assert.equal((await d.snapshot()).state.visited.length, 1);
        assert.match(await d.text('route-hint'), /alternating grid/);
        assert.equal(await d.evaluate(`(() => {
          const {level}=__BOUNDSTOY__.snapshot();
          return __BOUNDSTOY__.camera().hazards.every((h,i)=>h.enabled === (level.hazards[i].sectionId==='checker'));
        })()`), true, `active hazards at ${width}x${height}`);
        assert.equal(await wholePuzzle(1), true, `checkpoint reveal at ${width}x${height}`);
      }
      await d.click('overlay-exit');
    }
  }
  log(`PASS ${trials.length} whole-puzzle reveals and level-select touch targets at desktop, portrait and landscape sizes.`);
  for (const [index, { level }] of EXPLOSION_PUZZLES.entries()) {
    await select(level.id);
    const result = await d.run(EXPLOSION_REPLAYS[level.id].commands);
    assert.equal(result.won, true, level.id);
    assert.equal(result.deaths, 0, level.id);
    assert.equal(result.tick, EXPLOSION_REPLAYS[level.id].ticks);
    if (index === 0) {
      assert.equal(await d.text('primary-action'), 'Next level →');
      await d.click('primary-action');
      assert.equal((await d.snapshot()).level.id, EXPLOSION_PUZZLES[1].level.id, 'Next level starts the following trial');
      assert.equal(await screen(), 'play');
      await d.click('pause');
      await d.click('overlay-exit');
    } else await leave();
  }
  for (const { level } of CLASSIC_BOUNDS) {
    await select(level.id);
    const witness = CLASSIC_BOUND_WITNESSES[level.id];
    const result = await d.run(witness.commands);
    assert.equal(result.won, true, level.id);
    assert.equal(result.deaths, 0, level.id);
    assert.equal(result.tick, witness.ticks, level.id);
    assert.match(await d.text('finish-best'), /\d/);
    await leave();
  }
  assert.equal(await d.evaluate('document.querySelectorAll("#level-grid .tile-mark").length'), CLASSIC_BOUNDS.length);
  for (const { level } of ICE_ESCAPES) {
    await select(level.id);
    const witness = ICE_ESCAPE_WITNESSES[level.id];
    const result = await d.run(witness.commands);
    assert.equal(result.won, true, level.id);
    assert.equal(result.deaths, 0, level.id);
    assert.equal(result.tick, witness.ticks, level.id);
    await leave();
  }
  assert.equal(await d.evaluate('document.querySelectorAll("#level-grid .tile-mark").length'), ICE_ESCAPES.length);
  assert.match(await d.text('level-detail-result'), /Best this session/);
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
  await leave();
  const id = 'puzzle-wave';
  await select(id);
  const witness = EXPLOSION_REPLAYS[id];
  const won = await d.run(witness.commands);
  assert.equal(won.won, true); assert.equal(won.deaths, 0); assert.equal(won.tick, witness.ticks);
  assert.equal(await d.text('retry-course'), 'New trial ↻');
  await d.evaluate("document.getElementById('retry-course').click(); window.dispatchEvent(new Event('blur'))");
  assert.deepEqual((await d.snapshot()).state, createState(EXPLOSION_PUZZLES[0].level));
  await d.run(witness.commands);
  await leave();
  assert.match(await d.evaluate<string>(`document.getElementById('choose-${id}').getAttribute('aria-label')`), /cleared/);
  await select(id);
  const death = await d.run([{ ticks: 453, x: 1, y: 0 }]);
  assert.ok(death.deaths > 0);
  await d.evaluate("document.getElementById('restart').click(); window.dispatchEvent(new Event('blur'))");
  assert.deepEqual((await d.snapshot()).state, restartCheckpoint(EXPLOSION_PUZZLES[0].level, death));
  await d.click('overlay-exit');
  await d.click('levels-back');
  await d.click('home-settings');
  await d.click('editor-tab');
  assert.deepEqual((await d.snapshot()).level, editorDraft, 'puzzle exit does not load its level into the editor');
  await d.click('playtest');
  assert.equal(await d.evaluate("document.getElementById('editor-return').hidden"), false);
  await d.click('editor-return');
  await d.evaluate("document.getElementById('play-tab').click(); window.dispatchEvent(new Event('blur'))");
  await d.click('home-settings');
  await d.click('settings-close');
  await d.evaluate("document.getElementById('home-play').click(); window.dispatchEvent(new Event('blur'))");
  assert.deepEqual((await d.snapshot()).state, worldState, 'world live state survived puzzle selection, finish and restart');
  await settledPersistence(page, signal);
  assert.equal(await readStored(page, RUN_STORAGE_KEY, signal), storedBefore);
  assert.equal(await readStored(page, DRAFT_KEY, signal), draftBefore);
  assert.equal(await readStored(page, PROGRESS_KEY, signal), recordsBefore);
  await d.click('overlay-exit'); await d.click('home-levels'); await select('puzzle-refuges');
  await d.reload();
  assert.equal((await d.snapshot()).level.id, 'aftershock');
  assert.equal((await d.snapshot()).state.tick, worldState.tick);
  assert.equal(await screen(), 'home');
  log('PASS witness completion, Next level, trial marks, cost-preserving restart, world/draft/record isolation and reload.');
  log(`Explosion puzzle screenshots: ${out}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main(process.argv.slice(2), checkExplosionPuzzles);
