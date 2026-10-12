import * as THREE from 'three';
import { TERRAIN, type Tile } from '../data/terrain.ts';
import type { Point } from '../core/level.ts';

const walkable = (tiles: readonly string[], x: number, y: number) => {
  const terrain = TERRAIN[tiles[y]?.[x] as Tile];
  return !!terrain && !terrain.solid && !terrain.lethal;
};

/**
 * Walkable cells that touch the trigger circle and connect to the checkpoint
 * without crossing a wall, void or spikes. A lane behind a wall cannot collect
 * the checkpoint (line-of-sight rule), so it is never painted as part of it.
 */
export function checkpointZoneCells(tiles: readonly string[], point: Point, radius: number): Point[] {
  const cx = point.x + 0.5, cy = point.y + 0.5;
  const touches = (x: number, y: number) =>
    Math.hypot(Math.max(x - cx, 0, cx - x - 1), Math.max(y - cy, 0, cy - y - 1)) < radius;
  if (!walkable(tiles, point.x, point.y)) return [];
  const seen = new Set([`${point.x},${point.y}`]), cells: Point[] = [], queue = [point];
  while (queue.length) {
    const cell = queue.shift()!;
    cells.push(cell);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = cell.x + dx, y = cell.y + dy, key = `${x},${y}`;
      if (seen.has(key) || !walkable(tiles, x, y) || !touches(x, y)) continue;
      seen.add(key); queue.push({ x, y });
    }
  }
  return cells;
}

/** One flat quad per zone cell, local to the checkpoint centre, with UVs spanning the circle. */
export function createCheckpointZoneGeometry(tiles: readonly string[], point: Point, radius: number) {
  const positions: number[] = [], uvs: number[] = [];
  const cx = point.x + 0.5, cz = point.y + 0.5, span = 2 * radius;
  const vertex = (x: number, z: number) => {
    positions.push(x - cx, 0, z - cz);
    uvs.push((x - cx) / span + 0.5, 0.5 - (z - cz) / span);
  };
  for (const { x, y } of checkpointZoneCells(tiles, point, radius)) {
    vertex(x, y); vertex(x, y + 1); vertex(x + 1, y + 1);
    vertex(x, y); vertex(x + 1, y + 1); vertex(x + 1, y);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}

/** White radial mask (faint fill plus edge ring), tinted per marker by its material colour. */
export function createZoneTexture(createCanvas: () => HTMLCanvasElement = () => document.createElement('canvas')) {
  const canvas = createCanvas(), size = 256, edge = size / 2 - 4;
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is required for checkpoint zones.');
  const fill = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, edge);
  fill.addColorStop(0, 'rgba(255,255,255,0.08)');
  fill.addColorStop(0.8, 'rgba(255,255,255,0.2)');
  fill.addColorStop(1, 'rgba(255,255,255,0.3)');
  context.beginPath(); context.arc(size / 2, size / 2, edge, 0, Math.PI * 2);
  context.fillStyle = fill; context.fill();
  context.lineWidth = 6; context.strokeStyle = 'rgba(255,255,255,0.6)'; context.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
