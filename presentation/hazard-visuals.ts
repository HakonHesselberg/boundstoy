import * as THREE from 'three';
import { RULES, GROUND_COLORS, GROUND_WARNING_COLORS } from '../data/terrain.ts';
import type { Pulse } from '../core/level.ts';
import { hazardSample } from '../core/simulation.ts';

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

export function createPulse() {
  const group = new THREE.Group();
  const plate = new THREE.Mesh(new THREE.BoxGeometry(RULES.pulseRadius * 2, 0.07, RULES.pulseRadius * 2),
    new THREE.MeshStandardMaterial({ color: 0x251b2c, emissive: 0x341527, emissiveIntensity: 0.15, roughness: 0.55 }));
  plate.position.y = 0.06; group.add(plate);
  const outline = new THREE.LineSegments(new THREE.EdgesGeometry(plate.geometry),
    new THREE.LineBasicMaterial({ color: 0xad617d }));
  outline.position.copy(plate.position); group.add(outline);
  const warning = new THREE.Group();
  const warningMaterial = new THREE.MeshBasicMaterial({ color: 0xffc454, toneMapped: false });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.035, 6, 24), warningMaterial);
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.19; warning.add(ring);
  for (const x of [-0.27, 0.27]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.22, 0.035), warningMaterial);
    bar.position.set(x, 0.2, 0); warning.add(bar);
  }
  group.add(warning);
  const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.23, 0.055, 8),
    new THREE.MeshStandardMaterial({ color: 0x6b3e52, metalness: 0.6, roughness: 0.4 }));
  vent.position.y = 0.12; group.add(vent);

  const burst = new THREE.Group();
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 1),
    new THREE.MeshBasicMaterial({ color: 0xfff1ad, transparent: true, depthWrite: false, toneMapped: false }));
  core.position.y = 0.4; burst.add(core);
  const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 0),
    new THREE.MeshBasicMaterial({ color: 0xff692d, transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false }));
  shell.position.y = 0.42; burst.add(shell);
  const wave = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.045, 6, 24),
    new THREE.MeshBasicMaterial({ color: 0xffdb6a, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }));
  wave.rotation.x = -Math.PI / 2; wave.position.y = 0.12; burst.add(wave);
  const sparks = new THREE.Group();
  const sparkGeometry = new THREE.ConeGeometry(0.065, 0.32, 4);
  const sparkMaterial = new THREE.MeshBasicMaterial({ color: 0xffd878, transparent: true, depthWrite: false, toneMapped: false });
  for (let i = 0; i < 8; i++) sparks.add(new THREE.Mesh(sparkGeometry, sparkMaterial));
  burst.add(sparks); group.add(burst);
  return { group, plate, outline, warning, ring, burst, core, shell, wave, sparks, sparkMaterial };
}

export type PulseView = ReturnType<typeof createPulse>;

export function updatePulse(view: PulseView, hazard: Pulse, tick: number, reducedMotion: boolean) {
  const sample = hazardSample(hazard, tick);
  const cycle = sample.cycle;
  const charge = sample.warning ? (cycle - hazard.period + RULES.pulseWarningTicks) / RULES.pulseWarningTicks : 0;
  const age = Math.min(cycle / RULES.pulseEffectTicks, 1);
  const flash = Math.max(1 - cycle / RULES.pulseFlashTicks, 0);
  view.warning.visible = sample.warning;
  // Sample time since ignition so a rendered frame need not land on the lethal tick.
  view.burst.visible = cycle < RULES.pulseEffectTicks;
  const parity = (hazard.x + hazard.y) % 2;
  view.plate.material.color.setHex(sample.active ? 0xff551e
    : sample.warning ? GROUND_WARNING_COLORS[parity] : GROUND_COLORS[parity]);
  view.plate.material.emissive.setHex(sample.active ? 0xff4114 : sample.warning ? 0xaa4313 : 0x000000);
  view.plate.material.emissiveIntensity = sample.active ? 1.6 : sample.warning ? 0.3 + charge * 0.4 : 0.15;
  view.outline.material.color.setHex(sample.active ? 0xffefbd : sample.warning ? 0xffc454 : 0xad617d);
  view.ring.scale.setScalar(reducedMotion ? 1 : 1 - charge * 0.6);
  view.sparks.visible = !reducedMotion;
  view.core.visible = flash > 0;
  view.core.material.opacity = flash * (reducedMotion ? 0.6 : 1);
  view.core.scale.setScalar(reducedMotion ? 1 : 0.7 + (1 - flash) * 0.6);
  view.shell.scale.setScalar(reducedMotion ? 1 : 0.6 + age * 0.8);
  view.shell.position.y = reducedMotion ? 0.42 : 0.42 + age * 0.3;
  view.shell.material.color.setHex(flash > 0 ? 0xff692d : 0x9aaab4);
  view.shell.material.opacity = (1 - age) ** 2 * 0.4;
  view.wave.scale.setScalar(reducedMotion ? 1 : 0.5 + age * 0.9);
  view.wave.material.opacity = (1 - age) * 0.9;
  view.sparkMaterial.opacity = (1 - age) ** 2;
  view.sparks.children.forEach((spark, index) => {
    const flight = reducedMotion ? 0 : age;
    const angle = index * Math.PI / 4;
    const radius = 0.12 + flight * 0.43;
    spark.position.set(Math.cos(angle) * radius, 0.15 + 4 * flight * (1 - flight) * (0.6 + index % 3 * 0.15),
      Math.sin(angle) * radius);
    spark.rotation.set(Math.sin(angle) * 0.5, angle, -Math.cos(angle) * 0.5);
    spark.scale.setScalar(1 - flight);
  });
}
