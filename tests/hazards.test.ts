import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../data/levels.ts';
import { RULES } from '../data/terrain.ts';
import { hazardSample } from '../core/simulation.ts';
import { createPulse, updatePulse } from '../presentation/hazard-visuals.ts';

test('RelayFinale_BothTravellingPhrasesAndRiser_VisualsMatchEveryExactWarningAndLethalBoundary', () => {
  const level = LEVELS.find(level => level.id === 'relay-crescendo-v1');
  assert.ok(level, 'the finale supplies moving waves and a timed mud riser');
  const pulses = level.hazards.filter(hazard => hazard.kind === 'pulse');
  assert.equal(pulses.length, 20, 'nine first-phrase vents, ten answering vents and the riser');
  for (const hazard of pulses) {
    const ignition = 2 * hazard.period + (hazard.period - hazard.phase) % hazard.period;
    assert.equal(hazardSample(hazard, ignition - 1).active, false);
    assert.equal(hazardSample(hazard, ignition).active, true);
    const view = createPulse();
    for (const reducedMotion of [false, true]) for (const tick of [
      ignition - RULES.pulseWarningTicks - 1, ignition - RULES.pulseWarningTicks,
      ignition - 1, ignition, ignition + hazard.on - 1, ignition + hazard.on,
    ]) {
      const sample = hazardSample(hazard, tick);
      updatePulse(view, hazard, tick, reducedMotion);
      assert.equal(view.warning.visible, sample.warning, `${hazard.x},${hazard.y}@${tick}: warning`);
      assert.equal(view.burst.visible, sample.active, `${hazard.x},${hazard.y}@${tick}: lethal`);
      assert.equal(view.plate.geometry.parameters.width, 2 * RULES.pulseRadius);
      assert.equal(view.plate.geometry.parameters.depth, 2 * RULES.pulseRadius);
    }
  }
});
