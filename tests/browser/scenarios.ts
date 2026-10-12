import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { AFTERSHOCK_LEVELS as LEVELS } from '../../data/aftershock.ts';
import { AFTERSHOCK_REPLAYS as REPLAYS } from '../../data/aftershock-replays.ts';
import { checkRoughGame } from './rough-world.ts';
import { TERRAIN } from '../../data/terrain.ts';
import { parseLevel, type Level } from '../../core/level.ts';
import type { State } from '../../core/simulation.ts';
import { PROGRESS_KEY, DRAFT_KEY } from '../../application/storage.ts';
import { Cdp, waitFor } from './runtime.ts';
import { readStored } from './persistence.ts';

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
  if (await page.evaluate('window.__BOUNDSTOY__.snapshot().level.version === 2'))
    return checkRoughGame({ page, origin, signal, requests, log });
  let loadEvents = 0;
  page.on('Page.loadEventFired', () => { loadEvents++; });
  const evaluate = <T>(source: string) => page.evaluate<T>(source);
  const snapshot = () => evaluate<Snapshot>(`${debug}.snapshot()`);
  const text = (id: string) => evaluate<string>(`document.getElementById(${JSON.stringify(id)}).textContent`);
  const saved = () => readStored(page, PROGRESS_KEY, signal);
  const pause = (ms: number) => delay(ms, undefined, { signal });
  const until = <T>(label: string, probe: () => Promise<T | false | null>) => waitFor(label, probe, 5000, signal);
  const keyCodes: Record<string, [string, number]> = {
    ArrowRight: ['ArrowRight', 39], ArrowLeft: ['ArrowLeft', 37],
    KeyD: ['d', 68], KeyA: ['a', 65], KeyR: ['r', 82], Enter: ['Enter', 13],
    Space: [' ', 32], Escape: ['Escape', 27], Tab: ['Tab', 9],
  };
  async function key(code: string, down: boolean, modifiers = 0, autoRepeat = false) {
    const [key, virtualKey] = keyCodes[code];
    await page.call('Input.dispatchKeyEvent', {
      type: down ? 'keyDown' : 'keyUp', code, key, modifiers, autoRepeat,
      windowsVirtualKeyCode: virtualKey, nativeVirtualKeyCode: virtualKey,
      ...(down && code === 'Enter' ? { text: '\r', unmodifiedText: '\r' } : {}),
    });
  }
  async function press(code: string, modifiers = 0) { await key(code, true, modifiers); await key(code, false, modifiers); }
  async function controlPoint(selector: string, targetSize = 0) {
    return evaluate<{ x: number; y: number }>(`(() => {
      const node = document.querySelector(${JSON.stringify(selector)});
      if (!node || node.disabled || !node.getClientRects().length) throw new Error('Unavailable control: ' + ${JSON.stringify(selector)});
      node.scrollIntoView({block: 'center'});
      const rect = node.getBoundingClientRect(), x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
      if (rect.left < 0 || rect.top < 0 || rect.right > innerWidth || rect.bottom > innerHeight)
        throw new Error('Clipped control: ' + ${JSON.stringify(selector)});
      // Compositor translations can leave ~0.00003 CSSpx of DOMRect rounding.
      if (rect.width + 0.001 < ${targetSize} || rect.height + 0.001 < ${targetSize})
        throw new Error('Small touch target: ' + ${JSON.stringify(selector)} + ' ' + JSON.stringify({
          width: rect.width, height: rect.height, active: node.matches(':active'),
          transform: getComputedStyle(node).transform,
          animations: node.getAnimations().map(a => ({ state: a.playState, time: a.currentTime }))
        }));
      if (!node.contains(document.elementFromPoint(x, y))) throw new Error('Obscured control: ' + ${JSON.stringify(selector)});
      return {x, y};
    })()`);
  }
  async function click(selector: string, targetSize = 0) {
    const point = await controlPoint(selector, targetSize);
    await page.call('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
    await page.call('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
  }
  async function tap(selector: string) {
    const point = await controlPoint(selector, 44);
    await page.call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, id: 1 }] });
    await page.call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  const layouts = [
    { name: 'desktop', width: 1280, height: 800, touch: false },
    { name: 'portrait', width: 390, height: 844, touch: true },
    { name: 'landscape', width: 844, height: 390, touch: true },
  ];
  async function viewportLayout(layout: typeof layouts[number]) {
    await page.call('Emulation.setDeviceMetricsOverride', {
      width: layout.width, height: layout.height, deviceScaleFactor: 1, mobile: false,
    });
    await page.call('Emulation.setTouchEmulationEnabled', { enabled: layout.touch });
    await until(`${layout.name}: viewport resized`, () => evaluate<boolean>(
      `innerWidth === ${layout.width} && innerHeight === ${layout.height}`));
    await pause(80);
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, `${layout.name}: no horizontal clipping`);
  }
  async function movementDisabled(label: string) {
    assert.equal(await evaluate("[...document.querySelectorAll('[data-direction]')].every(button => button.disabled)"),
      true, `${label}: no movement controls active behind the overlay/menu`);
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
    await movementDisabled(label);
    // Drain the one-shot pause/ResizeObserver invalidation, independent of GPU speed.
    await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))');
    const frames = await evaluate<number>(`${debug}.metrics().frames`);
    await pause(180);
    const after = await snapshot();
    assert.deepEqual(after.state, before.state, `${label}: paused simulation must not advance`);
    assert.equal(await evaluate(`${debug}.metrics().frames`), frames, `${label}: unchanged paused scene renders no frames`);
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
  async function playing(label: string) {
    const current = await snapshot();
    assert.equal(current.mode, 'play', label);
    assert.equal(current.started, true, `${label}: no extra Play action`);
    assert.equal(current.paused, false, `${label}: not left paused by a focus transition`);
    assert.equal(current.state.won, false, label);
    assert.equal(await evaluate("document.getElementById('overlay').hidden"), true, `${label}: no instructional overlay`);
    assert.equal(await evaluate('document.activeElement.id'), 'viewport', `${label}: keyboard focus enters the game`);
    assert.equal(await evaluate("document.getElementById('game-menu').open"), false, `${label}: menu closed`);
    assert.equal(await evaluate("[...document.querySelectorAll('[data-direction]')].every(button => !button.disabled)"),
      true, `${label}: movement controls enabled`);
    assert.deepEqual(current.input, { x: 0, y: 0 }, `${label}: no inherited input`);
    await until(`${label}: live loop`, async () => (await snapshot()).state.tick >= current.state.tick + 8);
  }

  const metrics = await evaluate<{ drawCalls: number; triangles: number }>(`${debug}.metrics()`);
  assert.ok(metrics.drawCalls > 0 && metrics.triangles > 0, 'Production WebGL scene actually rendered');
  await pause(250); // Include Chromium's deferred favicon request before taking the offline baseline.
  assert.ok(requests.some(url => new URL(url).pathname.endsWith('.js')), 'Production JavaScript was loaded');
  assert.ok(requests.some(url => new URL(url).pathname.endsWith('.css')), 'Production stylesheet was loaded');
  await offline(true);
  const loadedRequests = requests.length;
  assert.equal(await saved(), null, 'Fresh profile must not inherit player records');
  const initial = await snapshot();
  assert.equal(initial.started, false, 'Initial entry waits for intent');
  assert.equal(initial.state.tick, 0);
  assert.equal(await text('overlay-title'), 'Small tracks. Big flow.');
  assert.match(await text('overlay-copy'), /WASD.*arrow keys.*touch arrows/i);
  assert.notEqual(await text('overlay-title'), initial.level.name, 'Initial Play is generic, not a level tutorial');
  assert.notEqual(await text('overlay-copy'), initial.level.description, 'Level instructions belong in non-blocking hints or optional Help');
  assert.equal(await text('audio'), 'Sound off', 'Sound remains opt-in');
  for (const layout of layouts) {
    await viewportLayout(layout);
    await controlPoint('#primary-action', 44); await controlPoint('#menu-toggle', 44);
    await movementDisabled(`${layout.name} initial entry`);
    assert.equal((await snapshot()).state.tick, 0, 'Resizing before initial Play cannot start the simulation');
  }
  await viewportLayout(layouts[0]);
  assert.equal(await evaluate('document.activeElement.id'), 'primary-action', 'Initial Play has keyboard focus');

  await press('Enter');
  await playing('Initial Play');
  log('PASS: generic intentional entry fits desktop/portrait/landscape; Enter starts with sound off.');
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

  await click('#primary-action'); await key('KeyD', true); await moving();
  await press('KeyR'); await playing('Restart with a direction still held');
  await key('KeyD', true, 0, true);
  await resumedWithoutInput('Auto-repeat cannot re-arm a cleared restart key');
  await key('KeyD', false);
  await key('KeyD', true); await moving();
  await click('#menu-toggle'); await click('[data-level="1"]');
  await playing('Select another level while a direction is held');
  await key('KeyD', true, 0, true);
  await resumedWithoutInput('Auto-repeat cannot inherit a key into another level');
  await key('KeyD', false); await click('#pause');
  log('PASS: held-key restart/selection clear movement and ignore auto-repeat until a fresh press.');

  await page.call('Emulation.setCPUThrottlingRate', { rate: 4 });
  try {
    await click('#primary-action'); await resumedWithoutInput('CPU-throttled resume');
    const stall = await evaluate<{ before: number; after: number }>(`(() => {
      const before = ${debug}.snapshot().state.tick, start = performance.now();
      while (performance.now() - start < 200) {}
      return new Promise(resolve => requestAnimationFrame(() =>
        resolve({before, after: ${debug}.snapshot().state.tick})));
    })()`);
    assert.ok(stall.after > stall.before && stall.after - stall.before <= 13,
      `First post-stall frame must have bounded catch-up: ${JSON.stringify(stall)}`);
    await click('#pause'); await stoppedWhilePaused('CPU-throttled pause');
    log(`PASS: 4x CPU throttle and a 200 ms main-thread stall recover with ${stall.after - stall.before} ticks, then pause cleanly.`);
  } finally {
    await page.call('Emulation.setCPUThrottlingRate', { rate: 1 });
  }

  await click('#primary-action'); await key('KeyD', true); await moving();
  const { targetInfo } = await page.call<{ targetInfo: { targetId: string } }>('Target.getTargetInfo');
  const other = await page.call<{ targetId: string }>('Target.createTarget', { url: 'about:blank', background: false });
  try {
    await until('Game hidden by another owned tab', () => evaluate<boolean>('document.hidden'));
    const hidden = await snapshot(), frames = await evaluate<number>(`${debug}.metrics().frames`);
    assert.equal(hidden.paused, true, 'Hidden game pauses');
    assert.deepEqual(hidden.input, { x: 0, y: 0 }, 'Hiding clears held keys');
    await movementDisabled('Hidden game');
    await pause(250);
    assert.deepEqual((await snapshot()).state, hidden.state, 'Hidden game does not simulate');
    assert.equal(await evaluate(`${debug}.metrics().frames`), frames, 'Hidden game renders no frames');
  } finally {
    await page.call('Target.closeTarget', { targetId: other.targetId });
    await page.call('Target.activateTarget', { targetId: targetInfo.targetId });
  }
  await until('Game visible again', () => evaluate<boolean>('!document.hidden'));
  await key('KeyD', false); await stoppedWhilePaused('Visible return waits for resume');
  await click('#primary-action'); await resumedWithoutInput('Visible return resume');
  log('PASS: real tab hiding clears held input and stops simulation/rendering; return waits for explicit resume.');

  await press('Escape'); await press('Tab'); await press('Tab'); await press('Enter');
  assert.deepEqual((await snapshot()).level, LEVELS[1]);
  await playing('Keyboard menu level selection');

  await click('#menu-toggle'); await click('#editor-tab');
  await click('.json-panel summary');
  const ice = room('~');
  await imported(ice); await click('#export');
  const exported = await evaluate<string>("document.getElementById('level-json').value");
  assert.deepEqual(JSON.parse(exported), ice, 'Export preserves full draft');
  await click('#new-course'); await inputJSON(exported); await click('#import'); await click('#export');
  assert.deepEqual(JSON.parse(await evaluate<string>("document.getElementById('level-json').value")), ice, 'Export/import roundtrip');
  const draftBefore = await readStored(page, DRAFT_KEY, signal);
  await inputJSON('{"version":'); await click('#import');
  assert.deepEqual((await snapshot()).level, ice, 'Invalid JSON preserves the live draft');
  assert.equal(await readStored(page, DRAFT_KEY, signal), draftBefore, 'Invalid JSON preserves saved draft');
  assert.equal(await evaluate("!document.getElementById('notice').hidden && document.getElementById('notice').classList.contains('error')"), true);
  assert.match(await text('notice-text'), /Import rejected/i);
  await click('#dismiss-notice');
  log('PASS: editor export/import roundtrip; invalid JSON shows an error and preserves live/saved draft.');

  await click('#playtest');
  assert.equal((await snapshot()).testing, true);
  await playing('Editor playtest');
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

  assert.ok(LEVELS.length > 0, 'Campaign must not be empty');
  assert.equal(REPLAYS.length, LEVELS.length, 'Every current level needs a reference replay');
  const expectedRuns: Record<string, { ticks: number; deaths: number }> = {};
  async function witness(index: number) {
    // Reset explicitly: normal Next/Retry actions run live even on a ?debug page.
    await evaluate(`${debug}.load(${index})`);
    const reset = await snapshot(), commands = REPLAYS[index], level = LEVELS[index];
    assert.deepEqual(reset.level, level, 'Browser bundle matches this worktree LEVELS');
    assert.equal(reset.state.tick, 0);
    assert.equal(reset.started, true, 'Debug inspection uses pause, never a level tutorial');
    assert.equal(reset.paused, true);
    assert.equal(await text('overlay-title'), 'Paused.');
    await stoppedWhilePaused(`${level.id} debug reset`);
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
    await movementDisabled(`${level.id} results`);
    return won;
  }
  // Finish the last missing course at index 1, not at the end of the array.
  // Next must skip already-cleared routes, wrap, and celebrate actual completion.
  const completionOrder = [0, ...LEVELS.map((_, index) => index).slice(2), 1];
  for (const [ordinal, index] of completionOrder.entries()) {
    const level = LEVELS[index];
    const won = await witness(index);
    const complete = ordinal === LEVELS.length - 1;
    assert.equal(await text('overlay-title'), complete ? 'Campaign complete.' : 'Level clear.');
    assert.match(await text('finish-comparison'), /First clear/);
    log(`PASS: ${level.id}: ${won.tick} ticks, zero deaths, ${won.visited.length} ordered checkpoints.`);
    if (index === 0 || complete) await press('Enter');
    else await click('#primary-action');
    if (complete) {
      assert.equal(await evaluate("document.getElementById('game-menu').open"), true, 'Completed campaign offers level choice, not a destructive restart');
      await click('[data-level="0"]');
      await playing('Choose a cleared course');
    } else {
      const next = Array.from({ length: LEVELS.length }, (_, offset) => (index + 1 + offset) % LEVELS.length)
        .find(candidate => !expectedRuns[LEVELS[candidate].id]);
      assert.notEqual(next, undefined);
      assert.deepEqual((await snapshot()).level, LEVELS[next!]);
      await playing('Next uncleared level');
    }
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
  await click('#primary-action');
  assert.equal((await snapshot()).mode, 'edit', 'Completed playtest returns directly to editor');
  assert.deepEqual((await snapshot()).level, quick);
  log('PASS: winning imported playtest with a built-in ID leaves campaign records unchanged.');

  for (const layout of layouts) {
    await viewportLayout(layout);
    const activate = layout.touch ? tap : (selector: string) => click(selector, 44);
    assert.equal(await text('play-tab'), 'Restart game level');
    await activate('#play-tab');
    await playing(`${layout.name}: deliberate editor-to-game restart`);
    await activate('#menu-toggle');
    await stoppedWhilePaused(`${layout.name}: menu`);
    await activate('#help');
    assert.equal(await text('help-description'), (await snapshot()).level.description, 'Full instructions remain in optional Help');
    await press('Tab', 8);
    assert.equal(await evaluate(`document.activeElement === [...document.querySelectorAll('#game-menu button:not(:disabled), #game-menu input:not(:disabled)')]
      .filter(button => button.getClientRects().length).at(-1)`), true, 'Help wraps reverse Tab to the last visible menu action');
    await activate('#help-back');
    await activate('[data-level="0"]');
    await playing(`${layout.name}: level selection`);
    await press('KeyR'); await playing(`${layout.name}: keyboard restart`);
    if (layout.touch) {
      const point = await controlPoint('[data-direction="right"]', 44);
      await page.call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, id: 1 }] });
      await moving();
      assert.equal(await evaluate("document.querySelector('[data-direction=\"right\"]').classList.contains('pressed')"), true);
      await page.call('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      await resumedWithoutInput(`${layout.name}: touch cancellation`);
      assert.equal(await evaluate("document.querySelector('.touch-controls .pressed') === null"), true, 'Cancelled touch releases capture and styling');
      await page.call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, id: 2 }] });
      await moving();
      await press('KeyR'); await playing(`${layout.name}: restart while touch remains down`);
      await page.call('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...point, id: 2 }] });
      await resumedWithoutInput(`${layout.name}: continued contact cannot re-arm cleared touch`);
      assert.equal(await evaluate("document.querySelector('.touch-controls .pressed') === null"), true);
      await page.call('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    }
    await activate('#pause'); await stoppedWhilePaused(`${layout.name}: pause`);
    await activate('#primary-action'); await playing(`${layout.name}: resume`);
    await activate('#pause'); await activate('#retry-course');
    await playing(`${layout.name}: paused retry`);
    await activate('#restart'); await playing(`${layout.name}: restart button`);
    await witness(0);
    await controlPoint('#primary-action', 44); await controlPoint('#retry-course', 44);
    if (layout.touch) await activate('#retry-course');
    else {
      await press('Tab');
      assert.equal(await evaluate('document.activeElement.id'), 'retry-course', 'Results expose Retry in keyboard order');
      await press('Enter');
    }
    await playing(`${layout.name}: result retry`);
    assert.deepEqual((await snapshot()).level, LEVELS[0]);
    await witness(0);
    assert.match(await text('finish-comparison'), /Matched your personal best/);
    assert.equal(await text('primary-action'), 'Choose a level →');
    await activate('#primary-action');
    assert.equal(await evaluate("document.getElementById('game-menu').open"), true);
    await activate('[data-level="1"]'); await playing(`${layout.name}: choose another cleared level`);
    assert.deepEqual((await snapshot()).level, LEVELS[1]);
    await witness(LEVELS.length - 1);
    assert.equal(await text('overlay-title'), 'Campaign complete.');
    await controlPoint('#retry-course', 44);
    await activate('#primary-action');
    assert.equal(await evaluate("document.getElementById('game-menu').open"), true);
    await activate('[data-level="0"]'); await playing(`${layout.name}: completed campaign level choice`);
    assert.deepEqual((await snapshot()).level, LEVELS[0]);
    await activate('#menu-toggle'); await activate('#editor-tab');
    assert.deepEqual((await snapshot()).level, quick, 'Returning to editor retains the saved draft');
    await activate('#playtest'); await playing(`${layout.name}: playtest`);
    await activate('#editor-return');
    assert.equal((await snapshot()).mode, 'edit', 'Playtest return needs no popup');
    assert.deepEqual((await snapshot()).level, quick);
    assert.equal(await saved(), progress, 'Navigation, retries and playtests preserve exact campaign records');
    assert.equal(await text('audio'), 'Sound off', 'No navigation action opts into sound');
    log(`PASS: ${layout.name} ${layout.width}x${layout.height}: Help, selection, restart/retry/completed choice, pause, editor and ${layout.touch ? 'real touch/cancel' : 'mouse/keyboard'}; all actions fit with 44px targets.`);
  }
  await viewportLayout(layouts[0]);
  const rebuilds: { geometries: number; textures: number }[][] = [];
  for (let round = 0; round < 4; round++) {
    const counts: { geometries: number; textures: number }[] = [];
    for (let index = 0; index < LEVELS.length; index++) {
      counts.push(await evaluate<{ geometries: number; textures: number }>(`(() => {
        ${debug}.load(${index});
        const {geometries,textures} = ${debug}.metrics();
        return {geometries,textures};
      })()`));
    }
    rebuilds.push(counts);
  }
  for (const [round, counts] of rebuilds.entries()) {
    assert.deepEqual(counts, rebuilds[0], `Rebuild round ${round}: stable geometry/texture counts per level`);
    for (const count of counts) assert.ok(count.geometries > 0 && count.textures > 0, 'resources are actually rendered');
  }
  const editorCounts: { geometries: number; textures: number }[] = [];
  for (let round = 0; round < 4; round++) {
    await click('#menu-toggle'); await click('#editor-tab');
    await click('#playtest'); await playing(`Scene stress ${round}: playtest`);
    await click('#editor-return');
    await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))');
    const count = await evaluate<{ geometries: number; textures: number }>(
      `(() => { const {geometries,textures} = ${debug}.metrics(); return {geometries,textures}; })()`);
    editorCounts.push(count);
    assert.deepEqual(count, editorCounts[0], `Editor return ${round}: stable geometry/texture counts`);
    assert.deepEqual((await snapshot()).input, { x: 0, y: 0 });
  }
  assert.equal(await saved(), progress, 'Stress transitions must not alter completed records');
  log(`PASS: ${4 * LEVELS.length} level rebuilds and 4 editor/playtest returns keep stable resources; per-level ${JSON.stringify(rebuilds[0])}, editor ${JSON.stringify(editorCounts[0])}.`);
  assertNoNewRequests(loadedRequests);
  log(`PASS: all ${LEVELS.length} courses and editor/input checks work offline with no additional asset requests.`);

  await offline(false);
  const beforeReload = loadEvents;
  await page.call('Page.reload', { ignoreCache: true });
  await until('Reload document load', async () => loadEvents > beforeReload);
  await until('Reload restores generic initial entry', async () => evaluate<boolean>(
    `document.readyState === 'complete' && Boolean(${debug}) && ${debug}.snapshot().state.tick === 0 && !${debug}.snapshot().started`));
  assert.equal(await saved(), progress, 'Reload preserves local records');
  assert.equal(await text('overlay-title'), 'Find your next flow.');
  assert.equal(await text('primary-action'), 'Continue →');
  assert.equal(await text('completion-count'), `${LEVELS.length} / ${LEVELS.length} cleared`, 'Reload hydrates progress into menu');
  await click('#menu-toggle'); await click('[data-level="2"]');
  await playing('Selecting a level before initial Play');
  assert.deepEqual((await snapshot()).level, LEVELS[2]);
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
  await click('#menu-toggle'); await click('[data-level="1"]');
  assert.equal(await text('course-title'), LEVELS[1].name);
  assert.equal(await evaluate("document.getElementById('overlay').hidden"), true, 'Ordinary selection needs no second Play');
  assert.equal(await evaluate('document.activeElement.id'), 'viewport');
  const selectedTimer = await text('timer');
  await until('Ordinary selection runs live', async () => await text('timer') !== selectedTimer);
  await click('#pause'); await click('#retry-course');
  assert.equal(await evaluate("document.getElementById('overlay').hidden"), true, 'Ordinary retry needs no second Play');
  const retryTimer = await text('timer');
  await until('Ordinary retry runs live', async () => await text('timer') !== retryTimer);
  await click('#pause');
  assertNoNewRequests(ordinaryRequests);
  assert.equal(await evaluate(`typeof ${debug}`), 'undefined');
  log('PASS: save/reload hydrates progress; ordinary non-debug play stays private and works offline.');
}
