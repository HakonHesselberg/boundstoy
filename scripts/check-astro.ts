import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { access, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseOptions, stopChild, waitFor } from '../tests/browser/runtime.ts';
import { BASES, auditConsumer, inventory, stageConsumer } from '../tests/astro-consumer/fixture.ts';
import { checkBrowser } from '../tests/astro-consumer/browser.ts';

const root = fileURLToPath(new URL('..', import.meta.url));

export async function runTool(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv,
  signal: AbortSignal, logFile: string) {
  signal.throwIfAborted();
  const child = spawn(command, args, { cwd, env, shell: false, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '', closed = false, spawnError: Error | undefined;
  child.once('error', error => { spawnError = error; });
  child.once('close', () => { closed = true; });
  const record = (data: Buffer) => { output = (output + data.toString()).slice(-1_000_000); };
  child.stdout.on('data', record); child.stderr.on('data', record);
  try {
    await waitFor(`${command} ${args.join(' ')}`, async () => {
      if (spawnError) throw spawnError;
      return closed;
    }, 600_000, signal);
    assert.equal(child.exitCode, 0, `${command} ${args.join(' ')} failed (${child.exitCode ?? child.signalCode})\n${output}`);
  } finally {
    try { await stopChild(child, 3000, true); }
    finally { await writeFile(logFile, output); }
  }
}

export async function main(args = process.argv.slice(2)) {
  const controller = new AbortController(), signal = controller.signal;
  const completed: string[] = [];
  let artifacts = '', failure: unknown, deadline: ReturnType<typeof setTimeout> | undefined;
  const interrupt = () => controller.abort(new Error('Astro checks interrupted by SIGINT/SIGTERM.'));
  process.on('SIGINT', interrupt); process.on('SIGTERM', interrupt);
  try {
    const options = parseOptions(args);
    await access(options.browser, constants.X_OK).catch(() => {
      throw new Error(`Chromium is missing or not executable: ${options.browser}. Install Chromium or pass --browser /absolute/path. No checks were skipped.`);
    });
    if (process.platform !== 'linux') throw new Error('The optional Astro browser check is verified on Linux with sandboxed Chromium. npm run evaluate remains portable.');
    await access(join(root, 'dist/index.html')).catch(() => {
      throw new Error('Production bundle missing. Run npm run build && node scripts/check-astro.ts.');
    });
    deadline = setTimeout(() => controller.abort(new Error(`Astro checks timed out after ${options.timeout}ms.`)), options.timeout);
    const fixture = join(root, 'tests/astro-consumer'), artifactRoot = join(fixture, 'artifacts');
    artifacts = join(artifactRoot, `run-${randomUUID()}`);
    const work = join(artifacts, 'consumer');
    await mkdir(artifacts, { recursive: true });
    console.log(`Evidence: ${artifacts}`);
    const files = await inventory(join(root, 'dist'));
    await stageConsumer(fixture, join(root, 'dist'), join(root, 'astro/Boundstoy.astro'), work);
    const env = {
      ...process.env, HOME: artifacts, TMPDIR: artifacts,
      XDG_CONFIG_HOME: artifacts, XDG_CACHE_HOME: artifacts, XDG_DATA_HOME: artifacts,
      ASTRO_TELEMETRY_DISABLED: '1', ASTRO_DISABLE_UPDATE_CHECK: '1',
      npm_config_cache: join(artifacts, 'npm-cache'),
    };
    console.log('Installing isolated locked Astro fixture tooling (npm ci; no root/runtime dependency).');
    await runTool('npm', ['ci', '--no-audit', '--no-fund'], work, env, signal, join(artifacts, 'install.log'));
    const manifest = JSON.parse(await readFile(join(work, 'package.json'), 'utf8'));
    const installed = JSON.parse(await readFile(join(work, 'node_modules/astro/package.json'), 'utf8'));
    assert.equal(installed.version, manifest.devDependencies.astro, 'Installed Astro must match the exact fixture pin.');
    await writeFile(join(artifacts, 'inputs.json'), JSON.stringify({
      node: process.version, astro: installed.version, bases: BASES, production: files,
      fixture: await inventory(join(work, 'src')),
      tooling: JSON.parse(await readFile(join(work, 'package-lock.json'), 'utf8')).packages[''],
    }, null, 2));
    for (const [index, base] of BASES.entries()) {
      const evidence = join(artifacts, index === 0 ? 'root' : 'nested'), site = join(evidence, 'site');
      await mkdir(evidence);
      console.log(`Building actual Astro consumer with base ${base}`);
      await runTool('npm', ['run', 'build'], work, { ...env, BOUNDSTOY_ASTRO_BASE: base }, signal, join(evidence, 'build.log'));
      const output = join(work, 'dist');
      await auditConsumer(output, base, files);
      await mkdir(site);
      await cp(output, join(site, base.slice(1)), { recursive: true });
      await checkBrowser(site, base, files, options, signal, evidence, artifactRoot);
      completed.push(base);
      await rm(output, { recursive: true });
    }
    assert.deepEqual(completed, [...BASES], 'Both static mount scenarios must run.');
    signal.throwIfAborted();
  } catch (error) { failure = signal.aborted ? signal.reason : error; }
  finally {
    if (deadline) clearTimeout(deadline);
    process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt);
    if (artifacts) await writeFile(join(artifacts, 'report.json'), JSON.stringify({
      passed: !failure, completed,
      error: failure instanceof Error ? failure.stack : failure ? String(failure) : null,
    }, null, 2));
  }
  if (failure) {
    console.error(`FAIL: ${failure instanceof Error ? failure.stack : String(failure)}\nEvidence: ${artifacts || 'no resources created'}`);
    process.exitCode = 1;
  } else console.log(`PASS: both real Astro consumers verified. Evidence: ${artifacts}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
