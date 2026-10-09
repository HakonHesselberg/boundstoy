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
const pulse = (x: number, y: number, period: number, on: number, phase: number): Hazard =>
  ({ kind: 'pulse', x, y, period, on, phase: ((phase % period) + period) % period });

// Relay station: eight original routes, authored around observation, commitment and recovery.
// IDs deliberately share nothing with the retired prototype, including its stored best times.
export const LEVELS = Object.freeze([
  course('relay-courtyard-v1', 'Relay courtyard',
    'Trace the courtyard balcony. Stop at each corner, read the next stretch, then commit to the turn.', [17, 14], fill => {
      fill(1, 1, 5, 5, '.');
      fill(6, 3, 6, 2, '.');
      fill(10, 5, 2, 5, '.');
      fill(8, 10, 6, 3, '.');
      fill(3, 10, 5, 2, '.');
      fill(12, 3, 1, 7, '#');
      fill(6, 2, 7, 1, '#');
      fill(6, 4, 3, 1, '!');
      fill(8, 12, 6, 1, '#');
    }, { x: 3, y: 3 }, { x: 4, y: 10 }, [{ x: 10, y: 3 }, { x: 10, y: 10 }]),

  course('relay-hairpin-v1', 'Reservoir hairpin',
    'Glide down the reservoir, round its broad bottom and climb the far bank. Two sweeping turns carry one continuous glide.', [18, 17], fill => {
      fill(2, 1, 6, 5, '.');
      fill(3, 6, 5, 8, '~');
      fill(3, 11, 12, 4, '~');
      fill(11, 5, 4, 6, '~');
      fill(11, 1, 6, 4, '.');
      fill(8, 8, 3, 3, '!');
      fill(2, 6, 1, 9, '#');
      fill(3, 15, 12, 1, '#');
    }, { x: 4, y: 3 }, { x: 16, y: 3 }, [{ x: 13, y: 3 }]),

  course('relay-spillway-v1', 'Spillway locks',
    'Align above the spillway. Blue ice carries you down, left and down again; each curb is a deliberate new launch.', [17, 18], fill => {
      fill(8, 1, 7, 3, '.');
      fill(11, 4, 3, 6, '=');
      fill(5, 7, 6, 3, '=');
      fill(5, 10, 2, 3, '=');
      fill(3, 13, 7, 3, '.');
      fill(5, 10, 9, 1, '#');
      fill(5, 10, 2, 3, '=');
      fill(4, 7, 1, 6, '#');
      fill(11, 5, 1, 2, '!');
      fill(7, 7, 3, 2, '!');
    }, { x: 9, y: 2 }, { x: 8, y: 14 }, [{ x: 12, y: 2 }, { x: 5, y: 14 }]),

  course('relay-signal-v1', 'Signal stairs',
    'Read one gate at a time. Climb through the first dark signal, rest on the elbow, then cross the second and turn toward the exit.', [16, 15], fill => {
      fill(1, 10, 5, 4, '.');
      fill(2, 6, 3, 4, '.');
      fill(1, 3, 5, 3, '.');
      fill(6, 4, 4, 3, '.');
      fill(10, 1, 4, 7, '.');
      fill(1, 6, 1, 4, '#');
      fill(5, 6, 1, 4, '#');
      fill(6, 3, 4, 1, '#');
      fill(6, 7, 4, 1, '#');
    }, { x: 3, y: 11 }, { x: 11, y: 2 }, [{ x: 3, y: 5 }, { x: 11, y: 5 }], [
      ...[2, 3, 4].map(x => pulse(x, 8, 600, 120, 170)),
      ...[4, 5, 6].map(y => pulse(8, y, 600, 120, 413)),
    ]),

  course('relay-looms-v1', 'Patrol looms',
    'Two patrols weave across an offset route. Let each saw move away, cross its thread, and stop on the next broad platform.', [18, 17], fill => {
      fill(1, 11, 4, 5, '.');
      fill(5, 13, 3, 1, '.');
      fill(8, 11, 3, 5, '.');
      fill(8, 7, 1, 4, '.');
      fill(6, 3, 6, 4, '.');
      fill(12, 4, 4, 3, '.');
      fill(5, 12, 3, 1, '#');
      fill(5, 14, 3, 1, '#');
      fill(7, 7, 1, 4, '#');
      fill(9, 7, 1, 4, '#');
      fill(11, 3, 1, 1, '!');
    }, { x: 3, y: 13 }, { x: 14, y: 5 }, [{ x: 8, y: 13 }, { x: 8, y: 5 }], [
      { kind: 'saw', from: { x: 6, y: 10 }, to: { x: 6, y: 15 }, period: 600, phase: 410 },
      { kind: 'saw', from: { x: 5, y: 9 }, to: { x: 11, y: 9 }, period: 600, phase: 120 },
    ]),

  course('relay-terraces-v1', 'Silt terraces',
    'Slow does not mean slippery. Cross the silt on a fresh dark signal, turn on the dry terrace, and budget more time for the descent.', [20, 18], fill => {
      fill(1, 1, 5, 5, '.');
      fill(6, 3, 6, 2, ':');
      fill(12, 1, 4, 6, '.');
      fill(13, 7, 2, 5, ':');
      fill(11, 12, 6, 4, '.');
      fill(5, 13, 6, 2, '.');
      fill(6, 2, 6, 1, '#');
      fill(6, 5, 6, 1, '#');
      fill(12, 7, 1, 5, '#');
      fill(15, 7, 1, 5, '#');
    }, { x: 3, y: 3 }, { x: 5, y: 13 }, [{ x: 13, y: 3 }, { x: 13, y: 13 }], [
      ...[3, 4].map(y => pulse(9, y, 720, 120, 0)),
      ...[13, 14].map(x => pulse(x, 9, 720, 120, 0)),
    ]),

  course('relay-interchange-v1', 'High interchange',
    'Carry a green-ice hook into a dry transfer platform. Change to a locked blue slide, relaunch at the curb, then time the high signal bridge.', [23, 21], fill => {
      fill(1, 15, 4, 5, '.');
      fill(5, 15, 8, 5, '~');
      fill(9, 12, 4, 3, '~');
      fill(9, 8, 5, 4, '.');
      fill(4, 8, 5, 3, '=');
      fill(4, 4, 2, 4, '=');
      fill(2, 1, 6, 3, '.');
      fill(3, 4, 1, 7, '#');
      fill(6, 8, 2, 1, '!');
      fill(8, 2, 9, 1, '.');
      fill(8, 1, 9, 1, '#');
      fill(8, 3, 9, 1, '#');
      fill(17, 1, 4, 8, '.');
      fill(5, 14, 4, 1, '!');
    }, { x: 3, y: 17 }, { x: 18, y: 7 },
    [{ x: 11, y: 10 }, { x: 4, y: 2 }, { x: 18, y: 2 }], [
      pulse(11, 2, 600, 100, 200), pulse(14, 2, 600, 100, 200),
    ]),

  course('relay-crescendo-v1', 'Last light relay',
    'Follow the clearing signal around two elbows without camping on a vent. Recover between phrases, climb the slow riser, then let the last patrol pass.', [24, 22], fill => {
      fill(1, 16, 4, 5, '.');
      fill(5, 18, 5, 1, '.');
      fill(9, 14, 1, 4, '.');
      fill(8, 11, 4, 3, '.');
      fill(12, 12, 6, 1, '.');
      fill(17, 13, 1, 4, '.');
      fill(15, 17, 5, 4, '.');
      fill(20, 18, 2, 3, '.');
      fill(21, 7, 1, 11, ':');
      fill(19, 3, 4, 4, '.');
      fill(14, 5, 5, 1, '.');
      fill(11, 3, 3, 5, '.');
      // Leave the inside elbow open to void: the locator points below this
      // approach instead of obscuring the next vertical vent on small screens.
      fill(5, 17, 3, 1, '#');
      fill(5, 19, 5, 1, '#');
      fill(8, 14, 1, 3, '#');
      fill(10, 14, 1, 5, '#');
      fill(12, 11, 6, 1, '#');
      fill(12, 13, 5, 1, '#');
      fill(16, 14, 1, 3, '#');
      fill(18, 13, 1, 4, '#');
      fill(20, 7, 1, 11, '#');
      fill(22, 7, 1, 12, '#');
      fill(14, 4, 5, 1, '#');
      fill(14, 6, 5, 1, '#');
    }, { x: 3, y: 18 }, { x: 12, y: 5 },
    [{ x: 9, y: 12 }, { x: 17, y: 20 }, { x: 21, y: 5 }], [
      // The wave follows the reference runner; the returning blast punishes camping.
      ...[[5, 18], [6, 18], [7, 18], [8, 18], [9, 18], [9, 17], [9, 16], [9, 15], [9, 14]]
        .map(([x, y], i) => pulse(x, y, 720, 100, 720 - (230 + i * 33))),
      ...[[12, 12], [13, 12], [14, 12], [15, 12], [16, 12], [17, 12], [17, 13], [17, 14], [17, 15], [17, 16]]
        .map(([x, y], i) => pulse(x, y, 720, 100, 720 - (760 + i * 33))),
      pulse(21, 10, 720, 120, 0),
      { kind: 'saw', from: { x: 16, y: 2 }, to: { x: 16, y: 8 }, period: 720, phase: 0 },
    ]),
]);

type Lesson = Readonly<{ title: string; hint: string }>;
const lessons = (...items: readonly (readonly [string, string])[]) =>
  Object.freeze(items.map(([title, hint]) => Object.freeze({ title, hint })));

export const COURSE_LESSONS: Readonly<Record<string, readonly Lesson[]>> = Object.freeze({
  'relay-courtyard-v1': lessons(
    ['Read the balcony', 'Use arrows or WASD. Walk right to 01; release to stop. Keep above the pink spikes. The striped curb stops you safely.'],
    ['Turn at the overlook', 'Walk down the outer balcony to 02. Empty space is a fall, not a shortcut. Checkpoints save your place.'],
    ['Close the loop', 'Turn left on the lower shelf and walk to the golden exit. There is no timer to beat.'],
  ),
  'relay-hairpin-v1': lessons(
    ['Round the reservoir', 'Green ice has no brakes. Enter downward, sweep right around the bottom, then steer up the far bank. Start each turn early; keep the central spikes inside your arc.'],
    ['Dry bank', 'You can release to stop here. Walk right to the exit; the whole reservoir is behind you.'],
  ),
  'relay-spillway-v1': lessons(
    ['Choose the spillway lane', 'Walk right to 01 above the clear blue lane. Blue ice locks your direction: line up before entering.'],
    ['Two locks, two launches', 'Slide down to the curb. Launch left along the bottom lane, let the next curb stop you, then launch down to 02. Do not aim through the inside spikes.'],
    ['Leave the spillway', 'Solid ground restores full control. Walk right to the exit.'],
  ),
  'relay-signal-v1': lessons(
    ['Watch from the foot', 'Stay on this dry platform to watch the first signal. When the blast goes dark, walk up through it to 01. Amber means another blast is approaching.'],
    ['Read the second signal', 'Stop on the elbow. Wait for the right-hand gate to go dark, then cross right to 02 without stopping in the gate.'],
    ['Above the signals', 'Turn up on the safe landing and walk to the exit.'],
  ),
  'relay-looms-v1': lessons(
    ['A moving thread', 'Watch the saw cross the narrow floor. Let it move away, then walk right to 01 before it returns. Its full patrol line is visible.'],
    ['Change your viewpoint', 'Stop here and watch the second saw. When it moves away from the vertical crossing, walk up to 02.'],
    ['Beyond the looms', 'Turn right across the broad upper platform to the exit.'],
  ),
  'relay-terraces-v1': lessons(
    ['Budget the slow crossing', 'Mud is slow, not slippery: release to stop. Watch the signal from dry ground and use a fresh dark window to walk right to 01.'],
    ['Down the second terrace', 'Wait on this dry terrace for the lower signal. Walk down through the silt to 02; allow more time than a normal-floor crossing.'],
    ['Dry return', 'Turn left along the dry lower shelf. Feel full walking speed return on the way to the exit.'],
  ),
  'relay-interchange-v1': lessons(
    ['Carry the hook', 'Green ice has no brakes. Launch right, then sweep up into the dry transfer at 01. Leave space for the arc before the far edge.'],
    ['Change movement rules', 'Align on the middle row of this pad, then launch left on blue ice. Let the curb stop you; launch up its outside lane to 02.'],
    ['The high signal bridge', 'You can stop here. Read both vents, then cross right through their dark windows to 03. Do not wait on a vent.'],
    ['Final descent', 'Turn down on this broad landing to the exit.'],
  ),
  'relay-crescendo-v1': lessons(
    ['First continuous phrase', 'Watch the travelling wave. Walk right, then up around the elbow to 01. Keep moving over the vents: a returning blast catches anyone camping.'],
    ['Answer the phrase', 'Recover here, then read the next wave. Walk right and turn down at its elbow to 02. Keep the same steady walking rhythm.'],
    ['The slow riser', 'Walk right onto the riser, then climb up. Mud needs a longer dark window at the signal. Observe from this dry pad before committing to 03.'],
    ['One last thread', 'Wait for the saw to move away from the upper bridge, then walk left to the exit. The relay is complete.'],
  ),
});
