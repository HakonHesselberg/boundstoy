import * as THREE from 'three';
import type { Point } from '../core/level.ts';

const PEBBLES_PER_CELL = 4;
const PEBBLE_RADIUS = 0.055;
const PEBBLE_COLOR = 0x6e4a31;

/** Stable 0..1 value per cell and pebble; scatter never changes between builds. */
function scatter(x: number, y: number, k: number) {
  const value = Math.sin(x * 127.1 + y * 311.7 + k * 74.7) * 43758.5453;
  return value - Math.floor(value);
}

/** Flat, darker pebbles give mud a texture that reads as "slow ground" at a glance. */
export function createMudPebbles(cells: readonly Point[]) {
  const geometry = new THREE.CircleGeometry(PEBBLE_RADIUS, 7).rotateX(-Math.PI / 2);
  const material = new THREE.MeshStandardMaterial({ color: PEBBLE_COLOR, roughness: 0.95, metalness: 0 });
  const pebbles = new THREE.InstancedMesh(geometry, material, cells.length * PEBBLES_PER_CELL);
  pebbles.receiveShadow = true;
  const place = new THREE.Object3D();
  cells.forEach(({ x, y }, cell) => {
    for (let k = 0; k < PEBBLES_PER_CELL; k++) {
      // One pebble per quadrant keeps the scatter even inside the tile.
      const qx = k % 2, qy = Math.floor(k / 2);
      place.position.set(x + 0.2 + qx * 0.33 + scatter(x, y, k) * 0.27,
        0.004, y + 0.2 + qy * 0.33 + scatter(y, x, k + 9) * 0.27);
      place.rotation.set(0, scatter(x, y, k + 17) * Math.PI, 0);
      place.scale.setScalar(0.7 + scatter(x, y, k + 31) * 0.6);
      place.updateMatrix();
      pebbles.setMatrixAt(cell * PEBBLES_PER_CELL + k, place.matrix);
    }
  });
  pebbles.instanceMatrix.needsUpdate = true;
  return pebbles;
}

const FLOOR_TEXELS = 64;
const FLOOR_LINE = 2;

/** White tile with a hairline border; instance colour tints it, so one texture serves every surface. */
export function createFloorTexture(createCanvas: () => HTMLCanvasElement = () => document.createElement('canvas')) {
  const canvas = createCanvas(), size = FLOOR_TEXELS;
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is required for floor tiles.');
  context.fillStyle = '#ffffff'; context.fillRect(0, 0, size, size);
  // Half the line on each tile edge: neighbours combine into one hairline seam.
  const half = FLOOR_LINE / 2;
  context.fillStyle = '#b3bcc4';
  context.fillRect(0, 0, size, half); context.fillRect(0, size - half, size, half);
  context.fillRect(0, 0, half, size); context.fillRect(size - half, 0, half, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
