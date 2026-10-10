import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Scene } from '../presentation/scene.ts';
import { parseLevel } from '../core/level.ts';
import { TERRAIN } from '../data/terrain.ts';

function groundBoard() {
  const board = new THREE.Group();
  const markerRadii: (number | undefined)[] = [];
  const view = {
    board, decorations: new THREE.Group(),
    boardGeometries: new Set<THREE.BufferGeometry>(), boardMaterials: new Set<THREE.Material>(),
    boardTextures: new Set<THREE.Texture>(), pulses: new Map(), lines: new Map(),
    marker(_point: unknown, _color: number, _goal: boolean, _label: string, radius?: number) {
      markerRadii.push(radius);
      return new THREE.Group();
    },
    tileDetails() {}, resize() {},
  };
  const level = parseLevel({
    version: 1, id: 'ground-colors', name: 'Ground', description: 'Same floor, two shades.',
    tiles: Array(6).fill('........'), spawn: { x: 0, y: 0 }, goal: { x: 7, y: 5 },
    checkpoints: [{ x: 4, y: 3, radius: 1.4 }], hazards: [],
  });
  Reflect.apply(Scene.prototype.setLevel, view, [level]);
  return { board, markerRadii, level, dispose() {
    view.boardGeometries.forEach(g => g.dispose());
    view.boardMaterials.forEach(m => m.dispose());
    view.boardTextures.forEach(t => t.dispose());
  } };
}

test('Ground_ActualInstances_AlternateTwoMutedShadesOfTheSameSurface', () => {
  const { board, level, dispose } = groundBoard();
  try {
    const ground = board.children.find((child): child is THREE.InstancedMesh => child instanceof THREE.InstancedMesh);
    assert.ok(ground);
    const colors = Array.from({ length: ground.count }, (_, index) => {
      const color = new THREE.Color();
      ground.getColorAt(index, color);
      return color.getHex();
    });
    assert.equal(new Set(colors).size, 2, 'two stable groups, not arbitrary per-cell noise');
    for (let y = 0; y < 6; y++) for (let x = 0; x < 8; x++)
      assert.equal(colors[y * 8 + x], colors[(x + y) % 2]);
    const [light, dark] = [new THREE.Color(colors[0]), new THREE.Color(colors[1])];
    const luma = (c: THREE.Color) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    assert.ok(luma(light) > luma(dark) * 1.5, 'group identity is readable without white/black warning colors');
    assert.ok(luma(light) < 0.3, 'floor must stay muted behind bright warnings');
    assert.ok(ground.material instanceof THREE.MeshStandardMaterial);
    assert.equal(ground.material.roughness, 0.65);
    assert.equal(ground.material.metalness, 0.15);
    assert.ok(level.tiles.every(row => [...row].every(tile => tile === '.')));
    assert.equal(TERRAIN['.'].speed, 3.6);
  } finally { dispose(); }
});

test('Checkpoint_AuthoredRadius_IsForwardedToItsVisibleMarker', () => {
  const { markerRadii, dispose } = groundBoard();
  try { assert.equal(markerRadii.at(-1), 1.4); }
  finally { dispose(); }
});

test('Checkpoint_ActualRingGeometry_ShowsTheCollectionRadiusWithoutEnlargingTheGoal', () => {
  const geometry = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  const view = { mesh(g: THREE.BufferGeometry, m: THREE.Material) {
    geometry.add(g); materials.add(m);
    return new THREE.Mesh(g, m);
  }, halo() { return new THREE.Group(); } };
  try {
    for (const [goal, radius] of [[false, 1.4], [true, undefined]] as const) {
      const marker = Reflect.apply(Reflect.get(Scene.prototype, 'marker'), view, [{ x: 4, y: 3 }, 0x86f2dd, goal, '', radius]);
      assert.ok(marker instanceof THREE.Group);
      const ring = marker.children[0];
      assert.ok(ring instanceof THREE.Mesh && ring.geometry instanceof THREE.TorusGeometry);
      assert.equal(ring.geometry.parameters.radius, goal ? 0.46 : 1.4);
      assert.equal(ring.rotation.x, -Math.PI / 2);
    }
  } finally {
    geometry.forEach(g => g.dispose());
    materials.forEach(m => m.dispose());
  }
});
