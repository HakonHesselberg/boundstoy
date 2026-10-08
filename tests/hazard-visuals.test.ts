import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Mesh, ConeGeometry } from 'three';
import { createSpikes, createPulse, updatePulse, WALL_HEIGHT } from '../presentation/hazard-visuals.ts';
import { RULES } from '../data/terrain.ts';

const pulse = { kind: 'pulse' as const, x: 3, y: 3, period: 360, on: 90, phase: 0 };

test('Spikes_Tile_HasTallPointedMetalTeethNotFlatDiamonds', () => {
  const spikes = createSpikes();
  const teeth: Mesh<ConeGeometry>[] = [];
  spikes.traverse(object => {
    if (object instanceof Mesh && object.geometry instanceof ConeGeometry) teeth.push(object);
  });
  assert.equal(teeth.length, 5);
  for (const tooth of teeth) {
    assert.ok(tooth.geometry.parameters.height >= 0.65);
    assert.ok(tooth.geometry.parameters.height > tooth.geometry.parameters.radius * 3);
  }
  assert.ok(WALL_HEIGHT < 0.3, 'barriers should be low curbs');
});

test('Pulse_SafeWarningAndBlast_AreDistinctAndMatchCollisionWindow', () => {
  const view = createPulse();
  updatePulse(view, pulse, 200, false);
  assert.equal(view.burst.visible, false);
  assert.equal(view.warning.visible, false);
  updatePulse(view, pulse, 340, false);
  assert.equal(view.burst.visible, false);
  assert.equal(view.warning.visible, true);
  updatePulse(view, pulse, 0, false);
  assert.equal(view.burst.visible, true);
  assert.equal(view.warning.visible, false);
  assert.ok(view.core.scale.y > 1, 'detonation has a rising fireball silhouette');
  updatePulse(view, pulse, 89, false);
  assert.equal(view.burst.visible, true, 'danger stays visible through the entire lethal interval');
  updatePulse(view, pulse, 90, false);
  assert.equal(view.burst.visible, false, 'no lingering blast on safe ground');
  assert.equal(view.plate.geometry.parameters.width, RULES.pulseRadius * 2);
});

test('Pulse_PausedOrReducedMotion_KeepsDeterministicLegibleDanger', () => {
  const view = createPulse();
  updatePulse(view, pulse, 10, false);
  const before = view.sparks.children.map(spark => spark.position.clone());
  updatePulse(view, pulse, 10, false);
  assert.deepEqual(view.sparks.children.map(spark => spark.position), before);
  updatePulse(view, pulse, 10, true);
  assert.equal(view.burst.visible, true);
  assert.equal(view.sparks.visible, false);
  assert.ok(view.core.visible);
});
