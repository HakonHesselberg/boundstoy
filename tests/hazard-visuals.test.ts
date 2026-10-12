import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Mesh, ConeGeometry, Vector3, LineSegments, Matrix4, Color } from 'three';
import { createSpikes, createPulse, updatePulse, createPulseField, pulseFieldMode, createSawPath, createSawBlade,
  SAW_HALO_SIZE, WALL_HEIGHT, PULSE_BURST_PEAK_HEIGHT, type PulseView } from '../presentation/hazard-visuals.ts';
import { RULES } from '../data/terrain.ts';
import { EXPLOSION_STYLES, EXPLOSION_STYLE_IDS, DORMANT_FRAME } from '../data/explosion-styles.ts';
import { LinearFilter, Texture } from 'three';
import { AFTERSHOCK_LEVELS as LEVELS } from '../data/aftershock.ts';
import { hazardSample } from '../core/simulation.ts';
import type { Pulse } from '../core/level.ts';

const pulse: Pulse = { kind: 'pulse', x: 3, y: 3, period: 360, on: 1, phase: 0 };
const IGNITION = 0, LAST_WARNING = 359, FIRST_WARNING = 360 - RULES.pulseWarningTicks;

const visibleMeshes = (view: PulseView) => {
  const meshes: Mesh[] = [];
  view.group.traverseVisible(object => { if (object instanceof Mesh) meshes.push(object); });
  return meshes;
};
const opacity = (mesh: Mesh) => (mesh.material as { opacity: number }).opacity;
const channel = (value: number) => {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex: number) => 0.2126 * channel(hex >> 16 & 255) + 0.7152 * channel(hex >> 8 & 255) + 0.0722 * channel(hex & 255);

test('Pulse_Warning_IsExactly225MillisecondsWithoutMovingIgnitionOrExtendingDanger', () => {
  assert.equal(RULES.pulseWarningTicks, 27);
  assert.equal(RULES.pulseWarningTicks / RULES.tickRate, 0.225);
  for (const tick of [305, 306, 332]) assert.equal(hazardSample(pulse, tick).warning, false, `no long buildup at ${tick}`);
  for (let tick = 333; tick < 360; tick++) {
    assert.equal(hazardSample(pulse, tick).warning, true);
    assert.equal(hazardSample(pulse, tick).active, false);
  }
  assert.equal(hazardSample(pulse, 360).active, true);
  assert.equal(hazardSample(pulse, 361).active, false);
});

test('Pulse_Idle_IsAThinRoundedGlowingGrooveOverVisibleGround', () => {
  const view = createPulse('ember');
  updatePulse(view, pulse, 200, false);
  assert.deepEqual(new Set(visibleMeshes(view)), new Set([view.frame, view.edgeGlow]),
    'a groove and its soft glow; no plate, dot, keyline or brackets');
  view.group.updateMatrixWorld(true);
  for (const mesh of visibleMeshes(view)) assert.ok(new Box3().setFromObject(mesh).max.y <= 0.03, 'flush with the floor');
  let lines = 0;
  view.group.traverse(object => { if (object instanceof LineSegments) lines++; });
  assert.equal(lines, 0, 'no fixed one-pixel GL lines');
  const positions = view.frame.geometry.getAttribute('position');
  const box = new Box3().setFromBufferAttribute(positions as never), outer = box.max.x;
  assert.ok(outer < RULES.pulseRadius, 'inside the footprint');
  let area = 0, corner = Infinity;
  for (let i = 0; i < positions.count; i++) {
    const v = new Vector3().fromBufferAttribute(positions, i);
    corner = Math.min(corner, Math.hypot(outer - Math.abs(v.x), outer - Math.abs(v.z)));
    if (i % 3 === 0) {
      const [a, b, c] = [0, 1, 2].map(k => new Vector3().fromBufferAttribute(positions, i + k));
      area += b.sub(a).cross(c.sub(a)).length() / 2;
    }
  }
  assert.ok(corner > 0.02, 'rounded corners: no vertex sits on the square corner');
  assert.ok(area < 8 * outer * 0.035, 'a thin groove, not a thick sprite band');
  assert.ok(view.edgeGlow.material.map instanceof Texture && view.edgeGlow.material.blending === 2, 'soft additive inner glow');
});

test('Pulse_EveryVisiblePart_IsSoftShadedNotFlat', () => {
  for (const id of EXPLOSION_STYLE_IDS) {
    const view = createPulse(id);
    for (const tick of [200, 340, 358, 0, 1, 4, 10, 20, 30]) {
      updatePulse(view, pulse, tick, false);
      for (const mesh of visibleMeshes(view)) {
        const material = mesh.material as { map?: Texture | null; vertexColors?: boolean };
        const thin = ['frame', 'fuse', 'ember'].includes(mesh.name);
        assert.ok(thin || material.vertexColors || material.map, `${id}@${tick}: ${mesh.name || mesh.geometry.type} is a flat fill`);
        if (material.map) assert.equal(material.map.magFilter, LinearFilter, 'smoothly filtered');
      }
    }
    for (const part of view.motif.children as Mesh[]) {
      assert.ok(part.geometry.getAttribute('position').count >= 60, `${id}: smooth motif geometry`);
      assert.ok(part.geometry.getAttribute('color'), `${id}: core-to-tip colour gradient`);
    }
  }
});

test('Pulse_Styles_ColourTheFrameBurstAndDebrisAndDormantPadsAreNeutral', () => {
  for (const id of EXPLOSION_STYLE_IDS) {
    const style = EXPLOSION_STYLES[id], view = createPulse(id);
    updatePulse(view, pulse, 200, false);
    assert.equal(view.frame.material.color.getHex(), style.frame);
    assert.equal(view.edgeGlow.material.color.getHex(), style.frame);
    updatePulse(view, pulse, 200, false, false);
    assert.equal(view.frame.material.color.getHex(), DORMANT_FRAME, `${id}: dormant pads carry no style colour`);
    assert.equal(view.warning.visible, false); assert.equal(view.burst.visible, false);
    updatePulse(view, pulse, IGNITION, false);
    assert.equal(view.flash.material.color.getHex(), style.core, `${id}: white-hot ignition core`);
    updatePulse(view, pulse, 3, false);
    assert.ok(view.motif.name === `motif-${style.motif}`, `${id}: its own burst motif`);
  }
});

test('Pulse_ChargeUp_TheFrameBurnsAsTheFuseAndSalienceRisesEveryTick', () => {
  for (const reducedMotion of [false, true]) for (const id of EXPLOSION_STYLE_IDS) {
    const view = createPulse(id);
    let previous = { fuse: 0, tint: 0 };
    for (let tick = FIRST_WARNING; tick <= LAST_WARNING; tick++) {
      updatePulse(view, pulse, tick, reducedMotion);
      const now = { fuse: view.fuse.geometry.drawRange.count, tint: opacity(view.tint) };
      assert.ok(view.spark.visible, `${id}: a glowing spark leads the fuse at ${tick}`);
      assert.ok(now.fuse > 0 && now.fuse >= previous.fuse, `${id}: fuse burns monotonically at ${tick}`);
      assert.ok(now.tint > previous.tint, `${id}: charge tint strictly rises at ${tick}`);
      previous = now;
    }
    assert.equal(view.fuse.geometry.drawRange.count, view.fuse.geometry.getAttribute('position').count,
      'the fuse has burned all the way round on the last warning tick');
    assert.ok(opacity(view.tint) <= 0.6, 'the ground is still visible at the end of the charge');
  }
});

test('Pulse_Detonation_OutshinesItsChargeUpAndEruptsInsideTheTile', () => {
  const view = createPulse('ember');
  updatePulse(view, pulse, LAST_WARNING, false);
  const chargePeak = opacity(view.tint) * luminance(view.tint.material.color.getHex());
  updatePulse(view, pulse, IGNITION, false);
  const ignition = opacity(view.flash) * luminance(view.flash.material.color.getHex());
  assert.ok(ignition >= chargePeak * 2, 'ignition is at least twice as salient as the charge-up peak');
  assert.equal(opacity(view.flash), 1, 'opaque white-hot tile on the lethal tick');
  let peak = 0;
  for (let tick = 0; tick < 14; tick++) {
    updatePulse(view, pulse, tick, false);
    view.group.updateMatrixWorld(true);
    peak = Math.max(peak, new Box3().setFromObject(view.motif).max.y);
  }
  assert.ok(peak >= 0.35 && peak <= PULSE_BURST_PEAK_HEIGHT + 1e-6, `burst rises clearly (${peak.toFixed(2)}) but stays capped`);
  updatePulse(view, pulse, 3, false);
  assert.ok(visibleMeshes(view).length >= 8, 'a layered eruption, not one flat flash');
});

test('Pulse_Detonation_FlashCoversTheFullFootprintOnEveryFrameOfTheFlashWindow', () => {
  for (const reducedMotion of [false, true]) {
    const view = createPulse();
    let previous = Infinity;
    for (let tick = 0; tick < RULES.pulseFlashTicks; tick++) {
      updatePulse(view, pulse, tick, reducedMotion);
      assert.equal(view.flash.visible, true);
      assert.ok(opacity(view.flash) >= 0.4 && opacity(view.flash) <= previous, `strong, fading full-tile flash at ${tick}`);
      previous = opacity(view.flash);
      view.flash.geometry.computeBoundingBox();
      const size = view.flash.geometry.boundingBox!.getSize(new Vector3());
      assert.ok(Math.max(size.x, size.y, size.z) >= RULES.pulseRadius * 2 - 0.04, 'flash spans the danger square');
      assert.ok(Math.max(size.x, size.y, size.z) <= RULES.pulseRadius * 2, 'flash stays inside the danger square');
    }
    updatePulse(view, pulse, RULES.pulseFlashTicks, reducedMotion);
    assert.equal(view.flash.visible, false);
  }
});

test('Pulse_DetonationAndHarmlessAftermath_AreDistinctFromTheWarning', () => {
  const view = createPulse();
  updatePulse(view, pulse, 200, false);
  assert.equal(view.burst.visible, false); assert.equal(view.warning.visible, false);
  updatePulse(view, pulse, 340, false);
  assert.equal(view.burst.visible, false); assert.equal(view.warning.visible, true);
  updatePulse(view, pulse, 0, false);
  assert.equal(view.burst.visible, true); assert.equal(view.warning.visible, false);
  updatePulse(view, pulse, 20, false);
  assert.equal(hazardSample(pulse, 20).active, false);
  assert.equal(view.burst.visible, true, 'the tile is safe even while the explosion dissipates');
  assert.equal(view.flash.visible, false, 'no lingering hot flash after the lethal moment');
  assert.ok(view.scorch.visible && opacity(view.scorch) < 0.8, 'a translucent spent mark, not fire');
  updatePulse(view, pulse, 35, false);
  assert.equal(view.burst.visible, true);
  updatePulse(view, pulse, 36, false);
  assert.equal(view.burst.visible, false, 'aftermath lasts 300 ms');
});

test('Pulse_Aftermath_CoolsToTheStyleDebrisColour', () => {
  for (const id of EXPLOSION_STYLE_IDS) {
    const view = createPulse(id), style = EXPLOSION_STYLES[id];
    updatePulse(view, pulse, 30, false);
    assert.equal(view.emberMaterial.color.getHex(), new Color(style.debris).getHex(), `${id}: embers have cooled`);
    assert.ok(view.emberMaterial.opacity <= 0.5);
    assert.equal(view.motif.visible, false, 'the eruption is over well before the aftermath ends');
  }
});

test('Pulse_PausedOrReducedMotion_KeepsDeterministicLegibleDanger', () => {
  const view = createPulse();
  updatePulse(view, pulse, 10, false);
  const before = view.embers.children.map(ember => ember.position.clone());
  updatePulse(view, pulse, 10, false);
  assert.deepEqual(view.embers.children.map(ember => ember.position), before);
  updatePulse(view, pulse, 2, true);
  assert.equal(view.burst.visible, true);
  assert.equal(view.embers.visible, false, 'reduced motion: no travelling embers');
  assert.equal(view.wave.scale.x, 1, 'reduced motion: the shockwave does not expand');
  assert.ok(opacity(view.flash) > 0 && view.motif.visible, 'the burst itself is still shown');
});

test('Pulse_SkippedIgnitionFrame_StillRendersAFadingNonLoopingExplosion', () => {
  const view = createPulse();
  let previousOpacity = 1, previousRadius = 0;
  const resources = view.group.children.length;
  for (let tick = 2; tick < 14; tick += 2) {
    updatePulse(view, pulse, tick, false);
    assert.equal(view.burst.visible, true);
    assert.equal(hazardSample(pulse, tick).active, false);
    assert.ok(opacity(view.wave) < previousOpacity);
    assert.ok(view.wave.scale.x > previousRadius);
    previousOpacity = opacity(view.wave); previousRadius = view.wave.scale.x;
    assert.equal(view.group.children.length, resources);
  }
  updatePulse(view, pulse, 36, false);
  assert.equal(view.burst.visible, false);
  updatePulse(view, pulse, 364, false);
  const repeated = view.embers.children.map(ember => ember.position.clone());
  updatePulse(view, pulse, 4, false);
  assert.deepEqual(view.embers.children.map(ember => ember.position), repeated);
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
      assert.equal(view.footprint.geometry.parameters.width, 2 * RULES.pulseRadius);
      assert.equal(view.footprint.geometry.parameters.height, 2 * RULES.pulseRadius);
    }
  }
});

test('Spikes_Tile_HasTallPointedMetalTeethNotFlatDiamonds', () => {
  const spikes = createSpikes();
  const teeth: Mesh<ConeGeometry>[] = [];
  spikes.traverse(object => { if (object instanceof Mesh && object.geometry instanceof ConeGeometry) teeth.push(object); });
  assert.equal(teeth.length, 5);
  for (const tooth of teeth) {
    assert.ok(tooth.geometry.parameters.height >= 0.65);
    assert.ok(tooth.geometry.parameters.height > tooth.geometry.parameters.radius * 3);
  }
  assert.ok(WALL_HEIGHT < 0.3, 'barriers should be low curbs');
});

test('PulseField_IdlePads_UseTwoDrawObjectsForAnyNumberOfPads', () => {
  const pads = Array.from({ length: 60 }, (_, i) => ({ ...pulse, x: i % 12, y: Math.floor(i / 12),
    ...(i % 3 ? { style: EXPLOSION_STYLE_IDS[i % 4] } : {}) }));
  const field = createPulseField(pads);
  let drawables = 0, lines = 0;
  field.group.traverse(object => {
    if (object instanceof Mesh || object instanceof LineSegments) drawables++;
    if (object instanceof LineSegments) lines++;
  });
  assert.equal(drawables, 2, 'glows and grooves are each one batched draw, whatever the styles');
  assert.equal(lines, 0);
  const matrix = new Matrix4(), position = new Vector3();
  pads.forEach((pad, index) => {
    field.frames.getMatrixAt(index, matrix);
    position.setFromMatrixPosition(matrix);
    assert.deepEqual([position.x, position.z], [pad.x + 0.5, pad.y + 0.5], 'exact pad footprint centre');
  });
  field.dispose();
});

test('PulseField_Modes_MatchTheIdlePulseViewAndHideLivePads', () => {
  const pads: Pulse[] = [pulse, { ...pulse, x: 4, style: 'plasma' }];
  const field = createPulseField(pads);
  const color = new Color(), matrix = new Matrix4();
  for (const [index, pad] of pads.entries()) for (const enabled of [true, false]) {
    const view = createPulse(pad.style);
    updatePulse(view, pad, 200, false, enabled);
    field.setMode(index, enabled ? 'active' : 'dormant');
    field.frames.getColorAt(index, color);
    assert.equal(color.getHex(), view.frame.material.color.getHex(), 'idle frame matches the per-pad view');
    field.glows.getColorAt(index, color);
    assert.equal(color.getHex(), view.edgeGlow.material.color.getHex());
    field.frames.getMatrixAt(index, matrix);
    assert.ok(Math.abs(matrix.determinant()) > 0, 'idle pad is drawn by the field');
  }
  field.setMode(1, 'hidden');
  for (const mesh of [field.frames, field.glows]) {
    mesh.getMatrixAt(1, matrix);
    assert.deepEqual([0, 1, 2].map(i => new Vector3().setFromMatrixColumn(matrix, i).length()), [0, 0, 0],
      'charging/bursting pads hand over to their per-pad view');
  }
  field.dispose();
});

test('PulseField_Mode_FollowsDormancyWarningAndAftermathWindows', () => {
  assert.equal(pulseFieldMode(hazardSample(pulse, 200), false), 'dormant');
  assert.equal(pulseFieldMode(hazardSample(pulse, 340), false), 'dormant', 'disabled pads never charge on screen');
  assert.equal(pulseFieldMode(hazardSample(pulse, 200), true), 'active');
  assert.equal(pulseFieldMode(hazardSample(pulse, FIRST_WARNING), true), 'hidden', 'first warning tick');
  assert.equal(pulseFieldMode(hazardSample(pulse, 0), true), 'hidden', 'lethal tick');
  assert.equal(pulseFieldMode(hazardSample(pulse, RULES.pulseEffectTicks - 1), true), 'hidden', 'last aftermath tick');
  assert.equal(pulseFieldMode(hazardSample(pulse, RULES.pulseEffectTicks), true), 'active', 'back to idle');
});

test('Pulse_Views_ShareStaticGeometryButOwnTheirColoursAndFuse', () => {
  const a = createPulse('toxic'), b = createPulse('toxic');
  for (const part of ['edgeGlow', 'frame', 'tint', 'flash', 'glow', 'wave', 'scorch', 'footprint', 'spark'] as const) {
    assert.equal(a[part].geometry, b[part].geometry, `${part} geometry is uploaded once`);
    assert.notEqual(a[part].material, b[part].material, `${part} colour stays per pad`);
  }
  assert.equal((a.motif.children[0] as Mesh).geometry, (b.motif.children[0] as Mesh).geometry, 'motif geometry shared');
  assert.equal((a.embers.children[0] as Mesh).geometry, (b.embers.children[0] as Mesh).geometry);
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
