import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);

/**
 * Quads for `[ax, ay, az, bx, by, bz, ...]` segment pairs. Unlike GL lines
 * (always 1 device pixel), strokes have a world-unit width that scales with
 * the camera. Square caps close polyline joints. Flat strokes lie on the
 * segment's height; vertical strokes stand on a side face.
 */
export function createStrokeGeometry(segments: readonly number[], width: number, vertical = false) {
  const positions: number[] = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), along = new THREE.Vector3(), side = new THREE.Vector3();
  for (let i = 0; i + 5 < segments.length; i += 6) {
    a.fromArray(segments, i); b.fromArray(segments, i + 3);
    along.subVectors(b, a);
    if (along.lengthSq() === 0) continue;
    along.normalize().multiplyScalar(width / 2);
    if (vertical) side.set(0, width / 2, 0);
    else side.crossVectors(UP, along).normalize().multiplyScalar(width / 2);
    const start = a.clone().sub(along), end = b.clone().add(along);
    const corners = [start.clone().sub(side), start.clone().add(side), end.clone().add(side), end.clone().sub(side)];
    for (const k of [0, 2, 1, 0, 3, 2]) positions.push(...corners[k].toArray());
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

/** Flat square band from `outer` inward by `width`, centred on the origin at y = 0. */
export function createFrameGeometry(outer: number, width: number) {
  const inner = outer - width, positions: number[] = [];
  const quad = (x0: number, z0: number, x1: number, z1: number) => {
    for (const [x, z] of [[x0, z0], [x0, z1], [x1, z1], [x0, z0], [x1, z1], [x1, z0]]) positions.push(x, 0, z);
  };
  quad(-outer, -outer, outer, -inner);
  quad(-outer, inner, outer, outer);
  quad(-outer, -inner, -inner, inner);
  quad(inner, -inner, outer, inner);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}
