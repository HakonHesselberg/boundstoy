import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createStrokeGeometry, createFrameGeometry } from '../presentation/stroke-visuals.ts';

const triangles = (geometry: THREE.BufferGeometry) => {
  const positions = geometry.getAttribute('position'), list: THREE.Vector3[][] = [];
  for (let i = 0; i < positions.count; i += 3)
    list.push([0, 1, 2].map(k => new THREE.Vector3().fromBufferAttribute(positions, i + k)));
  return list;
};
const area = ([a, b, c]: THREE.Vector3[]) => b.clone().sub(a).cross(c.clone().sub(a)).length() / 2;

test('Stroke_FlatSegments_HaveWorldUnitWidthAndSquareCaps', () => {
  const width = 0.04;
  const geometry = createStrokeGeometry([0, 0.01, 0, 1, 0.01, 0, 1, 0.01, 0, 1, 0.01, 1], width);
  const parts = triangles(geometry);
  assert.equal(parts.length, 4, 'two quads for two segments');
  const total = parts.reduce((sum, t) => sum + area(t), 0);
  assert.ok(Math.abs(total - 2 * (1 + width) * width) < 1e-6, 'each segment is extended by half the width at both ends');
  for (const t of parts) for (const v of t) assert.ok(Math.abs(v.y - 0.01) < 1e-9, 'flat on the authored height');
  for (const [a, b, c] of parts)
    assert.ok(b.clone().sub(a).cross(c.clone().sub(a)).y > 0, 'faces up, so single-sided materials draw it');
  const box = new THREE.Box3().setFromBufferAttribute(geometry.getAttribute('position') as THREE.BufferAttribute);
  assert.ok(Math.abs(box.min.x + width / 2) < 1e-6 && Math.abs(box.max.z - 1 - width / 2) < 1e-6);
  geometry.dispose();
});

test('Stroke_VerticalSegments_StandOnTheirEdge', () => {
  const geometry = createStrokeGeometry([0, -0.12, 0.5, 1, -0.12, 0.5], 0.03, true);
  const box = new THREE.Box3().setFromBufferAttribute(geometry.getAttribute('position') as THREE.BufferAttribute);
  assert.ok(Math.abs(box.max.y - box.min.y - 0.03) < 1e-6, 'width spans height on a side face');
  assert.ok(Math.abs(box.max.z - box.min.z) < 1e-9, 'stays in the face plane');
  geometry.dispose();
});

test('Frame_SquareOutline_StaysInsideItsOuterEdge', () => {
  const outer = 0.43, width = 0.03;
  const geometry = createFrameGeometry(outer, width);
  const total = triangles(geometry).reduce((sum, t) => sum + area(t), 0);
  assert.ok(Math.abs(total - ((2 * outer) ** 2 - (2 * (outer - width)) ** 2)) < 1e-6, 'exact square band');
  for (const [p, q, r] of triangles(geometry)) assert.ok(q.clone().sub(p).cross(r.clone().sub(p)).y > 0, 'band faces up');
  const box = new THREE.Box3().setFromBufferAttribute(geometry.getAttribute('position') as THREE.BufferAttribute);
  assert.ok(box.max.x <= outer + 1e-6 && box.min.z >= -outer - 1e-6 && box.max.y === 0 && box.min.y === 0);
  geometry.dispose();
});
