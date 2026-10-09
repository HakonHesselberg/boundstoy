import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../data/levels.ts';
import { paint, placeSaw, blankLevel } from '../core/editor.ts';
import { importLevel, parseLevel } from '../core/level.ts';

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
test('Paint_Pulse_DefaultBlastIsHalvedButImportedDurationsStayLiteral', () => {
  const first = paint(blankLevel(), { x: 5, y: 13 }, 'pulse');
  assert.deepEqual(first.hazards, [{ kind: 'pulse', x: 5, y: 13, period: 360, on: 45, phase: 0 }]);
  const custom = parseLevel({ ...first, hazards: first.hazards.map(hazard => ({ ...hazard, on: 77 })) });
  assert.deepEqual(importLevel(JSON.stringify(custom)), custom, 'do not silently scale authored JSON');
});
test('Paint_MarkerOnVoid_CreatesSafeFloor', () => {
  const edited = paint(blankLevel(), { x: 1, y: 1 }, 'checkpoint');
  assert.equal(edited.tiles[1][1], '.');
  assert.ok(edited.checkpoints.some(p => p.x === 1 && p.y === 1));
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
