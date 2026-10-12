import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { checkpointZoneCells, createCheckpointZoneGeometry } from '../presentation/marker-visuals.ts';

const parallel = ['#####', '#...#', '#####', '#...#', '#####'];

test('CheckpointZone_WalkableCellsInsideTheRadius_NeverCrossWalls', () => {
  const cells = checkpointZoneCells(parallel, { x: 2, y: 1 }, 2.5).map(p => `${p.x},${p.y}`).sort();
  assert.deepEqual(cells, ['1,1', '2,1', '3,1'], 'the parallel lane behind the wall cannot collect this checkpoint');
  const mixed = ['#######', '#.!. ~#', '#.:.=.#', '#######'];
  const zone = checkpointZoneCells(mixed, { x: 3, y: 1 }, 1.4).map(p => mixed[p.y][p.x]);
  assert.ok(zone.length > 0);
  for (const tile of zone) assert.ok(!['#', ' ', '!'].includes(tile), `no zone on ${JSON.stringify(tile)}`);
  assert.ok(zone.includes(':') && zone.includes('='), 'all walkable surfaces show the zone');
});

test('CheckpointZone_CellsMustTouchTheTriggerCircle', () => {
  const open = Array(9).fill('.........');
  const cells = checkpointZoneCells(open, { x: 4, y: 4 }, 2);
  for (const { x, y } of cells) {
    const dx = Math.max(x - 4.5, 0, 4.5 - (x + 1)), dy = Math.max(y - 4.5, 0, 4.5 - (y + 1));
    assert.ok(Math.hypot(dx, dy) < 2, `${x},${y} lies outside the trigger`);
  }
  assert.equal(cells.length, 21, 'every touched cell of the open floor is included');
});

test('CheckpointZone_GeometryIsFlatLocalQuadsWithRadialUvs', () => {
  const point = { x: 2, y: 1 }, radius = 2.5;
  const geometry = createCheckpointZoneGeometry(parallel, point, radius);
  const positions = geometry.getAttribute('position'), uvs = geometry.getAttribute('uv');
  assert.equal(positions.count, 3 * 6, 'two triangles per walkable zone cell');
  let area = 0;
  for (let i = 0; i < positions.count; i++) {
    const local = new THREE.Vector3().fromBufferAttribute(positions, i);
    assert.equal(local.y, 0, 'flush decal; height comes from the marker group');
    assert.ok(Math.abs(uvs.getX(i) - (local.x / (2 * radius) + 0.5)) < 1e-6);
    assert.ok(Math.abs(uvs.getY(i) - (0.5 - local.z / (2 * radius))) < 1e-6);
    if (i % 3 === 0) {
      const [a, b, c] = [0, 1, 2].map(k => new THREE.Vector3().fromBufferAttribute(positions, i + k));
      const middle = a.clone().add(b).add(c).divideScalar(3);
      const cell = { x: Math.floor(middle.x + point.x + 0.5), y: Math.floor(middle.z + point.y + 0.5) };
      assert.equal(parallel[cell.y][cell.x], '.', 'triangles stay on walkable cells');
      area += b.clone().sub(a).cross(c.clone().sub(a)).length() / 2;
      assert.ok(b.clone().sub(a).cross(c.clone().sub(a)).y > 0, 'faces up');
    }
  }
  assert.ok(Math.abs(area - 3) < 1e-6);
  geometry.dispose();
});
