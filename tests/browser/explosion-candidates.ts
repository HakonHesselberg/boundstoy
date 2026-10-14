import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main } from '../../scripts/browser-check.ts';
import { EXPLOSION_PALETTE } from '../../data/explosion-palette.ts';
import { waitFor } from './runtime.ts';
import type { BrowserContext } from './scenarios.ts';

type Start = { duration: number; time: number; loop: boolean };

export async function checkExplosionCandidates({ page, origin, signal, requests, log }: BrowserContext) {
  const before = await page.evaluate('Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)])');
  assert.equal(await page.evaluate("document.getElementById('explosion-listening-room').getAttribute('href')"),
    './audio/explosion-candidates/index.html');
  await page.call('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__starts = []; window.__active = new Set(); window.__contexts = new Set(); window.__gains = [];
    const create = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function() {
      if (!window.__contexts.has(this)) this.addEventListener('statechange', () => {
        if (this.state === 'closed') for (const source of window.__active) {
          if (source.context === this) window.__active.delete(source);
        }
      });
      window.__contexts.add(this);
      const source = create.call(this), start = source.start;
      source.start = function(time, ...args) {
        window.__starts.push({duration: source.buffer.duration, time, loop: source.loop});
        window.__active.add(source);
        return start.call(source, time, ...args);
      };
      source.addEventListener('ended', () => window.__active.delete(source));
      return source;
    };
    const gain = AudioContext.prototype.createGain;
    AudioContext.prototype.createGain = function() { const node = gain.call(this); window.__gains.push(node); return node; };
  ` });
  const until = (expression: string, timeout = 5000) => waitFor(expression, () => page.evaluate<boolean>(expression), timeout, signal);
  const ready = () => until("Boolean(document.getElementById('arcade-burst-pattern'))", 10000);
  const click = async (id: string) => {
    const reply = await page.call('Runtime.evaluate', {
      expression: `document.getElementById(${JSON.stringify(id)}).click()`, userGesture: true,
    });
    assert.ok(!reply.exceptionDetails, JSON.stringify(reply.exceptionDetails));
  };
  const stopped = async () => {
    await click('stop'); await until('window.__active.size === 0');
    assert.equal(await page.evaluate("document.getElementById('status').textContent"), 'Stopped.');
  };
  const url = `${origin}/audio/explosion-candidates/index.html`;
  await page.call('Page.navigate', { url }); await ready();
  assert.equal(requests.filter(request => request.endsWith('.wav')).length, 0, 'No audio downloads before consent');
  assert.equal(await page.evaluate('window.__contexts.size'), 0);
  assert.equal(await page.evaluate("document.querySelectorAll('#candidates article').length"), 8);
  assert.equal(await page.evaluate("document.querySelectorAll('#candidates a[download]').length"), 16);
  for (const candidate of EXPLOSION_PALETTE) {
    for (const [mode, count] of [['warning', 1], ['blast', 1], ['pair', 2], ['pattern', 8], ['rapid', 8]] as const) {
      const previous = await page.evaluate<number>('window.__starts.length');
      await click(`${candidate.id}-${mode}`);
      await until(`window.__starts.length === ${previous + count}`);
      const starts = await page.evaluate<Start[]>(`window.__starts.slice(${previous})`);
      assert.ok(starts.every(start => !start.loop));
      if (mode === 'warning') assert.equal(starts[0].duration, .225);
      if (mode === 'blast') assert.equal(starts[0].duration, candidate.decay);
      if (mode === 'rapid') {
        for (const [i, start] of starts.entries()) {
          assert.equal(start.duration, candidate.decay);
          assert.ok(Math.abs(start.time - starts[0].time - i * .25) < 1e-9);
        }
      }
      if (mode === 'pair' || mode === 'pattern') {
        for (let i = 0; i < starts.length; i += 2) {
          assert.equal(starts[i].duration, .225);
          assert.equal(starts[i + 1].duration, candidate.decay);
          assert.ok(Math.abs(starts[i + 1].time - starts[i].time - .225) < 1e-9);
          assert.ok(Math.abs(starts[i].time - starts[0].time - i / 2 * 1.2) < 1e-9);
        }
      }
      assert.ok(await page.evaluate<number>('window.__active.size') <= 8);
      await stopped();
    }
  }
  const audioRequests = requests.filter(request => request.includes('/explosion-candidates/') && request.endsWith('.wav'));
  assert.equal(audioRequests.length, 16, 'Selected components load once, including four-repeat previews');
  await click('soft-magic-pattern');
  await until('window.__active.size === 8');
  await click('glass-bloom-pattern');
  await until("window.__active.size === 8 && document.getElementById('glass-bloom').hasAttribute('data-playing')");
  await click('mono');
  assert.equal(await page.evaluate("window.__gains.find(node => node.channelCountMode === 'explicit').channelCount"), 1);
  await until("document.getElementById('status').textContent === 'Preview finished.'", 7000);
  assert.equal(await page.evaluate('window.__active.size'), 0);
  assert.equal(await page.evaluate("document.getElementById('pad').dataset.phase"), 'idle');
  await click('airy-puff-rapid');
  await until("document.getElementById('status').textContent === 'Preview finished.'", 4000);
  assert.equal(await page.evaluate('window.__active.size'), 0);
  log('PASS all 40 preview controls, 16 decodes, cache, exact 225 ms pairs, four-per-second rapid blasts, bounded replacement, mono and finite expiry.');

  await click('deep-cushion-pattern'); await until('window.__active.size === 8');
  await page.evaluate("document.getElementById('volume').value = '0'; document.getElementById('volume').dispatchEvent(new Event('input'))");
  await until('window.__active.size === 0');
  const mutedStarts = await page.evaluate('window.__starts.length');
  await click('airy-puff-rapid');
  assert.equal(await page.evaluate('window.__starts.length'), mutedStarts);
  assert.match(await page.evaluate<string>("document.getElementById('status').textContent"), /Volume is zero/);
  await page.evaluate("document.getElementById('volume').value = '65'; document.getElementById('volume').dispatchEvent(new Event('input'))");
  for (const event of ["window.dispatchEvent(new Event('blur'))",
    "Object.defineProperty(document, 'hidden', {value: true, configurable: true}); document.dispatchEvent(new Event('visibilitychange')); delete document.hidden;"]) {
    await click('airy-puff-rapid'); await until('window.__active.size === 8');
    await page.evaluate(event); await until('window.__active.size === 0');
    assert.equal(await page.evaluate("document.getElementById('status').textContent"), 'Stopped.');
  }
  await click('wooden-knock-pattern'); await until('window.__active.size === 8');
  await page.evaluate("window.dispatchEvent(new PageTransitionEvent('pagehide', {persisted: true}))");
  await until("window.__active.size === 0 && [...window.__contexts].every(context => context.state === 'closed')");
  await page.evaluate("window.dispatchEvent(new PageTransitionEvent('pageshow', {persisted: true}))");
  await click('soft-magic-pattern'); await until('window.__active.size === 8');
  assert.equal(await page.evaluate('window.__contexts.size'), 2);
  await stopped();

  await page.call('Page.navigate', { url }); await ready();
  await page.evaluate(`(async () => {
    window.__fetch = window.fetch;
    window.__warningBytes = await (await fetch('airy-puff-warning.wav')).arrayBuffer();
    window.fetch = (url, options) => url === 'airy-puff-blast.wav' ? Promise.resolve(new Response('', {status: 503}))
      : url === 'airy-puff-warning.wav' ? Promise.resolve(new Response(window.__warningBytes)) : window.__fetch(url, options);
  })()`);
  await click('airy-puff-pair');
  await until("document.getElementById('status').textContent.includes('HTTP 503')");
  assert.equal(await page.evaluate('window.__active.size'), 0, 'No half-loaded buildup on failure');
  await page.evaluate('window.fetch = window.__fetch');
  await click('airy-puff-pair'); await until('window.__active.size === 2'); await stopped();
  await page.evaluate(`(async () => {
    window.__glassWarning = await (await fetch('glass-bloom-warning.wav')).arrayBuffer();
    window.__glassBlast = await (await fetch('glass-bloom-blast.wav')).arrayBuffer();
    window.fetch = async (url, options) => {
      if (url === 'glass-bloom-warning.wav') return new Response(window.__glassWarning);
      if (url === 'glass-bloom-blast.wav') {
        window.__pendingSignal = options.signal;
        await new Promise(resolve => {window.__releaseFetch = resolve;});
        return new Response(window.__glassBlast);
      }
      return window.__fetch(url, options);
    };
  })()`);
  await click('glass-bloom-pattern'); await until("typeof window.__releaseFetch === 'function'");
  await stopped();
  assert.equal(await page.evaluate('window.__pendingSignal.aborted'), true);
  await page.evaluate('window.__releaseFetch(); window.fetch = window.__fetch');
  await page.evaluate('new Promise(resolve => setTimeout(resolve, 150))');
  assert.equal(await page.evaluate('window.__active.size'), 0);
  assert.equal(await page.evaluate("document.getElementById('status').textContent"), 'Stopped.');
  assert.deepEqual(await page.evaluate('Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)])'), before);
  log('PASS zero volume, blur/hidden/pagehide, restored-page playback, atomic loading, HTTP retry, Stop during loading and unchanged storage.');

  const mixes = await page.evaluate<Array<{ id: string; mode: string; rate: number; peak: number; monoDifference: number }>>(`(async () => {
    const manifest = await (await fetch('./manifest.json')).json(), mixes = [];
    const {createAudioOutput} = await import('../output.js');
    for (const rate of [44100, 48000]) for (const candidate of manifest.candidates) for (const mode of ['pair', 'rapid']) {
      const rapid = mode === 'rapid';
      const seconds = rapid ? (manifest.rapidCount - 1) * manifest.rapidInterval + candidate.blast.seconds
        : 3 * manifest.patternInterval + manifest.warningSeconds + candidate.blast.seconds;
      const context = new OfflineAudioContext(2, Math.ceil(seconds * rate), rate);
      const output = rapid ? createAudioOutput(context) : null;
      const warning = await context.decodeAudioData(await (await fetch(candidate.warning.file)).arrayBuffer());
      const blast = await context.decodeAudioData(await (await fetch(candidate.blast.file)).arrayBuffer());
      for (let i = 0; i < (rapid ? manifest.rapidCount : manifest.patternCount); i++) {
        const events = rapid ? [[blast, i * manifest.rapidInterval]]
          : [[warning, i * manifest.patternInterval], [blast, i * manifest.patternInterval + manifest.warningSeconds]];
        for (const [buffer, time] of events) {
          const source = context.createBufferSource(); source.buffer = buffer; source.connect(output?.input ?? context.destination); source.start(time);
        }
      }
      const result = await context.startRendering(), left = result.getChannelData(0), right = result.getChannelData(1);
      let peak = 0, monoDifference = 0;
      for (let i = 0; i < left.length; i++) {peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i])); monoDifference = Math.max(monoDifference, Math.abs(left[i] - right[i]));}
      output?.dispose();
      mixes.push({id: candidate.id, mode, rate, peak, monoDifference});
    }
    return mixes;
  })()`);
  assert.equal(mixes.length, 32);
  assert.ok(mixes.every(mix => mix.peak > .01 && mix.peak < (mix.mode === 'rapid' ? .851 : .16) && mix.monoDifference === 0));
  log(`PASS paired source patterns and calibrated rapid repeats at 44.1/48 kHz: maximum peak ${Math.max(...mixes.map(mix => mix.peak))}; mono unchanged.`);

  await mkdir(resolve('artifacts/explosion-candidates'), { recursive: true });
  const output = await mkdtemp(resolve('artifacts/explosion-candidates/run-'));
  for (const [width, height] of [[1280, 900], [390, 844], [844, 390]]) {
    await page.call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    assert.equal(await page.evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
    const point = await page.evaluate<{ x: number; y: number }>(`(() => {
      const button = document.getElementById('arcade-burst-rapid'); button.scrollIntoView({block: 'center'});
      const r = button.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
      if (r.height < 44 || !button.contains(document.elementFromPoint(x,y))) throw new Error('Preview control obscured or too small');
      return {x,y};
    })()`);
    await page.call('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
    await page.call('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
    await until("document.getElementById('arcade-burst').hasAttribute('data-playing')");
    await stopped();
    await page.evaluate('scrollTo(0,0)');
    const screenshot = await page.call<{ data: string }>('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    await writeFile(resolve(output, `${width}x${height}.png`), Buffer.from(screenshot.data, 'base64'));
  }
  await writeFile(resolve(output, 'mix.json'), JSON.stringify(mixes, null, 2));
  log(`PASS responsive clickable controls. Listening-room evidence: ${output}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main(process.argv.slice(2), checkExplosionCandidates);
