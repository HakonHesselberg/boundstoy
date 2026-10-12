import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Scene } from '../presentation/scene.ts';
import { parseLevel } from '../core/level.ts';
import { TERRAIN, GROUND_COLORS } from '../data/terrain.ts';
import { createMudPebbles, createFloorTexture } from '../presentation/terrain-visuals.ts';
import { createCheckpointZoneGeometry } from '../presentation/marker-visuals.ts';

function groundBoard(floorTexture?: THREE.Texture) {
  const board = new THREE.Group();
  const markerRadii: (number | undefined)[] = [];
  const view = {
    board, decorations: new THREE.Group(), floorTexture,
    boardGeometries: new Set<THREE.BufferGeometry>(), boardMaterials: new Set<THREE.Material>(),
    boardTextures: new Set<THREE.Texture>(), pulses: new Map(), lines: new Map(),
    marker(_point: unknown, _color: number, _goal: boolean, _label: string, radius?: number) {
      markerRadii.push(radius);
      return new THREE.Group();
    },
    tileDetails() {}, resize() {}, motion: { reset() {} },
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
    assert.ok(luma(light) > luma(dark) * 1.05, 'groups stay distinguishable but similar, without white/black warning colors');
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

test('Checkpoint_ActualZoneGeometry_ShowsTheCollectionAreaOnFloorWithoutEnlargingTheGoal', () => {
  const geometry = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  const view = { zoneTexture: new THREE.Texture(), markerMaterials: new Map(),
    markerMaterial: Reflect.get(Scene.prototype, 'markerMaterial'), mesh(g: THREE.BufferGeometry, m: THREE.Material) {
    geometry.add(g); materials.add(m);
    return new THREE.Mesh(g, m);
  }, halo() { return new THREE.Group(); } };
  try {
    const tiles = ['#######', '#.....#', '#######'];
    const zone = createCheckpointZoneGeometry(tiles, { x: 3, y: 1 }, 1.4);
    const checkpoint = Reflect.apply(Reflect.get(Scene.prototype, 'marker'), view, [{ x: 3, y: 1 }, 0x86f2dd, false, '', 1.4, zone]) as THREE.Group;
    const area = checkpoint.children[0];
    assert.ok(area instanceof THREE.Mesh);
    assert.equal(area.geometry, zone, 'trigger area is the floor-clipped zone, not a torus cut by walls');
    assert.ok(area.material instanceof THREE.MeshBasicMaterial);
    assert.equal(area.material.map, view.zoneTexture);
    assert.equal(area.material.transparent, true); assert.equal(area.material.depthWrite, false);
    assert.ok(area.position.y > 0 && area.position.y < 0.01, 'flush on the floor, below pad plates');
    const goal = Reflect.apply(Reflect.get(Scene.prototype, 'marker'), view, [{ x: 4, y: 3 }, 0xffce85, true, '']) as THREE.Group;
    const ring = goal.children[0];
    assert.ok(ring instanceof THREE.Mesh && ring.geometry instanceof THREE.TorusGeometry);
    assert.equal(ring.geometry.parameters.radius, 0.46);
    assert.equal(ring.rotation.x, -Math.PI / 2);
  } finally {
    geometry.forEach(g => g.dispose());
    materials.forEach(m => m.dispose());
  }
});

const rgb = (hex: string | number) => {
  const value = typeof hex === 'number' ? hex : parseInt(hex.slice(1), 16);
  return [value >> 16 & 255, value >> 8 & 255, value & 255].map(c => c / 255);
};
const hsl = (hex: string | number) => {
  const color = new THREE.Color().setRGB(...rgb(hex) as [number, number, number], THREE.SRGBColorSpace);
  return color.getHSL({ h: 0, s: 0, l: 0 }, THREE.SRGBColorSpace);
};
const lum = (hex: string | number) => {
  const [r, g, b] = rgb(hex).map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string | number, b: string | number) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

test('Terrain_HardIce_ReadsAsPaleIceDistinctFromNormalGroundAndSoftIce', () => {
  const hard = TERRAIN['='].color, soft = TERRAIN['~'].color;
  for (const ground of GROUND_COLORS) assert.ok(ratio(hard, ground) >= 3, 'hard ice is light, unlike slate floor');
  assert.ok(Math.abs(hsl(hard).h - hsl(soft).h) * 360 >= 30, 'hue separates it from teal soft ice');
  assert.ok(hsl(hard).s <= hsl(soft).s * 0.75, 'hard ice is the paler, frostier surface');
});

test('Terrain_DetailGlyphs_DiagonalStreaksOnHardIceAndPebblesOnMud', () => {
  const view = { level: { tiles: ['....', '.=:.', '....'] }, lines: new Map<string, { points: number[]; color: number }>(),
    line: Reflect.get(Scene.prototype, 'line') };
  Reflect.apply(Reflect.get(Scene.prototype, 'tileDetails'), view, [{ x: 1, y: 1 }, '=']);
  const streaks = [...view.lines.values()];
  assert.equal(streaks.length, 1);
  const points = streaks[0].points;
  for (let i = 0; i < points.length; i += 6) {
    assert.ok(Math.abs(points[i + 3] - points[i]) > 0.1 && Math.abs(points[i + 5] - points[i + 2]) > 0.1,
      'streaks run diagonally like scored ice, not like the old flat bars');
  }
  assert.ok(ratio(streaks[0].color, TERRAIN['='].color) >= 1.5, 'streaks are visible on the pale surface');
  view.lines.clear();
  Reflect.apply(Reflect.get(Scene.prototype, 'tileDetails'), view, [{ x: 2, y: 1 }, ':']);
  assert.equal(view.lines.size, 0, 'mud identity comes from pebbles, not a stray squiggle');
  const pebbles = createMudPebbles([{ x: 1, y: 0 }, { x: 3, y: 2 }]);
  assert.ok(pebbles instanceof THREE.InstancedMesh);
  assert.equal(pebbles.count % 2, 0);
  const perCell = pebbles.count / 2, matrix = new THREE.Matrix4(), position = new THREE.Vector3();
  assert.ok(perCell >= 3, 'a scattered texture, not a single dot');
  for (let i = 0; i < pebbles.count; i++) {
    pebbles.getMatrixAt(i, matrix); position.setFromMatrixPosition(matrix);
    const cell = i < perCell ? { x: 1, y: 0 } : { x: 3, y: 2 };
    assert.ok(position.x > cell.x + 0.1 && position.x < cell.x + 0.9 && position.z > cell.y + 0.1 && position.z < cell.y + 0.9);
    assert.ok(position.y >= 0 && position.y <= 0.02, 'flush with the floor');
  }
  const again = createMudPebbles([{ x: 1, y: 0 }, { x: 3, y: 2 }]);
  assert.deepEqual(Array.from(again.instanceMatrix.array), Array.from(pebbles.instanceMatrix.array), 'deterministic scatter');
  assert.ok(lum((pebbles.material as THREE.MeshStandardMaterial).color.getHex()) < lum(TERRAIN[':'].color), 'darker pebbles');
  for (const mesh of [pebbles, again]) { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); }
});

test('Ground_Tiles_AreFlatGaplessSquaresUsingTheHairlineGridTexture', () => {
  const texture = new THREE.Texture();
  const { board, dispose } = groundBoard(texture);
  try {
    const ground = board.children.find((child): child is THREE.InstancedMesh => child instanceof THREE.InstancedMesh);
    assert.ok(ground);
    assert.ok(ground.geometry instanceof THREE.BoxGeometry, 'a plain slab: no bevel or extruded rim');
    assert.equal(ground.geometry.parameters.width, 1, 'no grout gap between neighbouring tiles');
    assert.equal(ground.geometry.parameters.depth, 1);
    const matrix = new THREE.Matrix4(), box = new THREE.Box3();
    ground.getMatrixAt(0, matrix);
    ground.geometry.computeBoundingBox();
    box.copy(ground.geometry.boundingBox!).applyMatrix4(matrix);
    assert.ok(Math.abs(box.max.y) < 1e-6, 'walkable top is exactly the y = 0 gameplay plane');
    assert.ok(Math.abs(box.min.y + 0.38) < 1e-6, 'meets the wall base');
    assert.equal((ground.material as THREE.MeshStandardMaterial).map, texture, 'cells come from the hairline texture');
  } finally { dispose(); }
});

test('FloorTexture_IsWhiteWithAThinDarkerBorder', () => {
  const fills: { style: unknown; rect: number[] }[] = [];
  let fillStyle: unknown = '';
  const context = { set fillStyle(value: unknown) { fillStyle = value; }, get fillStyle() { return fillStyle; },
    fillRect: (...rect: number[]) => fills.push({ style: fillStyle, rect }) };
  const canvas = { width: 0, height: 0, getContext: () => context };
  const texture = createFloorTexture(() => canvas as unknown as HTMLCanvasElement);
  assert.ok(canvas.width >= 64 && canvas.width === canvas.height);
  assert.equal(fills[0].style, '#ffffff', 'tint comes from the instance colour');
  assert.deepEqual(fills[0].rect, [0, 0, canvas.width, canvas.height]);
  const border = fills.slice(1);
  assert.ok(border.length >= 4);
  for (const { style, rect } of border) {
    assert.notEqual(style, '#ffffff');
    assert.ok(Math.min(rect[2], rect[3]) <= canvas.width / 32, 'hairline, not a grout gap');
  }
  texture.dispose();
});

test('Markers_ShareGemGeometryAndColourMaterialsButKeepPerCheckpointZones', () => {
  const geometry = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  const view = { zoneTexture: new THREE.Texture(), markerMaterials: new Map(),
    markerMaterial: Reflect.get(Scene.prototype, 'markerMaterial'),
    mesh(g: THREE.BufferGeometry, m: THREE.Material) { geometry.add(g); materials.add(m); return new THREE.Mesh(g, m); },
    halo() { return new THREE.Group(); } };
  const tiles = ['#######', '#.....#', '#######'];
  const make = (x: number) => Reflect.apply(Reflect.get(Scene.prototype, 'marker'), view,
    [{ x, y: 1 }, 0x86f2dd, false, '', 1.4, createCheckpointZoneGeometry(tiles, { x, y: 1 }, 1.4)]) as THREE.Group;
  const [a, b] = [make(2), make(4)];
  const gem = (marker: THREE.Group) => marker.children[1] as THREE.Mesh;
  const zone = (marker: THREE.Group) => marker.children[0] as THREE.Mesh;
  assert.equal(gem(a).geometry, gem(b).geometry, 'one gem geometry upload');
  assert.equal(gem(a).material, gem(b).material, 'one material per marker colour');
  assert.notEqual(zone(a).material, zone(b).material, 'each zone fades independently when collected');
  geometry.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
});
