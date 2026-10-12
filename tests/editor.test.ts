import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AFTERSHOCK_LEVELS as LEVELS } from '../data/aftershock.ts';
import { paint, placeSaw, blankLevel } from '../core/editor.ts';
import { importLevel, parseLevel } from '../core/level.ts';
import { RULES } from '../data/terrain.ts';

test('Paint_Ground_ChangesOneTileWithoutMutatingLevel', () => {
  const level = blankLevel();
  const edited = paint(level, { x: 5, y: 13 }, '~');
  assert.equal(edited.tiles[13][5], '~');
  assert.equal(level.tiles[13][5], '.');
});
test('Paint_UnsafeSpawnTile_RejectsEdit', () => {
  const level = blankLevel();
  assert.throws(() => paint(level, level.spawn, ' '), /spawn|safe/i);
});
test('Paint_PulseTwice_ReplacesRatherThanDuplicates', () => {
  const point = { x: 5, y: 13 };
  const first = paint(blankLevel(), point, 'pulse');
  assert.equal(paint(first, point, 'pulse').hazards.length, first.hazards.length);
});
test('Paint_Pulse_DefaultAndLegacyImportsExportOneTickDetonations', () => {
  const first = paint(blankLevel(), { x: 5, y: 13 }, 'pulse');
  assert.deepEqual(first.hazards, [{ kind: 'pulse', x: 5, y: 13, period: 360, on: 1, phase: 0 }]);
  const legacy = { ...first, hazards: first.hazards.map(hazard => ({ ...hazard, on: 77, phase: 173 })) };
  const custom = importLevel(JSON.stringify(legacy));
  assert.deepEqual(custom.hazards, [{ kind: 'pulse', x: 5, y: 13, period: 360, on: 1, phase: 173 }]);
  assert.equal(legacy.hazards[0].on, 77, 'migration does not mutate its input');
  assert.deepEqual(importLevel(JSON.stringify(custom)), custom, 'canonical exports roundtrip');
  for (const on of [0, 301, 1.5, null, undefined]) {
    assert.throws(() => parseLevel({ ...first, hazards: [{ ...first.hazards[0], on }] }), /on/);
  }
});
test('Paint_MarkerOnVoid_CreatesSafeFloor', () => {
  const edited = paint(blankLevel(), { x: 1, y: 1 }, 'checkpoint');
  assert.equal(edited.tiles[1][1], '.');
  assert.ok(edited.checkpoints.some(p => p.x === 1 && p.y === 1));
  assert.equal(edited.checkpoints[0].radius, RULES.checkpointRadius);
  const painted = paint(edited, { x: 5, y: 5 }, '~');
  assert.deepEqual(importLevel(JSON.stringify(painted)).checkpoints, edited.checkpoints,
    'remixing and exporting do not shrink checkpoint zones');
});
test('PlaceSaw_TwoPoints_RoundtripsThroughJSON', () => {
  const level = placeSaw(blankLevel(), { x: 5, y: 5 }, { x: 10, y: 5 });
  assert.deepEqual(importLevel(JSON.stringify(level)), level);
});
test('Level_AllBuiltins_ValidateAndAreFrozen', () => {
  for (const level of LEVELS) {
    assert.deepEqual(parseLevel(level), level);
    assert.ok(Object.isFrozen(level.tiles));
  }
});
test('Import_InvalidAndOversizeJSON_RejectsWithoutFallback', () => {
  assert.throws(() => importLevel('{oops'));
  assert.throws(() => importLevel(' '.repeat(100_001)), /100 KB/);
});

test('Level_V1LimitsAndEditorExport_RemainExplicitAndCompatible', () => {
  const legacy = { ...blankLevel(), tiles: Array.from({ length: 32 }, () => '.'.repeat(40)),
    checkpoints: Array.from({ length: 30 }, (_, x) => ({ x, y: 20 })),
    hazards: Array.from({ length: 80 }, () => ({ kind: 'pulse', x: 1, y: 1, period: 360, on: 77, phase: 0 })) };
  const level = parseLevel(legacy);
  assert.equal(level.version, 1);
  assert.equal(level.resetPatternOnRetry, false);
  assert.deepEqual(importLevel(JSON.stringify(paint(level, { x: 4, y: 4 }, ':'))),
    paint(level, { x: 4, y: 4 }, ':'));
  assert.throws(() => parseLevel({ ...legacy, tiles: [...legacy.tiles, legacy.tiles[0]] }), /tiles|rows/i);
  assert.throws(() => parseLevel({ ...legacy, tiles: legacy.tiles.map(r => `${r}.`) }), /width/i);
  assert.throws(() => parseLevel({ ...legacy, hazards: [...legacy.hazards, legacy.hazards[0]] }), /hazards/i);
  assert.throws(() => parseLevel({ ...legacy, checkpoints: [...legacy.checkpoints, legacy.checkpoints[0]] }), /checkpoints/i);
  const json = JSON.stringify(level);
  assert.deepEqual(importLevel(json + ' '.repeat(100_000 - json.length)), level);
  assert.throws(() => importLevel(json + ' '.repeat(100_001 - json.length)), /100 KB/i);
});
