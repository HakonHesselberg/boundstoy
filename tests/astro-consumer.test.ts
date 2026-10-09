import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditConsumer, inventory, stageConsumer, validateBase } from './astro-consumer/fixture.ts';
import { permittedRequest } from './astro-consumer/browser.ts';
import { runTool } from '../scripts/check-astro.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const fixture = join(root, 'tests/astro-consumer');

test('AstroFixture_BasePaths_AreExplicitLocalMounts', () => {
  for (const base of ['/', '/showcase/arcade/']) assert.equal(validateBase(base), base);
  for (const base of ['', 'relative/', '//remote/', '/a/../', '/a//', '/a?debug/', '/a%2f/', '/a\\b/']) {
    assert.throws(() => validateBase(base), /base/i);
  }
});

test('AstroBrowser_RequestBoundary_RejectsRemoteAndRootEscapes', () => {
  const origin = 'http://127.0.0.1:4338', base = '/showcase/arcade/';
  assert.equal(permittedRequest(`${origin}${base}games/boundstoy/assets/game.js`, origin, base), true);
  for (const url of [
    `${origin}/games/boundstoy/index.html`, `${origin}${base}../game.js`,
    'http://127.0.0.1:4339/showcase/arcade/game.js', 'https://example.invalid/showcase/arcade/game.js',
    'ws://127.0.0.1:4338/showcase/arcade/socket',
  ]) assert.equal(permittedRequest(url, origin, base), false, url);
});

test('AstroFixture_ManifestAndLock_PinOnlyIsolatedBuildTooling', async () => {
  const manifest = JSON.parse(await readFile(join(fixture, 'package.json'), 'utf8'));
  const lock = JSON.parse(await readFile(join(fixture, 'package-lock.json'), 'utf8'));
  assert.equal(manifest.private, true);
  assert.deepEqual(manifest.dependencies ?? {}, {});
  assert.deepEqual(manifest.devDependencies, { astro: '7.3.8' });
  assert.deepEqual(lock.packages[''].devDependencies, manifest.devDependencies);
  assert.equal(lock.packages['node_modules/astro'].version, '7.3.8');
  for (const [name, pkg] of Object.entries(lock.packages) as [string, Record<string, unknown>][]) {
    if (name) {
      assert.match(String(pkg.integrity), /^sha512-/, name);
      assert.match(String(pkg.resolved), /^https:\/\/registry\.npmjs\.org\//, name);
      assert.equal(pkg.link, undefined, `${name}: no mutable linked install`);
    }
  }
  const game = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  assert.equal(game.dependencies.astro, undefined);
  assert.equal(game.devDependencies.astro, undefined);
});

test('AstroFixture_Staging_CopiesRealWrapperAndEveryProductionByte', async t => {
  const directory = join(fixture, 'artifacts', `native-${randomUUID()}`);
  t.after(() => rm(directory, { recursive: true, force: true }));
  const game = join(directory, 'game'), work = join(directory, 'consumer');
  await mkdir(join(game, 'assets'), { recursive: true });
  for (const [name, body] of [
    ['index.html', '<script src="./assets/game.js"></script>'],
    ['assets/game.js', 'console.log("fixture")'],
    ['LICENSE', 'game notice'], ['THIRD_PARTY_NOTICES.txt', 'renderer notice'],
  ]) await writeFile(join(game, name), body);
  await stageConsumer(fixture, game, join(root, 'astro/Boundstoy.astro'), work);
  assert.deepEqual(await inventory(join(work, 'public/games/boundstoy')), await inventory(game));
  assert.equal(await readFile(join(work, 'src/components/Boundstoy.astro'), 'utf8'),
    await readFile(join(root, 'astro/Boundstoy.astro'), 'utf8'));
  assert.match(await readFile(join(work, 'src/pages/index.astro'), 'utf8'), /<Boundstoy\s*\/>/);
  await assert.rejects(readFile(join(work, 'node_modules/astro/package.json')), { code: 'ENOENT' });
});

test('AstroFixture_OutputAudit_RejectsMissingNoticesTamperingAndEscapedBase', async t => {
  const directory = join(fixture, 'artifacts', `audit-${randomUUID()}`);
  t.after(() => rm(directory, { recursive: true, force: true }));
  const base = '/showcase/arcade/', game = join(directory, 'games/boundstoy');
  await mkdir(join(game, 'assets'), { recursive: true });
  await mkdir(join(directory, 'debug'), { recursive: true });
  const original = {
    'index.html': '<script src="./assets/game.js"></script>',
    'assets/game.js': 'original game', LICENSE: 'game license', 'THIRD_PARTY_NOTICES.txt': 'renderer license',
  };
  for (const [name, body] of Object.entries(original)) await writeFile(join(game, name), body);
  const expected = await inventory(game);
  const html = (src: string, title: string, height: string) =>
    `<iframe src="${src}" title="${title}" style="width:100%;height:${height};border:0" loading="lazy" allow="fullscreen" allowfullscreen></iframe>`;
  const defaultHTML = html(`${base}games/boundstoy/index.html`, 'Boundstoy - a playground for momentum', '1100px');
  await writeFile(join(directory, 'index.html'), defaultHTML);
  await writeFile(join(directory, 'debug/index.html'),
    html(`${base}games/boundstoy/index.html?debug`, 'Boundstoy Astro verification', '900px'));
  await auditConsumer(directory, base, expected);
  await writeFile(join(directory, 'index.html'), defaultHTML.replace(`${base}games/`, '/games/'));
  await assert.rejects(auditConsumer(directory, base, expected), /iframe.*src/i);
  await writeFile(join(directory, 'index.html'), defaultHTML.replace('Boundstoy - a playground for momentum', 'Wrong title'));
  await assert.rejects(auditConsumer(directory, base, expected), /iframe.*title/i);
  await writeFile(join(directory, 'index.html'), `${defaultHTML}<script src="https://example.invalid/telemetry.js"></script>`);
  await assert.rejects(auditConsumer(directory, base, expected), /static.*hydration/i);
  await writeFile(join(directory, 'index.html'), defaultHTML);
  await writeFile(join(game, 'assets/game.js'), 'altered game');
  await assert.rejects(auditConsumer(directory, base, expected), /production.*cop/i);
  await writeFile(join(game, 'assets/game.js'), original['assets/game.js']);
  await rm(join(game, 'LICENSE'));
  await assert.rejects(auditConsumer(directory, base, expected), /production.*cop/i);
  assert.equal(expected['assets/game.js'], createHash('sha256').update(original['assets/game.js']).digest('hex'));
});

test('AstroCli_WithoutImportMetaMain_ExecutesAndRejectsMissingBrowserWithoutAstro', async t => {
  const directory = join(fixture, 'artifacts', `entry-${randomUUID()}`);
  await mkdir(directory, { recursive: true });
  t.after(() => rm(directory, { recursive: true, force: true }));
  const entry = new URL('../scripts/check-astro.ts', import.meta.url);
  const source = (await readFile(entry, 'utf8')).replace(/from '(\.\.?\/[^']+)'/g,
    (_match, specifier: string) => `from '${new URL(specifier, entry).href}'`);
  const copy = join(directory, 'entry.ts');
  await writeFile(copy, `Reflect.deleteProperty(import.meta, 'main');\n${source}`);
  const result = spawnSync(process.execPath, [copy, '--browser', '/missing-bt004-chromium'], {
    encoding: 'utf8', timeout: 10_000,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, /Chromium is missing or not executable/);
  assert.doesNotMatch(result.stdout, /npm ci|Owned Chromium|Evidence:/);
});

test('AstroCli_UnsafeOptions_FailBeforeInstallOrBrowserStartup', () => {
  const result = spawnSync(process.execPath, [join(root, 'scripts/check-astro.ts'), '--no-sandbox'], {
    encoding: 'utf8', timeout: 10_000,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unknown or duplicate argument/);
  assert.doesNotMatch(result.stdout, /Evidence:|Installing|Owned Chromium/);
});

test('AstroTool_Deadline_ReapsOwnedBuildProcessAndRetainsFailureLog', {
  skip: process.platform === 'win32' ? 'POSIX process groups are unavailable on Windows' : false,
}, async t => {
  const directory = join(fixture, 'artifacts', `tool-${randomUUID()}`);
  await mkdir(directory, { recursive: true });
  t.after(() => rm(directory, { recursive: true, force: true }));
  const log = join(directory, 'command.log');
  await assert.rejects(runTool(process.execPath, ['-e',
    'console.log(process.pid); setTimeout(() => {}, 5000);'],
  directory, process.env, AbortSignal.timeout(500), log), /aborted|timeout/i);
  const pid = Number((await readFile(log, 'utf8')).trim());
  assert.ok(Number.isInteger(pid) && pid > 0, 'Owned command reached startup.');
  assert.throws(() => process.kill(-pid, 0), { code: 'ESRCH' }, 'No build/install descendant survived the deadline.');
});
