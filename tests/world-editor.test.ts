import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { paint, placeSaw } from '../core/editor.ts';
import { importLevel } from '../core/level.ts';
import { createState, step, hazardTick } from '../core/simulation.ts';
import { worldSectionIndex } from '../core/world.ts';
import { worldFixture } from './fixtures/world.ts';

test('WorldEditor_OrdinaryGlobalBrushes_PreserveIdentityMetadataAndWhitespace', () => {
  const source = worldFixture({ revision: 73,
    tiles: [' '.repeat(24), ...worldFixture().tiles.slice(1)] });
  let draft = paint(source, { x: 20, y: 4 }, '~');
  draft = paint(draft, { x: 20, y: 5 }, 'pulse');
  draft = placeSaw(draft, { x: 18, y: 6 }, { x: 21, y: 6 });
  assert.deepEqual(importLevel(JSON.stringify(draft)), draft);
  assert.equal(draft.version, 2);
  if (draft.version !== 2) return;
  assert.equal(draft.id, source.id);
  assert.equal(draft.revision, 73);
  assert.deepEqual(draft.sections, source.sections);
  assert.deepEqual(draft.checkpoints, source.checkpoints);
  assert.deepEqual(draft.hazards.slice(0, 2), source.hazards);
  assert.equal(draft.tiles[0], ' '.repeat(24));
  assert.equal(source.tiles[4][20], '.');
  assert.equal(paint(draft, { x: 20, y: 5 }, 'erase').hazards.length, 3);
});

test('WorldEditor_StructuralMarkers_ExplicitlyRequireValidatedJSON', () => {
  const world = worldFixture(), before = JSON.stringify(world);
  for (const brush of ['spawn', 'goal', 'checkpoint'] as const)
    assert.throws(() => paint(world, { x: 20, y: 3 }, brush), /world.*JSON/i);
  assert.throws(() => paint(world, world.checkpoints[0], 'erase'), /world.*JSON/i);
  assert.equal(JSON.stringify(world), before);
});

test('WorldEditor_InvalidGeometryAndMetadata_LeaveOriginalDraftIntact', () => {
  const world = worldFixture(), before = JSON.stringify(world);
  for (const brush of ['#', ' ', '~', 'pulse'] as const)
    assert.throws(() => paint(world, world.sections[1].entry, brush));
  assert.throws(() => placeSaw(world, { x: 9, y: 2 }, { x: 12, y: 2 }));
  for (const invalid of [
    { ...world, revision: 0 }, { ...world, script: 'alert(1)' },
    { ...world, sections: [{ ...world.sections[0], camera: { mode: 'script' } }] },
    { ...world, tiles: Array(129).fill('.'.repeat(24)) },
  ]) assert.throws(() => importLevel(JSON.stringify(invalid)));
  assert.equal(JSON.stringify(world), before);
});

const root = fileURLToPath(new URL('../', import.meta.url));
const inspect = (...args: string[]) => spawnSync(process.execPath, [join(root, 'scripts/inspect.ts'), ...args],
  { cwd: root, encoding: 'utf8', timeout: 15000, maxBuffer: 2_000_000 });

test('Inspect_WorldCommands_ReportProgressAndContinuousClockThroughDeathRecovery', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'bt047-inspect-'));
  try {
    const world = worldFixture();
    const commands = [{ ticks: 167, x: 1, y: 0 }, { ticks: 67, x: -1, y: 0 },
      { ticks: 100, x: 0, y: 1 }, { ticks: 9, x: 0, y: 0 },
      { ticks: 17, x: 0, y: 0 }, { ticks: 37, x: 0, y: 0 }];
    const worldPath = join(directory, 'world.json'), commandPath = join(directory, 'commands.json');
    await writeFile(worldPath, JSON.stringify(world));
    await writeFile(commandPath, JSON.stringify(commands));
    const result = inspect('--world', worldPath, '--commands', commandPath, '--json');
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.deepEqual(output.identity, { version: 2, id: world.id, revision: world.revision });
    let state = createState(world);
    assert.equal(output.trace.length, commands.length + 1);
    for (const [i, command] of commands.entries()) {
      for (let tick = 0; tick < command.ticks; tick++) state = step(world, state, command);
      const actual = output.trace[i + 1];
      assert.equal(actual.tick, state.tick);
      assert.equal(actual.hazardTick, hazardTick(state));
      assert.equal(actual.patternOffset, 0);
      assert.equal(actual.deaths, state.deaths);
      assert.equal(actual.respawnTicks, state.respawnTicks);
      assert.deepEqual(actual.position, state.position);
      assert.deepEqual(actual.checkpoints, state.visited);
      assert.deepEqual(actual.section, { index: worldSectionIndex(world, state.visited),
        id: world.sections[worldSectionIndex(world, state.visited)].id,
        name: world.sections[worldSectionIndex(world, state.visited)].name });
    }
    assert.equal(output.trace[4].respawnTicks, 54);
    assert.equal(output.trace[5].respawnTicks, 37);
    assert.equal(output.trace[6].respawnTicks, 0);
    assert.equal(state.deaths, 1);
    assert.deepEqual(state.position, { x: 6.5, y: 2.5 });
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('Inspect_Inputs_AreBoundedJSONNotScriptsOrStateSetters', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'bt047-inspect-'));
  try {
    const worldPath = join(directory, 'world.json'), commandPath = join(directory, 'commands.json');
    await writeFile(worldPath, JSON.stringify(worldFixture()));
    for (const commands of [[{ ticks: 100001, x: 0, y: 0 }], [{ ticks: 1, x: 2, y: 0 }],
      [{ ticks: 1, x: 0, y: 0, checkpoint: 2 }], Array(1001).fill({ ticks: 0, x: 0, y: 0 }),
      [{ ticks: 60000, x: 0, y: 0 }, { ticks: 60000, x: 0, y: 0 }]]) {
      await writeFile(commandPath, JSON.stringify(commands));
      const result = inspect('--world', worldPath, '--commands', commandPath, '--json');
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /command|ticks|input/i);
    }
    await writeFile(commandPath, 'export default []');
    assert.notEqual(inspect('--world', worldPath, '--commands', commandPath).status, 0);
    await writeFile(worldPath, ' '.repeat(1_000_001));
    const oversized = inspect('--world', worldPath);
    assert.notEqual(oversized.status, 0);
    assert.match(oversized.stderr, /byte|large|limit/i);
    assert.notEqual(inspect('0', '--checkpoint', '2').status, 0);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('Inspect_LegacyReplay_RemainsAvailable', () => {
  const result = inspect('0', '--replay');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /"won": true/);
});

test('Inspect_NamedPipe_RejectsWithoutWaitingForAWriter', { skip: process.platform === 'win32' }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'bt047-inspect-'));
  try {
    const path = join(directory, 'world.json');
    const pipe = spawnSync('mkfifo', [path], { encoding: 'utf8' });
    assert.equal(pipe.status, 0, pipe.error?.message ?? pipe.stderr);
    const result = inspect('--world', path);
    assert.notEqual(result.status, null, 'Non-regular input must reject, not time out opening a FIFO.');
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /regular file/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
