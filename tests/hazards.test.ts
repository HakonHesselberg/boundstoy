import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../data/levels.ts';
import { RULES } from '../data/terrain.ts';
import { hazardSample } from '../core/simulation.ts';
import { createPulse, updatePulse } from '../presentation/hazard-visuals.ts';

test('PocketWave_AllThreeOrientations_VisualsMatchEveryExactWarningAndLethalBoundary', () => {
  for (const hazard of LEVELS[8].hazards) {
    assert.equal(hazard.kind, 'pulse');
    if (hazard.kind !== 'pulse') continue;
    const ignition = 480 + (hazard.period - hazard.phase) % hazard.period;
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
