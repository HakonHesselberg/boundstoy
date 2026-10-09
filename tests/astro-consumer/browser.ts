import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  Cdp, Cleanup, chromiumArgs, chromiumEnvironment, startPreview, stopChild, waitFor,
  type Options,
} from '../browser/runtime.ts';
import { checkConsumer } from './scenarios.ts';
import type { Inventory } from './fixture.ts';

export function permittedRequest(address: string, origin: string, base: string): boolean {
  const url = new URL(address);
  return url.origin === origin && url.pathname.startsWith(base);
}

export async function captureFailure(page: Pick<Cdp, 'call'>, evidence: string, log: (message: string) => void) {
  try {
    const capture = await page.call<{ data: string }>('Page.captureScreenshot', { format: 'jpeg', quality: 60 });
    await writeFile(join(evidence, 'failure.jpg'), Buffer.from(capture.data, 'base64'));
  } catch (captureError) { log(`Screenshot unavailable: ${String(captureError)}`); }
}

// The standalone runner boots dist/?debug unconditionally. Reuse its tested transport,
// static server, isolation and cleanup primitives, but navigate the real Astro host here.
export async function checkBrowser(site: string, base: string, files: Inventory, options: Options,
  signal: AbortSignal, evidence: string, artifactRoot: string) {
  const cleanup = new Cleanup(), requests: string[] = [], problems: string[] = [], logs: string[] = [];
  const resources: Record<string, unknown> = {};
  let page: Cdp | undefined, failure: unknown, cleaned = false, chromiumLog = '';
  const problem = (message: string) => { if (problems.length < 50) problems.push(message.slice(0, 3000)); };
  const log = (message: string) => { console.log(message); if (logs.length < 100) logs.push(message); };
  try {
    const origin = await startPreview(site, cleanup, signal);
    resources.origin = origin;
    const profile = join(artifactRoot, `p-${randomBytes(3).toString('hex')}`);
    await mkdir(profile);
    resources.profile = profile;
    cleanup.add(() => rm(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }));
    const child = spawn(options.browser, chromiumArgs(profile), {
      cwd: profile, shell: false, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
      // A relative owned TMPDIR keeps Chromium's Unix socket below the POSIX path limit.
      env: { ...chromiumEnvironment(profile), TMPDIR: '.' },
    });
    resources.pid = child.pid; resources.processGroup = child.pid;
    cleanup.add(() => stopChild(child, 3000, true));
    let spawnError: Error | undefined;
    child.once('error', error => { spawnError = error; });
    const record = (data: Buffer) => { chromiumLog = (chromiumLog + data.toString()).slice(-16_384); };
    child.stdout.on('data', record); child.stderr.on('data', record);
    const port = await waitFor('Owned sandboxed Chromium startup', async () => {
      if (spawnError) throw spawnError;
      if (child.exitCode !== null || child.signalCode !== null) {
        throw new Error(`Chromium exited: ${child.exitCode ?? child.signalCode}\n${chromiumLog}`);
      }
      let contents: string;
      try { contents = await readFile(join(profile, 'DevToolsActivePort'), 'utf8'); }
      catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
      const port = Number(contents.split('\n')[0]);
      assert.ok(Number.isInteger(port) && port > 0 && port < 65536);
      return port;
    }, 15_000, signal);
    resources.debugPort = port;
    const response = await fetch(`http://127.0.0.1:${port}/json/list`, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
    });
    assert.ok(response.ok, `Owned target discovery: HTTP ${response.status}`);
    const targets = await response.json() as { type: string; url: string; webSocketDebuggerUrl: string }[];
    const target = targets.find(target => target.type === 'page' && target.url === 'about:blank');
    assert.ok(target, 'Fresh Chromium must provide the requested blank page.');
    page = await Cdp.connect(target.webSocketDebuggerUrl, Math.min(15_000, options.timeout), signal);
    const cdp = page;
    cleanup.add(async () => { cdp.close(); });
    const abort = () => cdp.close(new Error(String(signal.reason)));
    signal.addEventListener('abort', abort, { once: true });
    cleanup.add(async () => { signal.removeEventListener('abort', abort); });
    resources.browser = (await cdp.call('Browser.getVersion')).product;
    const { arguments: args } = await cdp.call<{ arguments: string[] }>('Browser.getBrowserCommandLine');
    assert.ok(!args.some(arg => /^--(?:no-sandbox|disable[^=]*sandbox|load-extension)(?:=|$)/.test(arg)),
      'Sandbox bypass and extensions are forbidden.');
    assert.deepEqual(args.filter(arg => arg.startsWith('--user-data-dir=')), [`--user-data-dir=${profile}`]);
    resources.arguments = args;
    log(`Owned Chromium PID ${child.pid}; ${base} at ${origin}; fresh profile ${profile}`);

    const pending = new Set<string>();
    cdp.on('Runtime.exceptionThrown', event => problem(`Uncaught: ${JSON.stringify(event.exceptionDetails)}`));
    cdp.on('Runtime.consoleAPICalled', event => {
      if (['error', 'assert'].includes(event.type)) problem(`Console ${event.type}: ${JSON.stringify(event.args)}`);
    });
    cdp.on('Log.entryAdded', event => {
      if (event.entry.level === 'error') problem(`Browser log: ${JSON.stringify(event.entry)}`);
    });
    cdp.on('Network.requestWillBeSent', event => {
      pending.add(event.requestId);
      if (requests.length < 200) requests.push(event.request.url); else problem('More than 200 consumer requests.');
      if (!permittedRequest(event.request.url, origin, base)) problem(`Request escaped the static mount: ${event.request.url}`);
    });
    cdp.on('Network.loadingFinished', event => pending.delete(event.requestId));
    cdp.on('Network.loadingFailed', event => { pending.delete(event.requestId); problem(`Failed request: ${JSON.stringify(event)}`); });
    cdp.on('Network.responseReceived', event => {
      if (event.response.status >= 400) problem(`HTTP ${event.response.status}: ${event.response.url}`);
    });
    cdp.on('Network.webSocketCreated', event => problem(`Unexpected WebSocket: ${event.url}`));
    cdp.on('Target.targetCreated', event => {
      if (/worker/.test(event.targetInfo.type)) problem(`Unexpected worker: ${JSON.stringify(event.targetInfo)}`);
    });
    cdp.on('Fetch.requestPaused', event => {
      const allowed = permittedRequest(event.request.url, origin, base);
      if (!allowed) problem(`Blocked request outside the static mount: ${event.request.url}`);
      void cdp.call(allowed ? 'Fetch.continueRequest' : 'Fetch.failRequest', {
        requestId: event.requestId, ...allowed ? {} : { errorReason: 'BlockedByClient' },
      }).catch(error => problem(String(error)));
    });
    await Promise.all(['Page.enable', 'Runtime.enable', 'Log.enable', 'Network.enable'].map(method => cdp.call(method)));
    await cdp.call('Target.setDiscoverTargets', { discover: true });
    await cdp.call('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
    await cdp.call('Network.setBlockedURLs', { urls: ['ws://*', 'wss://*'] });
    await checkConsumer({
      page: cdp, origin, base, files, signal, requests, evidence, log,
      settled: () => waitFor('All consumer assets loaded', async () => pending.size === 0, 5000, signal),
    });
    signal.throwIfAborted();
    assert.deepEqual(problems, [], 'Consumer console, protocol and network checks must be clean.');
  } catch (error) {
    failure = signal.aborted ? signal.reason : error;
    if (page) await captureFailure(page, evidence, log);
  } finally {
    try { await cleanup.close(); cleaned = true; }
    catch (error) { failure = new Error([failure, error].filter(Boolean).map(String).join('\n')); }
    await writeFile(join(evidence, 'chromium.log'), chromiumLog);
    await writeFile(join(evidence, 'browser.json'), JSON.stringify({
      passed: !failure, cleaned, base, resources, requests, problems, logs,
      error: failure instanceof Error ? failure.stack : failure ? String(failure) : null,
    }, null, 2));
    console.log(`${base} cleanup: ${cleaned ? 'browser, profile, CDP and preview closed' : 'FAILED'}`);
  }
  if (failure) throw failure;
}
