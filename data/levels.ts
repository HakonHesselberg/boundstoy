import { parseLevel, type Hazard, type Point } from '../core/level.ts';
import type { Tile } from './terrain.ts';

function course(id: string, name: string, description: string, draw: (fill: (x: number, y: number, w: number, h: number, tile: Tile) => void) => void,
  spawn: Point, goal: Point, checkpoints: Point[], hazards: Hazard[]) {
  const grid: Tile[][] = Array.from({ length: 17 }, () => Array<Tile>(24).fill(' '));
  draw((x, y, w, h, tile) => {
    for (let row = y; row < y + h; row++) for (let col = x; col < x + w; col++) grid[row][col] = tile;
  });
  return parseLevel({ version: 1, id, name, description, tiles: grid.map(row => row.join('')), spawn, goal, checkpoints, hazards });
}
function gate(x: number, y: number, count: number, period: number, phase: number): Hazard[] {
  return Array.from({ length: count }, (_, i) => ({ kind: 'pulse', x, y: y + i, period, on: 90, phase }));
}

export const LEVELS = Object.freeze([
  course('slalom-and-slide-v2', 'Slalom & slide', 'Green ice never slows down. Aim up-right, curve above the first spikes and below the next, then land on solid ground.', fill => {
    fill(2, 10, 4, 5, '.');
    fill(6, 10, 10, 5, '~');
    fill(8, 12, 1, 3, '!');
    fill(12, 10, 1, 2, '!');
    fill(6, 9, 10, 1, '#');
    fill(2, 15, 19, 1, '#');
    fill(16, 10, 2, 5, '.');
    fill(18, 6, 3, 9, '=');
    fill(21, 6, 1, 9, '#');
    fill(18, 8, 2, 1, '!');
    fill(18, 3, 3, 3, '.');
    fill(18, 2, 3, 1, '#');
    fill(9, 3, 9, 3, '=');
    fill(15, 3, 1, 1, '!');
    fill(15, 5, 1, 1, '!');
    fill(8, 3, 1, 3, '#');
    fill(9, 6, 3, 2, ':');
    fill(9, 8, 3, 1, '#');
  }, { x: 3, y: 13 }, { x: 10, y: 7 }, [{ x: 17, y: 13 }, { x: 19, y: 4 }],
  gate(13, 3, 3, 360, 150)),
  course('commit-and-cross-v2', 'Commit & cross', 'Put it all together: a timed launch, a continuous ice turn, a safe island before the saw, and one final mud crossing.', fill => {
    fill(2, 12, 4, 3, '.');
    fill(6, 11, 4, 4, '=');
    fill(8, 13, 1, 2, '!');
    fill(10, 11, 1, 4, '#');
    fill(6, 15, 5, 1, '#');
    fill(8, 8, 2, 3, '=');
    fill(7, 8, 1, 3, '#');
    fill(10, 8, 1, 3, '#');
    fill(8, 3, 12, 5, '~');
    fill(8, 6, 3, 2, '.');
    fill(13, 3, 2, 2, '.');
    fill(8, 2, 12, 1, '#');
    fill(11, 8, 9, 1, '#');
    fill(12, 5, 1, 3, '!');
    fill(16, 3, 1, 2, '!');
    fill(20, 5, 3, 4, '.');
    fill(20, 9, 3, 4, ':');
    fill(20, 13, 3, 2, '.');
    fill(19, 9, 1, 6, '#');
    fill(23, 5, 1, 10, '#');
  }, { x: 3, y: 13 }, { x: 21, y: 13 }, [{ x: 9, y: 7 }, { x: 13, y: 4 }, { x: 21, y: 7 }],
  [...gate(7, 11, 4, 360, 240),
    { kind: 'saw', from: { x: 15, y: 3 }, to: { x: 15, y: 7 }, period: 360, phase: 0 },
    ...Array.from({ length: 3 }, (_, i): Hazard => ({ kind: 'pulse', x: 20 + i, y: 10, period: 420, on: 150, phase: 60 }))]),
]);

type Lesson = Readonly<{ title: string; hint: string }>;
const lessons = (...items: readonly (readonly [string, string])[]) =>
  Object.freeze(items.map(([title, hint]) => Object.freeze({ title, hint })));

export const COURSE_LESSONS: Readonly<Record<string, readonly Lesson[]>> = Object.freeze({
  'slalom-and-slide-v2': lessons(
    ['Always in motion', 'Green ice has no brakes. Aim up-right, turn above the first spikes, then sweep below the next. Land at 01.'],
    ['Catch a curb', 'Blue ice locks your line. Slide right until the curb stops you, then head north along the outer lane to 02.'],
    ['Line up. Commit.', 'On solid ground, line up with the gap between the spikes. Launch left when the blast is dark; the far curb stops you. Turn down to EXIT.'],
  ),
  'commit-and-cross-v2': lessons(
    ['Read the window', 'Walk up to the open lane before entering blue ice. Wait for the blast to finish, slide right into the curb, then launch north to 01.'],
    ['Keep the curve', 'Head north, then start turning right before the top curb. Stay above the spikes and land on the solid island at 02. No braking on green ice.'],
    ['Pick your moment', 'Stop on the island. When the saw moves away, launch down-right below the next spikes, then turn east to 03.'],
    ['One last crossing', 'Mud is slow. Wait above the blast row for a fresh safe window, then keep moving south to EXIT.'],
  ),
});
