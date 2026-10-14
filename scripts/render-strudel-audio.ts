import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Cdp, Cleanup, chromiumArgs, chromiumEnvironment, startPreview, stopChild, waitFor } from '../tests/browser/runtime.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const sha256 = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');
const sampleRate = 48000, seconds = 28, cps = .5;
const bundleHash = '50beb01abd04589333a10e078dce182c82e2de75b43e9bbe81a34bd069948931';

// The authoring bundle stays outside public/ and is never part of the game.
export async function renderStrudel(bundle: string, patternFile: string, output: string) {
  const cleanup = new Cleanup(), controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(new Error('Strudel export timed out')), 120_000);
  const interrupt = () => controller.abort(new Error('Strudel export interrupted'));
  process.on('SIGINT', interrupt); process.on('SIGTERM', interrupt);
  const problems: string[] = [], requests: string[] = [], logs: string[] = [];
  let browserLog = '';
  try {
    const source = await readFile(patternFile, 'utf8');
    const engine = await readFile(join(bundle, 'index.mjs'));
    assert.equal(sha256(engine), bundleHash, 'Expected the pinned @strudel/web@1.3.0 bundle');
    await mkdir(join(root, 'artifacts'), { recursive: true });
    const profile = await mkdtemp(join(root, 'artifacts/p-'));
    cleanup.add(() => rm(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }));
    const site = join(profile, 'site'), downloads = join(profile, 'exports');
    await mkdir(site); await mkdir(downloads);
    await writeFile(join(site, 'strudel.js'), engine);
    await cp(join(bundle, 'assets'), join(site, 'assets'), { recursive: true });
    await writeFile(join(site, 'index.html'), '<!doctype html><title>Boundstoy isolated Strudel export</title><link rel="icon" href="data:,">');
    const origin = await startPreview(site, cleanup, controller.signal);
    const child = spawn('/usr/bin/chromium', chromiumArgs(profile), {
      cwd: root, detached: true, shell: false, stdio: ['ignore', 'pipe', 'pipe'], env: chromiumEnvironment(profile),
    });
    cleanup.add(() => stopChild(child, 3000, true));
    let spawnError: Error | undefined;
    child.once('error', error => { spawnError = error; });
    const record = (data: Buffer) => { browserLog = (browserLog + data.toString()).slice(-16384); };
    child.stdout.on('data', record); child.stderr.on('data', record);
    const port = await waitFor('Owned authoring Chromium', async () => {
      if (spawnError) throw spawnError;
      if (child.exitCode !== null || child.signalCode !== null) throw new Error(`Chromium exited: ${browserLog}`);
      try { return Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); }
      catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
    }, 15000, controller.signal);
    assert.ok(Number.isInteger(port) && port > 0 && port < 65536);
    const response = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]) });
    assert.ok(response.ok, 'Owned browser discovery failed');
    const targets = await response.json() as { type: string; url: string; webSocketDebuggerUrl: string }[];
    const target = targets.find(item => item.type === 'page' && item.url === 'about:blank');
    assert.ok(target);
    const page = await Cdp.connect(target.webSocketDebuggerUrl, 60_000, controller.signal);
    cleanup.add(async () => { page.close(); });
    controller.signal.addEventListener('abort', () => page.close(new Error(String(controller.signal.reason))), { once: true });
    page.on('Runtime.exceptionThrown', event => problems.push(JSON.stringify(event.exceptionDetails)));
    page.on('Runtime.consoleAPICalled', event => {
      const message = event.args.map((arg: { value?: unknown; description?: string }) => String(arg.value ?? arg.description)).join(' ');
      logs.push(message);
      if (event.type === 'error' || /\berror:/i.test(message)) problems.push(message);
    });
    page.on('Fetch.requestPaused', event => {
      const url = event.request.url as string;
      const local = new URL(url).origin === origin || url.startsWith(`blob:${origin}/`) || url.startsWith('data:');
      if (!local) problems.push(`Blocked external request: ${url}`);
      if (url.startsWith('http')) requests.push(url);
      void page.call(local ? 'Fetch.continueRequest' : 'Fetch.failRequest',
        { requestId: event.requestId, ...local ? {} : { errorReason: 'BlockedByClient' } })
        .catch(error => problems.push(String(error)));
    });
    await Promise.all(['Page.enable', 'Runtime.enable'].map(method => page.call(method)));
    await page.call('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
    await page.call('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
    await page.call('Page.navigate', { url: origin });
    await waitFor('Authoring document', () => page.evaluate(`location.origin === ${JSON.stringify(origin)} && document.readyState === 'complete'`), 10000, controller.signal);
    const browser = await page.call<{ product: string }>('Browser.getVersion');
    const onsets = await page.evaluate<number>(`(async () => {
      let seed = 7901;
      Math.random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
      const engine = await import('./strudel.js');
      await engine.initStrudel();
      const pattern = await engine.evaluate(${JSON.stringify(source)}, false);
      if (!pattern || typeof pattern.queryArc !== 'function') throw new Error('Strudel did not compile a pattern');
      const events = pattern.queryArc(0, ${seconds * cps}, { _cps: ${cps} }).filter(hap => hap.hasOnset());
      if (events.length < 1) throw new Error('Strudel pattern has no onsets');
      await engine.renderPatternAudio(pattern, ${cps}, 0, ${seconds * cps}, ${sampleRate}, 16, false, 'capture');
      return events.length;
    })()`);
    const wav = await waitFor('Native Strudel WAV download', async () => {
      try { return await readFile(join(downloads, 'capture.wav')); }
      catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
    }, 15000, controller.signal);
    assert.deepEqual(problems, [], 'Strudel compilation/render/network errors');
    assert.equal(wav.readUInt16LE(20), 1);
    assert.equal(wav.readUInt16LE(22), 2);
    assert.equal(wav.readUInt32LE(24), sampleRate);
    assert.equal(wav.length, 44 + sampleRate * seconds * 4);
    let peak = 0;
    for (let i = 44; i < wav.length; i += 2) peak = Math.max(peak, Math.abs(wav.readInt16LE(i)) / 32768);
    assert.ok(peak > .001 && peak < 1, 'Silent or clipped Strudel export');
    const evidence = {
      engine: '@strudel/web@1.3.0', bundleSha256: sha256(engine),
      browser: browser.product, method: 'renderPatternAudio / OfflineAudioContext',
      seed: 7901, cps, sampleRate, seconds, channels: 2, encoding: 'PCM16 lossless WAV',
      pattern: basename(patternFile), patternSha256: sha256(source), rawSha256: sha256(wav), onsets, peak, requests, logs,
    };
    await mkdir(output, { recursive: true });
    const id = basename(patternFile, '.strudel.js');
    await writeFile(join(output, `${id}.wav`), wav);
    await writeFile(join(output, `${id}.render.json`), JSON.stringify(evidence, null, 2) + '\n');
    console.log(`Exported ${id}: ${seconds}s, ${sampleRate}Hz stereo PCM16, ${onsets} Strudel onsets, peak ${peak}`);
  } finally {
    clearTimeout(deadline);
    process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt);
    await cleanup.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  assert.equal(args.length, 3, 'Usage: node scripts/render-strudel-audio.ts /path/to/package/dist pattern.strudel.js /output/directory');
  await renderStrudel(resolve(args[0]), resolve(args[1]), resolve(args[2]));
}
