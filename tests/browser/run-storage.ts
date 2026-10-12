import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { Cdp, Cleanup, chromiumArgs, chromiumEnvironment, parseOptions, startPreview, stopChild, waitFor } from './runtime.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));
// Test-only virtual Vite entry. No production debug hooks or runtime imports.
const fixtureSource = `
import { openBrowserRunStorage, RUN_STORAGE_KEY } from ${JSON.stringify(join(root, 'application/run-storage.ts'))};
import { createIndexedDBPort, DATABASE_NAME, DATABASE_STORE } from ${JSON.stringify(join(root, 'application/indexeddb.ts'))};
import { readWorldRecords, recordWorldFinish, PROGRESS_KEY, DRAFT_KEY } from ${JSON.stringify(join(root, 'application/storage.ts'))};
import { createRunSnapshot } from ${JSON.stringify(join(root, 'application/run-snapshot.ts'))};
import { createState, step, STILL } from ${JSON.stringify(join(root, 'core/simulation.ts'))};
import { worldFixture } from ${JSON.stringify(join(root, 'tests/fixtures/world.ts'))};
const world = worldFixture();
const must = result => {
  if (result.status !== 'ok') throw new Error(JSON.stringify(result));
  return result.value;
};
const store = must(openBrowserRunStorage((id, revision) =>
  id === world.id && revision === world.revision ? world : undefined));
const rawPort = createIndexedDBPort(indexedDB);
// Test-only fault injection still uses a real native transaction and abort event.
let abortNext = false, abortedAfterRequestSuccess = false;
const nativePut = IDBObjectStore.prototype.put;
IDBObjectStore.prototype.put = function(...args) {
  const request = nativePut.apply(this, args);
  if (abortNext && this.name === DATABASE_STORE) {
    abortNext = false;
    const tx = this.transaction;
    request.addEventListener('success', () => {
      abortedAfterRequestSuccess = true;
      tx.abort();
    }, { once: true });
  }
  return request;
};
let lease, oldLease;
const snapshot = (id = 'run-browser', ticks = 0) => {
  let state = createState(world);
  for (let i = 0; i < ticks; i++) state = step(world, state, STILL);
  return createRunSnapshot(world, id, state);
};
const finish = (id = 'run-browser') => {
  let state = createState(world);
  while (!state.won) state = step(world, state, { x: 1, y: 0 });
  return createRunSnapshot(world, id, state);
};
const facts = (ticks, deaths, id = world.id) => recordWorldFinish(readWorldRecords(null), { ...world, id }, ticks, deaths);
globalThis.fixture = {
  world, store, snapshot, finish, facts, key: RUN_STORAGE_KEY, progressKey: PROGRESS_KEY, draftKey: DRAFT_KEY,
  get lease() { return lease; }, get oldLease() { return oldLease; },
  acquire: async () => {
    const result = await store.acquire();
    if (result.status === 'ok') { lease = result.value; return { status: 'ok', initial: lease.initial }; }
    return result;
  },
  release: async () => { oldLease = lease; await lease.release(); },
  raw: () => rawPort.transact([RUN_STORAGE_KEY], tx => tx.get(RUN_STORAGE_KEY)),
  setRaw: source => rawPort.transact([RUN_STORAGE_KEY], tx => tx.put(RUN_STORAGE_KEY, source)),
  abortNext: () => { abortNext = true; abortedAfterRequestSuccess = false; },
  get abortedAfterRequestSuccess() { return abortedAfterRequestSuccess; },
};
`;

export async function main(args = process.argv.slice(2)) {
  const options = parseOptions(args), cleanup = new Cleanup(), controller = new AbortController();
  const logs: string[] = [], problems: string[] = [], resources: Record<string, unknown> = {};
  let artifacts = '', chromiumLog = '', cleaned = false, failure: unknown;
  const log = (message: string) => { logs.push(message); console.log(message); };
  const interrupt = () => controller.abort(new Error('Run-storage browser check interrupted.'));
  const deadline = setTimeout(() => controller.abort(new Error('Run-storage browser check timed out.')), options.timeout);
  process.on('SIGINT', interrupt); process.on('SIGTERM', interrupt);
  try {
    await mkdir(join(root, 'artifacts/run-storage'), { recursive: true });
    artifacts = await mkdtemp(join(root, 'artifacts/run-storage/run-'));
    const directory = join(artifacts, 'fixture');
    log(`Evidence: ${artifacts}`);
    await build({
      root, configFile: false, logLevel: 'warn',
      plugins: [{
        name: 'isolated-run-storage-fixture',
        resolveId: id => id === 'virtual:run-storage' || id === join(root, 'virtual:run-storage') ? '\0run-storage' : undefined,
        load: id => id === '\0run-storage' ? fixtureSource : undefined,
      }],
      build: { outDir: directory, emptyOutDir: false,
        lib: { entry: 'virtual:run-storage', formats: ['es'], fileName: () => 'fixture.js' } },
    });
    await writeFile(join(directory, 'index.html'),
      '<!doctype html><title>BT-044 isolated storage test</title><link rel="icon" href="data:,"><script type="module" src="./fixture.js"></script>');
    const origin = await startPreview(directory, cleanup, controller.signal);
    assert.ok(![4321, 4331, 4333].includes(Number(new URL(origin).port)));
    resources.preview = origin;
    const profile = await mkdtemp(join(root, 'artifacts/p-'));
    resources.profile = profile;
    cleanup.add(() => rm(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }));
    const child = spawn(options.browser, chromiumArgs(profile), {
      cwd: root, shell: false, detached: true, stdio: ['ignore', 'pipe', 'pipe'], env: chromiumEnvironment(profile),
    });
    resources.pid = child.pid; resources.processGroup = child.pid;
    cleanup.add(() => stopChild(child, 3000, true));
    let spawnError: Error | undefined;
    child.once('error', error => { spawnError = error; });
    const record = (data: Buffer) => { chromiumLog = (chromiumLog + data.toString()).slice(-16_384); };
    child.stdout.on('data', record); child.stderr.on('data', record);
    const port = await waitFor('Owned Chromium startup', async () => {
      if (spawnError) throw spawnError;
      if (child.exitCode !== null || child.signalCode !== null) throw new Error(`Chromium exited: ${chromiumLog}`);
      try { return Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); }
      catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
    }, 15000, controller.signal);
    assert.ok(Number.isInteger(port) && port > 0 && port < 65536);
    resources.debugPort = port;
    log(`Owned Chromium PID ${child.pid}, preview ${origin}, profile ${profile}`);
    const targets = async () => {
      const reply = await fetch(`http://127.0.0.1:${port}/json/list`,
        { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]) });
      assert.ok(reply.ok);
      return reply.json() as Promise<{ id: string; type: string; webSocketDebuggerUrl: string }[]>;
    };
    const versionReply = await fetch(`http://127.0.0.1:${port}/json/version`,
      { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]) });
    assert.ok(versionReply.ok);
    const endpoint = await versionReply.json() as { webSocketDebuggerUrl: string };
    const browser = await Cdp.connect(endpoint.webSocketDebuggerUrl, 5000, controller.signal);
    cleanup.add(async () => browser.close());
    controller.signal.addEventListener('abort', () => browser.close(), { once: true });
    resources.browser = await browser.call('Browser.getVersion');
    const launched = await browser.call<{ arguments: string[] }>('Browser.getBrowserCommandLine');
    assert.ok(!launched.arguments.some(arg => /^--(?:no-sandbox|disable[^=]*sandbox|load-extension)(?:=|$)/.test(arg)));
    assert.deepEqual(launched.arguments.filter(arg => arg.startsWith('--user-data-dir=')), [`--user-data-dir=${profile}`]);
    resources.arguments = launched.arguments;
    const pages: string[] = [];
    resources.targets = pages;
    const newTab = async () => {
      const { targetId } = await browser.call<{ targetId: string }>('Target.createTarget', { url: 'about:blank' });
      pages.push(targetId);
      const target = await waitFor('Owned tab target', async () => (await targets()).find(target => target.id === targetId),
        5000, controller.signal);
      const page = await Cdp.connect(target.webSocketDebuggerUrl, 5000, controller.signal);
      cleanup.add(async () => page.close());
      controller.signal.addEventListener('abort', () => page.close(), { once: true });
      page.on('Runtime.exceptionThrown', event => problems.push(JSON.stringify(event)));
      await page.call('Runtime.enable');
      await page.call('Page.enable');
      await page.call('Page.navigate', { url: origin });
      await waitFor('Isolated storage fixture boot', () => page.evaluate('Boolean(globalThis.fixture)'),
        15000, controller.signal);
      assert.equal(await page.evaluate('isSecureContext && !!navigator.locks && !!indexedDB'), true);
      return { page, targetId };
    };
    const { page: a, targetId: aId } = await newTab();
    const { page: b } = await newTab();
    const status = async (page: Cdp, expression: string, expected: string) => {
      const answer = await page.evaluate<{ status: string }>(expression);
      assert.equal(answer.status, expected, `${expression}: ${JSON.stringify(answer)}`);
      return answer;
    };
    await a.evaluate(`localStorage.setItem(fixture.progressKey,
      '{"version":1,"runs":{"old-course":{"ticks":450,"deaths":0}}}');
      localStorage.setItem(fixture.draftKey, 'existing draft')`);
    await status(a, 'fixture.acquire()', 'ok');
    await status(a, `fixture.lease.replace({ ...fixture.snapshot(), state: {
      ...fixture.snapshot().state, velocity: { x: -0, y: 0 } } })`, 'ok');
    assert.equal(await a.evaluate('(async () => Object.is((await fixture.lease.read()).value.active.state.velocity.x, -0))()'), true);
    await status(a, 'fixture.lease.save(fixture.snapshot("run-browser", 37))', 'ok');
    // Pause means no simulator steps and no release, not a localStorage flag.
    await status(b, 'fixture.acquire()', 'busy');
    await status(b, 'fixture.store.mergeRecords(fixture.facts(800, 4))', 'busy');
    await status(a, 'fixture.lease.mergeRecords(fixture.facts(1000, 0))', 'ok');
    await a.evaluate('fixture.release()');
    await status(a, 'fixture.oldLease.save(fixture.snapshot("run-browser", 38))', 'released');
    log('PASS: paused owner excludes second tab and record writers; async transaction commits work; released capability is rejected.');

    // Both facts were prepared independently, not copied from current storage.
    const expressions = ['fixture.store.mergeRecords(fixture.facts(800, 4))',
      'fixture.store.mergeRecords(fixture.facts(900, 0))'];
    const overlap = await Promise.all([a, b].map((page, i) => page.evaluate<{ status: string }>(expressions[i])));
    for (let i = 0; i < overlap.length; i++) {
      assert.ok(['ok', 'busy'].includes(overlap[i].status));
      if (overlap[i].status === 'busy') await status([a, b][i], expressions[i], 'ok');
    }
    await status(a, 'fixture.store.mergeRecords(fixture.facts(850, 2, "other-world"))', 'ok');
    await status(b, 'fixture.store.mergeRecords(fixture.facts(800, 4))', 'ok');
    await status(a, 'fixture.acquire()', 'ok');
    const view = await a.evaluate<any>('fixture.lease.initial');
    assert.equal(view.active.state.tick, 37);
    assert.deepEqual(view.records.records.map((entry: any) => [entry.worldId, entry.run]), [
      ['other-world', { ticks: 850, deaths: 2 }],
      ['progression-fixture', { ticks: 800, deaths: 4, cleanTicks: 900 }],
    ]);
    log(`PASS: native overlapping/stale record writes retain ${JSON.stringify(view.records.records)}; active tick 37 unchanged.`);

    await status(a, 'fixture.lease.save(fixture.snapshot("run-browser", 73))', 'ok');
    await browser.call('Target.closeTarget', { targetId: aId });
    await waitFor('Closed owner releases native lock', async () => {
      const answer = await b.evaluate<any>('fixture.acquire()');
      if (answer.status === 'busy') return false;
      assert.equal(answer.status, 'ok'); assert.equal(answer.initial.active.state.tick, 73);
      return true;
    }, 10000, controller.signal);
    log('PASS: closing owner without release allows another tab to acquire the latest snapshot (tick 73).');

    await status(b, 'fixture.lease.save(fixture.snapshot("run-browser", 111))', 'ok');
    const { page: c } = await newTab();
    await status(c, 'fixture.acquire()', 'busy');
    // Identify THIS owner's renderer via its unique trace marker, then verify
    // the PID against this owned browser before terminating it. Page.crash can
    // stall in platform crash reporting rather than actually terminate.
    const events: any[] = [];
    let traced = false;
    browser.on('Tracing.dataCollected', event => events.push(...event.value));
    browser.on('Tracing.tracingComplete', () => { traced = true; });
    await browser.call('Tracing.start', { categories: 'devtools.timeline', transferMode: 'ReportEvents' });
    await b.evaluate('console.timeStamp("bt-044-owned-renderer")');
    await browser.call('Tracing.end');
    await waitFor('Owned renderer trace', async () => traced, 10000, controller.signal);
    const marker = events.find(event => event.name === 'TimeStamp' && event.args?.data?.message === 'bt-044-owned-renderer');
    assert.ok(marker, 'Owner trace marker missing');
    const processes = await browser.call<{ processInfo: { type: string; id: number }[] }>('SystemInfo.getProcessInfo');
    assert.ok(processes.processInfo.some(info => info.type === 'renderer' && info.id === marker.pid),
      'Refuse to terminate PID not verified as this owned browser renderer.');
    resources.terminatedRenderer = marker.pid;
    await b.call('Inspector.enable');
    let crashed = false;
    b.on('Inspector.targetCrashed', () => { crashed = true; });
    process.kill(marker.pid, 'SIGKILL');
    await waitFor('Native renderer termination event', async () => crashed, 10000, controller.signal);
    log(`Observed native Inspector.targetCrashed after terminating owned renderer PID ${marker.pid}.`);
    await waitFor('Crashed owner releases native lock', async () => {
      const answer = await c.evaluate<any>('fixture.acquire()');
      if (answer.status === 'busy') return false;
      assert.equal(answer.status, 'ok'); assert.equal(answer.initial.active.state.tick, 111);
      return true;
    }, 10000, controller.signal);
    log('PASS: terminated renderer releases ownership; next owner reads latest snapshot (tick 111).');

    await status(c, 'fixture.lease.save(fixture.snapshot("run-browser", 100))', 'stale');
    await status(c, 'fixture.lease.complete(fixture.finish())', 'ok');
    const completed = await c.evaluate<string>('fixture.raw()');
    await status(c, 'fixture.lease.complete(fixture.finish())', 'ok');
    assert.equal(await c.evaluate('fixture.raw()'), completed);
    await status(c, 'fixture.lease.save(fixture.snapshot("run-browser", 120))', 'stale');
    await status(c, 'fixture.lease.replace(fixture.snapshot())', 'retired');
    await status(c, 'fixture.lease.replace(fixture.snapshot("next-run"))', 'ok');
    await status(c, 'fixture.lease.complete(fixture.finish())', 'ok');
    assert.equal(await c.evaluate('(async () => (await fixture.lease.read()).value.active.runId)()'), 'next-run');
    log(`PASS: completion retires atomically; replay changes no bytes; saves/replacements cannot resurrect; receipt ${completed}`);

    await status(c, 'fixture.lease.recordLegacyFinish("course", 900, 4)', 'ok');
    await c.evaluate('fixture.release()');
    const { page: d } = await newTab();
    await status(d, 'fixture.store.recordLegacyFinish("course", 1000, 0)', 'ok');
    await status(c, 'fixture.store.recordLegacyFinish("course", 950, 1)', 'ok');
    assert.deepEqual(await d.evaluate('(async () => (await fixture.store.readLegacy()).value.progress)()'), {
      'old-course': { ticks: 450, deaths: 0 }, course: { ticks: 900, deaths: 4, cleanTicks: 1000 },
    });
    assert.equal(await d.evaluate('localStorage.getItem(fixture.draftKey)'), 'existing draft');
    assert.deepEqual(await d.evaluate('JSON.parse(localStorage.getItem(fixture.progressKey)).runs'),
      { 'old-course': { ticks: 450, deaths: 0 } });
    await status(d, 'fixture.store.writeLegacyDraft("edited draft")', 'ok');
    assert.equal(await c.evaluate('(async () => (await fixture.store.readLegacy()).value.draft)()'), 'edited draft');
    log('PASS: transactional legacy writes retain unknown courses/clean facts; original localStorage progress/drafts remain unchanged.');

    await status(d, 'fixture.acquire()', 'ok');
    const beforeQuota = await d.evaluate<string>('fixture.raw()');
    await d.evaluate('fixture.abortNext()');
    await status(d, 'fixture.lease.complete(fixture.finish("next-run"))', 'storage-error');
    assert.equal(await d.evaluate('fixture.abortedAfterRequestSuccess'), true);
    assert.equal(await d.evaluate('fixture.raw()'), beforeQuota);
    log('PASS: native abort AFTER put request success returns storage-error; completion leaves active, records and retirements unchanged.');
    let quotaAvailable = false, nativeQuotaCovered = false;
    try {
      await d.call('Storage.overrideQuotaForOrigin', { origin, quotaSize: 1 });
      quotaAvailable = true;
    } catch (error) { log(`SKIP native quota override unavailable: ${String(error)}; unit quota + native abort remain covered.`); }
    if (quotaAvailable) {
      try {
        resources.quotaOverride = await d.call('Storage.getUsageAndQuota', { origin });
        const quota = await d.evaluate<{ status: string; reason?: string }>(`(async () => {
          const result = await fixture.lease.writeLegacyDraft("q".repeat(1024 * 1024));
          return { status: result.status, reason: result.reason };
        })()`);
        if (quota.status === 'ok') {
          log('SKIP native quota: CDP accepted override but Chromium committed the bounded 1 MiB probe. No disk filling or delay retries; unit quota + native abort covered.');
        } else {
          assert.equal(quota.status, 'storage-error');
          assert.match(quota.reason!, /quota/i);
          assert.equal(await d.evaluate('fixture.raw()'), beforeQuota);
          assert.equal(await d.evaluate('(async () => (await fixture.lease.readLegacy()).value.draft)()'), 'edited draft');
          nativeQuotaCovered = true;
          log(`PASS: native IndexedDB quota rejection under CDP origin quota override (no disk filling): ${JSON.stringify(quota)}`);
        }
      } finally { await d.call('Storage.overrideQuotaForOrigin', { origin }); }
      if (!nativeQuotaCovered) await status(d, 'fixture.lease.writeLegacyDraft("edited draft")', 'ok');
    }
    await status(d, 'fixture.lease.mergeRecords(fixture.facts(200, 0, "quota-new-world"))', 'ok');
    await d.evaluate('fixture.release()');
    await status(c, 'fixture.acquire()', 'ok');
    assert.equal(await c.evaluate('fixture.lease.initial.records.records.some(entry => entry.worldId === "quota-new-world")'), true);
    await c.evaluate('fixture.release()');
    resources.nativeQuotaCovered = nativeQuotaCovered;
    log(`PASS: immediate lock handoff after ${nativeQuotaCovered ? 'abort/quota' : 'abort'} recovery reads latest committed record, without coherence delays.`);

    const beforeCorruption = await d.evaluate<string>('fixture.raw()');
    await d.evaluate('fixture.setRaw("{corrupt")');
    const corruptionAcquire = await c.evaluate<any>('fixture.acquire()');
    assert.equal(corruptionAcquire.status, 'corrupt');
    assert.equal(await c.evaluate('fixture.raw()'), '{corrupt');
    await status(d, 'fixture.acquire()', 'corrupt');
    // Explicit test recovery only, NOT a production automatic reset path.
    assert.equal(await c.evaluate('(async () => (await fixture.store.exportRecovery()).value[fixture.key])()'), '{corrupt');
    await d.evaluate(`fixture.setRaw(${JSON.stringify(beforeCorruption)})`);
    await status(d, 'fixture.acquire()', 'ok');
    await d.evaluate('fixture.release()');
    log('PASS: corrupt bytes survive failed acquisition in both tabs; failed acquisitions release native locks; explicit test recovery succeeds.');
    assert.deepEqual(problems, [], 'Unexpected browser runtime errors');
    controller.signal.throwIfAborted();
  } catch (error) { failure = controller.signal.aborted ? controller.signal.reason : error; }
  finally {
    clearTimeout(deadline);
    try { await cleanup.close(); cleaned = true; }
    catch (error) { failure = new Error([failure, error].filter(Boolean).map(String).join('\n')); }
    process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt);
    log(`Cleanup: ${cleaned ? 'owned Chromium group, CDP sockets, profile and ephemeral preview stopped' : 'FAILED'}`);
    if (artifacts) {
      await writeFile(join(artifacts, 'chromium.log'), chromiumLog);
      await writeFile(join(artifacts, 'report.json'), JSON.stringify({
        passed: !failure, cleaned, resources, logs, problems,
        error: failure instanceof Error ? failure.stack : failure ? String(failure) : null,
      }, null, 2));
    }
  }
  if (failure) { console.error(failure); process.exitCode = 1; }
  else log('PASS: all BT-044 native Chromium storage scenarios.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
