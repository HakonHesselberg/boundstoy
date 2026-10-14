import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main } from '../../scripts/browser-check.ts';
import { waitFor } from './runtime.ts';
import type { BrowserContext } from './scenarios.ts';

export async function checkIceCandidates({ page, origin, signal, requests, log }: BrowserContext) {
  const before = await page.evaluate('Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)])');
  await page.call('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__starts = []; window.__active = new Set(); window.__contexts = new Set();
    const create = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function() {
      if (!window.__contexts.has(this)) this.addEventListener('statechange', () => {
        if (this.state === 'closed') for (const source of window.__active) {
          if (source.context === this) window.__active.delete(source);
        }
      });
      window.__contexts.add(this);
      const source = create.call(this), start = source.start;
      source.start = function(...args) {
        window.__starts.push({ duration: source.buffer.duration, loop: source.loop, rate: source.playbackRate.value });
        window.__active.add(source);
        return start.apply(source, args);
      };
      source.addEventListener('ended', () => window.__active.delete(source));
      return source;
    };
  ` });
  const ready = () => waitFor('Candidate controls', () => page.evaluate("Boolean(document.getElementById('veil-context'))"), 10000, signal);
  const until = (expression: string, timeout = 5000) => waitFor(expression, () => page.evaluate<boolean>(expression), timeout, signal);
  const click = async (id: string) => {
    const reply = await page.call('Runtime.evaluate', {
      expression: `document.getElementById(${JSON.stringify(id)}).click()`, userGesture: true,
    });
    assert.ok(!reply.exceptionDetails, JSON.stringify(reply.exceptionDetails));
  };
  const url = `${origin}/audio/ice-candidates/index.html`;
  await page.call('Page.navigate', { url });
  await ready();
  assert.equal(requests.filter(request => request.endsWith('.wav')).length, 0, 'No audio downloads before a gesture');
  for (const id of ['weightless', 'silk', 'veil']) {
    await click(`${id}-solo`);
    await until(`document.getElementById(${JSON.stringify(id)}).hasAttribute('data-playing')`);
    assert.equal(await page.evaluate('window.__active.size'), 1);
    assert.deepEqual(await page.evaluate('window.__starts.at(-1)'), { duration: 12, loop: false, rate: 1 });
    await click('stop');
    await until('window.__active.size === 0');
    assert.equal(await page.evaluate("document.getElementById('status').textContent"), 'Stopped.');
  }
  await click('weightless-context');
  await until('window.__active.size === 4');
  await click('veil-context');
  await until("window.__active.size === 4 && document.getElementById('veil').hasAttribute('data-playing')");
  await click('mono');
  await until("document.getElementById('status').textContent === 'Preview finished.'", 15000);
  assert.equal(await page.evaluate('window.__active.size'), 0);
  await click('silk-context');
  await until('window.__active.size === 4');
  await page.evaluate("window.dispatchEvent(new Event('blur'))");
  await until('window.__active.size === 0');
  assert.equal(await page.evaluate("document.getElementById('status').textContent"), 'Stopped.');
  await click('weightless-solo');
  await until('window.__active.size === 1');
  await page.evaluate("document.getElementById('volume').value = '0'; document.getElementById('volume').dispatchEvent(new Event('input'))");
  await until('window.__active.size === 0');
  const mutedStarts = await page.evaluate('window.__starts.length');
  await click('veil-solo');
  assert.equal(await page.evaluate('window.__starts.length'), mutedStarts);
  assert.match(await page.evaluate<string>("document.getElementById('status').textContent"), /Volume is zero/);
  log('PASS all real WAV decodes, single-preview replacement, finite expiry, mono, blur and zero volume.');

  await page.call('Page.navigate', { url });
  await ready();
  await page.evaluate(`window.__fetch = window.fetch; window.fetch = (url, options) =>
    url === 'silk.wav' ? Promise.resolve(new Response('', { status: 503 })) : window.__fetch(url, options)`);
  await click('silk-solo');
  await until("document.getElementById('status').textContent.includes('Playback failed: Cannot load silk.wav: HTTP 503')");
  assert.equal(await page.evaluate('window.__active.size'), 0);
  await page.evaluate('window.fetch = window.__fetch');
  await click('silk-solo');
  await until('window.__active.size === 1');
  await click('stop');
  await page.evaluate(`window.fetch = async (url, options) => {
    if (url === 'veil.wav') await new Promise(resolve => { window.__releaseFetch = resolve; });
    return window.__fetch(url, options);
  }`);
  await click('veil-solo');
  await until("typeof window.__releaseFetch === 'function'");
  await click('stop');
  await page.evaluate('window.__releaseFetch(); window.fetch = window.__fetch');
  await page.evaluate('new Promise(resolve => setTimeout(resolve, 100))');
  assert.equal(await page.evaluate('window.__active.size'), 0);
  assert.equal(await page.evaluate("document.getElementById('status').textContent"), 'Stopped.');
  assert.deepEqual(await page.evaluate('Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)])'), before);
  log('PASS explicit failure/retry, cancelled loading cannot play later, and unchanged persistent storage.');

  await click('weightless-context');
  await until('window.__active.size === 4');
  await page.evaluate("window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }))");
  await until("window.__active.size === 0 && [...window.__contexts].every(context => context.state === 'closed')");
  await page.evaluate("window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))");
  await click('veil-solo');
  await until('window.__active.size === 1');
  assert.equal(await page.evaluate('window.__contexts.size'), 2, 'Restored page creates a new context, not a permanently closed one');
  await page.evaluate(`Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange')); delete document.hidden;`);
  await until('window.__active.size === 0');
  assert.equal(await page.evaluate("document.getElementById('status').textContent"), 'Stopped.');
  log('PASS pagehide cleanup, restored-page playback, and hidden-page stop.');

  const peaks = await page.evaluate<number[]>(`(async () => {
    const manifest = await (await fetch('./manifest.json')).json();
    const peaks = [];
    for (const candidate of manifest.candidates) {
      const context = new OfflineAudioContext(2, 48000 * 12, 48000);
      const decode = async file => context.decodeAudioData(await (await fetch(file)).arrayBuffer());
      const definitions = [{ file: candidate.file, time: 0, gain: 1 }, ...manifest.context];
      for (const definition of definitions) {
        const buffer = await decode(definition.file), source = context.createBufferSource(), gain = context.createGain();
        source.buffer = buffer;
        const start = definition.time;
        if (definition.attack) {
          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(definition.gain, start + Math.min(definition.attack, buffer.duration / 4));
          gain.gain.setValueAtTime(definition.gain, start + buffer.duration - Math.min(definition.release, buffer.duration / 3));
          gain.gain.linearRampToValueAtTime(0, start + buffer.duration);
        }
        source.connect(gain).connect(context.destination); source.start(start); source.stop(start + buffer.duration);
      }
      const result = await context.startRendering();
      let peak = 0;
      for (let channel = 0; channel < 2; channel++) for (const value of result.getChannelData(channel)) peak = Math.max(peak, Math.abs(value));
      peaks.push(peak);
    }
    return peaks;
  })()`);
  assert.ok(peaks.every(peak => peak > .01 && peak < .5));
  log(`PASS decoded equal-context stereo mix peaks at full listening volume: ${peaks.join(', ')}`);

  await mkdir(resolve('artifacts/ice-candidates'), { recursive: true });
  const output = await mkdtemp(resolve('artifacts/ice-candidates/run-'));
  for (const [width, height] of [[1280, 900], [390, 844], [844, 390]]) {
    await page.call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    assert.equal(await page.evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
    const screenshot = await page.call<{ data: string }>('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    await writeFile(resolve(output, `${width}x${height}.png`), Buffer.from(screenshot.data, 'base64'));
  }
  await writeFile(resolve(output, 'mix.json'), JSON.stringify({ peaks, sampleRate: 48000 }, null, 2));
  log(`Listening-room evidence: ${output}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main(process.argv.slice(2), checkIceCandidates);
