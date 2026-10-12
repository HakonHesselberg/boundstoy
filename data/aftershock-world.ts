import { parseLevel, type Hazard, type Point, type Pulse, type Saw, type World } from '../core/level.ts';
import type { Section, WorldCheckpoint } from '../core/world.ts';

/**
 * Approved rough-world global-coordinate patches.
 * Rows cover section.bounds; hazards, entry and landing are already global.
 * The final patch has an explicit goal,
 * rather than inventing an eighth checkpoint and silently replacing it.
 */
export type AftershockFragment<H extends Hazard = Pulse> = Readonly<{
  section: Section;
  tiles: readonly string[];
  hazards: readonly H[];
  landing: WorldCheckpoint;
  cycle: number;
}>;
export type AftershockGoalFragment = Readonly<Omit<AftershockFragment, 'landing' | 'section'> & {
  section: Section & Readonly<{ completion: Readonly<{ kind: 'goal' }> }>;
  goal: Point;
}>;

const CYCLE = 480;
const SHELTER_ARRIVAL_PHASE = 153;
function pulse(x: number, y: number, detonation: number, period = CYCLE): Pulse {
  return Object.freeze({ kind: 'pulse', x, y, period, on: 1,
    phase: (period - detonation % period) % period });
}
// Align the taught transfers with the continuous approach from section one.
// This is authored phase, never a clock reset when entering the section.
function shelterPulse(x: number, y: number, detonation: number): Pulse {
  return pulse(x, y, detonation + SHELTER_ARRIVAL_PHASE);
}

function fragment<H extends Hazard>(index: number, name: string, x: number, width: number,
  entryX: number, landingX: number, floor: readonly (readonly [number, number, number])[],
  hazards: readonly H[], layout = { y: 0, height: 7, entryY: 3, landingY: 3 },
  cycle = CYCLE): AftershockFragment<H> {
  const bounds = Object.freeze({ x, y: layout.y, width, height: layout.height });
  const rows = Array.from({ length: layout.height }, () => Array<string>(width).fill('#'));
  for (const [y, from, to] of floor) for (let col = from; col <= to; col++) rows[y - layout.y][col - x] = '.';
  const landing = Object.freeze({ id: `aftershock-landing-${index}`, x: landingX, y: layout.landingY, radius: 0.8 });
  return Object.freeze({
    cycle, tiles: Object.freeze(rows.map(row => row.join(''))),
    hazards: Object.freeze(hazards), landing,
    section: Object.freeze({
      id: `aftershock-section-${index}`, name, bounds,
      entry: Object.freeze({ x: entryX, y: layout.entryY }),
      observation: Object.freeze({ x: floor[0][1], y: layout.entryY,
        width: entryX - floor[0][1] + 1, height: 1 }),
      completion: Object.freeze({ kind: 'checkpoint', checkpointId: landing.id }),
      camera: Object.freeze({ mode: 'fixed', frame: bounds }),
    }),
  });
}

export const AFTERSHOCK_OPENING: readonly AftershockFragment[] = Object.freeze([
  // Full-width pulses in a wall-bounded single-file passage. The first flash
  // leads the traveller; subsequent sites advance at 30 ticks/tile.
  fragment(1, 'Following the wake', 0, 19, 1, 17, [[3, 1, 18]],
    Array.from({ length: 13 }, (_, i) => pulse(3 + i, 3, 40 + i * 30))),
  // The central lane catches the straight transfer twice. Dip into the lower
  // shelf, then cross to the upper shelf; each shelf burns behind the traveller.
  // Neither shelf is a permanent safe tile, nor a checkpoint substitute.
  fragment(2, 'Passing shelter', 19, 22, 20, 38,
    [[3, 19, 40], [4, 25, 28], [2, 29, 32]], [
      ...Array.from({ length: 4 }, (_, i) => shelterPulse(22 + i, 3, 20 + i * 30)),
      ...[220, 240, 260, 290].map((tick, i) => shelterPulse(26 + i, 3, tick)),
      ...Array.from({ length: 7 }, (_, i) => shelterPulse(30 + i, 3, 410 + i * 33)),
      ...Array.from({ length: 4 }, (_, i) => shelterPulse(25 + i, 4, 266 + i * 30)),
      ...Array.from({ length: 4 }, (_, i) => shelterPulse(29 + i, 2, 470 + i * 30)),
    ]),
]);

// The patrol sweeps the entire crossing height. Upper/lower crossing lines
// trade travel against the visible patrol position; there are no pulse demands.
const patrol: Saw = Object.freeze({
  kind: 'saw', from: Object.freeze({ x: 46, y: 1 }), to: Object.freeze({ x: 46, y: 5 }),
  period: CYCLE, phase: 409,
});

// Turn south across a westward travelling fan, rather than repeating the
// opening's straight shelf corridor. The inner cut is shorter but closes
// before the outer line. Phase is authored against the actual ordinary walk
// from the opening and patrol; no arrival or retry changes the world clock.
const TRANSFER_ARRIVAL = 1998;
const transferPulse = (x: number, y: number, tick: number) =>
  pulse(x, y, TRANSFER_ARRIVAL + tick);
const transferFloor: readonly (readonly [number, number, number])[] = [
  [3, 55, 62], [4, 59, 63], [5, 59, 63], [6, 57, 61], [7, 57, 61],
  [8, 57, 59], [9, 57, 59], [10, 58, 58], [11, 58, 58], [12, 58, 58], [13, 58, 58],
];

export const AFTERSHOCK_MIDDLE = Object.freeze([
  fragment(3, 'Read the patrol', 41, 14, 41, 52,
    [[3, 41, 54], [2, 43, 49], [4, 43, 49]], [patrol]),
  fragment(4, 'Turning fan', 55, 10, 55, 58, transferFloor, [
    ...Array.from({ length: 6 }, (_, i) => transferPulse(57 + i, 3, 20 + i * 30)),
    ...[4, 5].flatMap(y => Array.from({ length: 5 }, (_, i) =>
      transferPulse(59 + i, y, 170 - i * 30 + (y - 4) * 33))),
    ...[6, 7].flatMap(y => Array.from({ length: 5 }, (_, i) =>
      transferPulse(57 + i, y, 360 - i * 33 + (y - 6) * 33))),
    ...[8, 9].flatMap(y => Array.from({ length: 3 }, (_, i) =>
      transferPulse(57 + i, y, 441 - i * 33 + (y - 8) * 33))),
  ], { y: 0, height: 14, entryY: 3, landingY: 11 }),
]);

/** The production composition ends with an explicit goal fragment. Bounded
 * test compositions instead turn their last landing into an artificial exit. */
export function assembleAftershock(fragments: readonly (AftershockFragment<Hazard> | AftershockGoalFragment)[],
  id: string, name: string, description: string): World {
  const width = Math.max(...fragments.map(f => f.section.bounds.x + f.section.bounds.width));
  const height = Math.max(...fragments.map(f => f.section.bounds.y + f.section.bounds.height));
  const rows = Array.from({ length: height }, () => Array<string>(width).fill('#'));
  for (const f of fragments) f.tiles.forEach((row, y) =>
    [...row].forEach((tile, x) => { rows[f.section.bounds.y + y][f.section.bounds.x + x] = tile; }));
  const last = fragments.at(-1)!;
  const destination = 'goal' in last ? last.goal : last.landing;
  const world = parseLevel({
    version: 2, revision: 1, id, name, description,
    resetPatternOnRetry: false, tiles: rows.map(row => row.join('')),
    spawn: fragments[0].section.entry,
    goal: { x: destination.x, y: destination.y },
    checkpoints: fragments.slice(0, -1).map(f => {
      if (!('landing' in f)) throw new Error('Only the final fragment may complete at goal.');
      return f.landing;
    }),
    hazards: fragments.flatMap(f => f.hazards),
    sections: fragments.map((f, i) => ({ ...f.section,
      completion: i === fragments.length - 1 ? { kind: 'goal' } : f.section.completion })),
  });
  if (world.version !== 2) throw new Error('Expected bounded V2 world.');
  return world;
}

// A single shared crossing: the lower line passes the patrol but its spent
// ground expires behind the player. The direct line is an earlier appointment.
// Both are visible from the south-facing observation at the previous seam.
export const AFTERSHOCK_COMBINED: readonly AftershockFragment<Hazard>[] = Object.freeze([
  fragment(5, 'Conflicting appointments', 42, 23, 58, 44,
    [[14, 58, 58], [15, 58, 58], [16, 49, 56], [16, 58, 58],
      [17, 42, 58], [18, 49, 56]], [
      Object.freeze({ kind: 'saw', from: Object.freeze({ x: 52, y: 15 }),
        to: Object.freeze({ x: 52, y: 19 }), period: CYCLE, phase: 275 } as Saw),
      ...[16, 17, 18].flatMap(y => Array.from({ length: 8 }, (_, i) =>
        pulse(56 - i, y, 2665 + 260 + i * 30 + (y === 17 ? -140 : (y - 17) * 80)))),
    ], { y: 14, height: 7, entryY: 14, landingY: 17 }),
  // A solid island makes the lower arc a commitment, not an interchangeable
  // lane. The short upper fuse closes while the longer lower arc is spent.
  // A 720-tick recurrence leaves a real travel-versus-wait tradeoff at both
  // continuous arrivals; LCM with the earlier 480-tick patterns is 1440.
  fragment(6, 'Take the open arc', 22, 20, 41, 24,
    [[17, 41, 41], [17, 22, 40], [18, 28, 29], [18, 37, 38], [19, 28, 38]], [
      ...Array.from({ length: 7 }, (_, i) => pulse(36 - i, 17, 3398 + 320 + i * 3, 720)),
      ...Array.from({ length: 7 }, (_, i) => pulse(36 - i, 19, 3398 + 80 + i * 30, 720)),
    ], { y: 14, height: 8, entryY: 17, landingY: 17 }, 720),
]);

// Retain both real completion checkpoints when composing the final world.
// Outgoing safe floor (22,17), facing west; section seven can meet (21,17).
// Current board is 65x22, with ample space below for the final pair.

// The crossing turns the familiar travelling front across a horizontal patrol.
// Read both rhythms before choosing the west crossing or the earlier inside line.
const coupled = fragment(7, 'Cross the grain', 10, 12, 21, 17,
  [[17, 21, 21], [17, 15, 20],
    ...Array.from({ length: 7 }, (_, i) => [18 + i, 15, 19] as const),
    [25, 17, 19], [26, 17, 17], [27, 17, 17], [28, 17, 17], [29, 17, 17]],
  [
    Object.freeze({ kind: 'saw', from: Object.freeze({ x: 14, y: 21 }),
      to: Object.freeze({ x: 20, y: 21 }), period: CYCLE, phase: 435 } as Saw),
    ...Array.from({ length: 8 }, (_, i): readonly [number, number, number] => [17 + i, 15, 19])
      .concat([[25, 17, 19]]).flatMap(([y, from, to]) =>
        Array.from({ length: to - from + 1 }, (_, i) =>
          pulse(from + i, y, 144 + 48 * (from + i - 17) + 20 * (y - 17)))),
  ], { y: 14, height: 16, entryY: 17, landingY: 27 });

// One broad turning current, not a sequence of gate rooms. The ordinary route
// follows the inner bank before transferring to spent lower ground; the early
// diagonal takes that lower ground before the returning front. The descending
// arm meets an eastward, north-slanted front in one continuous basin.
const finalFloor: readonly (readonly [number, number, number])[] = [
  [30, 17, 17], [31, 17, 17],
  ...Array.from({ length: 6 }, (_, i) => [32 + i, 16, 18] as const),
  ...Array.from({ length: 4 }, (_, i) => [38 + i, 16, 29] as const),
  [42, 29, 29], [43, 29, 29], [44, 29, 29],
];
function finalFragment(): AftershockGoalFragment {
  const { landing, ...patch } = fragment(8, 'Carry the current', 10, 23, 17, 29,
    finalFloor, finalFloor.filter(([y]) => y >= 32 && y <= 41).flatMap(([y, from, to]) =>
      Array.from({ length: to - from + 1 }, (_, i) =>
        pulse(from + i, y, y < 38
          ? 80 + 33 * (from + i - 17) + 33 * (y - 32)
          : 112 + 24 * (from + i - 17) - 66 * (y - 38)))),
    { y: 30, height: 16, entryY: 30, landingY: 44 });
  return Object.freeze({ ...patch, goal: Object.freeze({ x: landing.x, y: landing.y }),
    section: Object.freeze({ ...patch.section, completion: Object.freeze({ kind: 'goal' as const }) }) });
}
export const AFTERSHOCK_FINALE = Object.freeze([coupled, finalFragment()] as const);
/** Local phase origins, calibrated to ordinary checkpoint collection edges.
 * These are authoring offsets, NOT runtime arrival times. Each puzzle starts
 * its own clock at zero; faster arrivals never change the next puzzle's phase.
 * Historical fragments and assembleAftershock retain their global contract. */
export const CHECKPOINT_PHASE_ORIGINS = Object.freeze([0, 507, 1339, 1872, 2539, 3272, 4072, 4773]);
const productionFragments = [
  ...AFTERSHOCK_OPENING, ...AFTERSHOCK_MIDDLE, ...AFTERSHOCK_COMBINED, ...AFTERSHOCK_FINALE,
];
const historicWorld = assembleAftershock(productionFragments,
  'aftershock', 'Aftershock',
  'One world, eight sequential puzzles and seven safe checkpoints. Only the current puzzle runs. Restart or reload returns to its checkpoint; elapsed time and deaths are retained.');
/** Stable production identity with a new revision for checkpoint puzzle clocks. */
export const AFTERSHOCK_WORLD = parseLevel({
  ...historicWorld, revision: 2, puzzleMode: 'checkpoint',
  hazards: productionFragments.flatMap((fragment, index) => fragment.hazards.map(hazard => ({
    ...hazard, sectionId: fragment.section.id,
    phase: (hazard.phase + CHECKPOINT_PHASE_ORIGINS[index]) % hazard.period,
  }))),
}) as World;

export const AFTERSHOCK_SECTION_HINTS = Object.freeze([
  'Follow the travelling blast into spent ground. Fading debris is harmless; the next flash is farther along.',
  'The straight lane closes twice. Use the lower then upper shelter, and leave each before its blast returns.',
  'Watch the saw’s whole return trip. Choose a crossing line that passes behind it.',
  'The blast fan travels across your turn. Read the inner cut and outer lane before committing south.',
  'Read the saw and the travelling blasts together. Choose the crossing that is open when you arrive.',
  'The short upper fuse and longer lower arc open at different times. Choose a route, then carry it through.',
  'The patrol crosses a travelling front. Read both rhythms before turning into the crossing.',
  'Carry the descending current into the turning basin. Transfer onto spent ground and follow it to the exit.',
]);
