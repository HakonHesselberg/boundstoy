import * as THREE from 'three';
import { RULES, GROUND_COLORS, GROUND_WARNING_COLORS } from '../data/terrain.ts';
import type { Pulse } from '../core/level.ts';
import { hazardSample } from '../core/simulation.ts';
import type { Point } from '../core/level.ts';
import { createFrameGeometry, createStrokeGeometry } from './stroke-visuals.ts';

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
// shape how idle, charge-up, flash and harmless aftermath read on screen.
const PILOT_RADIUS = 0.085;
const PILOT_IDLE = 0xe8a94c;
const PILOT_HOT = 0xfff7e6;
const OUTLINE_IDLE = 0xb4874a;
// Inactive-section pads: still a recognisable footprint, but neutral so only
// the running puzzle carries amber on screen.
const PILOT_DORMANT = 0x6f7d88;
const OUTLINE_DORMANT = 0x66737d;
const PILOT_Y = 0.022;
const OUTLINE_Y = 0.021;
/** World-unit footprint band: about 1 px at desktop world scale, wider when closer. */
const OUTLINE_WIDTH = 0.03;
// Keeps the raised band inside the plate's projected footprint at the camera tilt.
const OUTLINE_INSET = 0.004;
const FUSE_WIDTH = 0.07;
const FUSE_SEGMENTS_PER_SIDE = 9;
const FUSE_INSET = 0.012;
const PREFLASH_TICKS = 4;
const GLOW_WARNING_START = 0.15;
const GLOW_CHARGE = 1.05;
const GLOW_PREFLASH = 1.9;
const FLASH_INSET = 0.012;
const AFTERMATH_COOL_TICKS = 8;
const WARM = new THREE.Color(0xffd27a);
const COOL = new THREE.Color(0x9fc2dc);
const CHARGE_EMISSIVE = new THREE.Color(0xff7a1e);
const PREFLASH_EMISSIVE = new THREE.Color(0xffd29a);
const PILOT_IDLE_COLOR = new THREE.Color(PILOT_IDLE);
const PILOT_HOT_COLOR = new THREE.Color(PILOT_HOT);

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/** Clockwise band around the pad edge; drawRange reveals it like a burning fuse. */
function fuseGeometry() {
  const outer = RULES.pulseRadius - FUSE_INSET, inner = outer - FUSE_WIDTH;
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const positions: number[] = [];
  for (let side = 0; side < 4; side++) {
    const [ax, az] = corners[side], [bx, bz] = corners[(side + 1) % 4];
    for (let i = 0; i < FUSE_SEGMENTS_PER_SIDE; i++) {
      const s0 = i / FUSE_SEGMENTS_PER_SIDE, s1 = (i + 1) / FUSE_SEGMENTS_PER_SIDE;
      const point = (s: number, r: number) => [(ax + (bx - ax) * s) * r, 0, (az + (bz - az) * s) * r];
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
  plate: new THREE.BoxGeometry(RULES.pulseRadius * 2, 0.02, RULES.pulseRadius * 2),
  outline: createFrameGeometry(RULES.pulseRadius - OUTLINE_INSET, OUTLINE_WIDTH),
  pilot: new THREE.CircleGeometry(PILOT_RADIUS, 20),
  flash: new THREE.PlaneGeometry(RULES.pulseRadius * 2 - 2 * FLASH_INSET, RULES.pulseRadius * 2 - 2 * FLASH_INSET),
  wave: new THREE.TorusGeometry(0.32, 0.02, 6, 24),
  spark: new THREE.ConeGeometry(0.035, 0.12, 4),
});

export function createPulse() {
  const group = new THREE.Group();
  const plate = new THREE.Mesh(SHARED.plate,
    new THREE.MeshStandardMaterial({ color: GROUND_COLORS[0], emissive: CHARGE_EMISSIVE, emissiveIntensity: 0,
      roughness: 0.65, metalness: 0.15 }));
  plate.position.y = 0.01; group.add(plate);
  const outline = new THREE.Mesh(SHARED.outline, new THREE.MeshBasicMaterial({ color: OUTLINE_IDLE, toneMapped: false }));
  outline.position.y = OUTLINE_Y; group.add(outline);
  const pilot = new THREE.Mesh(SHARED.pilot, new THREE.MeshBasicMaterial({ color: PILOT_IDLE, toneMapped: false }));
  pilot.rotation.x = -Math.PI / 2; pilot.position.y = PILOT_Y; group.add(pilot);

  const warning = new THREE.Group();
  const fuse = new THREE.Mesh(fuseGeometry(), new THREE.MeshBasicMaterial({ color: 0xffc454, toneMapped: false, side: THREE.DoubleSide }));
  fuse.position.y = 0.023; warning.add(fuse);
  group.add(warning);

  const burst = new THREE.Group();
  const flash = new THREE.Mesh(SHARED.flash,
    new THREE.MeshBasicMaterial({ color: 0xfff1c4, transparent: true, depthWrite: false, toneMapped: false }));
  flash.rotation.x = -Math.PI / 2; flash.position.y = 0.024; burst.add(flash);
  const wave = new THREE.Mesh(SHARED.wave,
    new THREE.MeshBasicMaterial({ color: WARM, transparent: true, depthWrite: false, toneMapped: false }));
  wave.rotation.x = -Math.PI / 2; wave.position.y = 0.05; burst.add(wave);
  const sparks = new THREE.Group();
  const sparkMaterial = new THREE.MeshBasicMaterial({ color: WARM, transparent: true, depthWrite: false, toneMapped: false });
  for (let i = 0; i < 4; i++) sparks.add(new THREE.Mesh(SHARED.spark, sparkMaterial));
  burst.add(sparks); group.add(burst);
  return { group, plate, outline, pilot, warning, fuse, burst, flash, wave, sparks, sparkMaterial };
}

export type PulseView = ReturnType<typeof createPulse>;

export function updatePulse(view: PulseView, hazard: Pulse, tick: number, reducedMotion: boolean, enabled = true) {
  const sampled = hazardSample(hazard, tick);
  // A dormant pad is a static identifier, not an idle sample at local tick 0.
  const sample = enabled ? sampled : { ...sampled, active: false, warning: false, cycle: RULES.pulseEffectTicks };
  const cycle = sample.cycle;
  // 1/27 on the first warning tick, exactly 1 on the last: the fuse completes before ignition.
  const charge = sample.warning ? (cycle - hazard.period + RULES.pulseWarningTicks + 1) / RULES.pulseWarningTicks : 0;
  const preflash = sample.warning && cycle >= hazard.period - PREFLASH_TICKS;
  const age = Math.min(cycle / RULES.pulseEffectTicks, 1);
  const flashing = cycle < RULES.pulseFlashTicks;
  const parity = (hazard.x + hazard.y) % 2;

  view.plate.material.color.setHex(sample.active ? 0xff551e
    : sample.warning ? GROUND_WARNING_COLORS[parity] : GROUND_COLORS[parity]);
  view.plate.material.emissive.copy(preflash || sample.active ? PREFLASH_EMISSIVE : CHARGE_EMISSIVE);
  view.plate.material.emissiveIntensity = sample.active ? GLOW_PREFLASH + 0.4
    : preflash ? GLOW_PREFLASH + (charge - 1) * 0.5
      : sample.warning ? GLOW_WARNING_START + GLOW_CHARGE * charge ** 2 : 0;
  view.outline.material.color.setHex(sample.active ? 0xffefbd : sample.warning ? 0xffc454 : enabled ? OUTLINE_IDLE : OUTLINE_DORMANT);

  // Anticipation: the fuse runs clockwise, the pilot swells and turns white-hot.
  view.warning.visible = sample.warning;
  const segments = view.fuse.geometry.getAttribute('position').count / 6;
  view.fuse.geometry.setDrawRange(0, Math.ceil(charge * segments) * 6);
  view.pilot.visible = !flashing;
  view.outline.visible = !flashing;
  if (enabled) view.pilot.material.color.lerpColors(PILOT_IDLE_COLOR, PILOT_HOT_COLOR, preflash ? 1 : charge ** 2 * 0.7);
  else view.pilot.material.color.setHex(PILOT_DORMANT);
  view.pilot.scale.setScalar(reducedMotion ? 1 : 1 + 0.6 * charge ** 2);

  // Sample time since ignition so a rendered frame need not land on the lethal tick.
  view.burst.visible = cycle < RULES.pulseEffectTicks;
  view.flash.visible = flashing;
  view.flash.material.opacity = Math.sqrt(Math.max(1 - cycle / RULES.pulseFlashTicks, 0));
  // Follow-through: debris cools from warm to grey-blue so it reads as spent, not fire.
  const cooled = Math.min(cycle / AFTERMATH_COOL_TICKS, 1);
  view.wave.material.color.lerpColors(WARM, COOL, cooled);
  view.sparkMaterial.color.copy(view.wave.material.color);
  view.wave.scale.setScalar(reducedMotion ? 1 : 0.5 + easeOutCubic(age) * 0.55);
  view.wave.material.opacity = 0.75 * (1 - age) ** 1.5 * (1 - 0.35 * cooled);
  view.sparks.visible = !reducedMotion;
  view.sparkMaterial.opacity = 0.9 * (1 - age) ** 2;
  view.sparks.children.forEach((spark, index) => {
    const flight = reducedMotion ? 0 : easeOutCubic(age);
    const angle = index * Math.PI * 2 / view.sparks.children.length;
    const radius = 0.08 + flight * 0.18;
    spark.position.set(Math.cos(angle) * radius, 0.06 + 4 * flight * (1 - flight) * 0.12,
      Math.sin(angle) * radius);
    spark.rotation.set(Math.sin(angle) * 0.5, angle, -Math.cos(angle) * 0.5);
    spark.scale.setScalar(1 - age);
  });
}

/** Which renderer owns a pad this frame: the shared idle field, or its own live view. */
export type PulseFieldMode = 'active' | 'dormant' | 'hidden';
export function pulseFieldMode(sample: ReturnType<typeof hazardSample>, enabled: boolean): PulseFieldMode {
  if (!enabled) return 'dormant';
  return sample.warning || sample.cycle < RULES.pulseEffectTicks ? 'hidden' : 'active';
}

/**
 * Idle pads in three batched draws (plates, pilots, outlines). A pad hands
 * over to its per-pad `PulseView` only while charging or bursting, so the
 * colours here must equal the view's idle/dormant state exactly.
 */
export function createPulseField(pads: readonly Readonly<{ x: number; y: number }>[]) {
  const group = new THREE.Group();
  group.name = 'pulse-field';
  const plateGeometry = new THREE.BoxGeometry(RULES.pulseRadius * 2, 0.02, RULES.pulseRadius * 2).translate(0, 0.01, 0);
  const plates = new THREE.InstancedMesh(plateGeometry,
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.65, metalness: 0.15 }), pads.length);
  const pilotGeometry = new THREE.CircleGeometry(PILOT_RADIUS, 20).rotateX(-Math.PI / 2).translate(0, PILOT_Y, 0);
  const pilots = new THREE.InstancedMesh(pilotGeometry,
    new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), pads.length);
  const outlines = new THREE.InstancedMesh(createFrameGeometry(RULES.pulseRadius - OUTLINE_INSET, OUTLINE_WIDTH).translate(0, OUTLINE_Y, 0),
    new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), pads.length);
  group.add(plates, outlines, pilots);

  const modes: (PulseFieldMode | null)[] = pads.map(() => null);
  const matrix = new THREE.Matrix4(), color = new THREE.Color();
  const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
  function setMode(index: number, mode: PulseFieldMode) {
    if (modes[index] === mode) return false;
    modes[index] = mode;
    const pad = pads[index], x = pad.x + 0.5, z = pad.y + 0.5;
    const shown = mode !== 'hidden';
    if (shown) matrix.makeTranslation(x, 0, z);
    for (const mesh of [plates, pilots, outlines]) mesh.setMatrixAt(index, shown ? matrix : HIDDEN);
    plates.setColorAt(index, color.setHex(GROUND_COLORS[(pad.x + pad.y) % 2]));
    pilots.setColorAt(index, color.setHex(mode === 'dormant' ? PILOT_DORMANT : PILOT_IDLE));
    outlines.setColorAt(index, color.setHex(mode === 'dormant' ? OUTLINE_DORMANT : OUTLINE_IDLE));
    for (const mesh of [plates, pilots, outlines]) {
      mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor!.needsUpdate = true;
    }
    return true;
  }
  pads.forEach((_, index) => setMode(index, 'active'));
  // Culling bounds come from the full field; hidden instances only shrink inside them.
  for (const mesh of [plates, pilots, outlines]) mesh.computeBoundingSphere();

  const outlineColor = (index: number) => {
    const value = new THREE.Color();
    outlines.getColorAt(index, value);
    return value;
  };
  /** Drawn perimeter of a pad's outline band; 0 while its live view owns the pad. */
  const outlineLength = (index: number) => {
    outlines.getMatrixAt(index, matrix);
    return 8 * (RULES.pulseRadius - OUTLINE_INSET) * new THREE.Vector3().setFromMatrixColumn(matrix, 0).length();
  };
  const dispose = () => {
    for (const object of [plates, pilots, outlines]) {
      object.geometry.dispose(); (object.material as THREE.Material).dispose();
    }
  };
  return { group, plates, pilots, outlines, setMode, outlineColor, outlineLength, dispose };
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
