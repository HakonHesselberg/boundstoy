import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Mesh, ConeGeometry } from 'three';
import { createSpikes, createPulse, updatePulse, WALL_HEIGHT } from '../presentation/hazard-visuals.ts';
import { RULES } from '../data/terrain.ts';
import { LEVELS } from '../data/levels.ts';
import { hazardSample } from '../core/simulation.ts';

const pulse = { kind: 'pulse' as const, x: 3, y: 3, period: 360, on: 90, phase: 0 };

test('Pulse_GroundParity_RemainsVisibleInSafeAndWarningStatesWithoutChangingTheBlast', () => {
  const light = createPulse(), dark = createPulse(), other = { ...pulse, x: 4 };
  for (const tick of [90, 340, 1]) {
    updatePulse(light, pulse, tick, false);
    updatePulse(dark, other, tick, false);
    assert.notEqual(light.plate.material.color.getHex(), dark.plate.material.color.getHex(),
      `tile groups remain distinct at tick ${tick}, including harmless aftermath`);
    assert.equal(light.warning.visible, dark.warning.visible);
  }
  updatePulse(light, pulse, 0, false);
  updatePulse(dark, other, 0, false);
  assert.equal(light.plate.material.color.getHex(), dark.plate.material.color.getHex(), 'same unmistakable detonation');
  assert.equal(light.plate.geometry.parameters.width, RULES.pulseRadius * 2, 'hazard footprint does not change');
});

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

test('Pulse_DetonationAndHarmlessAftermath_AreDistinctFromTheWarning', () => {
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
  const hotPlate = view.plate.material.color.getHex();
  updatePulse(view, pulse, 1, false);
  assert.equal(hazardSample(pulse, 1).active, false);
  assert.equal(view.burst.visible, true, 'the tile is safe even while the explosion dissipates');
  assert.notEqual(view.plate.material.color.getHex(), hotPlate, 'ground danger ends immediately');
  updatePulse(view, pulse, 35, false);
  assert.equal(view.burst.visible, true);
  updatePulse(view, pulse, 36, false);
  assert.equal(view.burst.visible, false, 'aftermath lasts 300 ms, not the old authored on duration');
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
  assert.ok(view.wave.material.opacity > 0);
});

test('Pulse_SkippedIgnitionFrame_StillRendersAFadingNonLoopingExplosion', () => {
  const view = createPulse();
  let previousOpacity = 1, previousRadius = 0;
  const resources = view.group.children.length;
  for (let tick = 4; tick < 36; tick += 4) {
    updatePulse(view, pulse, tick, false);
    assert.equal(view.burst.visible, true);
    assert.equal(hazardSample(pulse, tick).active, false);
    assert.ok(view.wave.material.opacity < previousOpacity);
    assert.ok(view.wave.scale.x > previousRadius);
    previousOpacity = view.wave.material.opacity;
    previousRadius = view.wave.scale.x;
    assert.equal(view.group.children.length, resources);
  }
  updatePulse(view, pulse, 36, false);
  assert.equal(view.burst.visible, false);
  updatePulse(view, pulse, 364, false);
  const repeated = view.sparks.children.map(spark => spark.position.clone());
  updatePulse(view, pulse, 4, false);
  assert.deepEqual(view.sparks.children.map(spark => spark.position), repeated);
});

test('AftershockPulses_AllAuthoredFields_MatchExactWarningAndLethalBoundaries', () => {
  const pulses = LEVELS.flatMap(level => level.hazards.filter(hazard => hazard.kind === 'pulse'));
  assert.ok(pulses.length > 0);
  for (const hazard of pulses) {
    const ignition = 2 * hazard.period + (hazard.period - hazard.phase) % hazard.period;
    const view = createPulse();
    for (const reducedMotion of [false, true]) for (const [offset, warning, active, aftermath] of [
      [-RULES.pulseWarningTicks - 1, false, false, false], [-RULES.pulseWarningTicks, true, false, false],
      [-1, true, false, false], [0, false, true, true], [1, false, false, true],
      [35, false, false, true], [36, false, false, false],
    ] as const) {
      const tick = ignition + offset, sample = hazardSample(hazard, tick);
      assert.equal(sample.warning, warning, 'test actual boundaries, not just agreement between two wrong phases');
      assert.equal(sample.active, active);
      updatePulse(view, hazard, tick, reducedMotion);
      assert.equal(view.warning.visible, warning, `${hazard.x},${hazard.y}@${tick}`);
      assert.equal(view.burst.visible, aftermath, `${hazard.x},${hazard.y}@${tick}`);
      assert.equal(view.plate.geometry.parameters.width, 2 * RULES.pulseRadius);
      assert.equal(view.plate.geometry.parameters.depth, 2 * RULES.pulseRadius);
    }
  }
});
