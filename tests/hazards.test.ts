import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AFTERSHOCK_LEVELS as LEVELS } from '../data/aftershock.ts';
import { RULES } from '../data/terrain.ts';
import { hazardSample } from '../core/simulation.ts';
import { createPulse, updatePulse } from '../presentation/hazard-visuals.ts';

test('Aftershock_AllFields_VisualsMatchEveryExactWarningAndLethalBoundary', () => {
  const pulses = LEVELS.flatMap(level => level.hazards.filter(hazard => hazard.kind === 'pulse'));
  assert.ok(pulses.length > 0);
  for (const hazard of pulses) {
    const ignition = 2 * hazard.period + (hazard.period - hazard.phase) % hazard.period;
    assert.equal(hazardSample(hazard, ignition - 1).active, false);
    assert.equal(hazardSample(hazard, ignition).active, true);
    const view = createPulse();
    for (const reducedMotion of [false, true]) for (const tick of [
      ignition - RULES.pulseWarningTicks - 1, ignition - RULES.pulseWarningTicks,
      ignition - 1, ignition, ignition + 1, ignition + 35, ignition + 36,
    ]) {
      const sample = hazardSample(hazard, tick);
      updatePulse(view, hazard, tick, reducedMotion);
      assert.equal(view.warning.visible, sample.warning, `${hazard.x},${hazard.y}@${tick}: warning`);
      assert.equal(sample.active, tick === ignition, 'exactly one lethal tick');
      assert.equal(view.burst.visible, tick >= ignition && tick < ignition + 36,
        `${hazard.x},${hazard.y}@${tick}: cosmetic aftermath`);
      assert.equal(view.footprint.geometry.parameters.width, 2 * RULES.pulseRadius);
      assert.equal(view.footprint.geometry.parameters.height, 2 * RULES.pulseRadius);
    }
  }
});
