import * as THREE from 'three';

/**
 * Soft white masks for explosive pads, generated from data so they need no DOM
 * and survive context loss. Materials tint them; linear filtering and mipmaps
 * keep every edge smooth at any zoom.
 */
const SIZE = 64;
const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

/** Signed distance from (x, y) to a rounded square of half-size `half` and corner `radius`. */
export function roundedRectDistance(x: number, y: number, half: number, radius: number) {
  const qx = Math.abs(x) - half + radius, qy = Math.abs(y) - half + radius;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
}

function mask(alpha: (x: number, y: number) => number) {
  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let row = 0; row < SIZE; row++) for (let column = 0; column < SIZE; column++) {
    // Centre of each texel in [-1, 1].
    const x = (column + 0.5) / SIZE * 2 - 1, y = (row + 0.5) / SIZE * 2 - 1, at = (row * SIZE + column) * 4;
    data.set([255, 255, 255, Math.round(255 * Math.min(Math.max(alpha(x, y), 0), 1))], at);
  }
  const texture = new THREE.DataTexture(data, SIZE, SIZE, THREE.RGBAFormat);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

/** Corner radius of pad shapes, as a fraction of the half-size. */
export const PAD_CORNER = 0.22;
export const GLOW_TEXTURES = Object.freeze({
  radial: mask((x, y) => (1 - smoothstep(0, 1, Math.hypot(x, y))) ** 1.4),
  // Bright just inside the rounded rim, fading inward; clear centre and corners.
  edge: mask((x, y) => {
    const d = roundedRectDistance(x, y, 0.97, PAD_CORNER);
    return d > 0 ? 0 : (1 - smoothstep(0, 0.45, -d)) * smoothstep(0, 0.04, -d + 0.02);
  }),
  // Opaque rounded tile with a soft rim.
  flash: mask((x, y) => {
    const d = roundedRectDistance(x, y, 0.98, PAD_CORNER);
    return d > 0 ? 0 : 0.55 + 0.45 * smoothstep(0, 0.35, -d);
  }),
  // Soft annulus peaking at 85% radius: an expanding shockwave without a hard torus edge.
  ring: mask((x, y) => Math.max(0, 1 - Math.abs(Math.hypot(x, y) - 0.85) / 0.15) ** 1.5),
  scorch: mask((x, y) => {
    const r = Math.hypot(x, y);
    return (1 - smoothstep(0.15, 0.95, r)) * (0.85 + 0.15 * Math.cos(Math.atan2(y, x) * 5 + r * 6));
  }),
});
