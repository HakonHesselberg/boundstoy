import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { main } from '../../scripts/browser-check.ts';
import { worldFixture } from '../fixtures/world.ts';
import { hazardSample, hazardTick, type State } from '../../core/simulation.ts';
import { type WorldView } from '../../presentation/world-camera.ts';
import { worldSectionIndex } from '../../core/world.ts';
import type { Point } from '../../core/level.ts';
import type { BrowserContext } from './scenarios.ts';
import { waitFor } from './runtime.ts';

const source = worldFixture();
const world = worldFixture({ hazards: [...source.hazards,
  { kind: 'pulse', x: 20, y: 5, period: 120, on: 1, phase: 41 },
  { kind: 'saw', from: { x: 11, y: 4 }, to: { x: 19, y: 4 }, period: 240, phase: 0 }] });
type Probe = {
  state: State; paused: boolean; input: Point;
  camera: { view: WorldView; extent: number; levelBuilds: number; player: Point; hazards: (Point & { visible: boolean })[] };
  metrics: { frames: number; geometries: number; textures: number; drawCalls: number };
  rect: { left: number; top: number; right: number; bottom: number; width: number; height: number };
  viewport: { width: number; height: number };
  playerScreen: Point; points: { global: Point; screen: Point; picked: Point }[];
};

export async function checkWorldCamera({ page, origin, signal, log }: BrowserContext) {
  const root = fileURLToPath(new URL('../..', import.meta.url));
  await mkdir(resolve(root, 'artifacts/world-camera'), { recursive: true });
  const out = await mkdtemp(resolve(root, 'artifacts/world-camera/run-'));
  log(`World camera captures/endstates: ${out}`);
  const evidence: object[] = [];
  let activeWorld = world;
  const evaluate = <T>(expression: string) => page.evaluate<T>(expression);
  const probe = () => evaluate<Probe>(`(() => {
    const d = window.__BOUNDSTOY__, s = d.snapshot(), camera = d.camera();
    const points = camera.view.sections.flatMap(i => {
      const section = s.level.sections[i], b = section.bounds;
      return [section.entry, { x: b.x, y: b.y }, { x: b.x + b.width - 1, y: b.y + b.height - 1 }];
    });
    for (const h of s.level.hazards) {
      const ends = h.kind === 'pulse' ? [h] : [h.from, h.to];
      if (ends.some(p => camera.view.sections.some(i => { const b = s.level.sections[i].bounds;
        return p.x >= b.x && p.x < b.x+b.width && p.y >= b.y && p.y < b.y+b.height; }))) points.push(...ends);
    }
    return { state: s.state, paused: s.paused, input: s.input, camera, metrics: d.metrics(),
      rect: document.querySelector('#viewport canvas').getBoundingClientRect().toJSON(),
      viewport: { width: document.getElementById('viewport').clientWidth, height: document.getElementById('viewport').clientHeight },
      playerScreen: d.project({ x: camera.player.x - 0.5, y: camera.player.y - 0.5 }),
      points: points.map(p => { const screen = d.project(p); return {
        global: { x: p.x, y: p.y }, screen, picked: d.pick(screen.x, screen.y) }; }) };
  })()`);
  const inside = (p: Point, s: Probe) => p.x > s.rect.left && p.x < s.rect.right
    && p.y > s.rect.top && p.y < s.rect.bottom;
  let builds = 0;
  const check = (p: Probe) => {
    assert.equal(p.camera.levelBuilds, builds, 'camera must not call setLevel/loadCourse');
    assert.equal(p.state.deaths, 0);
    assert.equal(p.state.patternOffset, 0);
    assert.equal(p.rect.width, p.viewport.width, 'canvas fills the actual viewport after import/resize');
    assert.equal(p.rect.height, p.viewport.height, 'canvas is not clipped by the actual viewport');
    assert.ok(inside(p.playerScreen, p), 'drawn player stays inside the actual canvas');
    assert.ok(Math.hypot(p.camera.player.x - p.state.position.x, p.camera.player.y - p.state.position.y) < 0.05,
      'accepted motion interpolation remains continuous, not reset at a view change');
    assert.deepEqual(p.camera.view.sections, [worldSectionIndex(activeWorld, p.state.visited)]);
    for (const point of p.points) {
      if (p.camera.view.kind === 'fixed')
        assert.ok(inside(point.screen, p), `revealed global tile ${JSON.stringify(point.global)} is visible`);
      assert.deepEqual(point.picked, point.global, 'production project/pick round-trip remains global');
    }
  };
  const capture = async (name: string, p: Probe) => {
    check(p);
    // Remove only capture-obscuring paused/import copy, never gameplay geometry.
    await evaluate(`document.getElementById('overlay').style.visibility = 'hidden'; document.getElementById('notice').hidden = true`);
    const image = await page.call<{ data: string }>('Page.captureScreenshot', { format: 'png' });
    await writeFile(resolve(out, `${name}.png`), Buffer.from(image.data, 'base64'));
    evidence.push({ name, ...p });
  };
  const key = (direction: number, down: boolean) => page.call('Input.dispatchKeyEvent', {
    type: down ? 'keyDown' : 'keyUp', code: direction > 0 ? 'ArrowRight' : 'ArrowLeft',
    key: direction > 0 ? 'ArrowRight' : 'ArrowLeft', windowsVirtualKeyCode: direction > 0 ? 39 : 37,
  });
  const pause = async (direction: number) => {
    await key(direction, false);
    await evaluate(`document.getElementById('pause').click()`);
    await delay(100, undefined, { signal });
  };
  const resume = () => evaluate(`document.getElementById('primary-action').click()`);
  const idle = async (hidden = false) => {
    await delay(100, undefined, { signal });
    const a = await probe();
    assert.equal(a.paused, true);
    assert.deepEqual(a.input, { x: 0, y: 0 });
    await delay(250, undefined, { signal });
    const b = await probe();
    assert.deepEqual(b.state, a.state, hidden ? 'hidden world freezes' : 'paused world freezes');
    assert.equal(b.metrics.frames, a.metrics.frames, 'idle world schedules no frames');
  };
  const advance = (ticks: number, direction: number) => evaluate<State>(`new Promise(resolve => {
    const state = window.__BOUNDSTOY__.advance(${ticks}, { x: ${direction}, y: 0 });
    // Let the software GPU/compositor consume each explicit frame instead of
    // queuing hundreds of draws before the next screenshot.
    requestAnimationFrame(() => requestAnimationFrame(() => resolve(state)));
  })`);
  const importFixture = async () => {
    await evaluate(`(() => {
      document.getElementById('editor-tab').click();
      document.getElementById('level-json').value = ${JSON.stringify(JSON.stringify(activeWorld))};
      document.getElementById('import').click();
      document.getElementById('playtest').click();
      window.__BOUNDSTOY__.advance(0);
    })()`);
    assert.equal(await evaluate(`window.__BOUNDSTOY__.snapshot().level.version`), 2, 'real UI imports validated joined world');
    await delay(100, undefined, { signal });
    builds = (await probe()).camera.levelBuilds;
  };

  for (const [width, height] of [[1280, 900], [390, 844], [844, 390]]) for (const reduced of [false, true]) {
    const tag = `${width}x${height}-${reduced ? 'reduced' : 'full'}`;
    await page.call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
    await page.call('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }],
    });
    const url = `${origin}/?debug&world-camera=${tag}`;
    await page.call('Page.navigate', { url });
    await waitFor('World camera boot', () => evaluate<boolean>(
      `location.href === ${JSON.stringify(url)} && Boolean(window.__BOUNDSTOY__) && window.__BOUNDSTOY__.metrics().frames > 0`),
    15000, signal);
    activeWorld = world;
    await importFixture();
    await capture(`${tag}-entry`, await probe());
    const extent = (await probe()).camera.extent;

    const drive = async (direction: number, target: number, label: string) => {
      let before = await probe();
      const views = new Set<string>();
      await resume(); await key(direction, true);
      await waitFor(`Held-input ${label}`, async () => {
        const p = await probe(); check(p);
        assert.equal(p.camera.extent, extent, 'held-input transitions never zoom');
        assert.equal(p.paused, false, 'view changes never pause or steal held input');
        assert.deepEqual(p.input, { x: direction, y: 0 });
        assert.ok(p.state.tick >= before.state.tick, 'elapsed clock never resets');
        assert.ok(p.state.visited.length >= before.state.visited.length, 'backtracking never downgrades progression');
        assert.ok(direction * (p.state.position.x - before.state.position.x) >= -1e-9, 'no teleport/backward jump');
        const view = `${p.camera.view.kind}-${p.camera.view.sections.join('-')}`;
        if (!views.has(view)) {
          views.add(view);
          await capture(`${tag}-${label}-${view}`, p);
        }
        before = p;
        return direction * (p.state.position.x - target) >= 0;
      }, 60000, signal);
      await pause(direction);
      return views;
    };
    const forward = await drive(1, 18.5, 'forward');
    assert.ok(forward.has('fixed-1') && forward.has('fixed-2'));
    if (!reduced) assert.ok(forward.has('reveal-1') && forward.has('reveal-2'));
    assert.equal((await probe()).state.visited.length, 2);
    const backward = await drive(-1, 3.5, 'backtrack');
    assert.ok(backward.has('track-2'), 'backtracking pans without revealing an uncollected puzzle or losing progress');
    const back = await probe();
    assert.equal(back.state.visited.length, 2);
    await capture(`${tag}-backtracked-progress-two`, back);
    await idle();

    // Resize the production canvas without rebuilding the level or disturbing progress.
    await page.call('Emulation.setDeviceMetricsOverride', { width: height, height: width, deviceScaleFactor: 1, mobile: height < 600 });
    await delay(150, undefined, { signal });
    const resized = await probe();
    assert.deepEqual(resized.state, back.state);
    await capture(`${tag}-resized`, resized);
    await idle();
    await page.call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
    await delay(150, undefined, { signal });

    // Exercise actual visibilitychange while holding input, not a synthetic pause.
    await resume(); await key(1, true);
    const { targetInfo } = await page.call<{ targetInfo: { targetId: string } }>('Target.getTargetInfo');
    const other = await page.call<{ targetId: string }>('Target.createTarget', { url: 'about:blank', background: false });
    try {
      await waitFor('Owned game tab hidden', () => evaluate<boolean>('document.hidden'), 5000, signal);
      await idle(true);
    } finally {
      await page.call('Target.closeTarget', { targetId: other.targetId });
      await page.call('Target.activateTarget', { targetId: targetInfo.targetId });
    }
    await waitFor('Game visible again', () => evaluate<boolean>('!document.hidden'), 5000, signal);
    await key(1, false); await idle();

    // Three uploads geometry lazily on its first visible phase. Warm ignition,
    // warning and idle at each section before comparing exact GPU counts; an
    // unobserved one-tick flash becoming visible is not a transition leak.
    for (const target of [3.5, 11.5, 19, 3.5]) {
      let p = await probe();
      const delta = target - p.state.position.x;
      await advance(Math.round(Math.abs(delta) / 0.03), Math.sign(delta));
      for (const hazard of world.hazards) if (hazard.kind === 'pulse') {
        for (const cycle of [0, hazard.period - 1, Math.floor(hazard.period / 2)]) {
          p = await probe();
          const current = hazardSample(hazard, hazardTick(p.state)).cycle;
          await advance((cycle - current + hazard.period) % hazard.period, 0);
        }
      }
    }
    const warmed = (await probe()).metrics;
    for (let repeat = 0; repeat < 3; repeat++) {
      for (const [direction, target] of [[1, 19], [-1, 3.5]]) {
        let p = await probe();
        while (direction * (target - p.state.position.x) > 0.04) {
          const ticks = Math.min(45, Math.max(1, Math.floor(Math.abs(target - p.state.position.x) / 0.03)));
          await advance(ticks, direction);
          p = await probe(); check(p);
          assert.equal(p.camera.extent, extent);
          assert.equal(p.state.visited.length, 2);
          p.camera.hazards.forEach((h, i) => {
            assert.deepEqual({ x: h.x, y: h.y }, hazardSample(world.hazards[i], hazardTick(p.state)).position,
              'offscreen hazards still sample the uninterrupted global clock');
          });
        }
      }
      const p = await probe();
      assert.equal(p.metrics.geometries, warmed.geometries, 'repeated transitions allocate no GPU geometry');
      assert.equal(p.metrics.textures, warmed.textures, 'repeated transitions allocate no textures');
    }
    await capture(`${tag}-repeated-endstate`, await probe());
    await idle();
    activeWorld = worldFixture({ hazards: world.hazards, sections: world.sections.map((s, i) => i !== 1 ? s : {
      ...s, camera: { mode: 'follow', frame: { x: 7, y: 0, width: 10, height: 8 } },
    }) });
    await importFixture();
    await advance(300, 1);
    await evaluate('__BOUNDSTOY__.animate(0.7)');
    const followBefore = await probe();
    assert.equal(followBefore.camera.view.kind, 'fixed');
    await capture(`${tag}-follow-before`, followBefore);
    await advance(80, 1);
    const followAfter = await probe();
    assert.equal(followAfter.camera.view.kind, 'fixed');
    assert.deepEqual(followBefore.camera.view.frame, followAfter.camera.view.frame,
      'authored follow hints do not reintroduce gameplay drift or zoom');
    await capture(`${tag}-follow-after`, followAfter);
    await idle();
    log(`PASS ${tag}: held forward/backtrack, global picking, resize, pause/hidden, three repeated round-trips`);
    await writeFile(resolve(out, 'endstates.json'), JSON.stringify(evidence, null, 2));
  }
  log(`PASS: named world camera captures and endstate checks at ${out}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main(process.argv.slice(2), checkWorldCamera);
