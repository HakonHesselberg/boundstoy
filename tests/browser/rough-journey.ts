import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { AFTERSHOCK_WORLD as world } from '../../data/aftershock-world.ts';
import { EIGHT_SECTION_ROUTES, openingCommand as c, type OpeningCommand } from '../../data/aftershock-world-replays.ts';
import { center } from '../../core/level.ts';
import { step, hazardTick, type State } from '../../core/simulation.ts';
import { createCheckpointSnapshot } from '../../application/run-snapshot.ts';
import { PREFERENCES_KEY } from '../../application/preferences.ts';
import { RUN_STORAGE_KEY } from '../../application/run-storage.ts';
import { CHECKPOINT_RECOVERIES } from '../fixtures/aftershock-world.ts';
import { productionRecovery } from '../fixtures/checkpoint-production.ts';
import { readStored } from './persistence.ts';
import { sliceRoute, worldDriver } from './rough-world.ts';
import type { BrowserContext } from './scenarios.ts';

function untilFailure(start: State, commands: readonly OpeningCommand[]) {
  let state = start;
  for (const command of commands) for (let i = 0; i < command.ticks; i++) {
    if (state.won || state.deaths > start.deaths) return state;
    state = step(world, state, command);
  }
  return state;
}

export async function checkRoughJourney(context: BrowserContext) {
  const { page, signal, log, origin, requests } = context, d = worldDriver(context);
  const wait = (ms = 200) => delay(ms, undefined, { signal });
  const key = (code: string, down: boolean, autoRepeat = false) => page.call('Input.dispatchKeyEvent', {
    type: down ? 'keyDown' : 'keyUp', code, key: code === 'Space' ? ' ' : code,
    windowsVirtualKeyCode: ({ KeyD: 68, KeyR: 82, Space: 32, Escape: 27, Tab: 9 } as Record<string, number>)[code],
    autoRepeat,
  });
  const press = async (code: string) => { await key(code, true); await key(code, false); };
  const playing = () => d.until('Intentional live world', '!__BOUNDSTOY__.snapshot().paused && __BOUNDSTOY__.persistence().ready');
  const frozen = async () => {
    await d.evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    const before = await d.snapshot(), frames = await d.evaluate('__BOUNDSTOY__.metrics().frames');
    assert.equal(before.paused, true); assert.deepEqual(before.input, { x: 0, y: 0 });
    await wait();
    assert.deepEqual((await d.snapshot()).state, before.state);
    assert.equal(await d.evaluate('__BOUNDSTOY__.metrics().frames'), frames);
  };

  assert.match(await d.text('controls-note'), /R.*checkpoint/i);
  assert.match(await d.evaluate<string>("document.getElementById('viewport').getAttribute('aria-label')"), /checkpoint/i);
  assert.equal(await d.text('intro-audio'), 'Sound off');
  await d.click('intro-audio');
  assert.equal(await d.evaluate('document.activeElement.id'), 'intro-audio');
  await d.click('menu-toggle');
  await d.evaluate(`const slider = document.getElementById('sound-volume');
    slider.value = '25'; slider.dispatchEvent(new Event('input', {bubbles:true}));
    slider.dispatchEvent(new Event('change', {bubbles:true}));`);
  const audioProbe = await page.call<{ identifier: string }>('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__audioContexts = 0;
    const NativeAudioContext = window.AudioContext;
    window.AudioContext = class extends NativeAudioContext {
      constructor(...args) { super(...args); window.__audioContexts++; }
    };` });
  try {
    await d.reload();
    assert.equal(await d.evaluate('window.__audioContexts'), 0, 'Saved sound never autoplays on boot');
    assert.equal(await d.evaluate("document.getElementById('sound-volume').value"), '25');
    assert.equal(await d.text('intro-audio'), 'Sound on');
    await d.click('primary-action'); await playing();
    await d.until('Remembered sound requires fresh intent', 'window.__audioContexts === 1');
    await d.click('menu-toggle'); await d.click('audio');
    assert.equal(await d.evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(PREFERENCES_KEY)})).sound`), false);
    await d.click('help');
    assert.match(await d.text('help-description'), /Aftershock|world|section/i);
    await d.click('help-back'); await d.click('menu-close');
  } finally { await page.call('Page.removeScriptToEvaluateOnNewDocument', audioProbe); }
  log('PASS production sound opt-in/volume/mute persistence, no autoplay, focused controls and world help.');

  await d.newRun(); await d.click('primary-action'); await playing();
  await key('KeyD', true);
  await d.until('Held world movement', '__BOUNDSTOY__.snapshot().state.velocity.x > 0');
  await key('KeyR', true);
  assert.equal(await d.evaluate("document.getElementById('new-run-confirm').open"), false);
  await playing();
  await key('KeyR', true, true); await key('KeyD', true, true);
  await wait();
  assert.equal(await d.evaluate("document.getElementById('new-run-confirm').open"), false);
  assert.deepEqual((await d.snapshot()).state.position, center(world.spawn));
  assert.deepEqual((await d.snapshot()).input, { x: 0, y: 0 });
  await key('KeyR', false); await key('KeyD', false);
  await key('KeyD', true); await press('Space'); await frozen();
  await key('KeyD', false); await press('Space'); await playing();
  await press('Tab'); await frozen();
  await d.click('primary-action'); await playing();
  await press('Escape'); await frozen();
  await d.click('menu-play'); await playing();
  const resumedTick = (await d.snapshot()).state.tick;
  await d.until('Resumed frame clock advances before injected stall',
    `__BOUNDSTOY__.snapshot().state.tick >= ${resumedTick + 8}`);

  await page.call('Emulation.setCPUThrottlingRate', { rate: 4 });
  try {
    const stalled = await d.evaluate<{ before: number; after: number }>(`(() => {
      const before = __BOUNDSTOY__.snapshot().state.tick, start = performance.now();
      while (performance.now() - start < 200) {}
      return new Promise(resolve => requestAnimationFrame(() =>
        resolve({before, after:__BOUNDSTOY__.snapshot().state.tick})));
    })()`);
    assert.ok(stalled.after > stalled.before && stalled.after - stalled.before <= 13,
      `Bounded first post-stall frame: ${JSON.stringify(stalled)}`);
  } finally { await page.call('Emulation.setCPUThrottlingRate', { rate: 1 }); }
  await key('KeyD', true);
  const { targetInfo } = await page.call<{ targetInfo: { targetId: string } }>('Target.getTargetInfo');
  const other = await page.call<{ targetId: string }>('Target.createTarget', { url: 'about:blank', background: false });
  try {
    await d.until('Native hidden world', 'document.hidden');
    const hidden = await d.snapshot(), frames = await d.evaluate('__BOUNDSTOY__.metrics().frames');
    assert.equal(hidden.paused, true); assert.deepEqual(hidden.input, { x: 0, y: 0 });
    await wait(250);
    assert.deepEqual((await d.snapshot()).state, hidden.state);
    assert.equal(await d.evaluate('__BOUNDSTOY__.metrics().frames'), frames);
  } finally {
    await page.call('Target.closeTarget', { targetId: other.targetId });
    await page.call('Target.activateTarget', { targetId: targetInfo.targetId });
  }
  await d.until('Visible world still waits', '!document.hidden');
  await key('KeyD', false); await frozen();
  log('PASS production held/repeated restart, Space, Tab, menu, native tab hiding and bounded 4x-CPU stall recovery.');

  await d.newRun();
  await d.run(sliceRoute(EIGHT_SECTION_ROUTES.ordinary, 0, 850));
  await d.click('menu-toggle'); await d.saved();
  const campaignBytes = await readStored(page, RUN_STORAGE_KEY, signal);
  await d.click('editor-tab');
  await d.evaluate(`document.querySelector('.json-panel').open = true;
    document.getElementById('level-json').value = ${JSON.stringify(JSON.stringify(world))};
    document.getElementById('import').click(); document.getElementById('export').click();`);
  assert.deepEqual(JSON.parse(await d.evaluate<string>("document.getElementById('level-json').value")), world);
  const resources: object[] = [];
  for (let i = 0; i < 4; i++) {
    await d.evaluate("document.getElementById('playtest').click(); __BOUNDSTOY__.advance(0)");
    assert.equal((await d.snapshot()).testing, true);
    if (i === 0) {
      const won = await d.run(EIGHT_SECTION_ROUTES.ordinary);
      assert.equal(won.won, true); assert.equal(won.tick, 5752);
    } else await d.run([c(120)]);
    assert.equal(await readStored(page, RUN_STORAGE_KEY, signal), campaignBytes,
      'A completed imported world with the campaign identity cannot alter its active save or records');
    await d.click('editor-return');
    await d.until('World editor focus redrawn', `__BOUNDSTOY__.snapshot().mode === 'edit'
      && __BOUNDSTOY__.camera().player.x === ${world.sections[0].bounds.x + world.sections[0].bounds.width / 2}`);
    const metrics = await d.evaluate<{ geometries: number; textures: number }>('__BOUNDSTOY__.metrics()');
    resources.push({ geometries: metrics.geometries, textures: metrics.textures });
  }
  for (const resourcesAfter of resources.slice(1)) assert.deepEqual(resourcesAfter, resources[0]);
  await d.reload();
  assert.equal((await d.snapshot()).state.tick, 850);
  log('PASS production world editor JSON roundtrip, full same-ID playtest isolation and bounded repeated resources.');

  for (const [index, fixture] of CHECKPOINT_RECOVERIES.entries()) {
    await d.newRun();
    const entry = await d.run(fixture.prefix);
    assert.equal(entry.deaths, 0); assert.equal(entry.visited.length, index + 1);
    const expectedDeath = untilFailure(entry, fixture.attempt);
    assert.equal(expectedDeath.deaths, 1);
    const death = await d.run(sliceRoute(fixture.attempt, 0, expectedDeath.tick - entry.tick));
    assert.deepEqual(death, expectedDeath);
    assert.equal(death.respawnTicks, 54);
    const savedDeath = JSON.parse((await d.saved()).active);
    assert.deepEqual(savedDeath, createCheckpointSnapshot(world, savedDeath.runId, death));
    const respawn = await d.run([c(54)]);
    assert.deepEqual(respawn.position, center(world.checkpoints[index]));
    assert.equal(respawn.respawnTicks, 0); assert.equal(respawn.tick, death.tick + 54);
    assert.equal(respawn.patternOffset, death.patternOffset, 'ordinary respawn preserves the active clock');
    assert.equal(hazardTick(respawn), hazardTick(death) + 54);
    assert.deepEqual(JSON.parse((await d.saved()).active), savedDeath, 'respawn completion is not a save boundary');
    await d.click('menu-toggle');
    const pausedSave = JSON.parse((await d.saved()).active);
    assert.deepEqual(pausedSave, createCheckpointSnapshot(world, savedDeath.runId, respawn));
    await d.reload();
    assert.deepEqual((await d.snapshot()).state, pausedSave.state);
    const recovery = productionRecovery(pausedSave.state, index);
    const finish = await d.run(recovery.commands);
    assert.deepEqual(finish, recovery.state);
    assert.equal(finish.deaths, 1);
    log(`PASS checkpoint ${index + 1}: death ${death.tick}, continuing live clock, checkpoint reload ${respawn.tick}, wait ${recovery.wait}, downstream ${finish.tick}.`);
  }
  assert.doesNotMatch(await d.text('finish-mastery'), /Deathless completion achieved/);
  await d.saved();

  await page.call('Page.navigate', { url: `${origin}/?ordinary-world` });
  await d.until('Ordinary production boot', `location.search === '?ordinary-world'
    && document.getElementById('primary-action') && !document.getElementById('primary-action').disabled
    && document.getElementById('save-status').textContent !== 'Loading save...'`);
  assert.equal(await d.evaluate('typeof window.__BOUNDSTOY__'), 'undefined');
  await wait(250);
  await page.call('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  const baselineRequests = requests.length;
  await d.click('primary-action');
  await d.until('Ordinary world starts', "document.getElementById('overlay').hidden");
  const timer = await d.text('timer');
  await key('KeyD', true);
  await d.until('Ordinary offline world advances', `document.getElementById('timer').textContent !== ${JSON.stringify(timer)}`);
  await key('KeyD', false); await press('Space');
  const pausedTimer = await d.text('timer'); await wait();
  assert.equal(await d.text('timer'), pausedTimer);
  assert.equal(requests.length, baselineRequests);
  log('PASS ordinary non-debug world play, offline input and explicit pause.');
}
