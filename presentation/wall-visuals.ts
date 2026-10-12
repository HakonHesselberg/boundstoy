import * as THREE from 'three';
import { TERRAIN } from '../data/terrain.ts';
import { WALL_HEIGHT } from './hazard-visuals.ts';

const WALL_BASE = -0.38;
const WALL_SIDE_COLOR = 0x273744;
/**
 * Tone by Chebyshev distance (in cells) from the nearest non-wall cell. Curbs
 * beside play keep the full matte tone; the solid fill recedes toward the
 * background so corridors read as walkways, not holes in one large slab.
 */
export const WALL_TONES = Object.freeze([1, 0.5, 0.28]);
type Vertex = readonly [number, number, number];

/** Distance from every cell to the nearest in-bounds non-wall cell (0 for open cells). */
function openDistance(tiles: readonly string[]) {
  const rows = tiles.length, columns = Math.max(0, ...tiles.map(row => row.length));
  const distance = Array.from({ length: rows }, () => Array<number>(columns).fill(Infinity));
  const queue: [number, number][] = [];
  tiles.forEach((row, y) => [...row].forEach((tile, x) => {
    if (tile !== '#') { distance[y][x] = 0; queue.push([x, y]); }
  }));
  for (let head = 0; head < queue.length; head++) {
    const [x, y] = queue[head];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (ny < 0 || ny >= rows || nx < 0 || nx >= columns || distance[ny][nx] <= distance[y][x] + 1) continue;
      distance[ny][nx] = distance[y][x] + 1; queue.push([nx, ny]);
    }
  }
  return distance;
}

/** Continuous caps and exposed boundary faces, never a decorated box per tile. */
export function createWalls(tiles: readonly string[]): THREE.Group {
  const group = new THREE.Group();
  group.name = 'walls';
  const tops: number[] = [], sides: number[] = [], topTones: number[] = [], sideTones: number[] = [];
  const wall = (x: number, y: number) => tiles[y]?.[x] === '#';
  const distance = openDistance(tiles);
  const cell = (x: number, y: number) => distance[y]?.[x] ?? Infinity;
  const tone = (cx: number, cy: number) => {
    const d = Math.min(cell(cx - 1, cy - 1), cell(cx, cy - 1), cell(cx - 1, cy), cell(cx, cy));
    return WALL_TONES[Math.min(d, WALL_TONES.length - 1)];
  };
  const quad = (into: number[], tones: number[], a: Vertex, b: Vertex, c: Vertex, d: Vertex) => {
    for (const v of [a, b, c, a, c, d]) { into.push(...v); tones.push(tone(v[0], v[2])); }
  };
  const uniform = (x: number, y: number) => {
    const value = tone(x, y);
    return [tone(x + 1, y), tone(x, y + 1), tone(x + 1, y + 1)].every(t => t === value) ? value : null;
  };
  for (let y = 0; y < tiles.length; y++) {
    for (let x = 0; x < tiles[y].length; x++) {
      if (!wall(x, y)) continue;
      const start = x, value = uniform(x, y);
      // Merge only runs of identical flat tone; ramps need per-cell corners.
      while (value !== null && wall(x + 1, y) && uniform(x + 1, y) === value) x++;
      quad(tops, topTones, [start, WALL_HEIGHT, y], [start, WALL_HEIGHT, y + 1],
        [x + 1, WALL_HEIGHT, y + 1], [x + 1, WALL_HEIGHT, y]);
      for (let cell = start; cell <= x; cell++) {
        if (!wall(cell - 1, y)) quad(sides, sideTones,
          [cell, WALL_BASE, y], [cell, WALL_BASE, y + 1], [cell, WALL_HEIGHT, y + 1], [cell, WALL_HEIGHT, y]);
        if (!wall(cell + 1, y)) quad(sides, sideTones,
          [cell + 1, WALL_BASE, y + 1], [cell + 1, WALL_BASE, y], [cell + 1, WALL_HEIGHT, y], [cell + 1, WALL_HEIGHT, y + 1]);
        if (!wall(cell, y - 1)) quad(sides, sideTones,
          [cell + 1, WALL_BASE, y], [cell, WALL_BASE, y], [cell, WALL_HEIGHT, y], [cell + 1, WALL_HEIGHT, y]);
        if (!wall(cell, y + 1)) quad(sides, sideTones,
          [cell, WALL_BASE, y + 1], [cell + 1, WALL_BASE, y + 1], [cell + 1, WALL_HEIGHT, y + 1], [cell, WALL_HEIGHT, y + 1]);
      }
    }
  }
  if (!tops.length) return group;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([...tops, ...sides], 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute([...topTones, ...sideTones].flatMap(t => [t, t, t]), 3));
  geometry.addGroup(0, tops.length / 3, 0);
  geometry.addGroup(tops.length / 3, sides.length / 3, 1);
  geometry.computeVertexNormals();
  const materials = [TERRAIN['#'].color, WALL_SIDE_COLOR].map(color =>
    new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0, envMapIntensity: 0, vertexColors: true }));
  const mesh = new THREE.Mesh(geometry, materials);
  // Curbs are 0.24 tall: baked contact shading reads better and costs no shadow pass.
  mesh.castShadow = false; mesh.receiveShadow = true;
  group.add(mesh);
  return group;
}

const CONTACT_WIDTH = 0.32;
const CONTACT_ALPHA = 0.5;
const CONTACT_Y = 0.002;

/**
 * Baked contact shading: a band on each floor cell edge that meets a wall,
 * dark at the wall and transparent inward. It replaces dynamic wall shadows.
 */
export function createContactShadeGeometry(tiles: readonly string[]) {
  const positions: number[] = [], colors: number[] = [];
  const open = (tile: string | undefined) => tile !== undefined && tile !== '#' && tile !== ' ';
  const vertex = (x: number, z: number, alpha: number) => { positions.push(x, CONTACT_Y, z); colors.push(1, 1, 1, alpha); };
  tiles.forEach((row, y) => [...row].forEach((tile, x) => {
    if (!open(tile)) return;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (tiles[y + dy]?.[x + dx] !== '#') continue;
      // Edge endpoints on the shared boundary, then the same points moved inward.
      const ex = dx === 1 ? x + 1 : x, ez = dy === 1 ? y + 1 : y;
      const [ax, az, bx, bz] = dx ? [ex, y, ex, y + 1] : [x, ez, x + 1, ez];
      const ix = -dx * CONTACT_WIDTH, iz = -dy * CONTACT_WIDTH;
      const quad: [number, number, number][] = [
        [ax, az, CONTACT_ALPHA], [bx, bz, CONTACT_ALPHA], [bx + ix, bz + iz, 0], [ax + ix, az + iz, 0]];
      // Wind every band upward regardless of which side the wall is on.
      const up = (quad[1][0] - quad[0][0]) * (quad[2][1] - quad[0][1]) - (quad[1][1] - quad[0][1]) * (quad[2][0] - quad[0][0]) < 0;
      for (const k of up ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]) vertex(...quad[k]);
    }
  }));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
  return geometry;
}
