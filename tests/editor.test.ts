import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../data/levels.ts';
import { paint, placeSaw, blankLevel } from '../core/editor.ts';
import { importLevel, parseLevel } from '../core/level.ts';

test('Paint_Ground_ChangesOneTileWithoutMutatingLevel', () => {
  const level = LEVELS[0];
  const edited = paint(level, { x: 5, y: 13 }, '~');
  assert.equal(edited.tiles[13][5], '~');
  assert.equal(level.tiles[13][5], '.');
});
test('Paint_UnsafeSpawnTile_RejectsEdit', () => {
  assert.throws(() => paint(LEVELS[0], LEVELS[0].spawn, ' '), /spawn|safe/i);
});
test('Paint_PulseTwice_ReplacesRatherThanDuplicates', () => {
  const point = { x: 5, y: 13 };
  const first = paint(LEVELS[0], point, 'pulse');
  assert.equal(paint(first, point, 'pulse').hazards.length, first.hazards.length);
});
test('Paint_MarkerOnVoid_CreatesSafeFloor', () => {
  const edited = paint(LEVELS[0], { x: 1, y: 1 }, 'checkpoint');
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
