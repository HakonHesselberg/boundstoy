import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Mesh, ConeGeometry, Vector3, LineSegments, Matrix4, Quaternion, Color } from 'three';
import { createSpikes, createPulse, updatePulse, createPulseField, pulseFieldMode, createSawPath, createSawBlade, SAW_HALO_SIZE, WALL_HEIGHT } from '../presentation/hazard-visuals.ts';
import { RULES, GROUND_COLORS } from '../data/terrain.ts';
import { AFTERSHOCK_LEVELS as LEVELS } from '../data/aftershock.ts';
import { hazardSample } from '../core/simulation.ts';

const pulse = { kind: 'pulse' as const, x: 3, y: 3, period: 360, on: 90, phase: 0 };

test('Pulse_Warning_IsExactly225MillisecondsWithoutMovingIgnitionOrExtendingDanger', () => {
  assert.equal(RULES.pulseWarningTicks, 27);
  assert.equal(RULES.pulseWarningTicks / RULES.tickRate, 0.225);
  for (const tick of [305, 306, 332]) {
    assert.equal(hazardSample(pulse, tick).warning, false, `no long buildup at ${tick}`);
  }
  for (let tick = 333; tick < 360; tick++) {
    assert.equal(hazardSample(pulse, tick).warning, true);
    assert.equal(hazardSample(pulse, tick).active, false);
  }
  assert.equal(hazardSample(pulse, 360).active, true);
  assert.equal(hazardSample(pulse, 361).active, false);
});

test('Pulse_DenseFields_UseFlatIdleMarkOneWarningFuseAndAtMostSevenBurstMeshes', () => {
  const view = createPulse();
  const meshes = () => {
    const visible: Mesh[] = [];
    view.group.traverseVisible(object => { if (object instanceof Mesh) visible.push(object); });
    return visible;
  };
  updatePulse(view, pulse, 200, false);
  assert.deepEqual(new Set(meshes()), new Set([view.plate, view.outline, view.pilot]),
    'plate plus a flat footprint band and pilot mark, no raised vent');
  let lines = 0;
  view.group.traverse(object => { if (object instanceof LineSegments) lines++; });
  assert.equal(lines, 0, 'no fixed one-pixel GL lines');
  view.group.updateMatrixWorld(true);
  for (const mesh of meshes()) {
    assert.ok(new Box3().setFromObject(mesh).max.y <= 0.03, 'idle identity stays flush with the floor');
  }
  updatePulse(view, pulse, 340, false);
  assert.deepEqual(new Set(meshes()), new Set([view.plate, view.outline, view.pilot, view.fuse]), 'one fuse cue, not stacked bars/rings');
  updatePulse(view, pulse, 0, false);
  assert.ok(meshes().length <= 7, 'plate plus flash sheet, wave and four shards; no overlapping shell');
  assert.equal(view.pilot.visible, false, 'the flash replaces the pilot instead of stacking on it');
  assert.equal(view.outline.visible, false, 'the flash sheet replaces the outline too');
});

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

const channel = (value: number) => {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex: number) => 0.2126 * channel(hex >> 16 & 255) + 0.7152 * channel(hex >> 8 & 255) + 0.0722 * channel(hex & 255);
const contrast = (a: number, b: number) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

test('Pulse_IdleIdentity_PilotAndFootprintOutlineContrastWithBothGroundShades', () => {
  for (const [x, parity] of [[3, 0], [4, 1]] as const) {
    const view = createPulse();
    updatePulse(view, { ...pulse, x }, 200, false);
    assert.equal(view.plate.material.color.getHex(), GROUND_COLORS[parity], 'idle pads keep the ordinary floor shade');
    assert.ok(contrast(view.pilot.material.color.getHex(), GROUND_COLORS[parity]) >= 3,
      `pilot mark is recognisable on parity ${parity}`);
    assert.ok(contrast(view.outline.material.color.getHex(), GROUND_COLORS[parity]) >= 1.8,
      `footprint outline is visible on parity ${parity}`);
    assert.equal(view.pilot.material.toneMapped, false, 'identity colour is not crushed by tone mapping');
  }
});

test('Pulse_ChargeUp_SalienceRisesEveryTickAndPeaksImmediatelyBeforeIgnition', () => {
  for (const reducedMotion of [false, true]) {
    const view = createPulse();
    let previous = { fuse: 0, glow: 0, pilot: 0 };
    const start = pulse.period - RULES.pulseWarningTicks;
    for (let tick = start; tick < pulse.period; tick++) {
      updatePulse(view, pulse, tick, reducedMotion);
      const now = { fuse: view.fuse.geometry.drawRange.count, glow: view.plate.material.emissiveIntensity,
        pilot: luminance(view.pilot.material.color.getHex()) };
      assert.ok(now.fuse > 0 && now.fuse >= previous.fuse, `fuse fills monotonically at ${tick}`);
      assert.ok(now.glow > previous.glow, `glow strictly rises at ${tick}, never dims toward ignition`);
      assert.ok(now.pilot >= previous.pilot, `pilot brightens at ${tick}`);
      if (reducedMotion) assert.equal(view.pilot.scale.x, 1, 'reduced motion conveys charge without growth');
      previous = now;
    }
    assert.equal(view.fuse.geometry.drawRange.count, view.fuse.geometry.getAttribute('position').count,
      'the perimeter fuse is complete on the last warning tick');
    updatePulse(view, pulse, start - 1, reducedMotion);
    const idleGlow = view.plate.material.emissiveIntensity;
    updatePulse(view, pulse, pulse.period - 1, reducedMotion);
    assert.ok(view.plate.material.emissiveIntensity > idleGlow * 4, 'pre-flash peak is unmistakable');
    if (!reducedMotion) assert.ok(view.pilot.scale.x > 1.3, 'pilot swells as anticipation');
  }
});

test('Pulse_Detonation_FlashCoversTheFullFootprintOnEveryFrameOfTheFlashWindow', () => {
  for (const reducedMotion of [false, true]) {
    const view = createPulse();
    let previous = Infinity;
    for (let tick = 0; tick < RULES.pulseFlashTicks; tick++) {
      updatePulse(view, pulse, tick, reducedMotion);
      assert.equal(view.flash.visible, true);
      assert.ok(view.flash.material.opacity >= 0.4 && view.flash.material.opacity <= previous,
        `strong, fading full-tile flash at ${tick}`);
      previous = view.flash.material.opacity;
      view.flash.geometry.computeBoundingBox();
      const size = view.flash.geometry.boundingBox!.getSize(new Vector3());
      assert.ok(Math.max(size.x, size.y, size.z) >= RULES.pulseRadius * 2 - 0.04, 'flash spans the danger square');
      assert.ok(Math.max(size.x, size.y, size.z) <= RULES.pulseRadius * 2, 'flash stays inside the danger square');
      if (tick > 0) assert.equal(view.plate.material.color.getHex(), GROUND_COLORS[0], 'floor is safe after the lethal tick');
    }
    updatePulse(view, pulse, RULES.pulseFlashTicks, reducedMotion);
    assert.equal(view.flash.visible, false);
  }
});

test('Pulse_Aftermath_CoolsToSubduedDebrisThatDoesNotReadAsFire', () => {
  const view = createPulse();
  updatePulse(view, pulse, 1, false);
  const warm = view.wave.material.color;
  assert.ok(warm.r > warm.b, 'ignition starts warm');
  for (const tick of [12, 20, 30]) {
    updatePulse(view, pulse, tick, false);
    const { r, b } = view.wave.material.color;
    assert.ok(b >= r, `aftermath at ${tick} is cool, not fire`);
    assert.ok(view.wave.material.opacity <= 0.5, `aftermath at ${tick} is subdued`);
    assert.ok(view.sparkMaterial.opacity <= 0.5);
  }
});

const saturation = (hex: number) => {
  const c = [hex >> 16 & 255, hex >> 8 & 255, hex & 255];
  return (Math.max(...c) - Math.min(...c)) / 255;
};

test('Pulse_DormantPad_UsesNeutralIdentityWhileTheActivePuzzleKeepsAmber', () => {
  for (const [x, parity] of [[3, 0], [4, 1]] as const) {
    const active = createPulse(), dormant = createPulse(), pad = { ...pulse, x };
    updatePulse(active, pad, 200, false, true);
    updatePulse(dormant, pad, 200, false, false);
    const amber = active.pilot.material.color, outline = active.outline.material.color;
    assert.ok(amber.r > amber.b * 1.5 && outline.r > outline.b * 1.2, 'active idle pads keep the amber identity');
    for (const part of [dormant.pilot.material.color, dormant.outline.material.color]) {
      assert.ok(saturation(part.getHex()) <= 0.12, 'dormant pads are neutral, not amber noise');
      assert.ok(contrast(part.getHex(), GROUND_COLORS[parity]) >= 1.4, 'dormant footprint remains identifiable');
    }
    assert.ok(luminance(dormant.pilot.material.color.getHex()) < luminance(amber.getHex()), 'dormant marks recede');
    assert.equal(dormant.plate.material.color.getHex(), GROUND_COLORS[parity]);
    assert.equal(dormant.warning.visible, false); assert.equal(dormant.burst.visible, false);
  }
});

test('PulseField_IdlePads_UseThreeDrawObjectsForAnyNumberOfPads', () => {
  const pads = Array.from({ length: 60 }, (_, i) => ({ ...pulse, x: i % 12, y: Math.floor(i / 12) }));
  const field = createPulseField(pads);
  let drawables = 0, lines = 0;
  field.group.traverse(object => {
    if (object instanceof Mesh || object instanceof LineSegments) drawables++;
    if (object instanceof LineSegments) lines++;
  });
  assert.equal(drawables, 3, 'plates, pilots and outlines are each one batched draw');
  assert.equal(lines, 0, 'outlines are world-unit bands, not one-pixel lines');
  assert.equal(field.plates.count, pads.length);
  assert.equal(field.pilots.count, pads.length);
  const matrix = new Matrix4(), position = new Vector3(), scale = new Vector3();
  pads.forEach((pad, index) => {
    field.plates.getMatrixAt(index, matrix);
    matrix.decompose(position, new Quaternion(), scale);
    assert.deepEqual([position.x, position.z], [pad.x + 0.5, pad.y + 0.5], 'exact pad footprint centre');
  });
  field.plates.geometry.computeBoundingBox();
  const size = field.plates.geometry.boundingBox!.getSize(new Vector3());
  assert.ok(Math.abs(size.x - RULES.pulseRadius * 2) < 1e-6 && Math.abs(size.z - RULES.pulseRadius * 2) < 1e-6,
    'instanced idle plate keeps the exact danger footprint');
  field.dispose();
});

test('PulseField_Modes_MatchTheIdlePulseViewColoursAndHideDynamicPads', () => {
  const pads = [pulse, { ...pulse, x: 4 }];
  const field = createPulseField(pads);
  const color = new Color(), matrix = new Matrix4();
  for (const [index, pad] of pads.entries()) for (const enabled of [true, false]) {
    const view = createPulse();
    updatePulse(view, pad, 200, false, enabled);
    field.setMode(index, enabled ? 'active' : 'dormant');
    field.plates.getColorAt(index, color);
    assert.equal(color.getHex(), view.plate.material.color.getHex(), 'idle plate matches the per-pad view');
    field.pilots.getColorAt(index, color);
    assert.equal(color.getHex(), view.pilot.material.color.getHex(), 'idle pilot matches the per-pad view');
    assert.equal(field.outlineColor(index).getHex(), view.outline.material.color.getHex());
    field.plates.getMatrixAt(index, matrix);
    assert.ok(Math.abs(matrix.determinant()) > 0, 'idle pad is drawn by the field');
  }
  field.setMode(1, 'hidden');
  field.plates.getMatrixAt(1, matrix);
  assert.deepEqual([0, 1, 2].map(i => new Vector3().setFromMatrixColumn(matrix, i).length()), [0, 0, 0],
    'charging/bursting pads hand over to their per-pad view');
  field.pilots.getMatrixAt(1, matrix);
  assert.equal(matrix.determinant(), 0);
  assert.equal(field.outlineLength(1), 0, 'no stale outline under the live fuse');
  assert.ok(field.outlineLength(0) > 0);
  field.dispose();
});

test('PulseField_Mode_FollowsDormancyWarningAndAftermathWindows', () => {
  assert.equal(pulseFieldMode(hazardSample(pulse, 200), false), 'dormant');
  assert.equal(pulseFieldMode(hazardSample(pulse, 340), false), 'dormant', 'disabled pads never charge on screen');
  assert.equal(pulseFieldMode(hazardSample(pulse, 200), true), 'active');
  assert.equal(pulseFieldMode(hazardSample(pulse, 360 - RULES.pulseWarningTicks), true), 'hidden', 'first warning tick');
  assert.equal(pulseFieldMode(hazardSample(pulse, 0), true), 'hidden', 'lethal tick');
  assert.equal(pulseFieldMode(hazardSample(pulse, RULES.pulseEffectTicks - 1), true), 'hidden', 'last aftermath tick');
  assert.equal(pulseFieldMode(hazardSample(pulse, RULES.pulseEffectTicks), true), 'active', 'back to idle');
});

test('Pulse_Views_ShareStaticGeometryButOwnTheirColoursAndFuse', () => {
  const a = createPulse(), b = createPulse();
  for (const part of ['plate', 'outline', 'pilot', 'flash', 'wave'] as const) {
    assert.equal(a[part].geometry, b[part].geometry, `${part} geometry is uploaded once`);
    assert.notEqual(a[part].material, b[part].material, `${part} colour stays per pad`);
  }
  assert.equal((a.sparks.children[0] as Mesh).geometry, (b.sparks.children[0] as Mesh).geometry);
  assert.notEqual(a.fuse.geometry, b.fuse.geometry, 'each fuse keeps its own draw range');
  updatePulse(a, pulse, 340, false);
  updatePulse(b, pulse, 200, false);
  assert.notEqual(a.fuse.geometry.drawRange.count, b.fuse.geometry.drawRange.count);
});

test('Saw_PatrolPath_IsAFlushGrooveWithEndCapsAndACompactHalo', () => {
  const from = { x: 2, y: 3 }, to = { x: 6, y: 3 };
  const path = createSawPath(from, to);
  let lines = 0;
  const meshes: Mesh[] = [];
  path.traverse(object => {
    if (object instanceof LineSegments) lines++;
    else if (object instanceof Mesh) meshes.push(object);
  });
  assert.equal(lines, 0);
  path.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(path);
  assert.ok(bounds.max.y <= 0.02, 'flush with the floor; never mistaken for a raised barrier');
  assert.ok(bounds.max.z - bounds.min.z >= 0.06, 'groove is wide enough to read at world scale');
  assert.ok(bounds.min.x <= from.x + 0.5 - 0.08 && bounds.max.x >= to.x + 0.5 + 0.08, 'caps mark both turnarounds');
  const caps = meshes.filter(mesh => mesh.name === 'saw-cap');
  assert.deepEqual(caps.map(cap => [cap.position.x, cap.position.z]).sort(), [[2.5, 3.5], [6.5, 3.5]]);
  assert.ok(SAW_HALO_SIZE <= 1, 'halo stays within the saw\'s own cell');
  const blade = createSawBlade();
  const materials = new Set<unknown>();
  blade.traverse(object => { if (object instanceof Mesh) materials.add(object.material); });
  assert.equal(materials.size, 1, 'blade and teeth share one material');
});
