import * as THREE from 'three';
import { RULES } from '../data/terrain.ts';
import { DEFAULT_EXPLOSION_STYLE, DORMANT_FRAME, EXPLOSION_STYLES, explosionStyle,
  type ExplosionMotif, type ExplosionStyleDefinition, type ExplosionStyleId } from '../data/explosion-styles.ts';
import { GLOW_TEXTURES } from './glow-textures.ts';
import type { Pulse } from '../core/level.ts';
import { hazardSample } from '../core/simulation.ts';
import type { Point } from '../core/level.ts';
import { createStrokeGeometry } from './stroke-visuals.ts';

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
// Idle identity: a thin rounded groove with a soft inner glow; the floor stays visible.
const GROOVE = Object.freeze({ outer: R - 0.03, width: 0.028, radius: 0.09, y: 0.008 });
const EDGE_GLOW = Object.freeze({ half: R - 0.03, y: 0.01, opacity: 0.55, dormant: 0x2c3338 });
const FUSE_Y = 0.01;
const SPARK = Object.freeze({ size: 0.044, y: 0.014, pulse: 0.25 });
const TINT = Object.freeze({ half: R - 0.03, y: 0.012, start: 0.06, rise: 0.44 });
const FLASH = Object.freeze({ inset: 0.012, y: 0.014, holdTicks: 2, floor: 0.4 });
const SCORCH = Object.freeze({ half: R - 0.01, y: 0.004, opacity: 0.7, fromTick: 2 });
const GLOW = Object.freeze({ half: 0.38, y: 0.016, ticks: 14 });
const WAVE = Object.freeze({ half: 0.32, y: 0.02, from: 0.4, to: 1.2, ticks: 14 });
const MOTIF = Object.freeze({ peakTick: 4, ticks: 16 });
const EMBERS = Object.freeze({ count: 6, size: 0.026, from: 0.08, to: 0.26, lift: 0.16, coolTicks: 14 });
/** Highest point any burst motif reaches; a column at the tile centre stays inside the projection. */
export const PULSE_BURST_PEAK_HEIGHT = 0.5;

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
const easeInCubic = (t: number) => t ** 3;
const flatPlane = (half: number, y: number) =>
  new THREE.PlaneGeometry(half * 2, half * 2).rotateX(-Math.PI / 2).translate(0, y, 0);
const apexUp = (geometry: THREE.BufferGeometry, height: number) => geometry.translate(0, height / 2, 0);

/** Clockwise centreline of a rounded square, with outward normals and cumulative length. */
function roundedPath(half: number, radius: number, perCorner = 6, perSide = 4) {
  const points: { x: number; z: number; nx: number; nz: number }[] = [];
  const inner = half - radius;
  // Corner centres and start angles walk clockwise from the far-left corner (screen top-left).
  const corners = [[inner, -inner, -Math.PI / 2], [inner, inner, 0], [-inner, inner, Math.PI / 2], [-inner, -inner, Math.PI]] as const;
  corners.forEach(([cx, cz, start], index) => {
    const [px, pz, previous] = corners[(index + 3) % 4];
    const from = { x: px + radius * Math.cos(previous + Math.PI / 2), z: pz + radius * Math.sin(previous + Math.PI / 2) };
    const to = { x: cx + radius * Math.cos(start), z: cz + radius * Math.sin(start) };
    for (let i = 0; i < perSide; i++) {
      const t = i / perSide;
      points.push({ x: from.x + (to.x - from.x) * t, z: from.z + (to.z - from.z) * t, nx: Math.cos(start), nz: Math.sin(start) });
    }
    for (let i = 0; i < perCorner; i++) {
      const angle = start + i / perCorner * Math.PI / 2;
      points.push({ x: cx + radius * Math.cos(angle), z: cz + radius * Math.sin(angle), nx: Math.cos(angle), nz: Math.sin(angle) });
    }
  });
  points.push(points[0]);
  const lengths = [0];
  for (let i = 1; i < points.length; i++)
    lengths.push(lengths[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z));
  return { points, lengths };
}
const GROOVE_PATH = roundedPath(GROOVE.outer - GROOVE.width / 2, GROOVE.radius - GROOVE.width / 2);

/** Ribbon along the groove path, one quad per path step in clockwise order (drawRange reveals it). */
function grooveRibbon(y: number) {
  const { points } = GROOVE_PATH, w = GROOVE.width / 2, positions: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const [ao, ai, bo, bi] = [[a, w], [a, -w], [b, w], [b, -w]].map(([p, d]) => {
      const q = p as typeof a, offset = d as number;
      return [q.x + q.nx * offset, y, q.z + q.nz * offset];
    });
    positions.push(...ao, ...ai, ...bo, ...bo, ...ai, ...bi);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}
function grooveAt(fraction: number) {
  const { points, lengths } = GROOVE_PATH, target = fraction * lengths.at(-1)!;
  let i = 1;
  while (i < lengths.length - 1 && lengths[i] < target) i++;
  const span = lengths[i] - lengths[i - 1], t = span ? (target - lengths[i - 1]) / span : 0;
  return { x: points[i - 1].x + (points[i].x - points[i - 1].x) * t, z: points[i - 1].z + (points[i].z - points[i - 1].z) * t };
}

type Gradient = (position: THREE.Vector3) => number;
const GRADIENT_FLOOR = 0.25;
/** Per-vertex colour from the style's white-hot core (t = 0) to its burst colour (t = 1). */
function gradientGeometry(geometry: THREE.BufferGeometry, style: ExplosionStyleDefinition, along: Gradient) {
  const positions = geometry.getAttribute('position'), colors: number[] = [];
  const core = new THREE.Color(style.core), burst = new THREE.Color(style.burst), color = new THREE.Color(), v = new THREE.Vector3();
  for (let i = 0; i < positions.count; i++) {
    // Only the innermost part reaches white-hot; most of the shape keeps a saturated style colour.
    const t = Math.min(Math.max(along(v.fromBufferAttribute(positions, i)), 0), 1);
    color.lerpColors(core, burst, GRADIENT_FLOOR + (1 - GRADIENT_FLOOR) * Math.sqrt(t));
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

// Static pad geometry is uploaded once and shared by every pad view; colours
// and the fuse draw range stay per pad.
const SHARED = Object.freeze({
  footprint: new THREE.PlaneGeometry(R * 2, R * 2).rotateX(-Math.PI / 2),
  groove: grooveRibbon(GROOVE.y),
  edgeGlow: flatPlane(EDGE_GLOW.half, EDGE_GLOW.y),
  spark: flatPlane(SPARK.size / 2, 0),
  tint: flatPlane(TINT.half, TINT.y),
  flash: flatPlane(R - FLASH.inset, FLASH.y),
  scorch: flatPlane(SCORCH.half, SCORCH.y),
  glow: flatPlane(GLOW.half, GLOW.y),
  wave: flatPlane(WAVE.half, WAVE.y),
  ember: new THREE.SphereGeometry(EMBERS.size, 10, 6),
});

type Part = Readonly<{ shape: string; position: readonly [number, number, number];
  tilt?: readonly [number, number]; scale?: number }>;
const ring = (count: number, make: (angle: number, index: number) => Part) =>
  Array.from({ length: count }, (_, i) => make(i * Math.PI * 2 / count, i));
const PETAL = 0.26, PUFF = 0.12;
/** Smooth shapes with a colour gradient: hot at the core and base, style colour at the tips. */
const SHAPES: Readonly<Record<string, () => [THREE.BufferGeometry, Gradient]>> = Object.freeze({
  column: () => [apexUp(new THREE.ConeGeometry(0.08, PULSE_BURST_PEAK_HEIGHT, 16, 6), PULSE_BURST_PEAK_HEIGHT),
    v => (v.y / PULSE_BURST_PEAK_HEIGHT) ** 0.8],
  petal: () => [apexUp(new THREE.ConeGeometry(0.07, PETAL, 12, 5), PETAL), v => v.y / PETAL],
  ring: () => [new THREE.TorusGeometry(0.22, 0.022, 10, 48).rotateX(-Math.PI / 2),
    v => (Math.hypot(v.x, v.z) - 0.198) / 0.044],
  bolt: () => [apexUp(new THREE.CylinderGeometry(0.016, 0.03, PULSE_BURST_PEAK_HEIGHT, 8, 8), PULSE_BURST_PEAK_HEIGHT),
    v => 0.3 + 0.7 * (v.y / PULSE_BURST_PEAK_HEIGHT)],
  puff: () => [new THREE.IcosahedronGeometry(PUFF, 3), v => 0.75 - 0.6 * (v.y + PUFF) / (2 * PUFF)],
  orb: () => [new THREE.SphereGeometry(0.045, 12, 8), v => 0.3 + 0.7 * (v.y + 0.045) / 0.09],
});
const MOTIFS: Readonly<Record<ExplosionMotif, readonly Part[]>> = Object.freeze({
  // Scourge-like eruption: a central flame with eight petals leaning outward.
  petals: [{ shape: 'column', position: [0, 0, 0] },
    ...ring(8, angle => ({ shape: 'petal', position: [Math.cos(angle) * 0.12, 0, Math.sin(angle) * 0.12],
      tilt: [Math.cos(angle) * 0.5, Math.sin(angle) * 0.5] }))],
  // Protoss flash: two shock rings and a crackling column of bolts.
  ring: [{ shape: 'ring', position: [0, 0.05, 0], scale: 1.4 }, { shape: 'ring', position: [0, 0.22, 0], scale: 0.9 },
    ...ring(3, angle => ({ shape: 'bolt', position: [Math.cos(angle) * 0.04, 0, Math.sin(angle) * 0.04] }))],
  // Zerg cloud: a large central puff over four smaller billows.
  cloud: [{ shape: 'puff', position: [0, 0.22, 0], scale: 1.6 },
    ...ring(4, angle => ({ shape: 'puff', position: [Math.cos(angle) * 0.17, 0.1, Math.sin(angle) * 0.17], scale: 1.2 }))],
  // Dark Archon swirl: orbs spiralling inward as they climb around a column.
  swirl: [{ shape: 'column', position: [0, 0, 0], scale: 0.9 },
    ...ring(8, (angle, i) => ({ shape: 'orb',
      position: [Math.cos(angle * 1.5) * (0.3 - 0.03 * i), 0.05 + 0.05 * i, Math.sin(angle * 1.5) * (0.3 - 0.03 * i)] }))],
});
// Gradient geometry depends on the style's colours, so it is shared per style and shape.
const shapeCache = new Map<string, THREE.BufferGeometry>();
function shapeGeometry(style: ExplosionStyleDefinition, shape: string) {
  const key = `${style.id}:${shape}`;
  let geometry = shapeCache.get(key);
  if (!geometry) {
    const [base, along] = SHAPES[shape]();
    geometry = gradientGeometry(base, style, along);
    shapeCache.set(key, geometry);
  }
  return geometry;
}

const UP = new THREE.Vector3(0, 1, 0);
function createMotif(style: ExplosionStyleDefinition, material: THREE.Material) {
  const group = new THREE.Group();
  group.name = `motif-${style.motif}`;
  for (const part of MOTIFS[style.motif]) {
    const mesh = new THREE.Mesh(shapeGeometry(style, part.shape), material);
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
const glowing = (color: number, map: THREE.Texture, extra: THREE.MeshBasicMaterialParameters = {}) =>
  fading(color, { map, blending: THREE.AdditiveBlending, ...extra });
const named = <T extends THREE.Object3D>(object: T, name: string) => { object.name = name; return object; };

export function createPulse(styleId: ExplosionStyleId = DEFAULT_EXPLOSION_STYLE) {
  const style = EXPLOSION_STYLES[styleId];
  const group = new THREE.Group();
  const footprint = named(new THREE.Mesh(SHARED.footprint, basic(0xffffff)), 'footprint');
  footprint.visible = false;
  const edgeGlow = named(new THREE.Mesh(SHARED.edgeGlow, glowing(style.frame, GLOW_TEXTURES.edge, { opacity: EDGE_GLOW.opacity })), 'edge-glow');
  const frame = named(new THREE.Mesh(SHARED.groove, basic(style.frame, { side: THREE.DoubleSide })), 'frame');
  group.add(footprint, edgeGlow, frame);

  const warning = new THREE.Group();
  const tint = named(new THREE.Mesh(SHARED.tint, fading(style.hot, { map: GLOW_TEXTURES.edge })), 'tint');
  const fuse = named(new THREE.Mesh(grooveRibbon(FUSE_Y), basic(style.core, { side: THREE.DoubleSide })), 'fuse');
  fuse.geometry.setDrawRange(0, 0);
  const spark = named(new THREE.Mesh(SHARED.spark, glowing(style.core, GLOW_TEXTURES.radial)), 'spark');
  warning.add(tint, fuse, spark); group.add(warning);

  const burst = new THREE.Group();
  const scorch = named(new THREE.Mesh(SHARED.scorch, fading(style.scorch, { map: GLOW_TEXTURES.scorch })), 'scorch');
  const glow = named(new THREE.Mesh(SHARED.glow, glowing(style.burst, GLOW_TEXTURES.radial)), 'glow');
  const flash = named(new THREE.Mesh(SHARED.flash, fading(style.core, { map: GLOW_TEXTURES.flash })), 'flash');
  const wave = named(new THREE.Mesh(SHARED.wave, glowing(style.hot, GLOW_TEXTURES.ring)), 'wave');
  const motifMaterial = fading(0xffffff, { vertexColors: true });
  const motif = createMotif(style, motifMaterial);
  const embers = new THREE.Group();
  const emberMaterial = fading(style.burst, { blending: THREE.AdditiveBlending });
  for (let i = 0; i < EMBERS.count; i++) embers.add(named(new THREE.Mesh(SHARED.ember, emberMaterial), 'ember'));
  [scorch, glow, flash, wave, motif, embers].forEach((part, order) => { part.renderOrder = order; burst.add(part); });
  group.add(burst);
  return { group, style, footprint, edgeGlow, frame, warning, tint, fuse, spark, burst, scorch, glow, flash, wave,
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

  // Identity: the groove over visible ground. It heats toward the fuse colour while charging.
  view.frame.visible = !(bursting && cycle < RULES.pulseFlashTicks);
  view.edgeGlow.visible = view.frame.visible;
  if (!enabled) {
    view.frame.material.color.setHex(DORMANT_FRAME);
    view.edgeGlow.material.color.setHex(EDGE_GLOW.dormant);
  } else {
    mix(view.frame.material.color, style.frame, style.hot, charge);
    view.edgeGlow.material.color.setHex(style.frame);
  }

  // Anticipation: a spark burns clockwise round the groove, leaving a hot trail, while an edge tint rises.
  view.warning.visible = sample.warning;
  const segments = view.fuse.geometry.getAttribute('position').count / 6;
  view.fuse.geometry.setDrawRange(0, Math.ceil(charge * segments) * 6);
  const head = grooveAt(Math.min(charge, 0.999));
  view.spark.visible = sample.warning;
  view.spark.position.set(head.x, SPARK.y, head.z);
  view.spark.scale.setScalar(reducedMotion ? 1 : 1 + SPARK.pulse * Math.sin(cycle * 1.7));
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
  const glows = new THREE.InstancedMesh(SHARED.edgeGlow.clone(),
    glowing(0xffffff, GLOW_TEXTURES.edge, { opacity: EDGE_GLOW.opacity }), pads.length);
  const frames = new THREE.InstancedMesh(SHARED.groove.clone(), basic(0xffffff, { side: THREE.DoubleSide }), pads.length);
  group.add(glows, frames);

  const modes: (PulseFieldMode | null)[] = pads.map(() => null);
  const matrix = new THREE.Matrix4(), color = new THREE.Color();
  const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
  function setMode(index: number, mode: PulseFieldMode) {
    if (modes[index] === mode) return false;
    modes[index] = mode;
    const pad = pads[index], shown = mode !== 'hidden', dormant = mode === 'dormant';
    if (shown) matrix.makeTranslation(pad.x + 0.5, 0, pad.y + 0.5);
    for (const mesh of [glows, frames]) mesh.setMatrixAt(index, shown ? matrix : HIDDEN);
    glows.setColorAt(index, color.setHex(dormant ? EDGE_GLOW.dormant : explosionStyle(pad).frame));
    frames.setColorAt(index, color.setHex(dormant ? DORMANT_FRAME : explosionStyle(pad).frame));
    for (const mesh of [glows, frames]) {
      mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor!.needsUpdate = true;
    }
    return true;
  }
  pads.forEach((_, index) => setMode(index, 'active'));
  // Culling bounds come from the full field; hidden instances only shrink inside them.
  for (const mesh of [glows, frames]) mesh.computeBoundingSphere();
  const dispose = () => {
    for (const mesh of [glows, frames]) { mesh.geometry.dispose(); mesh.material.dispose(); }
  };
  return { group, glows, frames, setMode, dispose };
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
