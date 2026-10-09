import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export const BASES = ['/', '/showcase/arcade/'] as const;
export type Inventory = Record<string, string>;

export function validateBase(base: string): string {
  if (base !== '/' && !/^\/(?:[a-zA-Z0-9_-]+\/)+$/.test(base)) {
    throw new Error(`Invalid static base: ${base}`);
  }
  return base;
}

export async function inventory(directory: string): Promise<Inventory> {
  const result: Inventory = {};
  async function visit(prefix: string) {
    for (const entry of (await readdir(join(directory, prefix), { withFileTypes: true }))
      .sort((a, b) => a.name.localeCompare(b.name))) {
      const name = prefix + entry.name;
      if (entry.isDirectory()) await visit(`${name}/`);
      else {
        assert.ok(entry.isFile(), `Only regular static files are supported: ${name}`);
        result[name] = createHash('sha256').update(await readFile(join(directory, name))).digest('hex');
      }
    }
  }
  await visit('');
  return result;
}

export async function stageConsumer(fixture: string, game: string, wrapper: string, work: string) {
  const files = await inventory(game);
  assert.ok(files['index.html'] && files['THIRD_PARTY_NOTICES.txt'], 'Production build and notices are required.');
  for (const name of [
    'package.json', 'package-lock.json', 'astro.config.mjs',
    'src/pages/index.astro', 'src/pages/debug.astro', 'src/layouts/Host.astro',
  ]) {
    await mkdir(dirname(join(work, name)), { recursive: true });
    await cp(join(fixture, name), join(work, name), { errorOnExist: true, force: false });
  }
  await mkdir(join(work, 'src/components'), { recursive: true });
  await cp(wrapper, join(work, 'src/components/Boundstoy.astro'), { errorOnExist: true, force: false });
  await mkdir(join(work, 'public/games'), { recursive: true });
  await cp(game, join(work, 'public/games/boundstoy'), { recursive: true, errorOnExist: true, force: false });
}

function iframeAttributes(html: string): Record<string, string> {
  const tags = html.match(/<iframe\b[^>]*>/g) ?? [];
  assert.equal(tags.length, 1, 'Exactly one compiled wrapper iframe is required.');
  return Object.fromEntries([...tags[0].matchAll(/([-\w]+)(?:="([^"]*)"|='([^']*)'|=([^\s>]+))?/g)]
    .map(([, name, double, single, bare]) => [name, double ?? single ?? bare ?? '']));
}

export async function auditConsumer(output: string, base: string, expected: Inventory) {
  validateBase(base);
  assert.deepEqual(await inventory(join(output, 'games/boundstoy')), expected,
    'Every production asset and notice must be copied byte-for-byte.');
  for (const [file, suffix, title, height] of [
    ['index.html', '', 'Boundstoy - a playground for momentum', '1100px'],
    ['debug/index.html', '?debug', 'Boundstoy Astro verification', '900px'],
  ]) {
    const html = await readFile(join(output, file), 'utf8'), attrs = iframeAttributes(html);
    assert.equal(attrs.src, `${base}games/boundstoy/index.html${suffix}`, `${file}: emitted iframe src`);
    assert.equal(attrs.title, title, `${file}: emitted iframe title`);
    assert.equal(attrs.loading, 'lazy');
    assert.equal(attrs.allow, 'fullscreen');
    assert.ok('allowfullscreen' in attrs);
    assert.ok(attrs.style.includes(`height:${height}`), 'Default and custom iframe height survive compilation.');
    assert.doesNotMatch(html, /<astro-island\b|https?:\/\/|<script\b/, 'The host is static, without hydration or remote runtime assets.');
  }
}
