import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AFTERSHOCK_LEVELS as LEVELS } from '../../data/aftershock.ts';
import { AFTERSHOCK_TARGETS } from '../../data/aftershock.ts';
import { AFTERSHOCK_MASTERY_REPLAYS } from '../../data/aftershock-replays.ts';
import { AFTERSHOCK_REPLAYS as REPLAYS } from '../../data/aftershock-replays.ts';
import { captureRoughWorld } from './rough-world.ts';
import { PROGRESS_KEY } from '../../application/storage.ts';
import { FAILURE_REPLAYS, LANDING_FAILURE_REPLAYS } from '../fixtures/aftershock-failures.ts';
import { main } from '../../scripts/browser-check.ts';
import { waitFor } from './runtime.ts';
import { readStored } from './persistence.ts';
import { hazardSample, type State } from '../../core/simulation.ts';
import { RULES } from '../../data/terrain.ts';
import { checkGame, type BrowserContext } from './scenarios.ts';
import { checkJourney } from './journey.ts';
import { runLegacyChecks } from './legacy-registry.ts';

export async function checkAftershock(context: BrowserContext) {
  const { page, origin, signal, log } = context;
  if (await page.evaluate('window.__BOUNDSTOY__.snapshot().level.version === 2'))
    return captureRoughWorld(context);
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
  assert.deepEqual(LEVELS.map(level => level.name), ['Borrowed Ground', 'Crosscurrent', 'Checkerboard']);
  await page.call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  assert.deepEqual(await page.evaluate("[...document.querySelectorAll('.course-card strong')].map(node => node.textContent)"),
    LEVELS.map(level => level.name), 'only the new levels appear in the playable selector');

  for (const [index, level] of LEVELS.entries()) {
    assert.deepEqual(level.checkpoints, [], 'single-puzzle maps have no redundant exit checkpoint');
    await page.evaluate(`window.__BOUNDSTOY__.load(${index}); document.getElementById('overlay').hidden = true;`);
    await capture(`${level.id}-board`);
    const ordinary = await run(REPLAYS[index]);
    assert.equal(ordinary.won, true);
    assert.equal(ordinary.deaths, 0);
    assert.deepEqual(ordinary.visited, [], 'the final landing does not save a checkpoint');
    assert.ok(ordinary.tick > AFTERSHOCK_TARGETS[level.id], 'ordinary route is not automatically mastered');
    assert.match(await text('finish-mastery'), /Clean.*Mastery/);
    await capture(`${level.id}-clean`);

    await page.evaluate(`window.__BOUNDSTOY__.load(${index})`);
    const master = await run(AFTERSHOCK_MASTERY_REPLAYS[index]);
    assert.equal(master.won, true);
    assert.equal(master.deaths, 0);
    assert.deepEqual(master.visited, []);
    assert.ok(master.tick <= AFTERSHOCK_TARGETS[level.id]);
    assert.match(await text('finish-mastery'), /Mastered/);
    await capture(`${level.id}-mastered`);

    await page.evaluate(`window.__BOUNDSTOY__.load(${index})`);
    const died = await run(FAILURE_REPLAYS[index]);
    assert.equal(died.deaths, 1);
    assert.equal(died.event, 'death');
    const respawn = await page.evaluate<State>(`window.__BOUNDSTOY__.advance(${RULES.respawnTicks})`);
    assert.equal(respawn.tick - respawn.patternOffset, 0);
    const assisted = await run(REPLAYS[index]);
    assert.equal(assisted.deaths, 1);
    assert.equal(assisted.won, true);
    assert.equal(assisted.tick, respawn.tick + ordinary.tick);
    assert.match(await text('finish-mastery'), /Assisted clear/);
    const saved = JSON.parse((await readStored(page, PROGRESS_KEY, signal))!).runs;
    assert.equal(saved[level.id].ticks, master.tick, 'slower assisted clear cannot replace clean mastery');
    assert.equal(saved[level.id].deaths, 0);
    log(`PASS: ${level.name}: clear ${ordinary.tick}, mastery ${master.tick}, target ${AFTERSHOCK_TARGETS[level.id]}; real retry preserves run costs.`);
  }

  for (const fixture of LANDING_FAILURE_REPLAYS) {
    const level = LEVELS[fixture.index];
    await page.evaluate(`window.__BOUNDSTOY__.load(${fixture.index})`);
    const reached = await run(fixture.approach);
    assert.deepEqual(reached.visited, []);
    assert.deepEqual(reached.checkpoint, level.spawn);
    assert.equal(reached.won, false);
    assert.equal(reached.deaths, 0);
    await page.evaluate("document.getElementById('overlay').hidden = true");
    await capture(`${level.id}-exit-landing`);
    const died = await run(fixture.failure);
    assert.equal(died.event, 'death', 'fixture backtracks into the completed field to cause a real death');
    const returned = await page.evaluate<State>(`window.__BOUNDSTOY__.advance(${RULES.respawnTicks})`);
    assert.deepEqual(returned.position, { x: level.spawn.x + 0.5, y: level.spawn.y + 0.5 });
    assert.deepEqual(returned.visited, reached.visited);
    assert.equal(returned.tick - returned.patternOffset, 0);
    assert.equal(returned.tick, died.tick + RULES.respawnTicks);
    const finished = await run(REPLAYS[fixture.index]);
    assert.equal(finished.won, true);
    assert.equal(finished.deaths, 1);
    log(`PASS: ${level.name}: final landing saves no checkpoint; backtrack death restarts the short puzzle.`);
  }

  // Watch from the safe spawn: capture the actual travel/group order, not just an empty board.
  for (const [index, level] of LEVELS.entries()) {
    const ignitions = [...new Set(level.hazards.map(hazard => (hazard.period - hazard.phase) % hazard.period))]
      .sort((a, b) => a - b).slice(0, 3);
    for (const tick of ignitions) {
      const state = await page.evaluate<State>(`(() => {
        window.__BOUNDSTOY__.load(${index});
        const state = window.__BOUNDSTOY__.advance(${tick});
        document.getElementById('overlay').hidden = true;
        return state;
      })()`);
      assert.equal(state.deaths, 0, 'the player can observe the sequence from its safe starting pad');
      await capture(`${level.id}-pattern-t${tick}`);
    }
  }
  const gridIndex = LEVELS.findIndex(level => level.name === 'Checkerboard'), grid = LEVELS[gridIndex];
  const gridPulses = grid.hazards.filter(hazard => hazard.kind === 'pulse');
  const light = gridPulses.find(hazard => (hazard.x + hazard.y) % 2 === 0
    && gridPulses.some(other => other.x === hazard.x + 1 && other.y === hazard.y));
  assert.ok(light, 'checkerboard supplies adjacent light/dark group cells');
  const quiet = Array.from({ length: gridPulses[0].period }, (_, tick) => tick).find(tick =>
    gridPulses.every(hazard => {
      const sample = hazardSample(hazard, tick);
      return !sample.warning && sample.cycle >= RULES.pulseEffectTicks;
    }));
  assert.notEqual(quiet, undefined, 'the grid has an observable quiet state between alternating groups');
  const shadePixels = await page.evaluate<number[][]>(`(() => {
    window.__BOUNDSTOY__.load(${gridIndex});
    window.__BOUNDSTOY__.advance(${quiet});
    document.getElementById('overlay').hidden = true;
    const canvas = document.querySelector('.viewport canvas'), rect = canvas.getBoundingClientRect();
    const image = document.createElement('canvas'); image.width = canvas.width; image.height = canvas.height;
    const context = image.getContext('2d'); context.drawImage(canvas, 0, 0);
    const ratio = canvas.width / rect.width;
    return [0, 1].map(offset => {
      const point = window.__BOUNDSTOY__.project({ x: ${light.x} + offset + 0.32, y: ${light.y} + 0.30 });
      const pixels = context.getImageData(Math.round((point.x - rect.left) * ratio) - 1,
        Math.round((point.y - rect.top) * ratio) - 1, 3, 3).data;
      return [0, 1, 2].map(channel => {
        let sum = 0; for (let i = channel; i < pixels.length; i += 4) sum += pixels[i];
        return sum / 9;
      });
    });
  })()`);
  const luminance = ([r, g, b]: number[]) => r * 0.2126 + g * 0.7152 + b * 0.0722;
  assert.ok(luminance(shadePixels[0]) > luminance(shadePixels[1]) * 1.03,
    `actual checkerboard plate pixels must preserve group contrast: ${JSON.stringify(shadePixels)}`);
  await capture(`${grid.id}-quiet-ground-groups`);
  for (const [width, height] of [[1280, 900], [390, 844]]) for (const reduced of [false, true]) {
    const suffix = `${width}x${height}-${reduced ? 'reduced' : 'full'}`;
    await page.call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await page.call('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }],
    });
    await reload(`visual-${suffix}`);
    for (const tick of [126, 127, 154, 158, 190]) {
      const state = await page.evaluate<State>(`(() => {
        window.__BOUNDSTOY__.load(${gridIndex});
        const state = window.__BOUNDSTOY__.advance(${tick});
        document.getElementById('overlay').hidden = true;
        return state;
      })()`);
      assert.equal(state.deaths, 0);
      await capture(`visual-grid-${suffix}-t${tick}`);
    }
    const corridorIndex = LEVELS.findIndex(level => level.name === 'Crosscurrent');
    for (const tick of [80, 84]) {
      await page.evaluate(`window.__BOUNDSTOY__.load(${corridorIndex});
        window.__BOUNDSTOY__.advance(${tick}); document.getElementById('overlay').hidden = true;`);
      await capture(`visual-corridor-${suffix}-t${tick}`);
    }
  }
  await page.call('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
  });
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

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main(process.argv.slice(2), checkAftershock);
  if (!process.exitCode) await runLegacyChecks(process.argv.slice(2), [checkGame, checkJourney, checkAftershock]);
}
