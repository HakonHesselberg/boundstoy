import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { LEVELS } from '../../data/levels.ts';
import { REPLAYS } from '../../data/replays.ts';
import { TERRAIN } from '../../data/terrain.ts';
import { parseLevel, type Level } from '../../core/level.ts';
import type { State } from '../../core/simulation.ts';
import { PROGRESS_KEY, DRAFT_KEY } from '../../application/storage.ts';
import { Cdp, waitFor } from './runtime.ts';

export type BrowserContext = {
  page: Cdp; origin: string; signal: AbortSignal; requests: string[]; log: (message: string) => void;
};
type Snapshot = ReturnType<NonNullable<Window['__BOUNDSTOY__']>['snapshot']>;
const debug = 'window.__BOUNDSTOY__';

function room(tile: '.' | '~', id = 'browser-input-room'): Level {
  return parseLevel({
    version: 1, id, name: 'Browser input room', description: 'Isolated, imported keyboard test room.',
    tiles: Array.from({ length: 16 }, (_, y) => y === 0 || y === 15 ? '#'.repeat(24) : `#${tile.repeat(22)}#`),
    spawn: { x: 12, y: 8 }, goal: { x: 2, y: 2 }, checkpoints: [], hazards: [],
  });
}

export async function checkGame({ page, origin, signal, requests, log }: BrowserContext) {
  let loadEvents = 0;
  page.on('Page.loadEventFired', () => { loadEvents++; });
  const evaluate = <T>(source: string) => page.evaluate<T>(source);
  const snapshot = () => evaluate<Snapshot>(`${debug}.snapshot()`);
  const text = (id: string) => evaluate<string>(`document.getElementById(${JSON.stringify(id)}).textContent`);
  const saved = () => evaluate<string | null>(`localStorage.getItem(${JSON.stringify(PROGRESS_KEY)})`);
  const pause = (ms: number) => delay(ms, undefined, { signal });
  const until = <T>(label: string, probe: () => Promise<T | false | null>) => waitFor(label, probe, 5000, signal);
  const keyCodes: Record<string, [string, number]> = {
    ArrowRight: ['ArrowRight', 39], ArrowLeft: ['ArrowLeft', 37],
    KeyD: ['d', 68], KeyA: ['a', 65], Space: [' ', 32], Escape: ['Escape', 27], Tab: ['Tab', 9],
  };
  async function key(code: string, down: boolean, modifiers = 0) {
    const [key, virtualKey] = keyCodes[code];
    await page.call('Input.dispatchKeyEvent', {
      type: down ? 'keyDown' : 'keyUp', code, key, modifiers,
      windowsVirtualKeyCode: virtualKey, nativeVirtualKeyCode: virtualKey,
    });
  }
  async function press(code: string, modifiers = 0) { await key(code, true, modifiers); await key(code, false, modifiers); }
  async function click(selector: string) {
    const point = await evaluate<{ x: number; y: number }>(`(() => {
      const node = document.querySelector(${JSON.stringify(selector)});
      if (!node || node.disabled || !node.getClientRects().length) throw new Error('Unavailable control: ' + ${JSON.stringify(selector)});
      node.scrollIntoView({block: 'center'});
      const rect = node.getBoundingClientRect(), x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
      if (!node.contains(document.elementFromPoint(x, y))) throw new Error('Obscured control: ' + ${JSON.stringify(selector)});
      return {x, y};
    })()`);
    await page.call('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
    await page.call('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
  }
  async function inputJSON(source: string) {
    await click('#level-json');
    await press('KeyA', 2);
    await page.call('Input.insertText', { text: source });
  }
  async function imported(level: Level) {
    await inputJSON(JSON.stringify(level));
    await click('#import');
    assert.deepEqual((await snapshot()).level, level, 'Import must update the draft through the real UI');
  }
  async function stoppedWhilePaused(label: string) {
    const before = await snapshot();
    assert.equal(before.paused, true, label);
    assert.deepEqual(before.input, { x: 0, y: 0 }, `${label}: cleared input`);
    await pause(180);
    const after = await snapshot();
    assert.deepEqual(after.state, before.state, `${label}: paused simulation must not advance`);
  }
  async function resumedWithoutInput(label: string) {
    const before = await snapshot();
    assert.equal(before.paused, false, label);
    await until(`${label}: live ticks`, async () => (await snapshot()).state.tick >= before.state.tick + 8);
    const after = await snapshot();
    assert.deepEqual(after.input, { x: 0, y: 0 }, `${label}: no stuck keys`);
    assert.deepEqual(after.state.position, before.state.position, `${label}: ground stays still after resuming`);
  }
  async function moving() {
    await until('Keyboard movement', async () => (await snapshot()).state.velocity.x > 0);
  }
  const offline = (value: boolean) => page.call('Network.emulateNetworkConditions', {
    offline: value, latency: 0, downloadThroughput: -1, uploadThroughput: -1,
  });
  const assertNoNewRequests = (count: number) => assert.equal(requests.length, count, 'Loaded gameplay must request no extra assets, even offline');

  const metrics = await evaluate<{ drawCalls: number; triangles: number }>(`${debug}.metrics()`);
  assert.ok(metrics.drawCalls > 0 && metrics.triangles > 0, 'Production WebGL scene actually rendered');
  await pause(250); // Include Chromium's deferred favicon request before taking the offline baseline.
  assert.ok(requests.some(url => new URL(url).pathname.endsWith('.js')), 'Production JavaScript was loaded');
  assert.ok(requests.some(url => new URL(url).pathname.endsWith('.css')), 'Production stylesheet was loaded');
  await offline(true);
  const loadedRequests = requests.length;
  assert.equal(await saved(), null, 'Fresh profile must not inherit player records');

  await click('#primary-action');
  const start = await snapshot();
  await key('ArrowRight', true);
  await moving();
  await until('Actual ground movement', async () => (await snapshot()).state.position.x > start.state.position.x + 0.15);
  await key('ArrowRight', false);
  const releaseTick = (await snapshot()).state.tick;
  await until('First live tick after ground release', async () => (await snapshot()).state.tick > releaseTick);
  const released = await snapshot();
  assert.deepEqual(released.state.velocity, { x: 0, y: 0 }, 'Ground release stops at the next observed tick, not by gradual braking');
  await resumedWithoutInput('Ground release');
  assert.ok(released.state.position.x > start.state.position.x);
  assert.equal(released.state.deaths, 0);

  await key('KeyD', true); await moving();
  await press('Space');
  await stoppedWhilePaused('Space pause with key held');
  await key('KeyD', false); await press('Space');
  await resumedWithoutInput('Space resume');
  await key('KeyD', true); await moving();
  await press('Escape');
  assert.equal(await evaluate("document.getElementById('game-menu').open"), true);
  await stoppedWhilePaused('Menu opens with key held');
  await key('KeyD', false); await press('ArrowLeft');
  await click('#menu-play');
  await resumedWithoutInput('Menu resume ignores menu keys');
  await key('KeyD', true); await moving();
  await press('Tab');
  assert.notEqual(await evaluate('document.activeElement.id'), 'viewport', 'Tab really moves focus outside the game');
  await stoppedWhilePaused('Focus leaves viewport');
  await key('KeyD', false); await click('#primary-action');
  await resumedWithoutInput('Focus resume');
  await click('#pause');
  await stoppedWhilePaused('Pause button');
  log('PASS: real arrows/WASD, ground release, Space/button pause, menu keys, Tab focus and clean resume.');

  await click('#menu-toggle'); await click('#editor-tab');
  await click('.json-panel summary');
  const ice = room('~');
  await imported(ice); await click('#export');
  const exported = await evaluate<string>("document.getElementById('level-json').value");
  assert.deepEqual(JSON.parse(exported), ice, 'Export preserves full draft');
  await click('#new-course'); await inputJSON(exported); await click('#import'); await click('#export');
  assert.deepEqual(JSON.parse(await evaluate<string>("document.getElementById('level-json').value")), ice, 'Export/import roundtrip');
  const draftBefore = await evaluate(`localStorage.getItem(${JSON.stringify(DRAFT_KEY)})`);
  await inputJSON('{"version":'); await click('#import');
  assert.deepEqual((await snapshot()).level, ice, 'Invalid JSON preserves the live draft');
  assert.equal(await evaluate(`localStorage.getItem(${JSON.stringify(DRAFT_KEY)})`), draftBefore, 'Invalid JSON preserves saved draft');
  assert.equal(await evaluate("!document.getElementById('notice').hidden && document.getElementById('notice').classList.contains('error')"), true);
  assert.match(await text('notice-text'), /Import rejected/i);
  await click('#dismiss-notice');
  log('PASS: editor export/import roundtrip; invalid JSON shows an error and preserves live/saved draft.');

  await click('#playtest');
  assert.equal((await snapshot()).testing, true);
  await key('KeyD', true); await moving(); await key('KeyD', false);
  const samples: State[] = [];
  const sample = async () => {
    const current = await snapshot(), state = current.state;
    samples.push(state);
    assert.equal(current.level.tiles[Math.floor(state.position.y)][Math.floor(state.position.x)], '~', 'Stay on isolated soft ice');
    assert.equal(state.deaths, 0);
    assert.ok(Math.abs(Math.hypot(state.velocity.x, state.velocity.y) - TERRAIN['~'].speed) < 1e-9, 'Soft ice never brakes');
    return state;
  };
  await key('KeyA', true);
  await until('Soft-ice keyboard reversal completes a U-turn', async () => (await sample()).velocity.x < -0.95 * TERRAIN['~'].speed);
  assert.ok(samples.some(state => Math.abs(state.velocity.y) > TERRAIN['~'].speed / 2), 'Reversing follows an arc, not an instant flip');
  assert.ok(new Set(samples.map(state => state.tick)).size >= 4, 'Observed distinct simulation ticks during reversal');
  await key('KeyA', false);
  const beforeGlide = await sample();
  await until('Released soft ice keeps advancing', async () => (await sample()).tick >= beforeGlide.tick + 24);
  const afterGlide = await snapshot();
  assert.deepEqual(afterGlide.input, { x: 0, y: 0 });
  assert.ok(afterGlide.state.position.x < beforeGlide.position.x, 'Released soft ice keeps gliding');
  log(`PASS: soft-ice reversal/release at constant ${TERRAIN['~'].speed} speed (${samples.length} live samples).`);

  await evaluate(`${debug}.load(0)`);
  assert.ok(LEVELS.length > 0, 'Campaign must not be empty');
  assert.equal(REPLAYS.length, LEVELS.length, 'Every current level needs a reference replay');
  const expectedRuns: Record<string, { ticks: number; deaths: number }> = {};
  for (const [index, level] of LEVELS.entries()) {
    const intro = await snapshot(), commands = REPLAYS[index];
    assert.deepEqual(intro.level, level, 'Browser bundle matches this worktree LEVELS');
    assert.equal(intro.state.tick, 0);
    assert.equal(intro.started, false, 'Next level must have an intro, not auto-run');
    assert.equal(intro.paused, true);
    assert.equal(await text('overlay-title'), level.name);
    await stoppedWhilePaused(`${level.id} intro`);
    let elapsed = 0;
    const checkpoints = level.checkpoints.map(point => `${point.x},${point.y}`);
    for (const [commandIndex, command] of commands.entries()) {
      assert.ok(Number.isSafeInteger(command.ticks) && command.ticks > 0, 'Positive integer replay ticks');
      assert.ok([-1, 0, 1].includes(command.x) && [-1, 0, 1].includes(command.y), 'Replay contains only legal keyboard axes');
      const last = commandIndex === commands.length - 1;
      const ticks = command.ticks - (last ? 1 : 0);
      const state = await evaluate<State>(`${debug}.advance(${ticks}, ${JSON.stringify({ x: command.x, y: command.y })})`);
      elapsed += ticks;
      assert.equal(state.tick, elapsed, `${level.id}: exact command ticks`);
      assert.equal(state.won, false, `${level.id}: no premature win or padded replay`);
      assert.equal(state.deaths, 0, `${level.id}: no deaths`);
      assert.deepEqual(state.visited, checkpoints.slice(0, state.visited.length), `${level.id}: checkpoints stay ordered`);
      if (last) await evaluate(`${debug}.advance(1, ${JSON.stringify({ x: command.x, y: command.y })})`);
    }
    const won = (await snapshot()).state;
    const expectedTicks = commands.reduce((sum, command) => sum + command.ticks, 0);
    assert.equal(won.won, true, level.id);
    assert.equal(won.tick, expectedTicks, level.id);
    assert.equal(won.deaths, 0, level.id);
    assert.deepEqual(won.visited, checkpoints, `${level.id}: every checkpoint in order`);
    expectedRuns[level.id] = { ticks: expectedTicks, deaths: 0 };
    assert.equal(await text('overlay-title'), index === LEVELS.length - 1 ? 'Campaign complete.' : 'Level clear.');
    log(`PASS: ${level.id}: ${won.tick} ticks, zero deaths, ${won.visited.length} ordered checkpoints.`);
    if (index < LEVELS.length - 1) await click('#primary-action');
  }
  const progress = await saved();
  assert.deepEqual(JSON.parse(progress!).runs, expectedRuns, 'All exact records saved');

  // Deliberately reuse a built-in ID and finish faster: a broken playtest guard would overwrite its record.
  await click('#menu-toggle'); await click('#editor-tab');
  const quick = parseLevel({ ...room('.', LEVELS[0].id), goal: { x: 13, y: 8 } });
  await imported(quick); await click('#playtest');
  await key('KeyD', true);
  await until('Imported playtest finishes', async () => (await snapshot()).state.won);
  await key('KeyD', false);
  assert.equal(await text('finish-best'), 'PLAYTEST');
  assert.ok((await snapshot()).state.tick < expectedRuns[quick.id].ticks, 'Playtest fixture could overwrite the built-in best if isolation were broken');
  assert.equal(await saved(), progress, 'Winning playtests must not modify built-in records');
  log('PASS: winning imported playtest with a built-in ID leaves campaign records unchanged.');
  assertNoNewRequests(loadedRequests);
  log(`PASS: all ${LEVELS.length} courses and editor/input checks work offline with no additional asset requests.`);

  await offline(false);
  const beforeReload = loadEvents;
  await page.call('Page.reload', { ignoreCache: true });
  await until('Reload document load', async () => loadEvents > beforeReload);
  await until('Debug reload restores the initial intro', async () => evaluate<boolean>(
    `document.readyState === 'complete' && Boolean(${debug}) && ${debug}.snapshot().state.tick === 0 && !${debug}.snapshot().started`));
  assert.equal(await saved(), progress, 'Reload preserves local records');
  assert.equal(await text('completion-count'), `${LEVELS.length} / ${LEVELS.length} cleared`, 'Reload hydrates progress into menu');
  const beforeNavigation = loadEvents;
  await page.call('Page.navigate', { url: `${origin}/` });
  await until('Ordinary document load', async () => loadEvents > beforeNavigation);
  await until('Ordinary production game boot', async () => evaluate<boolean>(
    "location.search === '' && document.readyState === 'complete' && Boolean(document.querySelector('#viewport canvas')) && !document.getElementById('primary-action').disabled"));
  assert.equal(await evaluate(`typeof ${debug}`), 'undefined', 'Non-debug play must not expose the debug API');
  assert.equal(await saved(), progress);
  await pause(250); await offline(true);
  const ordinaryRequests = requests.length, timer = await text('timer');
  await click('#primary-action'); await key('ArrowRight', true);
  await until('Ordinary offline play advances', async () => await text('timer') !== timer);
  await key('ArrowRight', false); await click('#pause');
  const pausedTimer = await text('timer');
  await pause(180);
  assert.equal(await text('timer'), pausedTimer);
  assertNoNewRequests(ordinaryRequests);
  assert.equal(await evaluate(`typeof ${debug}`), 'undefined');
  log('PASS: save/reload hydrates progress; ordinary non-debug play stays private and works offline.');
}
