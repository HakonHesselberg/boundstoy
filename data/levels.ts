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

  course('soft-switchbacks-v1', 'Switchback sweep', 'Carry your glide around the lower bend, then weave back between the staggered spike tongues. Solid landings save each section.', [22, 19], fill => {
    fill(1, 13, 4, 5, '.');
    fill(5, 10, 16, 8, '~');
    fill(9, 14, 2, 4, '!');
    fill(18, 5, 3, 5, '.');
    fill(4, 3, 14, 6, '~');
    fill(11, 3, 3, 3, '!');
    fill(7, 7, 2, 2, '!');
    fill(1, 2, 3, 7, '.');
  }, { x: 2, y: 15 }, { x: 2, y: 3 }, [{ x: 19, y: 8 }, { x: 2, y: 5 }]),

  course('hard-routing-v1', 'Three curb route', 'Read each clear lane before committing. Three different curb stops turn a locked slide into a route, with solid ground between sections.', [19, 18], fill => {
    fill(1, 13, 4, 4, '.');
    fill(5, 13, 12, 4, '=');
    fill(8, 15, 3, 2, '!');
    fill(15, 9, 2, 4, '=');
    fill(14, 7, 3, 3, '.');
    fill(12, 2, 5, 5, '=');
    fill(12, 5, 3, 2, '!');
    fill(9, 2, 3, 3, '=');
    fill(5, 2, 4, 5, '.');
    fill(1, 5, 4, 5, '=');
    fill(3, 7, 2, 3, '!');
    fill(1, 10, 5, 2, '.');
    fill(17, 2, 1, 15, '#');
    fill(9, 1, 9, 1, '#');
    fill(0, 5, 1, 7, '#');
  }, { x: 2, y: 15 }, { x: 4, y: 10 }, [{ x: 16, y: 8 }, { x: 7, y: 2 }, { x: 1, y: 10 }]),

  course('pocket-wave-v1', 'Pocket wave', 'Precision bounds: a blast wave overtakes each narrow lane. Duck into its side pocket, then escape as the path clears—the pocket explodes next.', [16, 16], fill => {
    fill(1, 12, 3, 3, '.');
    fill(4, 13, 7, 1, '.');
    fill(11, 11, 4, 4, '.');
    fill(12, 4, 1, 7, '.');
    fill(11, 1, 4, 3, '.');
    fill(4, 2, 7, 1, '.');
    fill(1, 1, 3, 5, '.');
    fill(4, 12, 7, 1, '#');
    fill(4, 14, 7, 1, '#');
    fill(11, 4, 1, 7, '#');
    fill(13, 4, 1, 7, '#');
    fill(4, 1, 7, 1, '#');
    fill(4, 3, 7, 1, '#');
    fill(7, 12, 1, 1, '.');
    fill(7, 11, 1, 1, '#');
    fill(13, 7, 1, 1, '.');
    fill(14, 7, 1, 1, '#');
    fill(7, 3, 1, 1, '.');
    fill(7, 4, 1, 1, '#');
  }, { x: 2, y: 13 }, { x: 2, y: 4 }, [{ x: 12, y: 13 }, { x: 12, y: 2 }, { x: 2, y: 2 }], [
    // Each wave advances one tile per 12 ticks. Its pocket fires 28 ticks after the adjacent path clears.
    ...Array.from({ length: 7 }, (_, i): Hazard => ({ kind: 'pulse', x: 4 + i, y: 13, period: 240, on: 100, phase: (71 - 12 * i + 240) % 240 })),
    { kind: 'pulse', x: 7, y: 12, period: 240, on: 50, phase: 147 },
    ...Array.from({ length: 7 }, (_, i): Hazard => ({ kind: 'pulse', x: 12, y: 10 - i, period: 240, on: 110, phase: (21 - 12 * i + 240) % 240 })),
    { kind: 'pulse', x: 13, y: 7, period: 240, on: 50, phase: 87 },
    ...Array.from({ length: 7 }, (_, i): Hazard => ({ kind: 'pulse', x: 10 - i, y: 2, period: 240, on: 90, phase: (223 - 12 * i + 240) % 240 })),
    { kind: 'pulse', x: 7, y: 3, period: 240, on: 50, phase: 69 },
  ]),
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
  'soft-switchbacks-v1': lessons(
    ['Sweep, then bend north', 'No brakes: sweep up-right above the lower spikes, straighten, then bend up onto 01. Leave room for each arc; green ice never slows.'],
    ['Weave back through the tongues', 'Walk up this landing, then launch left. Sweep down below the upper spikes, straighten, then turn up above the lower pair and left onto 02.'],
    ['Finish on foot', 'Solid ground again. Walk up to the golden exit.'],
  ),
  'hard-routing-v1': lessons(
    ['Read the first lane', 'Align with the clear upper lane before entering blue ice. Slide right to the far curb, then launch up along the outside edge to 01.'],
    ['Turn across the top', 'Launch up through the right-hand lane. Let the top curb stop you, then launch left across the upper shelf to 02.'],
    ['Use the outside corner', 'Walk down to the lower edge of this pad. Launch left to the curb, then down past the inside spikes onto 03.'],
    ['A final landing', 'Walk right across solid ground to the golden exit.'],
  ),
  'pocket-wave-v1': lessons(
    ['Hide, but do not stay', 'Precise timing: duck into the upper pocket as the wave catches you. Return as the path clears; the pocket explodes next. Continue right to 01.'],
    ['Read the climbing wave', 'The next wave climbs. Hide in the right pocket, then exit left as the lane clears—before the pocket blast. Continue up to 02.'],
    ['Reverse the approach', 'This wave runs left. Use the lower pocket, then escape up as the lane clears. Do not camp: the pocket fires next. Continue left to 03.'],
    ['Out of the waves', 'All three lanes are behind you. Walk down this safe landing to the golden exit.'],
  ),
});
