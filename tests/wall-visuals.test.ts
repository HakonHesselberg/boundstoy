import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createWalls, createContactShadeGeometry } from '../presentation/wall-visuals.ts';
import { WALL_HEIGHT } from '../presentation/hazard-visuals.ts';
import { TERRAIN, GROUND_COLORS } from '../data/terrain.ts';
import { Scene, SHADOW_MAP_SIZE } from '../presentation/scene.ts';
import { parseLevel } from '../core/level.ts';

const fixtures = [
  ['####', '####', '####'],
  ['###', '#.#', '###'],
  ['#...', '##..', '.###'],
  ['#.#', '.#.', '#.#'],
  ['..#', '...'],
];

test('Walls_ContinuousTopology_ExactlyCoversCellsAndOnlyExposedSides', () => {
  for (const tiles of fixtures) {
    const group = createWalls(tiles), mesh = group.children[0];
    assert.ok(mesh instanceof THREE.Mesh);
    const geometry = mesh.geometry, positions = geometry.getAttribute('position'), normals = geometry.getAttribute('normal');
    let topArea = 0, sideArea = 0;
    for (let i = 0; i < positions.count; i += 3) {
      const a = new THREE.Vector3().fromBufferAttribute(positions, i);
      const b = new THREE.Vector3().fromBufferAttribute(positions, i + 1);
      const c = new THREE.Vector3().fromBufferAttribute(positions, i + 2);
      const normal = new THREE.Vector3().fromBufferAttribute(normals, i);
      const area = b.clone().sub(a).cross(c.clone().sub(a)).length() / 2;
      assert.ok(area > 0, 'no degenerate triangles');
      const middle = a.clone().add(b).add(c).divideScalar(3);
      if (normal.y > 0.99) {
        topArea += area;
        assert.ok(Math.abs(middle.y - WALL_HEIGHT) < 1e-6);
        assert.equal(tiles[Math.floor(middle.z)]?.[Math.floor(middle.x)], '#', 'tops never bridge floor or void');
      } else {
        sideArea += area;
        assert.equal(Math.abs(normal.y), 0);
        const outside = middle.clone().addScaledVector(normal, 0.01);
        const inside = middle.clone().addScaledVector(normal, -0.01);
        assert.notEqual(tiles[Math.floor(outside.z)]?.[Math.floor(outside.x)], '#', 'no hidden interior walls');
        assert.equal(tiles[Math.floor(inside.z)]?.[Math.floor(inside.x)], '#', 'faces point out of solid cells');
      }
    }
    const count = tiles.join('').split('#').length - 1;
    let edges = 0;
    tiles.forEach((row, y) => [...row].forEach((tile, x) => {
      if (tile === '#') for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]])
        if (tiles[y + dy]?.[x + dx] !== '#') edges++;
    }));
    assert.ok(Math.abs(topArea - count) < 1e-6, 'all wall cells are covered once');
    assert.ok(Math.abs(sideArea - edges * (WALL_HEIGHT + 0.38)) < 1e-5, 'exact exposed boundary down to the floor base');
    geometry.dispose(); mesh.material.forEach((m: THREE.Material) => m.dispose());
  }
});

test('Walls_MatteArchitecturalMaterials_RecedeWithoutReflectionsOrDecorativeLines', () => {
  const walls = createWalls(fixtures[0]);
  assert.equal(walls.children.length, 1, 'one batched mesh, not decorative objects per cell');
  const mesh = walls.children[0];
  assert.ok(mesh instanceof THREE.Mesh);
  assert.equal(mesh.geometry.groups.length, 2, 'top and vertical boundary faces only');
  assert.equal(mesh.castShadow, false, 'low curbs use baked contact shading, not a dynamic shadow pass');
  assert.equal(mesh.receiveShadow, true);
  const materials: THREE.MeshStandardMaterial[] = mesh.material;
  const luma = (c: THREE.Color) => c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722;
  for (const material of materials) {
    assert.equal(material.roughness, 1); assert.equal(material.metalness, 0);
    assert.equal(material.envMapIntensity, 0);
    assert.equal(material.emissive.getHex(), 0);
    assert.equal(material.transparent, false);
    assert.ok(luma(material.color) < luma(new THREE.Color(GROUND_COLORS[1])) * 0.55,
      'both wall surfaces are materially quieter than even the darker playable floor');
  }
  assert.equal(materials[0].color.getHexString(), TERRAIN['#'].color.slice(1), 'editor swatch matches wall tops');
  assert.ok(mesh.geometry.getAttribute('position').count < 12 * 6 * 6, 'no individually beveled tile boxes');
  mesh.geometry.dispose(); materials.forEach(m => m.dispose());
});

test('Walls_EmptyFloor_AllocatesNoGeometryOrMaterial', () => {
  assert.equal(createWalls(['....', '....']).children.length, 0);
});

test('Walls_ProductionScene_ReplacesTileDecorationAndDisposesBatchedResourcesOnEdit', () => {
  const details: string[] = [];
  const view = {
    board: new THREE.Group(), decorations: new THREE.Group(),
    boardGeometries: new Set<THREE.BufferGeometry>(), boardMaterials: new Set<THREE.Material>(),
    boardTextures: new Set<THREE.Texture>(), pulses: new Map(), lines: new Map(), levelBuilds: 0,
    marker() { return new THREE.Group(); },
    track: Reflect.get(Scene.prototype, 'track'), mesh: Reflect.get(Scene.prototype, 'mesh'),
    tileDetails(_point: unknown, tile: string) { details.push(tile); },
    resize() {}, motion: { reset() {} },
  };
  const level = parseLevel({
    version: 1, id: 'wall-integration', name: 'Walls', description: 'Continuous boundary.',
    tiles: ['########', '#......#', '#......#', '#......#', '#......#', '########'],
    spawn: { x: 1, y: 1 }, goal: { x: 4, y: 4 }, checkpoints: [], hazards: [],
  });
  Reflect.apply(Scene.prototype.setLevel, view, [level]);
  const walls = view.board.getObjectByName('walls');
  assert.ok(walls);
  const mesh = walls.children[0];
  assert.ok(mesh instanceof THREE.Mesh);
  assert.equal(details.includes('#'), false, 'no old outlines, hatching or per-cell embellishment');
  assert.ok(view.board.getObjectByName('contact-shade'), 'wall bases get baked contact shading');
  const floor = view.board.children.find((object): object is THREE.InstancedMesh => object instanceof THREE.InstancedMesh);
  assert.equal(floor?.count, 24, 'only playable floor uses tile instances');
  let geometries = 0, materials = 0;
  mesh.geometry.addEventListener('dispose', () => geometries++);
  mesh.material.forEach((material: THREE.Material) => material.addEventListener('dispose', () => materials++));
  Reflect.apply(Scene.prototype.setLevel, view, [level]);
  assert.equal(geometries, 1); assert.equal(materials, 2);
  view.boardGeometries.forEach(g => g.dispose()); view.boardMaterials.forEach(m => m.dispose());
});

test('Walls_DistantMass_FadesTowardTheBackgroundWhileCurbsKeepFullTone', () => {
  const tiles = ['#########', '#########', '##.....##', '#########', '#########', '#########', '#########'];
  const mesh = createWalls(tiles).children[0];
  assert.ok(mesh instanceof THREE.Mesh);
  const materials: THREE.MeshStandardMaterial[] = mesh.material;
  assert.ok(materials.every(material => material.vertexColors), 'tone ramps are per-vertex, not extra materials');
  const positions = mesh.geometry.getAttribute('position'), colors = mesh.geometry.getAttribute('color');
  assert.ok(colors, 'wall geometry carries a tone ramp');
  const floor = (x: number, y: number) => tiles[y]?.[x] === '.';
  // Chebyshev distance from a grid corner to the nearest floor cell touching that corner's neighbourhood.
  const cornerDistance = (cx: number, cy: number) => {
    let best = Infinity;
    tiles.forEach((row, y) => [...row].forEach((_, x) => {
      if (!floor(x, y)) return;
      best = Math.min(best, Math.max(Math.max(x - cx, cx - x - 1, 0), Math.max(y - cy, cy - y - 1, 0)));
    }));
    return best;
  };
  const tone = new Map<number, number[]>();
  for (let i = 0; i < positions.count; i++) {
    const [r, g, b] = [colors.getX(i), colors.getY(i), colors.getZ(i)];
    assert.ok(r === g && g === b, 'tone darkens without shifting the matte hue');
    const d = cornerDistance(Math.round(positions.getX(i)), Math.round(positions.getZ(i)));
    tone.set(d, [...(tone.get(d) ?? []), r]);
  }
  assert.ok(tone.get(0)!.every(value => value === 1), 'curb edges beside the floor keep the BT-033 tone');
  const levels = [...tone.keys()].sort((a, b) => a - b).map(d => Math.max(...tone.get(d)!));
  for (let i = 1; i < levels.length; i++) assert.ok(levels[i] <= levels[i - 1], 'tone never brightens away from play');
  const far = Math.max(...[...tone.keys()].filter(Number.isFinite));
  assert.ok(far >= 3);
  assert.ok(Math.max(...tone.get(far)!) <= 0.5, 'distant mass recedes toward the background');
  mesh.geometry.dispose(); materials.forEach(m => m.dispose());
});

test('ContactShade_DarkensFloorAlongWallBasesOnly', () => {
  const tiles = ['######', '#..#.#', '#....#', '# ...#', '######'];
  const geometry = createContactShadeGeometry(tiles);
  const positions = geometry.getAttribute('position'), colors = geometry.getAttribute('color');
  assert.equal(colors.itemSize, 4, 'alpha ramps per vertex; no texture needed');
  let edges = 0;
  tiles.forEach((row, y) => [...row].forEach((tile, x) => {
    if (tile === '#' || tile === ' ') return;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (tiles[y + dy]?.[x + dx] === '#') edges++;
  }));
  assert.equal(positions.count, edges * 6, 'one band per floor/wall edge');
  for (let i = 0; i < positions.count; i += 3) {
    const [p, q, r] = [0, 1, 2].map(k => new THREE.Vector3().fromBufferAttribute(positions, i + k));
    assert.ok(q.clone().sub(p).cross(r.clone().sub(p)).y > 0, 'every band faces up toward the camera');
  }
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i), alpha = colors.getW(i);
    assert.ok(y > 0 && y < 0.004, 'just above the floor, below zones and pad plates');
    const around = [[-0.01, -0.01], [0.01, -0.01], [-0.01, 0.01], [0.01, 0.01]]
      .map(([ox, oz]) => tiles[Math.floor(z + oz)]?.[Math.floor(x + ox)]);
    if (alpha > 0) assert.ok(around.includes('#'), `${x},${z}: shading starts at a wall edge`);
    else assert.ok(around.some(tile => tile !== undefined && tile !== '#' && tile !== ' '), 'fade ends on open floor');
    assert.ok(alpha <= 0.6);
    assert.equal(colors.getX(i), 1);
  }
  const shade = createContactShadeGeometry(['....', '....', '....', '....', '....', '....']);
  assert.equal(shade.getAttribute('position').count, 0, 'open floor gets no shading');
  geometry.dispose(); shade.dispose();
  assert.ok(SHADOW_MAP_SIZE <= 1024, 'remaining shadow casters are small');
});
