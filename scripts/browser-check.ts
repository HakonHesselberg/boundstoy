import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Cdp, Cleanup, chromiumArgs, chromiumEnvironment, parseOptions, startPreview, stopChild, waitFor } from '../tests/browser/runtime.ts';
import { checkGame, type BrowserContext } from '../tests/browser/scenarios.ts';

const root = fileURLToPath(new URL('..', import.meta.url));

export async function main(args = process.argv.slice(2), check: (context: BrowserContext) => Promise<void> = checkGame) {
  const cleanup = new Cleanup(), controller = new AbortController();
  const logs: string[] = [], problems: string[] = [], requests: string[] = [];
  const resources: Record<string, unknown> = {};
  let artifacts = '', chromiumLog = '', cdp: Cdp | undefined, deadline: ReturnType<typeof setTimeout> | undefined;
  let failure: unknown, cleaned = false;
  const log = (message: string) => { console.log(message); if (logs.length < 200) logs.push(message.slice(0, 2000)); };
  const problem = (message: string) => { if (problems.length < 50) problems.push(message.slice(0, 2000)); };
  const interrupt = () => controller.abort(new Error('Browser checks interrupted by SIGINT/SIGTERM.'));
  process.on('SIGINT', interrupt); process.on('SIGTERM', interrupt);
  try {
    const options = parseOptions(args);
    deadline = setTimeout(() => controller.abort(new Error(`Browser checks timed out after ${options.timeout}ms.`)), options.timeout);
    await access(options.browser, constants.X_OK).catch(() => {
      throw new Error(`Chromium is missing or not executable: ${options.browser}. Install Chromium or pass --browser /absolute/path. No checks were skipped.`);
    });
    if (process.platform === 'win32') throw new Error('Browser checks require POSIX process-group cleanup; run on Linux. npm test remains portable.');
    await access(join(root, 'dist/index.html')).catch(() => {
      throw new Error('Production bundle missing. Run npm run test:browser (builds first), not the runner directly.');
    });
    await mkdir(join(root, 'artifacts/browser-check'), { recursive: true });
    artifacts = await mkdtemp(join(root, 'artifacts/browser-check/run-'));
    log(`Evidence: ${artifacts}`);
    const origin = await startPreview(join(root, 'dist'), cleanup, controller.signal);
    assert.ok(![4321, 4331, 4333].includes(Number(new URL(origin).port)), 'Reserved preview port selected.');
    resources.server = origin;
    // Chromium puts a Unix socket below TMPDIR; keep this owned path short.
    const profile = await mkdtemp(join(root, 'artifacts/p-'));
    resources.profile = profile;
    cleanup.add(() => rm(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }));
    // A dedicated POSIX group lets cleanup stop descendants too; never unref this child.
    const child = spawn(options.browser, chromiumArgs(profile), {
      cwd: root, shell: false, detached: true,
      stdio: ['ignore', 'pipe', 'pipe'], env: chromiumEnvironment(profile),
    });
    resources.pid = child.pid;
    resources.processGroup = child.pid;
    let spawnError: Error | undefined;
    child.once('error', error => { spawnError = error; });
    const record = (data: Buffer) => { chromiumLog = (chromiumLog + data.toString()).slice(-16_384); };
    child.stdout.on('data', record); child.stderr.on('data', record);
    cleanup.add(() => stopChild(child, 3000, true));
    log(`Owned Chromium PID ${child.pid}; preview ${origin}; profile ${profile}`);
    const port = await waitFor('Chromium startup (sandbox must be supported; see chromium.log)', async () => {
      if (spawnError) throw new Error(`Cannot start Chromium: ${spawnError.message}`);
      if (child.exitCode !== null || child.signalCode !== null) throw new Error(`Chromium exited during startup (${child.exitCode ?? child.signalCode}). Sandbox/WebGL support is required.\n${chromiumLog}`);
      let contents: string;
      try { contents = await readFile(join(profile, 'DevToolsActivePort'), 'utf8'); }
      catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
      const port = Number(contents.split('\n')[0]);
      assert.ok(Number.isInteger(port) && port > 0 && port < 65536, 'Invalid owned Chromium DevTools port.');
      return port;
    }, 15_000, controller.signal);
    resources.debugPort = port;
    const response = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]) });
    assert.ok(response.ok, `Chromium target discovery returned HTTP ${response.status}`);
    const targets = await response.json() as { type: string; url: string; webSocketDebuggerUrl: string }[];
    const target = targets.find(target => target.type === 'page' && target.url === 'about:blank');
    assert.ok(target, 'Owned Chromium did not create the requested blank page.');
    cdp = await Cdp.connect(target.webSocketDebuggerUrl, 5000, controller.signal);
    const page = cdp;
    cleanup.add(async () => { page.close(); });
    controller.signal.addEventListener('abort', () => page.close(new Error(String(controller.signal.reason))), { once: true });
    const version = await page.call('Browser.getVersion');
    resources.browser = version.product;
    const launched = await page.call<{ arguments: string[] }>('Browser.getBrowserCommandLine');
    assert.ok(!launched.arguments.some(arg => /^--(?:no-sandbox|disable[^=]*sandbox|load-extension)(?:=|$)/.test(arg)), 'Browser launcher injected sandbox bypass or extensions.');
    assert.deepEqual(launched.arguments.filter(arg => arg.startsWith('--user-data-dir=')), [`--user-data-dir=${profile}`]);
    resources.arguments = launched.arguments;
    const pending = new Set<string>();
    page.on('Runtime.exceptionThrown', event => problem(`Uncaught browser exception: ${JSON.stringify(event.exceptionDetails)}`));
    page.on('Runtime.consoleAPICalled', event => {
      const message = `console.${event.type}: ${JSON.stringify(event.args)}`;
      if (['error', 'assert'].includes(event.type)) problem(message);
      if (logs.length < 200) logs.push(message.slice(0, 2000));
    });
    page.on('Log.entryAdded', event => {
      if (event.entry.level === 'error') problem(`Browser log: ${JSON.stringify(event.entry)}`);
    });
    page.on('Network.requestWillBeSent', event => {
      pending.add(event.requestId);
      if (requests.length < 200) requests.push(event.request.url.slice(0, 2000)); else problem('More than 200 production requests.');
      if (new URL(event.request.url).origin !== origin) problem(`Non-local request: ${event.request.url}`);
    });
    page.on('Network.loadingFinished', event => pending.delete(event.requestId));
    page.on('Network.loadingFailed', event => { pending.delete(event.requestId); problem(`Request failed: ${JSON.stringify(event)}`); });
    page.on('Network.responseReceived', event => {
      if (event.response.status >= 400) problem(`HTTP ${event.response.status}: ${event.response.url}`);
    });
    page.on('Network.webSocketCreated', event => problem(`Unexpected page WebSocket: ${event.url}`));
    page.on('Fetch.requestPaused', event => {
      const local = new URL(event.request.url).origin === origin;
      if (!local) problem(`Blocked non-local request: ${event.request.url}`);
      void page.call(local ? 'Fetch.continueRequest' : 'Fetch.failRequest',
        { requestId: event.requestId, ...local ? {} : { errorReason: 'BlockedByClient' } }).catch(error => problem(String(error)));
    });
    await Promise.all(['Page.enable', 'Runtime.enable', 'Log.enable', 'Network.enable'].map(method => page.call(method)));
    await page.call('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
    let loaded = false;
    page.on('Page.loadEventFired', () => { loaded = true; });
    await page.call('Page.navigate', { url: `${origin}/?debug` });
    await waitFor('Production document load', async () => loaded, 15_000, controller.signal);
    await waitFor('Production WebGL game boot', () => page.evaluate("Boolean(window.__BOUNDSTOY__)"), 15_000, controller.signal);
    await waitFor('Initial asset requests', async () => pending.size === 0, 5000, controller.signal);
    await check({ page, origin, signal: controller.signal, requests, log });
    controller.signal.throwIfAborted();
    assert.deepEqual(problems, [], 'Browser console, protocol, or network failures');
  } catch (error) {
    failure = controller.signal.aborted ? controller.signal.reason : error;
    if (cdp && artifacts) {
      try {
        const screenshot = await cdp.call<{ data: string }>('Page.captureScreenshot', { format: 'jpeg', quality: 60, captureBeyondViewport: false });
        const image = Buffer.from(screenshot.data, 'base64');
        if (image.length <= 2_000_000) await writeFile(join(artifacts, 'failure.jpg'), image);
      } catch (captureError) { log(`Screenshot unavailable: ${String(captureError)}`); }
    }
  } finally {
    if (deadline) clearTimeout(deadline);
    try { await cleanup.close(); cleaned = true; }
    catch (error) { failure = new Error([failure, error].filter(Boolean).map(String).join('\n'), { cause: failure }); }
    process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt);
    log(`Cleanup: ${cleaned ? 'owned browser, sockets, profile and preview closed' : 'FAILED; inspect resources in report.json'}`);
    if (artifacts) {
      await writeFile(join(artifacts, 'chromium.log'), chromiumLog);
      await writeFile(join(artifacts, 'report.json'), JSON.stringify({
        passed: !failure, cleaned, resources, requests, logs, problems,
        error: failure instanceof Error ? `${failure.stack}\n${String(failure.cause ?? '')}` : failure ? String(failure) : null,
      }, null, 2));
    }
  }
  if (failure) {
    console.error(`FAIL: ${failure instanceof Error ? failure.stack : String(failure)}\nEvidence: ${artifacts || 'no browser resources created'}`);
    process.exitCode = 1;
  } else log('PASS: all production browser checks.');
}

if (import.meta.main) await main();
