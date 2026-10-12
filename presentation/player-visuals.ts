import * as THREE from 'three';

/** Visor (0.34 tiles) must span about 14 px to read; below that, show a clean silhouette. */
export const PLAYER_DETAIL_MIN_PPU = 14 / 0.34;
export const playerDetailsVisible = (pixelsPerUnit: number) => pixelsPerUnit >= PLAYER_DETAIL_MIN_PPU;

/** The robot, its rigid footprint ring and the heading cue; Scene animates them. */
export function createPlayerModel() {
  const rig = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.23, 0.12, 5, 12),
    new THREE.MeshStandardMaterial({ color: 0xecfaff, roughness: 0.22, metalness: 0.25 }));
  body.position.y = 0.37; body.castShadow = true; rig.add(body);
  const details = new THREE.Group();
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.085),
    new THREE.MeshStandardMaterial({ color: 0x081a29, roughness: 0.2 }));
  visor.position.set(0, 0.41, 0.2); details.add(visor);
  const eyeGeometry = new THREE.SphereGeometry(0.031, 8, 6), eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x6bffe0 });
  for (const x of [-0.09, 0.09]) {
    const eye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    eye.position.set(x, 0.415, 0.25); details.add(eye);
  }
  rig.add(details);
  const antenna = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd28e }));
  antenna.position.set(0, 0.72, 0); rig.add(antenna);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.034, 6, 40),
    new THREE.MeshBasicMaterial({ color: 0x9dfff0, toneMapped: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.07;

  const headingArrow = new THREE.Group();
  const arrowShape = new THREE.Shape();
  arrowShape.moveTo(-0.12, 0); arrowShape.lineTo(0, -0.24); arrowShape.lineTo(0.12, 0); arrowShape.closePath();
  const arrowGeometry = new THREE.ShapeGeometry(arrowShape); arrowGeometry.rotateX(-Math.PI / 2);
  const arrowMaterial = new THREE.MeshBasicMaterial({ color: 0xc4fff0, transparent: true, opacity: 0.95,
    side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
  const tip = new THREE.Mesh(arrowGeometry, arrowMaterial); tip.position.z = 0.62; headingArrow.add(tip);
  const stem = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.014, 0.24), arrowMaterial);
  stem.position.z = 0.52; headingArrow.add(stem);
  headingArrow.scale.setScalar(1.25);
  return { rig, details, antenna, ring, headingArrow };
}
