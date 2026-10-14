import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import type { Socket as NetSocket } from 'node:net';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { Cdp, Cleanup, chromiumArgs, chromiumEnvironment, parseOptions, startPreview, stopChild, waitFor } from './browser/runtime.ts';

class Socket extends EventTarget {
  sent: { id: number; method: string }[] = [];
  closed = false;
  send(message: string) { this.sent.push(JSON.parse(message)); }
  close() { this.closed = true; this.dispatchEvent(new Event('close')); }
  message(value: unknown) { this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(value) })); }
}

test('BrowserCli_WithoutImportMetaMain_StillExecutesInsteadOfSilentlyPassing', async () => {
  const source = await readFile(new URL('../scripts/browser-check.ts', import.meta.url), 'utf8');
  const fixture = new URL(`../scripts/.browser-entry-${randomUUID()}.ts`, import.meta.url);
  await writeFile(fixture, `Reflect.deleteProperty(import.meta, 'main');\n${source}`, { flag: 'wx' });
  try {
    const result = spawnSync(process.execPath, [fileURLToPath(fixture), '--browser', '/missing-boundstoy-browser'], {
      encoding: 'utf8', timeout: 10_000,
    });
    assert.equal(result.status, 1, `CLI did not execute: ${result.stderr}`);
    assert.match(result.stderr, /missing or not executable/);
  } finally { await unlink(fixture); }
});

test('BrowserOptions_InvalidOrUnsafeArguments_RejectRatherThanSkip', () => {
  assert.deepEqual(parseOptions([]), { browser: '/usr/bin/chromium', timeout: 180_000 });
  assert.deepEqual(parseOptions(['--browser', '/a path/chrome', '--timeout', '30000']),
    { browser: '/a path/chrome', timeout: 30_000 });
  for (const args of [
    ['--unknown'], ['--browser'], ['--browser', 'chromium'], ['--timeout', 'NaN'],
    ['--timeout', '0'], ['--timeout', '1.5'], ['--timeout', '9999999'],
    ['--browser', '/a', '--browser', '/b'], ['--no-sandbox'],
  ]) assert.throws(() => parseOptions(args), /browser|timeout|argument/i);
});

test('ChromiumArgs_IsolatedProfile_NoSandboxBypassOrSharedDebuggingPort', () => {
  const profile = '/project/artifacts/profile with spaces';
  const args = chromiumArgs(profile);
  assert.ok(args.includes(`--user-data-dir=${profile}`));
  assert.ok(args.includes('--remote-debugging-port=0'));
  assert.ok(args.includes('--remote-debugging-address=127.0.0.1'));
  assert.ok(args.includes('--disable-extensions'));
  assert.ok(args.includes('--mute-audio'), 'Automated browser checks must not play through the user speakers');
  assert.equal(args.some(arg => /no-sandbox|disable.*sandbox|load-extension/.test(arg)), false);
  assert.equal(args.at(-1), 'about:blank');
  const env = chromiumEnvironment(profile);
  for (const name of ['HOME', 'XDG_CONFIG_HOME', 'XDG_CACHE_HOME', 'XDG_DATA_HOME', 'TMPDIR']) {
    assert.equal(env[name], profile, `${name} must not inherit user launcher settings`);
  }
});

test('Cleanup_PartialStartupAndFailure_RunsAllDisposersOnceInReverseOrder', async () => {
  const cleanup = new Cleanup(), calls: number[] = [];
  cleanup.add(async () => { calls.push(1); });
  cleanup.add(async () => { calls.push(2); throw new Error('owned resource failed'); });
  cleanup.add(async () => { calls.push(3); });
  await assert.rejects(cleanup.close(), /owned resource failed/);
  await cleanup.close();
  assert.deepEqual(calls, [3, 2, 1]);
});

test('WaitFor_StartupTimeoutAndAbort_FailWithActionableContext', async () => {
  await assert.rejects(waitFor('Chromium DevTools endpoint', async () => null, 20),
    /Chromium DevTools endpoint.*timed out/);
  await assert.rejects(waitFor('startup', async () => { throw new Error('process exited 1'); }, 100),
    /process exited 1/);
  await assert.rejects(waitFor('startup', async () => null, 100, AbortSignal.abort(new Error('cancelled'))),
    /cancelled/);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('whole run expired after 10ms')), 10);
  try {
    await assert.rejects(waitFor('startup', async () => null, 100, controller.signal), /whole run expired after 10ms/);
  } finally { clearTimeout(timer); }
});

test('Cdp_OutOfOrderRepliesAndEvents_MatchCommandsById', async () => {
  const socket = new Socket(), cdp = new Cdp(socket as unknown as WebSocket, 100);
  const events: unknown[] = [];
  cdp.on('Page.loadEventFired', event => events.push(event));
  const first = cdp.call('Page.enable'), second = cdp.call('Runtime.enable');
  socket.message({ method: 'Page.loadEventFired', params: { timestamp: 1 } });
  socket.message({ id: socket.sent[1].id, result: { second: true } });
  socket.message({ id: socket.sent[0].id, result: { first: true } });
  assert.deepEqual(await first, { first: true });
  assert.deepEqual(await second, { second: true });
  assert.deepEqual(events, [{ timestamp: 1 }]);
  cdp.close();
  assert.equal(socket.closed, true);
});

test('Cdp_ProtocolErrorTimeoutDisconnectAndMalformedReply_RejectPendingCommands', async () => {
  const socket = new Socket(), cdp = new Cdp(socket as unknown as WebSocket, 20);
  const invalid = cdp.call('Bad.command');
  socket.message({ id: socket.sent[0].id, error: { code: -32601, message: 'Method not found' } });
  await assert.rejects(invalid, /Bad.command.*Method not found/);
  await assert.rejects(cdp.call('Never.answers'), /Never.answers.*timed out/);
  const pending = cdp.call('Still.pending');
  socket.dispatchEvent(new MessageEvent('message', { data: '{' }));
  await assert.rejects(pending, /malformed.*CDP/i);
  assert.equal(socket.closed, true);
  await assert.rejects(cdp.call('After.close'), /closed/i);
  const other = new Socket(), disconnected = new Cdp(other as unknown as WebSocket, 100);
  const waiting = disconnected.call('Page.enable');
  other.close();
  await assert.rejects(waiting, /closed/i);
});

test('Cdp_BrowserEvaluationException_IsNotASuccessShapedUndefined', async () => {
  const socket = new Socket(), cdp = new Cdp(socket as unknown as WebSocket, 100);
  const evaluation = cdp.evaluate('throw new Error("fixture")');
  socket.message({ id: socket.sent[0].id, result: {
    exceptionDetails: { text: 'Uncaught', exception: { description: 'Error: fixture' } },
  } });
  await assert.rejects(evaluation, /fixture/);
  cdp.close();
});

test('BrowserCli_MissingBrowserAndInvalidArguments_ExitNonzeroWithoutStartingResources', () => {
  const cwd = new URL('..', import.meta.url);
  for (const [args, message] of [
    [['--no-sandbox'], /Unknown.*argument/],
    [['--browser', '/not-an-installed-browser/bt-002'], /Chromium is missing.*--browser/],
  ] as const) {
    const result = spawnSync(process.execPath, ['scripts/browser-check.ts', ...args], { cwd, encoding: 'utf8', timeout: 10_000 });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, message);
    assert.doesNotMatch(result.stdout, /Owned Chromium|Evidence:/);
  }
});

test('StopChild_ResistantOwnedProcess_IsReapedWithoutTouchingAnotherProcess', async t => {
  const spawnChild = () => spawn(process.execPath, ['-e',
    "process.on('SIGTERM', () => {}); console.log('ready'); setInterval(() => {}, 1000)"],
  { cwd: new URL('..', import.meta.url), stdio: ['ignore', 'pipe', 'pipe'] });
  const child = spawnChild(), other = spawnChild();
  t.after(async () => { await stopChild(child, 30); await stopChild(other, 30); });
  let ready = false;
  child.stdout.on('data', () => { ready = true; });
  await waitFor('Fixture process ready', async () => ready, 1000);
  await stopChild(child, 30);
  assert.equal(child.signalCode, 'SIGKILL', 'Escalate only the owned, unresponsive process');
  assert.equal(other.exitCode, null);
  assert.equal(other.signalCode, null);
  await stopChild(child, 30);
});

test('Cdp_HandshakeTimeout_ClosesTheOwnedSocketAndRejectsExternalEndpoints', async t => {
  let connected = false, closed = false;
  const sockets = new Set<NetSocket>();
  const server = createServer(socket => {
    connected = true; sockets.add(socket); socket.resume();
    socket.on('close', () => { closed = true; sockets.delete(socket); });
  });
  t.after(() => {
    for (const socket of sockets) socket.destroy();
    return new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  await assert.rejects(Cdp.connect(`ws://127.0.0.1:${address.port}`, 100), /CDP WebSocket connection.*timed out/);
  assert.equal(connected, true);
  await waitFor('Timed-out WebSocket closes', async () => closed, 1000);
  await assert.rejects(Cdp.connect('ws://example.invalid:9222'), /Refusing non-loopback/);
});

test('Preview_OnlyOwnedStaticFiles_CleansListenerAndConnectionsWithoutSignalHandlers', async t => {
  const cleanup = new Cleanup();
  t.after(() => cleanup.close());
  const listeners = process.listeners('SIGTERM');
  const origin = await startPreview(fileURLToPath(new URL('./browser/fixtures', import.meta.url)), cleanup);
  assert.deepEqual(process.listeners('SIGTERM'), listeners);
  const response = await fetch(origin);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type')!, /text\/html/);
  assert.match(await response.text(), /Owned preview fixture/);
  assert.equal((await fetch(`${origin}/missing.js`)).status, 404);
  assert.equal((await fetch(`${origin}/%2e%2e%2fruntime.ts`)).status, 403);
  assert.equal((await fetch(origin, { method: 'POST' })).status, 405);
  await cleanup.close();
  await assert.rejects(fetch(origin), /fetch failed/);
});

test('StopChild_OwnedProcessGroup_WaitsForDescendantsBeforeProfileCleanup',
  { skip: process.platform === 'win32' ? 'POSIX process groups are unavailable on Windows' : false }, async t => {
    const source = `
      const {spawn} = require('node:child_process');
      const child = spawn(process.execPath, ['-e', "process.on('SIGTERM', () => setTimeout(() => process.exit(0), 150)); console.log('ready'); setInterval(() => {}, 1000)"]);
      child.stdout.on('data', () => console.log('ready'));
      process.on('SIGTERM', () => child.on('exit', () => process.exit(0)));
    `;
    const child = spawn(process.execPath, ['-e', source], {
      cwd: new URL('..', import.meta.url), detached: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    t.after(async () => {
      try { await stopChild(child, 1000, true); }
      finally {
        try { process.kill(-child.pid!, 'SIGKILL'); }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
      }
    });
    let ready = false;
    child.stdout.on('data', () => { ready = true; });
    await waitFor('Process group fixture ready', async () => ready, 1000);
    await stopChild(child, 1000, true);
    assert.throws(() => process.kill(-child.pid!, 0), { code: 'ESRCH' }, 'No owned descendant may survive cleanup');
  });
