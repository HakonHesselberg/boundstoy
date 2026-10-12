import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { main } from '../../scripts/browser-check.ts';
import { waitFor } from './runtime.ts';
import { readStored } from './persistence.ts';
import type { BrowserContext } from './scenarios.ts';
import { worldFixture } from '../fixtures/world.ts';
import { DRAFT_KEY, PROGRESS_KEY } from '../../application/storage.ts';
import { RUN_STORAGE_KEY } from '../../application/run-storage.ts';
import type { Level, Point } from '../../core/level.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));
await mkdir(join(root, 'artifacts/bt047'), { recursive: true });
const evidence = await mkdtemp(join(root, 'artifacts/bt047/native-'));
const world = worldFixture();
const source = worldFixture({ name: '<b>Draft only</b>',
  tiles: [' '.repeat(24), ...world.tiles.slice(1)],
  sections: world.sections.map((section, i) => ({ ...section, name: i === 2 ? '<b>Third</b>' : section.name })) });

async function checkWorldEditor({ page, origin, signal, log }: BrowserContext) {
  const evaluate = <T>(expression: string) => page.evaluate<T>(expression);
  const snapshot = () => evaluate<ReturnType<NonNullable<Window['__BOUNDSTOY__']>['snapshot']>>(
    'window.__BOUNDSTOY__.snapshot()');
  const saved = () => waitFor('Saved campaign', () => evaluate(
    `window.__BOUNDSTOY__.persistence().phase === 'saved'`), 5000, signal);
  const draftSaved = () => waitFor('Committed draft', () => evaluate(
    `document.getElementById('draft-status').textContent === 'Draft saved.'`), 5000, signal);
  const clickPoint = async (point: Point) => {
    await page.call('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
    await page.call('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
  };
  const click = async (selector: string) => {
    await evaluate(`if (!document.getElementById('notice').hidden) document.getElementById('dismiss-notice').click()`);
    const point = await evaluate<Point>(`(() => {
      const n = document.querySelector(${JSON.stringify(selector)});
      if (!n || n.disabled || !n.getClientRects().length) throw new Error('Unavailable control ' + ${JSON.stringify(selector)});
      n.scrollIntoView({block:'center'});
      const r=n.getBoundingClientRect(), x=r.x+r.width/2, y=r.y+r.height/2;
      if (!n.contains(document.elementFromPoint(x,y))) throw new Error('Obscured control');
      return {x,y};
    })()`);
    await clickPoint(point);
  };
  const paintTile = async (tile: Point) => {
    await evaluate(`document.querySelector('#viewport canvas').scrollIntoView({block:'center'}); window.__BOUNDSTOY__.animate(0)`);
    const point = await evaluate<Point>(`window.__BOUNDSTOY__.project(${JSON.stringify(tile)})`);
    assert.deepEqual(await evaluate(`window.__BOUNDSTOY__.pick(${point.x},${point.y})`), tile);
    assert.equal(await evaluate(`document.elementFromPoint(${point.x},${point.y}) === document.querySelector('#viewport canvas')`),
      true, 'shifted global tile is really clickable');
    await clickPoint(point);
    await draftSaved();
  };
  const importSource = async (value: string) => {
    await evaluate(`document.querySelector('.json-panel').open=true;
      document.getElementById('level-json').value=${JSON.stringify(value)}`);
    await click('#import');
  };
  const exportLevel = async () => {
    await click('#export');
    return evaluate<Level>(`JSON.parse(document.getElementById('level-json').value)`);
  };
  const capture = async (name: string) => {
    await evaluate(`document.getElementById('notice').hidden=true;
      document.querySelector('#viewport canvas').scrollIntoView({block:'center'}); window.__BOUNDSTOY__.animate(0)`);
    const image = await page.call<{ data: string }>('Page.captureScreenshot', { format: 'png' });
    await writeFile(join(evidence, `${name}.png`), Buffer.from(image.data, 'base64'));
    await writeFile(join(evidence, `${name}.json`), JSON.stringify(await evaluate(`({
      snapshot:window.__BOUNDSTOY__.snapshot(), camera:window.__BOUNDSTOY__.camera(),
      inspection:window.__BOUNDSTOY__.inspect()})`), null, 2));
  };

  // Create real committed records and a different active run through the actual UI.
  await evaluate(`document.getElementById('primary-action').click()`);
  await saved();
  await evaluate(`window.__BOUNDSTOY__.advance(2000,{x:1,y:0})`);
  await saved();
  assert.equal((await snapshot()).state.won, true);
  await evaluate(`document.getElementById('restart').click()`);
  await saved();
  await evaluate(`window.__BOUNDSTOY__.advance(73,{x:1,y:0}); document.getElementById('pause').click()`);
  await saved();
  const campaign = await snapshot();
  const bytes = await readStored(page, RUN_STORAGE_KEY, signal);
  assert.ok(JSON.parse(bytes!).records.records.length > 0);
  assert.ok(JSON.parse(bytes!).active);
  const progress = await readStored(page, PROGRESS_KEY, signal);

  for (const [width, height] of [[1280, 900], [390, 844]]) {
    const tag = `${width}x${height}`;
    await page.call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await evaluate(`document.getElementById('menu-toggle').click(); document.getElementById('editor-tab').click()`);
    await importSource(JSON.stringify(source));
    await draftSaved();
    assert.deepEqual((await snapshot()).level, source);
    assert.equal(await evaluate(`document.getElementById('section-focus')?.options.length`), 3);
    assert.equal(await evaluate(`document.querySelector('[data-brush="checkpoint"]').disabled`), true);
    assert.equal(await evaluate(`document.querySelector('[data-brush="spawn"]').disabled`), true);
    assert.equal(await evaluate(`document.querySelector('[data-brush="goal"]').disabled`), true);
    const editorState = (await snapshot()).state;
    await evaluate(`document.getElementById('section-focus').focus()`);
    await page.call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'End', code: 'End', windowsVirtualKeyCode: 35 });
    await page.call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'End', code: 'End', windowsVirtualKeyCode: 35 });
    await evaluate(`window.__BOUNDSTOY__.animate(0)`);
    assert.deepEqual((await snapshot()).state, editorState, 'focus does not move simulation state');
    assert.deepEqual(await evaluate(`window.__BOUNDSTOY__.camera().view.sections`), [2]);
    assert.equal(await evaluate(`document.querySelector('#section-focus option:last-child').textContent`), '3 · <b>Third</b>');
    assert.equal(await evaluate(`document.querySelector('#section-focus b')`), null);
    await click('[data-brush="~"]');
    await paintTile({ x: 20, y: 4 });
    assert.equal((await snapshot()).level.tiles[4][20], '~');
    await capture(`${tag}-shifted-paint`);
    await click('#undo'); await draftSaved();
    assert.deepEqual((await snapshot()).level, source);
    assert.deepEqual(await exportLevel(), source, 'IDs, revision, whitespace, hazards and metadata roundtrip');
    assert.equal(await evaluate(`document.getElementById('pulse-styles').hidden`), true, 'style chips only with the Pulse brush');
    await click('[data-brush="pulse"]');
    assert.equal(await evaluate(`document.getElementById('pulse-styles').hidden`), false);
    assert.deepEqual(await evaluate(`[...document.querySelectorAll('#pulse-styles [data-style]')].map(b => b.dataset.style)`),
      ['ember', 'plasma', 'toxic', 'psionic']);
    await click('[data-style="plasma"]');
    assert.equal(await evaluate(`document.querySelector('[data-style="plasma"]').getAttribute('aria-pressed')`), 'true');
    await paintTile({ x: 20, y: 5 });
    const styled = (await snapshot()).level.hazards.at(-1)!;
    assert.ok(styled.kind === 'pulse' && styled.style === 'plasma', 'painted pad carries the chosen style');
    await click('[data-brush="saw"]');
    assert.equal(await evaluate(`document.getElementById('pulse-styles').hidden`), true);
    await paintTile({ x: 18, y: 6 }); await paintTile({ x: 21, y: 6 });
    const edited = (await snapshot()).level;
    assert.equal(edited.hazards.length, source.hazards.length + 2);
    assert.deepEqual(await exportLevel(), edited);
    const storedDraft = await readStored(page, DRAFT_KEY, signal);
    assert.deepEqual(JSON.parse(storedDraft!), edited);

    for (const invalid of ['{oops', JSON.stringify({ ...source, revision: 0 }),
      JSON.stringify({ ...source, sections: [] }), JSON.stringify({ ...source, execute: 'alert(1)' }),
      ' '.repeat(1_000_001)]) {
      await importSource(invalid);
      assert.equal(await evaluate(`document.getElementById('notice').hidden`), false);
      assert.match(await evaluate<string>(`document.getElementById('notice-text').textContent`), /Import rejected/);
      assert.deepEqual((await snapshot()).level, edited);
      assert.equal(await readStored(page, DRAFT_KEY, signal), storedDraft);
    }
    await evaluate(`document.getElementById('notice').hidden=true`);
    await click('[data-brush="~"]'); await paintTile({ x: 17, y: 2 });
    assert.equal(await evaluate(`document.getElementById('notice').hidden`), false);
    assert.deepEqual((await snapshot()).level, edited, 'unsafe observation paint is atomic');
    assert.equal(await readStored(page, DRAFT_KEY, signal), storedDraft);
    await evaluate(`document.getElementById('level-name').value='';
      document.getElementById('level-name').dispatchEvent(new Event('change',{bubbles:true}))`);
    assert.deepEqual((await snapshot()).level, edited);
    assert.equal(await readStored(page, DRAFT_KEY, signal), storedDraft);
    await evaluate(`document.getElementById('level-name').value=${JSON.stringify(edited.name)};
      document.getElementById('notice').hidden=true`);
    // Imported identity deliberately equals the registered campaign identity.
    await evaluate(`document.getElementById('playtest').click(); window.__BOUNDSTOY__.advance(0)`);
    assert.equal((await snapshot()).testing, true);
    assert.equal(await evaluate(`document.getElementById('section-focus').disabled`), true);
    const beforeHiddenFocus = (await snapshot()).state;
    await evaluate(`document.getElementById('section-focus').value='1';
      document.getElementById('section-focus').dispatchEvent(new Event('change',{bubbles:true}))`);
    assert.deepEqual((await snapshot()).state, beforeHiddenFocus);
    // Legal progress, death and recovery on the first pulse, not a checkpoint setter.
    await evaluate(`(() => { const d=window.__BOUNDSTOY__; d.advance(167,{x:1,y:0}); d.advance(67,{x:-1,y:0});
      d.advance(100,{x:0,y:1}); d.advance(9); })()`);
    const dying = await evaluate<{ hazardTick: number; section: { id: string } }>('window.__BOUNDSTOY__.inspect()');
    assert.equal(dying.hazardTick, 343);
    assert.equal(dying.section.id, 'section-2');
    assert.equal((await snapshot()).state.respawnTicks, 54);
    await evaluate(`window.__BOUNDSTOY__.advance(54)`);
    assert.equal(await evaluate(`window.__BOUNDSTOY__.inspect().hazardTick`), 397);
    assert.deepEqual((await snapshot()).state.position, { x: 6.5, y: 2.5 });
    await evaluate(`window.__BOUNDSTOY__.advance(2000,{x:1,y:0})`);
    assert.equal((await snapshot()).state.won, true);
    await evaluate(`document.getElementById('primary-action').click()`);
    assert.equal((await snapshot()).mode, 'edit');
    assert.deepEqual((await snapshot()).level, edited);
    assert.equal(await evaluate(`document.getElementById('section-focus').value`), '2');
    assert.deepEqual(await exportLevel(), edited);
    await click('#undo'); await draftSaved();
    assert.equal((await snapshot()).level.hazards.length, source.hazards.length + 1, 'undo survives playtest return');
    await capture(`${tag}-returned`);
    assert.equal(await readStored(page, RUN_STORAGE_KEY, signal), bytes, 'playtest cannot change active run or records');
    assert.equal(await readStored(page, PROGRESS_KEY, signal), progress);
    await evaluate(`document.getElementById('play-tab').click(); document.getElementById('pause').click()`);
    await saved();
    assert.deepEqual((await snapshot()).state, campaign.state);
    assert.equal(await readStored(page, RUN_STORAGE_KEY, signal), bytes);
    log(`PASS: ${tag} shifted native picking/brushes/undo/export, atomic rejection, playtest recovery/return and committed campaign isolation.`);
  }
  await page.call('Page.navigate', { url: `${origin}/?ordinary-player` });
  await waitFor('Ordinary player boot', () => evaluate(
    `document.getElementById('save-status')?.textContent === 'Saved'`), 15000, signal);
  assert.equal(await evaluate(`typeof window.__BOUNDSTOY__`), 'undefined');
  assert.equal(await evaluate(`document.getElementById('section-focus').getClientRects().length`), 0);
  assert.equal(await evaluate(`document.getElementById('section-focus').disabled`), true);
  log('PASS: ordinary play exposes neither debug inspection nor section-focus skipping.');
  log(`World editor captures and endstates: ${evidence}`);
}

// Same isolated registry substitution as continuation.ts; never alters production data.
const bundle = join(evidence, 'bundle');
await build({
  root, configFile: false, logLevel: 'warn',
  plugins: [{
    name: 'world-editor-test-registry',
    load(id) {
      if (id === join(root, 'data/levels.ts')) return `
        import { worldFixture } from ${JSON.stringify(join(root, 'tests/fixtures/world.ts'))};
        export const LEVELS = [worldFixture()];
        export const MASTERY_TARGETS = {};
        export const COURSE_LESSONS = {};
      `;
    },
  }],
  build: { outDir: bundle },
});
console.log(`World editor fixture: ${evidence}`);
await main(process.argv.slice(2), checkWorldEditor, bundle);
