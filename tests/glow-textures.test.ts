import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GLOW_TEXTURES, roundedRectDistance } from '../presentation/glow-textures.ts';

const alphaAt = (texture: THREE.DataTexture, u: number, v: number) => {
  const { width, height, data } = texture.image as { width: number; height: number; data: Uint8Array };
  const x = Math.min(width - 1, Math.floor(u * width)), y = Math.min(height - 1, Math.floor(v * height));
  return data[(y * width + x) * 4 + 3] / 255;
};

test('GlowTextures_AreSmoothWhiteMasksBuiltWithoutADom', () => {
  for (const [name, texture] of Object.entries(GLOW_TEXTURES)) {
    assert.ok(texture instanceof THREE.DataTexture, `${name}: built from data, so Node tests and context loss work`);
    assert.equal(texture.magFilter, THREE.LinearFilter, `${name}: no nearest-neighbour stair-stepping`);
    assert.equal(texture.minFilter, THREE.LinearMipmapLinearFilter, `${name}: smooth when minified`);
    assert.equal(texture.generateMipmaps, true);
    const { data } = texture.image as { data: Uint8Array };
    for (let i = 0; i < data.length; i += 4) assert.deepEqual([...data.slice(i, i + 3)], [255, 255, 255], `${name}: tinted by material colour`);
  }
});

test('GlowTextures_FalloffShapes', () => {
  const { radial, edge, flash, scorch, ring } = GLOW_TEXTURES;
  assert.ok(alphaAt(radial, 0.5, 0.5) > 0.95 && alphaAt(radial, 0.98, 0.5) < 0.05, 'radial: bright centre, transparent rim');
  assert.ok(alphaAt(radial, 0.7, 0.5) < alphaAt(radial, 0.6, 0.5), 'radial: monotonic falloff');
  assert.ok(alphaAt(edge, 0.06, 0.5) > 0.7 && alphaAt(edge, 0.5, 0.5) < 0.05, 'edge glow: bright inside the rim, clear centre');
  assert.equal(alphaAt(edge, 0.005, 0.005), 0, 'edge glow: rounded, so the corner is empty');
  assert.ok(alphaAt(flash, 0.5, 0.5) > 0.98 && alphaAt(flash, 0.04, 0.5) >= 0.5, 'flash: covers the tile, softening only at the edge');
  assert.equal(alphaAt(flash, 0.005, 0.005), 0, 'flash: rounded corners, not a hard square');
  assert.ok(alphaAt(scorch, 0.5, 0.5) > alphaAt(scorch, 0.85, 0.5), 'scorch: darkest at the centre');
  assert.ok(alphaAt(ring, 0.925, 0.5) > 0.9 && alphaAt(ring, 0.5, 0.5) === 0 && alphaAt(ring, 0.995, 0.5) < 0.3, 'ring: soft annulus');
});

test('RoundedRectDistance_IsZeroOnTheEdgeAndRoundsCorners', () => {
  assert.ok(Math.abs(roundedRectDistance(1, 0, 1, 0.2)) < 1e-9);
  assert.ok(roundedRectDistance(0, 0, 1, 0.2) < -0.9);
  assert.ok(roundedRectDistance(1, 1, 1, 0.2) > 0, 'the square corner lies outside a rounded rectangle');
});
