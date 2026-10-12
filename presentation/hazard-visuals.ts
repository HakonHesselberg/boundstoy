import * as THREE from 'three';
import { RULES } from '../data/terrain.ts';
import { DEFAULT_EXPLOSION_STYLE, DORMANT_FRAME, EXPLOSION_STYLES, FRAME_KEYLINE, explosionStyle,
  type ExplosionMotif, type ExplosionStyleId } from '../data/explosion-styles.ts';
import type { Pulse } from '../core/level.ts';
import { hazardSample } from '../core/simulation.ts';
import type { Point } from '../core/level.ts';
import { createFrameGeometry, createRectsGeometry, createStrokeGeometry, frameRects } from './stroke-visuals.ts';

export const WALL_HEIGHT = 0.24;

export function createSpikes(): THREE.Group {
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.08, 0.88),
    new THREE.MeshStandardMaterial({ color: 0x321e2b, roughness: 0.75, metalness: 0.25 }));
  base.position.y = 0.035; group.add(base);
  const socketGeometry = new THREE.CylinderGeometry(0.19, 0.2, 0.09, 8);
  const socketMaterial = new THREE.MeshStandardMaterial({ color: 0xf04860, emissive: 0x9c142c, emissiveIntensity: 0.4, roughness: 0.45 });
  const toothGeometry = new THREE.ConeGeometry(0.16, 0.78, 4);
  const toothMaterial = new THREE.MeshStandardMaterial({ color: 0xe0e9eb, metalness: 0.65, roughness: 0.28, flatShading: true });
  for (const [x, z] of [[-0.25, -0.25], [0.25, -0.25], [0, 0], [-0.25, 0.25], [0.25, 0.25]]) {
    const socket = new THREE.Mesh(socketGeometry, socketMaterial);
    socket.position.set(x, 0.11, z); group.add(socket);
    const tooth = new THREE.Mesh(toothGeometry, toothMaterial);
    tooth.position.set(x, 0.5, z);
    tooth.rotation.set(z * 0.35, Math.PI / 4, -x * 0.35);
    if (x === 0 && z === 0) tooth.scale.y = 1.15;
    tooth.castShadow = true; group.add(tooth);
  }
  return group;
}

// Pulse presentation. Timing and footprint come from RULES; these values only
// shape how idle, charge-up, detonation and harmless aftermath read on screen.
//
// Every vertex must stay inside the tile's projected footprint. At the fixed
// 25:17 camera tilt, screen-up = 0.562·y − 0.827·z, so a point may rise only
// as far as its distance from the far edge allows. Sizes below are chosen
// against that envelope and verified for every tick in mobile-readability tests.
const R = RULES.pulseRadius;
const KEYLINE = Object.freeze({ outer: R - 0.01, width: 0.016, y: 0.006 });
const FRAME = Object.freeze({ outer: R - 0.024, width: 0.05, y: 0.008, bracket: 0.17, bracketWidth: 0.045 });
const FUSE_Y = 0.01;
const FUSE_SEGMENTS_PER_SIDE = 9;
const TINT = Object.freeze({ half: R - 0.03, y: 0.012, start: 0.06, rise: 0.44 });
const FLASH = Object.freeze({ inset: 0.012, y: 0.014, holdTicks: 2, floor: 0.4 });
const SCORCH = Object.freeze({ half: R - 0.01, y: 0.004, opacity: 0.65, fromTick: 2 });
const GLOW = Object.freeze({ radius: 0.38, y: 0.016, ticks: 14 });
const WAVE = Object.freeze({ radius: 0.3, tube: 0.025, y: 0.02, from: 0.4, to: 1.2, ticks: 14 });
const MOTIF = Object.freeze({ peakTick: 4, ticks: 16 });
const EMBERS = Object.freeze({ count: 6, size: 0.03, from: 0.08, to: 0.26, lift: 0.16, coolTicks: 14 });
/** Highest point any burst motif reaches; a column at the tile centre stays inside the projection. */
export const PULSE_BURST_PEAK_HEIGHT = 0.5;

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
const easeInCubic = (t: number) => t ** 3;
const flatPlane = (half: number, y: number) =>
  new THREE.PlaneGeometry(half * 2, half * 2).rotateX(-Math.PI / 2).translate(0, y, 0);
const apexUp = (geometry: THREE.BufferGeometry, height: number) => geometry.translate(0, height / 2, 0);

/** Band plus thicker corner brackets: reads as an armed device over any floor. */
function hazardFrameGeometry() {
  const { outer, width, bracket, bracketWidth } = FRAME, inner = outer - width, deep = inner - bracketWidth;
  const rects = frameRects(outer, width);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x0 = sx * inner, x1 = sx * deep, z0 = sz * inner, z1 = sz * deep, reach = sx * (outer - bracket);
    const zreach = sz * (outer - bracket);
    rects.push([Math.min(x0, reach), Math.min(z0, z1), Math.max(x0, reach), Math.max(z0, z1)]);
    rects.push([Math.min(x0, x1), Math.min(z1, zreach), Math.max(x0, x1), Math.max(z1, zreach)]);
  }
  return createRectsGeometry(rects).translate(0, FRAME.y, 0);
}

/** Clockwise copy of the frame band; drawRange reveals it as the burning fuse. */
function fuseGeometry() {
  const outer = FRAME.outer, inner = outer - FRAME.width;
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const positions: number[] = [];
  for (let side = 0; side < 4; side++) {
    const [ax, az] = corners[side], [bx, bz] = corners[(side + 1) % 4];
    for (let i = 0; i < FUSE_SEGMENTS_PER_SIDE; i++) {
      const s0 = i / FUSE_SEGMENTS_PER_SIDE, s1 = (i + 1) / FUSE_SEGMENTS_PER_SIDE;
      const point = (s: number, r: number) => [(ax + (bx - ax) * s) * r, FUSE_Y, (az + (bz - az) * s) * r];
      const [o0, o1, i0, i1] = [point(s0, outer), point(s1, outer), point(s0, inner), point(s1, inner)];
      positions.push(...o0, ...i0, ...o1, ...o1, ...i0, ...i1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setDrawRange(0, 0);
  return geometry;
}

// Static pad geometry is uploaded once and shared by every pad view; colours
// and the fuse draw range stay per pad.
const SHARED = Object.freeze({
  footprint: new THREE.PlaneGeometry(R * 2, R * 2).rotateX(-Math.PI / 2),
  keyline: createFrameGeometry(KEYLINE.outer, KEYLINE.width).translate(0, KEYLINE.y, 0),
  frame: hazardFrameGeometry(),
  tint: flatPlane(TINT.half, TINT.y),
  flash: flatPlane(R - FLASH.inset, FLASH.y),
  scorch: flatPlane(SCORCH.half, SCORCH.y),
  glow: new THREE.CircleGeometry(GLOW.radius, 28).rotateX(-Math.PI / 2).translate(0, GLOW.y, 0),
  wave: new THREE.TorusGeometry(WAVE.radius, WAVE.tube, 6, 28).rotateX(-Math.PI / 2).translate(0, WAVE.y, 0),
  ember: new THREE.OctahedronGeometry(EMBERS.size),
  column: apexUp(new THREE.ConeGeometry(0.08, PULSE_BURST_PEAK_HEIGHT, 8), PULSE_BURST_PEAK_HEIGHT),
  petal: apexUp(new THREE.ConeGeometry(0.07, 0.26, 5), 0.26),
  ring: new THREE.TorusGeometry(0.22, 0.02, 6, 28).rotateX(-Math.PI / 2),
  bolt: apexUp(new THREE.CylinderGeometry(0.018, 0.03, PULSE_BURST_PEAK_HEIGHT, 5), PULSE_BURST_PEAK_HEIGHT),
  puff: new THREE.IcosahedronGeometry(0.12, 1),
  shard: new THREE.TetrahedronGeometry(0.05),
});

type Part = Readonly<{ geometry: THREE.BufferGeometry; position: readonly [number, number, number];
  tilt?: readonly [number, number]; scale?: number }>;
const ring = (count: number, make: (angle: number, index: number) => Part) =>
  Array.from({ length: count }, (_, i) => make(i * Math.PI * 2 / count, i));
/** Burst shapes per motif; each part's extreme points sit inside the projected envelope. */
const MOTIFS: Readonly<Record<ExplosionMotif, readonly Part[]>> = Object.freeze({
  // Scourge-like eruption: a central flame with eight petals leaning outward.
  petals: [{ geometry: SHARED.column, position: [0, 0, 0] },
    ...ring(8, angle => ({ geometry: SHARED.petal, position: [Math.cos(angle) * 0.12, 0, Math.sin(angle) * 0.12],
      tilt: [Math.cos(angle) * 0.5, Math.sin(angle) * 0.5] }))],
  // Protoss flash: two shock rings and a crackling column of bolts.
  ring: [{ geometry: SHARED.ring, position: [0, 0.05, 0], scale: 1.4 }, { geometry: SHARED.ring, position: [0, 0.22, 0], scale: 0.9 },
    ...ring(3, angle => ({ geometry: SHARED.bolt, position: [Math.cos(angle) * 0.04, 0, Math.sin(angle) * 0.04] }))],
  // Zerg cloud: a large central puff over four smaller billows.
  cloud: [{ geometry: SHARED.puff, position: [0, 0.22, 0], scale: 1.6 },
    ...ring(4, angle => ({ geometry: SHARED.puff, position: [Math.cos(angle) * 0.17, 0.1, Math.sin(angle) * 0.17], scale: 1.2 }))],
  // Dark Archon swirl: shards spiralling inward as they climb around a column.
  swirl: [{ geometry: SHARED.column, position: [0, 0, 0], scale: 0.9 },
    ...ring(8, (angle, i) => ({ geometry: SHARED.shard,
      position: [Math.cos(angle * 1.5) * (0.3 - 0.03 * i), 0.05 + 0.05 * i, Math.sin(angle * 1.5) * (0.3 - 0.03 * i)] }))],
});

const UP = new THREE.Vector3(0, 1, 0);
function createMotif(motif: ExplosionMotif, material: THREE.Material) {
  const group = new THREE.Group();
  group.name = `motif-${motif}`;
  for (const part of MOTIFS[motif]) {
    const mesh = new THREE.Mesh(part.geometry, material);
    mesh.position.set(...part.position);
    if (part.tilt) mesh.quaternion.setFromUnitVectors(UP, new THREE.Vector3(part.tilt[0], 1, part.tilt[1]).normalize());
    mesh.scale.setScalar(part.scale ?? 1);
    group.add(mesh);
  }
  return group;
}

const basic = (color: number, extra: THREE.MeshBasicMaterialParameters = {}) =>
  new THREE.MeshBasicMaterial({ color, toneMapped: false, ...extra });
const fading = (color: number, extra: THREE.MeshBasicMaterialParameters = {}) =>
  basic(color, { transparent: true, depthWrite: false, ...extra });

export function createPulse(styleId: ExplosionStyleId = DEFAULT_EXPLOSION_STYLE) {
  const style = EXPLOSION_STYLES[styleId];
  const group = new THREE.Group();
  const footprint = new THREE.Mesh(SHARED.footprint, basic(0xffffff));
  footprint.name = 'footprint'; footprint.visible = false;
  const keyline = new THREE.Mesh(SHARED.keyline, basic(FRAME_KEYLINE));
  const frame = new THREE.Mesh(SHARED.frame, basic(style.frame));
  group.add(footprint, keyline, frame);

  const warning = new THREE.Group();
  const tint = new THREE.Mesh(SHARED.tint, fading(style.hot));
  const fuse = new THREE.Mesh(fuseGeometry(), basic(style.core, { side: THREE.DoubleSide }));
  warning.add(tint, fuse); group.add(warning);

  const burst = new THREE.Group();
  const scorch = new THREE.Mesh(SHARED.scorch, fading(style.scorch));
  const glow = new THREE.Mesh(SHARED.glow, fading(style.burst, { blending: THREE.AdditiveBlending }));
  const flash = new THREE.Mesh(SHARED.flash, fading(style.core));
  const wave = new THREE.Mesh(SHARED.wave, fading(style.hot));
  const motifMaterial = fading(style.burst);
  const motif = createMotif(style.motif, motifMaterial);
  const embers = new THREE.Group();
  const emberMaterial = fading(style.burst);
  for (let i = 0; i < EMBERS.count; i++) embers.add(new THREE.Mesh(SHARED.ember, emberMaterial));
  [scorch, glow, flash, wave, motif, embers].forEach((part, order) => { part.renderOrder = order; burst.add(part); });
  group.add(burst);
  return { group, style, footprint, keyline, frame, warning, tint, fuse, burst, scorch, glow, flash, wave,
    motif, motifMaterial, embers, emberMaterial };
}

export type PulseView = ReturnType<typeof createPulse>;

const scratch = { a: new THREE.Color(), b: new THREE.Color() };
const mix = (target: THREE.Color, from: number, to: number, t: number) =>
  target.lerpColors(scratch.a.setHex(from), scratch.b.setHex(to), Math.min(Math.max(t, 0), 1));

export function updatePulse(view: PulseView, hazard: Pulse, tick: number, reducedMotion: boolean, enabled = true) {
  const { style } = view;
  const sampled = hazardSample(hazard, tick);
  // A dormant pad is a static identifier, not an idle sample at local tick 0.
  const sample = enabled ? sampled : { ...sampled, active: false, warning: false, cycle: RULES.pulseEffectTicks };
  const cycle = sample.cycle;
  // 1/27 on the first warning tick, exactly 1 on the last: the fuse completes before ignition.
  const charge = sample.warning ? (cycle - hazard.period + RULES.pulseWarningTicks + 1) / RULES.pulseWarningTicks : 0;
  const bursting = cycle < RULES.pulseEffectTicks;
  const age = Math.min(cycle / RULES.pulseEffectTicks, 1);

  // Identity: the frame over visible ground. It heats toward the fuse colour while charging.
  view.frame.visible = !(bursting && cycle < RULES.pulseFlashTicks);
  view.keyline.visible = view.frame.visible;
  if (!enabled) view.frame.material.color.setHex(DORMANT_FRAME);
  else mix(view.frame.material.color, style.frame, style.hot, charge);

  // Anticipation: the fuse burns clockwise round the frame while a tint rises.
  view.warning.visible = sample.warning;
  const segments = view.fuse.geometry.getAttribute('position').count / 6;
  view.fuse.geometry.setDrawRange(0, Math.ceil(charge * segments) * 6);
  view.tint.material.opacity = sample.warning ? TINT.start + TINT.rise * charge ** 1.5 : 0;

  // Detonation, sampled by time since ignition so a frame need not land on the lethal tick.
  view.burst.visible = bursting;
  if (!bursting) return;
  view.flash.visible = cycle < RULES.pulseFlashTicks;
  view.flash.material.opacity = cycle < FLASH.holdTicks ? 1
    : 1 - (1 - FLASH.floor) * (cycle - FLASH.holdTicks + 1) / (RULES.pulseFlashTicks - FLASH.holdTicks);
  mix(view.flash.material.color, style.core, style.burst, (cycle - FLASH.holdTicks + 1) / (RULES.pulseFlashTicks - FLASH.holdTicks + 1));

  view.glow.visible = cycle < GLOW.ticks;
  view.glow.material.opacity = (1 - cycle / GLOW.ticks) ** 2;

  view.wave.visible = cycle < WAVE.ticks;
  const waveAge = cycle / WAVE.ticks;
  view.wave.scale.setScalar(reducedMotion ? 1 : WAVE.from + (WAVE.to - WAVE.from) * easeOutCubic(waveAge));
  view.wave.material.opacity = 0.9 * (1 - waveAge) ** 1.5;

  // The eruption peaks after four ticks and is gone long before the aftermath ends.
  view.motif.visible = cycle < MOTIF.ticks;
  const rise = cycle < MOTIF.peakTick ? easeOutCubic((cycle + 1) / (MOTIF.peakTick + 1))
    : 1 - easeInCubic((cycle - MOTIF.peakTick) / (MOTIF.ticks - MOTIF.peakTick));
  view.motif.scale.setScalar(reducedMotion ? 1 : Math.max(rise, 0.001));
  view.motif.rotation.y = reducedMotion || style.motif !== 'swirl' ? 0 : cycle * 0.25;
  // Saturated against the white-hot flash, warming to the fuse colour as it collapses.
  mix(view.motifMaterial.color, style.burst, style.hot, (cycle - MOTIF.peakTick) / (MOTIF.ticks - MOTIF.peakTick));
  view.motifMaterial.opacity = cycle <= MOTIF.peakTick ? 1 : Math.max(rise, 0.15);

  view.scorch.visible = cycle >= SCORCH.fromTick;
  view.scorch.material.opacity = SCORCH.opacity * (1 - age);

  // Follow-through: embers settle and cool to the style's debris colour, so the aftermath reads as spent.
  view.embers.visible = !reducedMotion && cycle >= 1;
  mix(view.emberMaterial.color, style.burst, style.debris, cycle / EMBERS.coolTicks);
  view.emberMaterial.opacity = 0.9 * (1 - age) ** 1.5;
  const flight = easeOutCubic(age);
  view.embers.children.forEach((ember, index) => {
    const angle = (index + 0.25) * Math.PI * 2 / EMBERS.count;
    const radius = EMBERS.from + (EMBERS.to - EMBERS.from) * flight;
    ember.position.set(Math.cos(angle) * radius, 0.02 + 4 * flight * (1 - flight) * EMBERS.lift, Math.sin(angle) * radius);
    ember.rotation.set(angle, angle * 2, 0);
    ember.scale.setScalar(1 - 0.6 * age);
  });
}

/** Which renderer owns a pad this frame: the shared idle field, or its own live view. */
export type PulseFieldMode = 'active' | 'dormant' | 'hidden';
export function pulseFieldMode(sample: ReturnType<typeof hazardSample>, enabled: boolean): PulseFieldMode {
  if (!enabled) return 'dormant';
  return sample.warning || sample.cycle < RULES.pulseEffectTicks ? 'hidden' : 'active';
}

/**
 * Idle pads in two batched draws (keylines and style-coloured frames). A pad
 * hands over to its per-pad `PulseView` only while charging or bursting, so
 * the colours here must equal the view's idle/dormant state exactly.
 */
export function createPulseField(pads: readonly Readonly<{ x: number; y: number; style?: ExplosionStyleId }>[]) {
  const group = new THREE.Group();
  group.name = 'pulse-field';
  const keylines = new THREE.InstancedMesh(SHARED.keyline.clone(), basic(0xffffff), pads.length);
  const frames = new THREE.InstancedMesh(SHARED.frame.clone(), basic(0xffffff), pads.length);
  group.add(keylines, frames);

  const modes: (PulseFieldMode | null)[] = pads.map(() => null);
  const matrix = new THREE.Matrix4(), color = new THREE.Color();
  const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
  function setMode(index: number, mode: PulseFieldMode) {
    if (modes[index] === mode) return false;
    modes[index] = mode;
    const pad = pads[index], shown = mode !== 'hidden';
    if (shown) matrix.makeTranslation(pad.x + 0.5, 0, pad.y + 0.5);
    for (const mesh of [keylines, frames]) mesh.setMatrixAt(index, shown ? matrix : HIDDEN);
    keylines.setColorAt(index, color.setHex(FRAME_KEYLINE));
    frames.setColorAt(index, color.setHex(mode === 'dormant' ? DORMANT_FRAME : explosionStyle(pad).frame));
    for (const mesh of [keylines, frames]) {
      mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor!.needsUpdate = true;
    }
    return true;
  }
  pads.forEach((_, index) => setMode(index, 'active'));
  // Culling bounds come from the full field; hidden instances only shrink inside them.
  for (const mesh of [keylines, frames]) mesh.computeBoundingSphere();
  const dispose = () => {
    for (const mesh of [keylines, frames]) { mesh.geometry.dispose(); mesh.material.dispose(); }
  };
  return { group, keylines, frames, setMode, dispose };
}

export type PulseField = ReturnType<typeof createPulseField>;

export const SAW_HALO_SIZE = 1;
const SAW_COLOR = 0xfa7298;

/** Blade and teeth share one material so the saw stays a single readable silhouette. */
export function createSawBlade() {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: 0xff80a0, emissive: 0xe63764, emissiveIntensity: 1,
    metalness: 0.6, roughness: 0.25 });
  const blade = new THREE.Mesh(new THREE.CylinderGeometry(RULES.sawRadius, RULES.sawRadius, 0.14, 12), material);
  blade.position.y = 0.24; group.add(blade);
  const toothGeometry = new THREE.ConeGeometry(0.11, 0.22, 3);
  for (let i = 0; i < 8; i++) {
    const tooth = new THREE.Mesh(toothGeometry, material), angle = i * Math.PI / 4;
    tooth.position.set(Math.cos(angle) * 0.31, 0.24, Math.sin(angle) * 0.31);
    tooth.rotation.set(0, -angle, Math.PI / 2); group.add(tooth);
  }
  return group;
}

/** Flush groove along the patrol with a bright centre line and caps at both turnarounds. */
export function createSawPath(from: Point, to: Point) {
  const group = new THREE.Group();
  group.name = 'saw-path';
  const a = [from.x + 0.5, 0, from.y + 0.5], b = [to.x + 0.5, 0, to.y + 0.5];
  const segment = (y: number) => [a[0], y, a[2], b[0], y, b[2]];
  const groove = new THREE.Mesh(createStrokeGeometry(segment(0.006), 0.09),
    new THREE.MeshBasicMaterial({ color: 0x4a1428, transparent: true, opacity: 0.85, depthWrite: false }));
  const centre = new THREE.Mesh(createStrokeGeometry(segment(0.008), 0.022),
    new THREE.MeshBasicMaterial({ color: SAW_COLOR, transparent: true, opacity: 0.65, depthWrite: false }));
  group.add(groove, centre);
  const capGeometry = new THREE.CircleGeometry(0.1, 20).rotateX(-Math.PI / 2);
  const capMaterial = new THREE.MeshBasicMaterial({ color: SAW_COLOR, transparent: true, opacity: 0.8, depthWrite: false });
  for (const end of [a, b]) {
    const cap = new THREE.Mesh(capGeometry, capMaterial);
    cap.name = 'saw-cap'; cap.position.set(end[0], 0.01, end[2]); group.add(cap);
  }
  return group;
}
