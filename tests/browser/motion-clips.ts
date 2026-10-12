import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { main } from '../../scripts/browser-check.ts';
import { AFTERSHOCK_LEVELS } from '../../data/aftershock.ts';
import { AFTERSHOCK_MASTERY_REPLAYS } from '../../data/aftershock-replays.ts';
import type { State } from '../../core/simulation.ts';
import { waitFor } from './runtime.ts';
import { worldDriver } from './rough-world.ts';
import type { BrowserContext } from './scenarios.ts';

// Deterministic 60 fps clips: each frame advances exactly two 120 Hz ticks, so
// playback speed equals game speed even when software rendering is slow.
// CLIP_DIR selects the output folder, CLIP_SCENARIOS a comma-separated subset.
const run = promisify(execFile);
const TICKS_PER_FRAME = 2;
const VIEWPORTS = [[1280, 900], [390, 844]] as const;

type Command = { ticks: number; x: number; y: number };
const room = (id: string, tiles: string[], spawn: { x: number; y: number }, hazards: object[] = []) => ({
  version: 1, id, name: id, description: 'Motion clip fixture.', tiles, spawn,
  goal: { x: tiles[0].length - 2, y: 1 }, checkpoints: [], hazards,
});
const FIXTURES = {
  hazards: room('clip-hazards', ['########', '#......#', '#......#', '#......#', '#......#', '########'],
    { x: 1, y: 3 }, [{ kind: 'pulse', x: 3, y: 3, period: 120, on: 1, phase: 75 },
      { kind: 'pulse', x: 4, y: 3, period: 120, on: 1, phase: 15 }]),
  soft: room('clip-soft-ice', ['##########', ...Array.from({ length: 6 }, () => '#~~~~~~~~#'), '##########'],
    { x: 2, y: 4 }),
  hard: room('clip-hard-ice', ['##########', '#========#', '#========#', '#===  ===#', '#========#', '##########'],
    { x: 1, y: 3 }),
};
const SCRIPTS: Record<string, Command[]> = {
  // Approach as the near pad charges, wait out its flash on the far edge,
  // borrow the spent tile, stay too long, then retry.
  hazards: [{ ticks: 44, x: 1, y: 0 }, { ticks: 16, x: 0, y: 0 }, { ticks: 12, x: 1, y: 0 },
    { ticks: 110, x: 0, y: 0 }, { ticks: 60, x: 0, y: 0 }, { ticks: 30, x: 1, y: 0 }],
  soft: [{ ticks: 50, x: 1, y: 0 }, { ticks: 50, x: 0, y: -1 }, { ticks: 90, x: 0, y: 0 },
    { ticks: 40, x: -1, y: 0 }, { ticks: 90, x: 0, y: 0 }],
  // Slide into the void, respawn, then make three locked slides that stop at curbs.
  hard: [{ ticks: 120, x: 1, y: 0 }, { ticks: 60, x: 0, y: -1 }, { ticks: 70, x: 1, y: 0 }, { ticks: 60, x: 0, y: 1 }],
};

export async function captureMotionClips({ page, origin, signal, log }: BrowserContext) {
  const out = resolve(process.env.CLIP_DIR ?? 'artifacts/motion/after');
  const only = process.env.CLIP_SCENARIOS?.split(',').filter(Boolean);
  const wanted = (name: string) => !only || only.includes(name);
  await mkdir(out, { recursive: true });
  const evaluate = <T>(expression: string) => page.evaluate<T>(expression);
  let frames = '', frame = 0;
  const begin = async (name: string) => {
    frames = resolve(out, `.frames-${name}`); frame = 0;
    await rm(frames, { recursive: true, force: true }); await mkdir(frames, { recursive: true });
  };
  const shot = async (hideOverlay: boolean) => {
    await evaluate(`document.getElementById('overlay').style.visibility = ${JSON.stringify(hideOverlay ? 'hidden' : '')}`);
    if (hideOverlay) await evaluate(`document.getElementById('overlay').hidden = true;
      document.getElementById('notice').hidden = true;`);
    const image = await page.call<{ data: string }>('Page.captureScreenshot', { format: 'png' });
    return Buffer.from(image.data, 'base64');
  };
  const record = async (hideOverlay = true, still?: string) => {
    const png = await shot(hideOverlay);
    await writeFile(resolve(frames, `${String(frame++).padStart(5, '0')}.png`), png);
    if (still) await writeFile(resolve(out, `${still}.png`), png);
  };
  const finish = async (name: string) => {
    await run('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '60', '-i', resolve(frames, '%05d.png'),
      '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20',
      resolve(out, `${name}.mp4`)]);
    await rm(frames, { recursive: true, force: true });
    log(`clip ${name}.mp4 (${frame} frames, ${(frame / 60).toFixed(2)} s)`);
  };
  const setup = async (width: number, height: number, reduced: boolean, tag: string) => {
    await page.call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
    await page.call('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }],
    });
    const url = `${origin}/?debug&clip=${tag}`;
    await page.call('Page.navigate', { url });
    await waitFor('Clip boot', () => evaluate<boolean>(
      `location.href === ${JSON.stringify(url)} && Boolean(window.__BOUNDSTOY__) && window.__BOUNDSTOY__.metrics().frames > 0`),
    15000, signal);
  };
  const importLevel = (fixture: object) => evaluate(`(() => {
    document.getElementById('editor-tab').click();
    document.getElementById('level-json').value = ${JSON.stringify(JSON.stringify(fixture))};
    document.getElementById('import').click();
    document.getElementById('playtest').click();
    window.__BOUNDSTOY__.advance(0);
  })()`);
  const step = (ticks: number, x: number, y: number) =>
    evaluate<State>(`window.__BOUNDSTOY__.advance(${ticks}, { x: ${x}, y: ${y} })`);
  // Freeze CSS/Web animations at an explicit time so UI transitions are captured exactly.
  const seekUi = (ms: number) => evaluate(`document.getAnimations().forEach(animation => {
    animation.pause(); animation.currentTime = ${ms}; })`);
  const animate = (seconds: number) => evaluate(`window.__BOUNDSTOY__.animate
    ? window.__BOUNDSTOY__.animate(${seconds}) : undefined`);
  const play = async (commands: Command[], stills: Record<number, string> = {}) => {
    let state = await step(0, 0, 0);
    for (const command of commands) {
      for (let done = 0; done < command.ticks && !state.won; done += TICKS_PER_FRAME) {
        state = await step(Math.min(TICKS_PER_FRAME, command.ticks - done), command.x, command.y);
        await record(true, stills[state.tick]);
      }
    }
    return state;
  };
  const completion = async () => {
    // play() hid the results overlay for unobstructed frames; restore it before the beat starts.
    await evaluate(`document.getElementById('overlay').hidden = false; document.getElementById('overlay').offsetWidth`);
    for (let i = 0; i < 45; i++) {
      await animate(1 / 60); await seekUi(i * 1000 / 60);
      await record(false);
    }
  };

  for (const [width, height] of VIEWPORTS) for (const reduced of [false, true]) {
    const tag = `${width}x${height}-${reduced ? 'reduced' : 'full'}`;
    if (wanted('hazards')) {
      await setup(width, height, reduced, `hazards-${tag}`);
      await importLevel(FIXTURES.hazards); await begin(`hazards-${tag}`);
      const end = await play(SCRIPTS.hazards, {
        10: `hazards-${tag}-idle-t10`, 30: `hazards-${tag}-warning-t30`, 44: `hazards-${tag}-preflash-t44`,
        46: `hazards-${tag}-flash-t46`, 56: `hazards-${tag}-aftermath-t56`, 166: `hazards-${tag}-death-t166`,
        200: `hazards-${tag}-respawn-t200`, 222: `hazards-${tag}-respawned-t222` });
      assert.equal(end.deaths, 1, 'hazard clip includes exactly one deliberate pulse death');
      await finish(`hazards-${tag}`);
    }
    if (wanted('checkerboard')) {
      await setup(width, height, reduced, `checkerboard-${tag}`);
      await importLevel(AFTERSHOCK_LEVELS[2]);
      await begin(`checkerboard-${tag}`);
      const end = await play([...AFTERSHOCK_MASTERY_REPLAYS[2]], { 160: `checkerboard-${tag}-dense-t160` });
      assert.ok(end.won && end.deaths === 0, 'checkerboard mastery replay still clears cleanly');
      await completion(); await record(false, `checkerboard-${tag}-complete`);
      await finish(`checkerboard-${tag}`);
    }
    if (reduced || width < 600) continue;
    for (const ice of ['soft', 'hard'] as const) if (wanted(ice)) {
      await setup(width, height, reduced, `${ice}-${tag}`);
      await importLevel(FIXTURES[ice]); await begin(`${ice}-ice-${tag}`);
      await play(SCRIPTS[ice]);
      await finish(`${ice}-ice-${tag}`);
    }
  }
  for (const [width, height] of VIEWPORTS) for (const reduced of [false, true]) {
    if (!wanted('ui')) break;
    const tag = `${width}x${height}-${reduced ? 'reduced' : 'full'}`;
    await setup(width, height, reduced, `ui-${tag}`);
    await begin(`ui-${tag}`);
    for (let i = 0; i < 6; i++) await record(false);
    await evaluate(`document.getElementById('menu-toggle').click()`);
    for (let i = 0; i < 24; i++) { await seekUi(i * 1000 / 60); await record(false); }
    await evaluate(`document.getElementById('menu-close').click()`);
    for (let i = 0; i < 12; i++) { await seekUi(i * 1000 / 60); await record(false); }
    await evaluate(`document.getElementById('primary-action').click()`);
    await waitFor('Motion UI start commits before playing', () => evaluate<boolean>(
      '__BOUNDSTOY__.snapshot().started && !__BOUNDSTOY__.snapshot().paused'), 15000, signal);
    await record(false);
    await evaluate(`document.getElementById('pause').click()`);
    assert.equal(await evaluate('__BOUNDSTOY__.snapshot().paused'), true);
    for (let i = 0; i < 24; i++) { await seekUi(i * 1000 / 60); await record(false); }
    await finish(`ui-${tag}`);
  }
  if (wanted('pacing')) {
    await setup(1280, 900, false, 'pacing');
    const driver = worldDriver({ page, origin, signal, log, requests: [] });
    await driver.newRun();
    await driver.click('primary-action');
    await page.call('Input.dispatchKeyEvent', { type: 'keyDown', code: 'ArrowRight', key: 'ArrowRight', windowsVirtualKeyCode: 39 });
    const pacing = await evaluate<Record<string, number>>(`new Promise(done => {
      const stamps = []; const start = performance.now();
      const tick = now => { stamps.push(now); if (now - start < 4000) requestAnimationFrame(tick); else {
        const gaps = stamps.slice(1).map((t, i) => t - stamps[i]).sort((a, b) => a - b);
        const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
        done({ frames: gaps.length, meanMs: +mean.toFixed(2), p95Ms: +gaps[Math.floor(gaps.length * 0.95)].toFixed(2),
          maxMs: +gaps[gaps.length - 1].toFixed(2) });
      } };
      requestAnimationFrame(tick);
    })`);
    await page.call('Input.dispatchKeyEvent', { type: 'keyUp', code: 'ArrowRight', key: 'ArrowRight', windowsVirtualKeyCode: 39 });
    await writeFile(resolve(out, 'frame-pacing.json'), `${JSON.stringify(pacing, null, 2)}\n`);
    log(`frame pacing (software renderer, 4 s live play): ${JSON.stringify(pacing)}`);
  }
  log(`PASS: motion clips written to ${out}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main(process.argv.slice(2), captureMotionClips);
