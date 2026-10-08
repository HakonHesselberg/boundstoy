import { parseLevel, type Hazard, type Point } from '../core/level.ts';
import type { Tile } from './terrain.ts';

function course(id: string, name: string, description: string, size: readonly [number, number],
  draw: (fill: (x: number, y: number, w: number, h: number, tile: Tile) => void) => void,
  spawn: Point, goal: Point, checkpoints: Point[], hazards: Hazard[] = []) {
  const [width, height] = size;
  const grid: Tile[][] = Array.from({ length: height }, () => Array<Tile>(width).fill(' '));
  draw((x, y, w, h, tile) => {
    for (let row = y; row < y + h; row++) for (let col = x; col < x + w; col++) grid[row][col] = tile;
  });
  return parseLevel({ version: 1, id, name, description, tiles: grid.map(row => row.join('')), spawn, goal, checkpoints, hazards });
}

export const LEVELS = Object.freeze([
  course('first-steps-v1', 'First steps', 'Walk, stop and find your way around. Follow the checkpoints to the golden exit.', [14, 12], fill => {
    fill(1, 6, 6, 4, '.');
    fill(4, 2, 3, 5, '.');
    fill(7, 2, 6, 3, '.');
    fill(1, 10, 7, 1, '#');
    fill(7, 5, 1, 5, '#');
    fill(4, 1, 9, 1, '#');
    fill(2, 6, 2, 1, '!');
    fill(9, 2, 1, 1, '!');
  }, { x: 2, y: 8 }, { x: 11, y: 3 }, [{ x: 5, y: 8 }, { x: 5, y: 3 }]),

  course('gentle-curve-v1', 'Gentle curve', 'Green ice keeps moving. Sweep above the spikes, then turn right onto the wide landing.', [19, 12], fill => {
    fill(1, 6, 4, 4, '.');
    fill(5, 3, 8, 7, '~');
    fill(8, 6, 2, 4, '!');
    fill(13, 3, 5, 3, '.');
    fill(5, 2, 13, 1, '#');
    fill(1, 10, 12, 1, '#');
    fill(0, 6, 1, 4, '#');
    fill(18, 3, 1, 3, '#');
  }, { x: 2, y: 7 }, { x: 16, y: 4 }, [{ x: 14, y: 4 }]),

  course('curb-turn-v1', 'Curb turn', 'Choose a clear blue-ice lane. Slide to the curb, stop, then launch in a new direction.', [13, 12], fill => {
    fill(1, 6, 4, 5, '.');
    fill(5, 6, 6, 5, '=');
    fill(7, 8, 1, 3, '!');
    fill(9, 4, 2, 2, '=');
    fill(6, 1, 5, 3, '.');
    fill(11, 1, 1, 10, '#');
    fill(1, 11, 11, 1, '#');
    fill(6, 0, 6, 1, '#');
  }, { x: 2, y: 9 }, { x: 7, y: 2 }, [{ x: 3, y: 7 }, { x: 10, y: 2 }]),

  course('pulse-crossing-v1', 'Pulse crossing', 'Watch a blast gate from solid ground. Cross in the quiet part of its cycle.', [15, 9], fill => {
    fill(1, 2, 5, 5, '.');
    fill(6, 3, 3, 3, '.');
    fill(9, 2, 5, 5, '.');
    fill(6, 2, 3, 1, '#');
    fill(6, 6, 3, 1, '#');
  }, { x: 2, y: 4 }, { x: 12, y: 4 }, [{ x: 5, y: 4 }],
  Array.from({ length: 3 }, (_, i): Hazard => ({ kind: 'pulse', x: 7, y: 3 + i, period: 480, on: 240, phase: 0 }))),

  course('saw-crossing-v1', 'Saw crossing', 'Watch the saw travel past the narrow bridge. Let it move away before you cross.', [15, 11], fill => {
    fill(1, 3, 5, 5, '.');
    fill(6, 5, 3, 1, '.');
    fill(9, 3, 5, 5, '.');
    fill(6, 4, 1, 1, '#');
    fill(8, 4, 1, 1, '#');
    fill(6, 6, 1, 1, '#');
    fill(8, 6, 1, 1, '#');
  }, { x: 2, y: 5 }, { x: 12, y: 5 }, [{ x: 5, y: 5 }],
  [{ kind: 'saw', from: { x: 7, y: 2 }, to: { x: 7, y: 8 }, period: 480, phase: 432 }]),

  course('mud-crossing-v1', 'Take your time', 'Mud keeps your control but slows your steps. Use a fresh quiet window for the longer crossing.', [9, 14], fill => {
    fill(2, 1, 5, 4, '.');
    fill(3, 5, 3, 5, ':');
    fill(2, 10, 5, 3, '.');
    fill(2, 5, 1, 5, '#');
    fill(6, 5, 1, 5, '#');
  }, { x: 4, y: 2 }, { x: 4, y: 11 }, [{ x: 4, y: 4 }],
  Array.from({ length: 3 }, (_, i): Hazard => ({ kind: 'pulse', x: 3 + i, y: 7, period: 840, on: 300, phase: 0 }))),
]);

type Lesson = Readonly<{ title: string; hint: string }>;
const lessons = (...items: readonly (readonly [string, string])[]) =>
  Object.freeze(items.map(([title, hint]) => Object.freeze({ title, hint })));

export const COURSE_LESSONS: Readonly<Record<string, readonly Lesson[]>> = Object.freeze({
  'first-steps-v1': lessons(
    ['Walk, then stop', 'Use arrows or WASD to reach 01. Release to stop. Stay on the floor and away from pink spikes.'],
    ['Find the way around', 'Head up to 02. Walls stop you safely; the empty space beyond the floor does not. Checkpoints save your place.'],
    ['Follow the floor', 'Walk right to the golden exit, keeping below the spikes. Take your time.'],
  ),
  'gentle-curve-v1': lessons(
    ['Make a gentle curve', 'Green ice has no brakes. Enter right, steer up-right early to pass above the spikes, then turn right onto the wide landing at 01.'],
    ['Back on solid ground', 'You can stop on this landing. Walk right to the golden exit.'],
  ),
  'curb-turn-v1': lessons(
    ['Choose your lane', 'Walk up and right to 01. Line up above the spikes before entering blue ice; you cannot steer once sliding.'],
    ['Let the curb stop you', 'Slide right until the curb stops you. Then launch up along the outer lane to 02.'],
    ['Control returns', 'Back on solid ground, walk left to the golden exit.'],
  ),
  'pulse-crossing-v1': lessons(
    ['A safe place to watch', 'Walk right to 01, then stop before the blast gate. Watch it light up and go dark.'],
    ['Cross while it is quiet', 'Wait for the gate to go dark, then walk right through to the exit. Do not wait inside the gate.'],
  ),
  'saw-crossing-v1': lessons(
    ['Watch the patrol', 'Walk right to 01 and stop before the narrow bridge. Watch the saw pass through the crossing.'],
    ['Let it move away', 'When the saw moves away from the bridge, walk right across to the exit before it returns.'],
  ),
  'mud-crossing-v1': lessons(
    ['Slower, not slippery', 'Walk down to 01. Mud is slower, but you can still turn freely and release to stop.'],
    ['Allow more time', 'Wait here for a fresh dark window, then keep walking down through the mud to the exit. Crossing the blast takes longer at this speed.'],
  ),
});
