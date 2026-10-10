import * as THREE from 'three';
import type { Level, Point } from '../core/level.ts';

const BODY_WIDTH = 0.46;
const MIN_BODY_PIXELS = 12;
const SIGN_HEIGHT_PIXELS = 18;
const LOCATOR_GAP_PIXELS = 4;
const NARROW_LANE_CLEARANCE = 0.65;
const SIGNAL_OBSERVATION_DISTANCE = 3;
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const right = new THREE.Vector3(), up = new THREE.Vector3();

export type RouteSign = { sprite: THREE.Sprite; label: string };

export function createPlayerLocator(): THREE.Group {
  // A hollow, screen-aligned pointer is a locator, not a larger collision body.
  const shape = new THREE.Shape();
  shape.moveTo(0, 0); shape.lineTo(9, 16); shape.lineTo(-9, 16); shape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(0, 4); hole.lineTo(-5, 14); hole.lineTo(5, 14); hole.closePath();
  shape.holes.push(hole);
  // Queue after translucent explosions while keeping the pointer itself opaque.
  const pointer = new THREE.Mesh(new THREE.ShapeGeometry(shape),
    new THREE.MeshBasicMaterial({ color: 0xb0ffe4, toneMapped: false, transparent: true, depthTest: false, depthWrite: false }));
  pointer.renderOrder = 2;
  const group = new THREE.Group(); group.add(pointer);
  return group;
}

export function placePlayerLocator(locator: THREE.Group, camera: THREE.OrthographicCamera, height: number,
  level: Level, position: Point) {
  const ppu = height / (camera.top - camera.bottom);
  locator.visible = BODY_WIDTH * ppu < MIN_BODY_PIXELS;
  if (!locator.visible) return;
  const x = Math.floor(position.x), y = Math.floor(position.y);
  const wall = (dx: number, dy: number) => level.tiles[y + dy]?.[x + dx] === '#';
  const besideWall = wall(0, -1) || wall(1, 0) || wall(0, 1) || wall(-1, 0);
  let dx = 0, dy = 1;
  // Point away from a narrow lane: upper, right and lower pockets keep their mouths exposed.
  if (wall(0, -1) && !wall(0, 1)) dy = 1;
  else if (wall(1, 0) && !wall(-1, 0)) { dx = 1; dy = 0; }
  else if (wall(0, 1) && !wall(0, -1)) dy = -1;
  else if (wall(-1, 0) && !wall(1, 0)) { dx = -1; dy = 0; }
  else if (wall(1, 0) && wall(-1, 0)) { dx = 1; dy = 0; }
  else {
    const nearby = (point: Point) => Math.hypot(position.x - point.x - 0.5, position.y - point.y - 0.5) < 0.9;
    if (nearby(level.spawn) || nearby(level.goal) || level.checkpoints.some(nearby)) { dx = 1; dy = 0; }
    // On open staging pads, point away from the signal the player needs to read.
    let distance = SIGNAL_OBSERVATION_DISTANCE;
    for (const hazard of besideWall ? [] : level.hazards) {
      if (hazard.kind !== 'pulse') continue;
      const offsetX = position.x - hazard.x - 0.5, offsetY = position.y - hazard.y - 0.5;
      const candidate = Math.hypot(offsetX, offsetY);
      if (candidate === 0 || candidate >= distance) continue;
      distance = candidate;
      if (Math.abs(offsetX) > Math.abs(offsetY)) { dx = Math.sign(offsetX); dy = 0; }
      else { dx = 0; dy = -Math.sign(offsetY); }
    }
  }
  right.set(1, 0, 0).applyQuaternion(camera.quaternion);
  up.set(0, 1, 0).applyQuaternion(camera.quaternion);
  const gap = (besideWall ? NARROW_LANE_CLEARANCE : BODY_WIDTH / 2) + LOCATOR_GAP_PIXELS / ppu;
  locator.position.set(position.x, 0.37, position.y)
    .addScaledVector(right, dx * gap).addScaledVector(up, dy * gap);
  locator.quaternion.copy(camera.quaternion);
  locator.rotateOnAxis(Z_AXIS, -Math.atan2(dx, dy));
  locator.scale.setScalar(1 / ppu);
}

export function fitRouteSigns(signs: readonly RouteSign[], camera: THREE.OrthographicCamera, height: number) {
  const ppu = height / (camera.top - camera.bottom);
  const adaptive = 0.45 * ppu < SIGN_HEIGHT_PIXELS;
  up.set(0, 1, 0).applyQuaternion(camera.quaternion);
  const boxes: { sprite: THREE.Sprite; left: number; right: number; top: number; bottom: number }[] = [];
  for (const { sprite, label } of signs) {
    const wide = label.length > 2;
    sprite.visible = label !== 'START' || BODY_WIDTH * ppu >= MIN_BODY_PIXELS;
    sprite.position.set(0, 1.05, 0);
    sprite.scale.set(wide ? 1.7 : 0.95, 0.45, 1);
    if (!adaptive || !sprite.visible) continue;
    const h = SIGN_HEIGHT_PIXELS / ppu;
    sprite.scale.set(h * (wide ? 3 : 1.5), h, 1);
    sprite.position.y = Math.max(1.05, (SIGN_HEIGHT_PIXELS / 2 + 6) / ppu / up.y);
    const point = sprite.getWorldPosition(new THREE.Vector3()).project(camera);
    const width = sprite.scale.x * ppu, screenY = -point.y * height / 2;
    const screenX = point.x * (camera.right - camera.left) * ppu / 2;
    boxes.push({ sprite, left: screenX - width / 2, right: screenX + width / 2,
      top: screenY - SIGN_HEIGHT_PIXELS / 2, bottom: screenY + SIGN_HEIGHT_PIXELS / 2 });
  }
  boxes.sort((a, b) => a.left - b.left);
  for (let i = 1; i < boxes.length; i++) {
    const box = boxes[i];
    for (const other of boxes.slice(0, i)) {
      if (box.bottom <= other.top || box.top >= other.bottom || box.left >= other.right || box.right <= other.left) continue;
      const shift = other.right + 2 - box.left;
      box.left += shift; box.right += shift; box.sprite.position.x += shift / ppu;
    }
  }
}
