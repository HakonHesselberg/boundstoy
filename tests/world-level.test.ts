import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importLevel, parseLevel, type Level } from '../core/level.ts';

// Two independently placed sections joined by two ordinary global floor cells.
function fixture() {
  return {
    version: 2, id: 'joined-fixture', revision: 1, name: 'Joined fixture',
    description: 'Contract evidence, not a campaign.', resetPatternOnRetry: false,
    tiles: ['################', '################', '#..............#',
      '#......##......#', '################', '################'],
    spawn: { x: 1, y: 2 }, goal: { x: 14, y: 2 },
    checkpoints: [{ id: 'landing-one', x: 6, y: 2, radius: 1.4 }],
    hazards: [{ kind: 'pulse', x: 4, y: 3, period: 360, on: 1, phase: 60 }],
    sections: [
      { id: 'first', name: 'First', bounds: { x: 1, y: 2, width: 6, height: 2 },
        entry: { x: 1, y: 2 }, observation: { x: 1, y: 2, width: 1, height: 2 },
        completion: { kind: 'checkpoint', checkpointId: 'landing-one' },
        camera: { mode: 'fixed', frame: { x: 0, y: 0, width: 9, height: 6 } } },
      { id: 'second', name: 'Second', bounds: { x: 9, y: 2, width: 6, height: 2 },
        entry: { x: 9, y: 2 }, observation: { x: 9, y: 2, width: 1, height: 2 },
        completion: { kind: 'goal' },
        camera: { mode: 'follow', frame: { x: 7, y: 0, width: 9, height: 6 } } },
    ],
  };
}

function frozen(value: unknown) {
  if (value && typeof value === 'object') {
    assert.ok(Object.isFrozen(value));
    for (const child of Object.values(value)) frozen(child);
  }
}

test('World_JoinedSections_FrozenGlobalCoordinatesAndIdentityRoundtrip', () => {
  const raw = fixture(), world = parseLevel(raw);
  assert.equal(world.version, 2);
  if (world.version !== 2) throw new Error('Expected world');
  assert.equal(world.revision, 1);
  assert.equal(world.sections[1].entry.x, 9);
  assert.equal(world.checkpoints[0].id, 'landing-one');
  assert.deepEqual(importLevel(JSON.stringify(world)), world);
  frozen(world);
  raw.sections[1].entry.x = 10;
  assert.equal(world.sections[1].entry.x, 9);
  // Compile-time discriminant evidence; no assertions/casts on Level consumers.
  const identity = (level: Level) => level.version === 2 ? level.revision : level.version;
  assert.equal(identity(world), 1);
});

test('World_MalformedMetadataAndReferences_RejectExplicitly', () => {
  const cases: [string, (raw: ReturnType<typeof fixture>) => void, RegExp][] = [
    ['duplicate section', r => { r.sections[1].id = 'first'; }, /duplicate.*section/i],
    ['duplicate checkpoint', r => { r.checkpoints.push({ ...r.checkpoints[0] }); }, /duplicate.*checkpoint/i],
    ['reference', r => { r.sections[0].completion.checkpointId = 'absent'; }, /checkpoint.*reference/i],
    ['early goal', r => { r.sections[0].completion = { kind: 'goal' }; }, /completion/i],
    ['last checkpoint', r => { r.sections[1].completion = r.sections[0].completion; }, /completion/i],
    ['unused checkpoint', r => { r.checkpoints.push({ id: 'unused', x: 10, y: 3, radius: 1 }); }, /checkpoint/i],
    ['overlap', r => { r.sections[1].bounds.x = 6; }, /overlap/i],
    ['bounds', r => { r.sections[0].bounds.width = 0; }, /width/i],
    ['outside bounds', r => { r.sections[1].bounds.width = 8; }, /bounds/i],
    ['observation outside', r => { r.sections[0].observation.x = 0; }, /observation/i],
    ['unsafe observation', r => { r.tiles[2] = '################'; }, /safe|observation/i],
    ['hazard observation', r => { r.hazards[0].x = 1; }, /observation/i],
    ['entry outside observation', r => { r.sections[0].entry.x = 3; }, /entry/i],
    ['camera outside', r => { r.sections[0].camera.frame.width = 17; }, /camera/i],
    ['camera mode', r => { r.sections[0].camera.mode = 'script'; }, /camera/i],
    ['revision', r => { r.revision = 0; }, /revision/i],
    ['retry clock', r => { r.resetPatternOnRetry = true; }, /resetPatternOnRetry/i],
    ['pulse duration', r => { r.hazards[0].on = 2; }, /on/i],
    ['stacked pulses', r => { r.hazards.push({ ...r.hazards[0], phase: 61 }); }, /duplicate.*pulse/i],
  ];
  for (const [label, mutate, error] of cases) {
    const raw = fixture(); mutate(raw);
    assert.throws(() => parseLevel(raw), error, label);
  }
  for (const value of [null, [], {}, { ...fixture(), sections: [] },
    { ...fixture(), surprise: true },
    { ...fixture(), sections: [{ ...fixture().sections[0], camera: null }] }]) {
    assert.throws(() => parseLevel(value));
  }
});

test('World_SectionAndConnectorRoutes_RejectDisconnectedTerrain', () => {
  const section = fixture();
  section.tiles[2] = '#..#...........#';
  section.tiles[3] = '#..#...##......#';
  assert.throws(() => parseLevel(section), /section.*route/i);
  const connector = fixture();
  connector.tiles[2] = '#......#.......#';
  assert.throws(() => parseLevel(connector), /connector.*route/i);
});

test('World_TranslatedSections_PreserveEveryGlobalCoordinate', () => {
  const raw = fixture();
  raw.tiles = ['#'.repeat(18), ...raw.tiles.map(row => `#${row}#`)];
  const shift = (p: { x: number; y: number }) => { p.x++; p.y++; };
  shift(raw.spawn); shift(raw.goal);
  raw.checkpoints.forEach(shift); raw.hazards.forEach(shift);
  raw.sections.forEach(s => {
    shift(s.entry); shift(s.bounds); shift(s.observation); shift(s.camera.frame);
  });
  assert.deepEqual(importLevel(JSON.stringify(parseLevel(raw))), parseLevel(raw));
});

test('World_DefensiveDimensionAndHazardLimits_AcceptBoundaryRejectBeyond', () => {
  const raw = fixture();
  raw.tiles = Array.from({ length: 128 }, () => '.'.repeat(160));
  raw.hazards = Array.from({ length: 640 }, (_, i) => ({
    kind: 'pulse', x: i % 160, y: 10 + Math.floor(i / 160), period: 360, on: 1, phase: 0,
  }));
  assert.equal(parseLevel(raw).hazards.length, 640);
  assert.throws(() => parseLevel({ ...raw, tiles: [...raw.tiles, raw.tiles[0]] }), /tiles|rows/i);
  assert.throws(() => parseLevel({ ...raw, tiles: raw.tiles.map(r => `${r}.`) }), /width|cells/i);
  assert.throws(() => parseLevel({ ...raw, hazards: [...raw.hazards, raw.hazards[0]] }), /hazards/i);
  assert.throws(() => parseLevel({ ...fixture(), tiles: ['.......'] }), /tiles|rows|width/i);
});

test('World_LongThinWorlds_AllowWidthUpTo320WithinTheSameCellBudget', () => {
  const raw = fixture();
  assert.equal(parseLevel({ ...raw, tiles: Array.from({ length: 64 }, () => '.'.repeat(320)) }).tiles[0].length, 320);
  assert.throws(() => parseLevel({ ...raw, tiles: Array.from({ length: 6 }, () => '.'.repeat(321)) }), /width/i);
  assert.throws(() => parseLevel({ ...raw, tiles: Array.from({ length: 65 }, () => '.'.repeat(320)) }), /cells/i);
});

test('World_ImportLimit_IsOneMillionUTF8BytesNotCharacters', () => {
  const raw = fixture(); raw.description = 'é';
  const json = JSON.stringify(raw);
  const bytes = new TextEncoder().encode(json).length;
  assert.equal(importLevel(json + ' '.repeat(1_000_000 - bytes)).version, 2);
  assert.throws(() => importLevel(json + ' '.repeat(1_000_001 - bytes)), /1 MB/i);
});

test('World_NestedMalformedDataAndSparseArrays_RejectWithoutCoercion', () => {
  const raw = fixture(), section = raw.sections[0];
  const invalid: unknown[] = [
    { ...raw, revision: NaN }, { ...raw, revision: Infinity }, { ...raw, revision: 1.5 },
    { ...raw, id: 'Invalid ID' }, { ...raw, version: 3 },
    { ...raw, sections: Array(2) }, { ...raw, hazards: Array(1) },
    { ...raw, checkpoints: [{ ...raw.checkpoints[0], radius: undefined }] },
    { ...raw, checkpoints: [{ ...raw.checkpoints[0], radius: Infinity }] },
    { ...raw, checkpoints: [{ ...raw.checkpoints[0], id: 'BAD' }] },
    { ...raw, spawn: { ...raw.spawn, z: 0 } },
    { ...raw, hazards: [{ ...raw.hazards[0], script: 'ignored?' }] },
    { ...raw, hazards: [{ kind: 'saw', from: raw.spawn, to: raw.goal, period: 119, phase: 0 }] },
    ...[
      { ...section, name: '' }, { ...section, id: 'BAD' },
      { ...section, entry: { x: 1.5, y: 2 } },
      { ...section, observation: { ...section.observation, width: -1 } },
      { ...section, bounds: { ...section.bounds, x: NaN } },
      { ...section, bounds: { ...section.bounds, depth: 3 } },
      { ...section, completion: { kind: 'checkpoint', checkpointId: 'landing-one', next: 'second' } },
      { ...section, camera: { mode: 'fixed', frame: section.bounds, speed: 1 } },
      { ...section, camera: { mode: 'fixed', frame: section.observation } },
    ].map(s => ({ ...raw, sections: [s, raw.sections[1]] })),
  ];
  for (const value of invalid) assert.throws(() => parseLevel(value));
});

test('World_Saws_FreezeEndpointsAndRejectUnsafeObservationOrDuplicatePaths', () => {
  const raw = fixture();
  const saw = { kind: 'saw', from: { x: 3, y: 3 }, to: { x: 4, y: 3 }, period: 120, phase: 119 };
  const world = parseLevel({ ...raw, hazards: [saw] });
  frozen(world);
  assert.deepEqual(importLevel(JSON.stringify(world)), world);
  assert.throws(() => parseLevel({ ...raw, hazards: [saw, saw] }), /duplicate.*saw/i);
  assert.throws(() => parseLevel({ ...raw, hazards: [{ ...saw, from: raw.spawn }] }), /observation/i);
  assert.throws(() => parseLevel({ ...raw, hazards: [{ ...saw, to: { x: 6, y: 2 } }] }), /checkpoint.*observation/i);
  assert.throws(() => parseLevel({ ...raw, hazards: [{ ...saw, phase: 120 }] }), /phase/i);
});

test('World_SectionBudget_IsGenericFromOneThrough64With63Checkpoints', () => {
  const raw = fixture();
  const sections = Array.from({ length: 64 }, (_, i) => ({
    id: `section-${i}`, name: `Section ${i}`, bounds: { x: 0, y: i * 2, width: 8, height: 2 },
    entry: { x: 1, y: i * 2 }, observation: { x: 1, y: i * 2, width: 1, height: 1 },
    completion: i === 63 ? { kind: 'goal' } : { kind: 'checkpoint', checkpointId: `checkpoint-${i}` },
    camera: { mode: 'fixed', frame: { x: 0, y: i * 2, width: 8, height: 2 } },
  }));
  const checkpoints = Array.from({ length: 63 }, (_, i) => ({
    id: `checkpoint-${i}`, x: 1, y: i * 2 + 1, radius: 0.1,
  }));
  const maximum = { ...raw, tiles: Array.from({ length: 128 }, () => '.'.repeat(8)),
    spawn: sections[0].entry, goal: { x: 1, y: 127 }, hazards: [], sections, checkpoints };
  const world = parseLevel(maximum);
  if (world.version !== 2) throw new Error('Expected world');
  assert.equal(world.sections.length, 64);
  assert.equal(world.checkpoints.length, 63);
  assert.throws(() => parseLevel({ ...maximum, sections: [...sections, sections[0]] }), /sections/i);
  assert.throws(() => parseLevel({ ...maximum, checkpoints: [...checkpoints, checkpoints[0]] }), /checkpoints/i);
  const one = { ...raw, tiles: Array.from({ length: 6 }, () => '.'.repeat(8)),
    spawn: { x: 1, y: 1 }, goal: { x: 6, y: 4 }, hazards: [], checkpoints: [],
    sections: [{ id: 'single', name: 'Single', bounds: { x: 0, y: 0, width: 8, height: 6 },
      entry: { x: 1, y: 1 }, observation: { x: 1, y: 1, width: 1, height: 1 },
      completion: { kind: 'goal' }, camera: { mode: 'fixed', frame: { x: 0, y: 0, width: 8, height: 6 } } }] };
  assert.equal(parseLevel(one).version, 2);
  assert.throws(() => parseLevel({ ...one, tiles: one.tiles.slice(1) }), /rows/i);
  assert.throws(() => parseLevel({ ...one, tiles: one.tiles.map(row => row.slice(1)) }), /width/i);
  assert.throws(() => parseLevel({ ...maximum, checkpoints: [...checkpoints].reverse() }), /order/i);
});

test('World_CompletionOwnershipAndSafeLandings_RejectAmbiguousProgression', () => {
  const raw = fixture();
  assert.throws(() => parseLevel({ ...raw, checkpoints: [{ ...raw.checkpoints[0], x: 10 }] }), /completion.*bounds/i);
  assert.throws(() => parseLevel({ ...raw, checkpoints: [{ ...raw.checkpoints[0], ...raw.spawn }] }), /overlap/i);
  assert.throws(() => parseLevel({ ...raw, goal: { x: 5, y: 2 } }), /completion.*bounds/i);
  assert.throws(() => parseLevel({ ...raw, spawn: { x: 2, y: 2 } }), /entry.*spawn/i);
  const duplicatePosition = [...raw.checkpoints, { ...raw.checkpoints[0], id: 'different' }];
  assert.throws(() => parseLevel({ ...raw, checkpoints: duplicatePosition }), /duplicate.*checkpoint/i);
  raw.tiles[2] = '#~.............#';
  assert.throws(() => parseLevel(raw), /stoppable observation/i);
});
