import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { LEVELS, COURSE_LESSONS } from '../data/levels.ts';
import { REPLAYS } from '../data/replays.ts';
import { RULES } from '../data/terrain.ts';
import { parseLevel, type Level, type Hazard } from '../core/level.ts';
import { createState, step, ascii, terrainAt, hazardSample, type State } from '../core/simulation.ts';

type Command = Readonly<{ ticks: number; x: number; y: number }>;
function run(level: Level, commands: readonly Command[], initial = createState(level)) {
  let state = initial;
  for (const command of commands) {
    for (let tick = 0; tick < command.ticks; tick++) {
      state = step(level, state, command);
      if (state.deaths || state.won) return state;
    }
  }
  return state;
}

test('Tuning_OnlyBuiltInBlastDurationsAreHalved_AllOtherCourseDataStaysUnchanged', () => {
  const originals = LEVELS.map(level => ({ ...level, hazards: level.hazards.map(hazard =>
    hazard.kind === 'pulse' ? { ...hazard, on: hazard.on * 2 } : hazard) }));
  const digest = createHash('sha256').update(JSON.stringify([originals, COURSE_LESSONS, REPLAYS])).digest('hex');
  assert.equal(digest, '66090a785fce5b909ca8735b666410df99b3a09a7e9eaaa911a6b0e802dca53c');
  assert.equal(LEVELS.flatMap(level => level.hazards).filter(hazard => hazard.kind === 'pulse').length, 30);
});

test('Curriculum_SixLessonsAndThreeFocusedPractices_UseOnlyTheirNamedMechanics', () => {
  const expected = [
    ['first-steps-v1', '.', []],
    ['gentle-curve-v1', '.~', []],
    ['curb-turn-v1', '.=', []],
    ['pulse-crossing-v1', '.', ['pulse']],
    ['saw-crossing-v1', '.', ['saw']],
    ['mud-crossing-v1', '.:', ['pulse']],
    ['soft-switchbacks-v1', '.~', []],
    ['hard-routing-v1', '.=', []],
    ['pocket-wave-v1', '.', ['pulse']],
  ] as const;
  assert.equal(LEVELS.length, 9);
  assert.ok(LEVELS.length <= 10);
  assert.equal(REPLAYS.length, LEVELS.length);
  assert.deepEqual(Object.keys(COURSE_LESSONS), LEVELS.map(level => level.id));
  for (const [index, [id, surfaces, hazards]] of expected.entries()) {
    const level = LEVELS[index];
    assert.equal(level.id, id);
    const terrain = [...new Set(level.tiles.join(''))].filter(tile => '.~=:'.includes(tile)).sort();
    assert.deepEqual(terrain, [...surfaces].sort(), id);
    assert.deepEqual([...new Set(level.hazards.map(hazard => hazard.kind))].sort(), [...hazards], id);
    assert.equal(COURSE_LESSONS[id].length, level.checkpoints.length + 1);
    assert.ok(Object.isFrozen(level) && Object.isFrozen(level.hazards));
    assert.ok(Object.isFrozen(COURSE_LESSONS[id]));
    for (const lesson of COURSE_LESSONS[id]) {
      assert.ok(Object.isFrozen(lesson));
      assert.ok(lesson.title.length > 0 && lesson.hint.length > 0 && lesson.hint.length <= 200);
    }
  }
});

test('Practice_CompactRoutes_ProvideSafeRecoveryBetweenSections', () => {
  assert.equal(LEVELS.slice(6).length, 3);
  for (const level of LEVELS.slice(6)) {
    assert.ok(level.tiles[0].length <= 24 && level.tiles.length <= 24, level.id);
    assert.ok(level.checkpoints.length >= 2, 'checkpoint solved sections');
    for (const point of [level.spawn, ...level.checkpoints, level.goal]) {
      assert.equal(terrainAt(level, point).id, 'normal', `${level.id}: stoppable planning ground`);
    }
  }
});

test('PocketWave_ThreeTravelingWaves_DetonateEachPocketAfterTheLocalPathClears', () => {
  const level = LEVELS.find(level => level.id === 'pocket-wave-v1');
  assert.ok(level);
  assert.equal(level.hazards.length, 24);
  for (let section = 0; section < 3; section++) {
    const wave: readonly Hazard[] = level.hazards.slice(section * 8, section * 8 + 7);
    const pocket: Hazard = level.hazards[section * 8 + 7];
    assert.equal(pocket.kind, 'pulse');
    for (const [index, pulse] of wave.entries()) {
      assert.equal(pulse.kind, 'pulse');
      assert.equal(pulse.period, 240);
      const activation = (pulse.period - pulse.phase) % pulse.period;
      assert.equal(hazardSample(pulse, activation - 1).active, false);
      assert.equal(hazardSample(pulse, activation).active, true);
      if (index) assert.equal((wave[index - 1].phase - pulse.phase + pulse.period) % pulse.period, 12);
    }
    const local: Hazard = wave[3];
    assert.equal(local.kind, 'pulse');
    if (local.kind !== 'pulse' || pocket.kind !== 'pulse') continue;
    const localActivation = (local.period - local.phase) % local.period;
    const detonation = localActivation + local.on + [78, 83, 73][section];
    assert.equal(hazardSample(local, detonation).active, false);
    assert.equal(hazardSample(pocket, detonation - 1).active, false);
    assert.equal(hazardSample(pocket, detonation).active, true);
    assert.equal(hazardSample(pocket, detonation - RULES.pulseWarningTicks).warning, true);
  }
});

function statesFor(index: number) {
  const level = LEVELS[index], states: State[] = [createState(level)];
  for (const command of REPLAYS[index]) for (let tick = 0; tick < command.ticks; tick++) {
    states.push(step(level, states.at(-1)!, command));
  }
  return states;
}

function canWalkToGoal(level: Level, blocked: ReadonlySet<string>) {
  const seen = new Set<string>(), pending = [level.spawn];
  while (pending.length) {
    const point = pending.pop()!, key = `${point.x},${point.y}`;
    const ground = terrainAt(level, point);
    if (seen.has(key) || ground.solid || ground.lethal || blocked.has(key)) continue;
    if (point.x === level.goal.x && point.y === level.goal.y) return true;
    seen.add(key);
    for (const [x, y] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) pending.push({ x: point.x + x, y: point.y + y });
  }
  return false;
}

test('Practice_EachReachedCheckpoint_CanStopAndObserveForTwoWaveCycles', () => {
  for (const index of [6, 7, 8]) {
    const level = LEVELS[index];
    const checkpoints = statesFor(index).filter(state => state.event === 'checkpoint');
    assert.equal(checkpoints.length, level.checkpoints.length);
    for (const checkpoint of checkpoints) {
      const stopped = run(level, [{ ticks: 480, x: 0, y: 0 }], checkpoint);
      assert.equal(stopped.deaths, 0);
      assert.deepEqual(stopped.position, checkpoint.position);
      assert.deepEqual(stopped.velocity, { x: 0, y: 0 });
    }
  }
});

test('SoftPractice_SevenSeparateSteeringArcs_NeverBrakeOrBounce', () => {
  const level = LEVELS[6], states = statesFor(6);
  let arcs = 0, turning = false, iceTicks = 0, turn = 0;
  for (let tick = 1; tick < states.length; tick++) {
    const before = states[tick - 1], after = states[tick];
    const onIce = terrainAt(level, before.position).id === 'soft';
    if (onIce) {
      iceTicks++;
      assert.ok(Math.abs(Math.hypot(after.velocity.x, after.velocity.y) - 4.4) < 1e-9);
      const delta = Math.atan2(
        before.velocity.x * after.velocity.y - before.velocity.y * after.velocity.x,
        before.velocity.x * after.velocity.x + before.velocity.y * after.velocity.y,
      );
      assert.ok(Math.abs(delta) <= 3.2 / RULES.tickRate + 1e-9, 'steering, not a wall reflection');
      turn += Math.abs(delta);
      const changed = Math.abs(delta) > 1e-9;
      if (changed && !turning) arcs++;
      turning = changed;
    } else turning = false;
  }
  assert.equal(arcs, 7);
  assert.ok(turn > Math.PI * 1.9, 'two substantially different routed sections, not a diagonal coast');
  assert.ok(iceTicks >= 800);
});

test('SoftPractice_OmittingAnyOfTheSevenArcs_HitsSpikesOrLeavesTheRoute', () => {
  for (const index of [1, 2, 3, 6, 7, 8, 9]) {
    const commands = REPLAYS[6].map((command, i) => i === index
      ? { ...REPLAYS[6][i - 1], ticks: command.ticks } : command);
    const state = run(LEVELS[6], commands);
    assert.ok(state.deathCause === 'spikes' || state.deathCause === 'void', `omitted arc ${index}`);
  }
  for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) {
    const state = run(LEVELS[6], [{ ticks: 1800, x, y }]);
    assert.equal(state.won, false, `held direction ${x},${y}`);
  }
});

test('SoftPractice_EveryTurnBoundaryHasAnEightyMillisecondMargin', () => {
  const level = LEVELS[6], replay = REPLAYS[6];
  for (let index = 0; index < replay.length - 1; index++) for (let offset = -10; offset <= 10; offset++) {
    const commands = replay.map((command, i) => ({
      ...command, ticks: i === index ? command.ticks + offset : i === replay.length - 1 ? 180 : command.ticks,
    }));
    const state = run(level, commands);
    assert.equal(state.deaths, 0, `boundary ${index}, offset ${offset}`);
    assert.equal(state.won, true, `boundary ${index}, offset ${offset}`);
    assert.equal(state.visited.length, level.checkpoints.length);
  }
});

test('HardPractice_ThreeCurbs_StopBeforeNorthWestAndSouthRelaunches', () => {
  const level = LEVELS[7], replay = REPLAYS[7];
  for (const [index, x, y] of [[1, 0, -1], [3, -1, 0], [6, 0, 1]]) {
    const stopped = run(level, replay.slice(0, index + 1));
    assert.equal(terrainAt(level, stopped.position).id, 'hard');
    assert.deepEqual(stopped.velocity, { x: 0, y: 0 });
    const next = step(level, stopped, { x, y });
    assert.deepEqual(next.velocity, { x: 4.8 * x, y: 4.8 * y });
    const stuck = run(level, [{ ...replay[index], ticks: 240 }], stopped);
    assert.deepEqual(stuck.position, stopped.position, 'continuing straight cannot negotiate this curb');
    assert.equal(stuck.won, false);
  }
});

test('HardPractice_PoorAlignmentInEachStagingArea_FailsTheNextSection', () => {
  const level = LEVELS[7], replay = REPLAYS[7];
  const lowerLane = run(level, [{ ticks: 240, x: 1, y: 0 }]);
  assert.equal(lowerLane.deathCause, 'spikes');
  const innerLane = run(level, [
    ...replay.slice(0, 3), { ticks: 67, x: -1, y: 0 }, { ticks: 200, x: 0, y: -1 },
  ]);
  assert.equal(innerLane.deathCause, 'spikes');
  const unaligned = run(level, [...replay.slice(0, 5), { ticks: 200, x: -1, y: 0 }]);
  assert.equal(unaligned.deathCause, 'void', 'the third departure must use the lower opening');
});

test('HardPractice_EachOutsideLane_IsRequiredWithoutAdjacentLandingShortcuts', () => {
  const level = LEVELS[7];
  assert.equal(canWalkToGoal(level, new Set()), true);
  for (const lane of [['15,11', '16,11'], ['15,6', '16,6'], ['1,8', '2,8']]) {
    assert.equal(canWalkToGoal(level, new Set(lane)), false, `must pass the outside lane ${lane}`);
  }
});

test('HardPractice_AlignmentAndAllThreeCurbArrivals_HaveIndependentMargins', () => {
  const level = LEVELS[7], replay = REPLAYS[7];
  for (let alignment = -10; alignment <= 10; alignment++) {
    for (const first of [-18, 18]) for (const second of [-18, 18]) for (const third of [-18, 18]) {
      const commands = replay.map((command, index) => ({
        ...command,
        ticks: index === 1 ? command.ticks + first : index === 3 ? command.ticks + second
          : index === 6 ? command.ticks + third : [0, 5].includes(index) ? command.ticks + alignment
            : index === replay.length - 1 ? 180 : command.ticks,
      }));
      const state = run(level, commands);
      assert.equal(state.deaths, 0, `alignment ${alignment}; curbs ${first},${second},${third}`);
      assert.equal(state.won, true);
      assert.equal(state.visited.length, level.checkpoints.length);
    }
  }
});

test('PocketWave_EachCorridor_IsUnavoidableEvenWithItsSidePocket', () => {
  const level = LEVELS[8];
  assert.equal(canWalkToGoal(level, new Set()), true);
  for (let section = 0; section < 3; section++) {
    const wave = level.hazards.slice(section * 8, section * 8 + 7);
    const blocked = new Set(wave.map(hazard => hazard.kind === 'pulse' ? `${hazard.x},${hazard.y}` : ''));
    assert.equal(canWalkToGoal(level, blocked), false, `wave ${section} cannot be walked around`);
  }
});

test('PocketWave_StraightRuns_HaveNarrowWindowsButMistimedLaunchesStillFail', () => {
  const level = LEVELS[8], replay = REPLAYS[8];
  const windows = [[173, 193], [172, 187], [172, 197]];
  for (let section = 0; section < 3; section++) {
    const index = section * 5, start = run(level, replay.slice(0, index));
    for (let delay = 0; delay < 240; delay++) {
      let state = run(level, [{ ticks: delay, x: 0, y: 0 }], start);
      for (let tick = 0; tick < 600 && !state.deaths && state.visited.length === section; tick++) {
        state = step(level, state, replay[index]);
      }
      const expected = delay >= windows[section][0] && delay <= windows[section][1];
      assert.equal(state.deaths === 0 && state.visited.length === section + 1, expected,
        `section ${section}, departure ${delay}`);
      if (!expected) assert.equal(state.deathCause, 'pulse');
    }
  }
});

test('PocketWave_StayingOnThePathOrCampingInThePocket_DiesAtTheExpectedBlast', () => {
  const level = LEVELS[8], replay = REPLAYS[8];
  for (const [section, pathBlast, pocketBlast] of [[0, 205, 333], [1, 735, 873], [2, 1253, 1371]]) {
    const index = section * 5;
    const exposed = run(level, [...replay.slice(0, index + 1), { ticks: 240, x: 0, y: 0 }]);
    assert.equal(exposed.deathCause, 'pulse');
    assert.equal(exposed.tick, pathBlast);
    const camped = run(level, [...replay.slice(0, index + 2), { ticks: 240, x: 0, y: 0 }]);
    assert.equal(camped.deathCause, 'pulse');
    assert.equal(camped.tick, pocketBlast);
    assert.equal(camped.visited.length, section);
  }
});

test('PocketWave_LocalLaunchAndPocketDwellWindows_WidenWithShorterBlasts', () => {
  const level = LEVELS[8], replay = REPLAYS[8];
  const launches = [[-59, 10], [-56, 8], [-54, 10]];
  const dwells = [[43, 112], [42, 116], [43, 107]];
  for (let section = 0; section < 3; section++) {
    const index = section * 5, start = run(level, replay.slice(0, index));
    const commands = replay.slice(index, index + 5);
    const [low, high] = launches[section];
    for (let delay = 0; delay < 240; delay++) {
      const offset = delay > 120 ? delay - 240 : delay;
      const state = run(level, [{ ticks: delay, x: 0, y: 0 }, ...commands], start);
      const expected = offset >= low && offset <= high;
      assert.equal(state.deaths === 0 && state.visited.length === section + 1, expected, `launch ${section}: ${offset}`);
    }
    for (let dwell = 0; dwell < 240; dwell++) {
      const state = run(level, commands.map((command, i) => ({
        ...command, ticks: i === 2 ? dwell : command.ticks,
      })), start);
      const expected = dwell >= dwells[section][0] && dwell <= dwells[section][1];
      assert.equal(state.deaths === 0 && state.visited.length === section + 1, expected, `dwell ${section}: ${dwell}`);
      if (!expected) assert.equal(state.deathCause, 'pulse', 'too early meets the wave; too late meets the pocket blast');
    }
  }
});

test('PocketWave_FourTickInputErrorsAndCombinedDwellErrors_StillCompleteTheRoute', () => {
  const level = LEVELS[8], replay = REPLAYS[8];
  for (let index = 0; index < replay.length - 1; index++) for (let offset = -4; offset <= 4; offset++) {
    const commands = replay.map((command, i) => ({
      ...command, ticks: i === index ? command.ticks + offset : i === replay.length - 1 ? 100 : command.ticks,
    }));
    const state = run(level, commands);
    assert.equal(state.won, true, `boundary ${index}, offset ${offset}`);
    assert.equal(state.deaths, 0);
    assert.equal(state.visited.length, 3);
  }
  for (const first of [-2, 2]) for (const second of [-2, 2]) for (const third of [-2, 2]) {
    const state = run(level, replay.map((command, index) => ({
      ...command, ticks: command.ticks + (index === 2 ? first : index === 7 ? second : index === 12 ? third : 0),
    })));
    assert.equal(state.won, true);
    assert.equal(state.deaths, 0);
    assert.equal(state.visited.length, 3);
  }
});

for (const [index, level] of LEVELS.entries()) {
  test(`Replay_${level.id}_WinsAtExactFinalTickThroughOrderedCheckpoints`, () => {
    assert.ok(Object.isFrozen(REPLAYS[index]));
    let state = createState(level);
    for (const command of REPLAYS[index]) {
      assert.ok(Object.isFrozen(command));
      assert.ok(Number.isInteger(command.ticks) && command.ticks > 0);
      assert.ok([-1, 0, 1].includes(command.x) && [-1, 0, 1].includes(command.y), 'keyboard-only input');
      for (let tick = 0; tick < command.ticks; tick++) {
        assert.equal(state.won, false, 'no padding after the win tick');
        state = step(level, state, command);
      }
    }
    assert.equal(state.won, true, ascii(level, state));
    assert.equal(state.deaths, 0);
    assert.deepEqual(state.visited, level.checkpoints.map(point => `${point.x},${point.y}`));
    assert.equal(state.tick, REPLAYS[index].reduce((ticks, command) => ticks + command.ticks, 0));
  });
}

test('Step_NonFiniteInput_RejectsInvalidCommand', () => {
  assert.throws(() => step(LEVELS[0], createState(LEVELS[0]), { x: Infinity, y: 0 }), /finite/i);
});
test('Step_HardIceToGround_RegainsFullControl', () => {
  const level = parseLevel({
    version: 1, id: 'transition-fixture', name: 'Transition', description: 'A controlled ice-to-ground boundary.',
    tiles: Array.from({ length: 6 }, () => '....===='),
    spawn: { x: 1, y: 2 }, goal: { x: 1, y: 4 }, checkpoints: [], hazards: [],
  });
  let state = { ...createState(level), position: { x: 4.02, y: 2.5 }, velocity: { x: -4.8, y: 0 } };
  state = step(level, state, { x: 0, y: 1 });
  assert.equal(state.position.y, 2.5);
  const next = step(level, state, { x: 0, y: 1 });
  assert.equal(next.velocity.x, 0);
  assert.equal(next.velocity.y, 3.6);
});

test('Walking_ReleaseAndStraightIntoBoundary_StopsSafelyWithoutWinning', () => {
  const level = LEVELS[0];
  const walked = run(level, [{ ticks: 60, x: 1, y: 0 }]);
  const stopped = step(level, walked, { x: 0, y: 0 });
  assert.deepEqual(stopped.position, walked.position);
  assert.deepEqual(stopped.velocity, { x: 0, y: 0 });
  const blocked = run(level, [{ ticks: 600, x: 1, y: 0 }]);
  assert.equal(blocked.deaths, 0);
  assert.equal(blocked.won, false);
  assert.deepEqual(blocked.velocity, { x: 0, y: 0 });
});

test('SoftIce_StraightAcrossObstacle_FailsInsteadOfBypassingTurn', () => {
  const state = run(LEVELS[1], [{ ticks: 600, x: 1, y: 0 }]);
  assert.equal(state.deathCause, 'spikes');
});

test('SoftIce_Witness_SteersAtConstantSpeedThenStopsOnLanding', () => {
  const level = LEVELS[1];
  let state = createState(level), turningTicks = 0, landingStops = 0;
  for (const command of REPLAYS[1]) for (let tick = 0; tick < command.ticks; tick++) {
    const ground = terrainAt(level, state.position);
    if (ground.id === 'soft' && Math.abs(state.velocity.x * command.y - state.velocity.y * command.x) > 0.5) turningTicks++;
    if (ground.id === 'normal' && state.position.x >= 13) {
      const stopped = step(level, state, { x: 0, y: 0 });
      assert.deepEqual(stopped.position, state.position);
      assert.deepEqual(stopped.velocity, { x: 0, y: 0 });
      landingStops++;
    }
    state = step(level, state, command);
    if (ground.id === 'soft' && !state.won && !state.respawnTicks) {
      assert.ok(Math.abs(Math.hypot(state.velocity.x, state.velocity.y) - 4.4) < 1e-9);
    }
  }
  assert.ok(turningTicks >= 40, 'the curve must require steering, not just a diagonal coast');
  assert.ok(landingStops > 0, 'the landing must restore release-to-stop control');
  assert.equal(terrainAt(level, state.position).id, 'normal');
});

test('SoftIce_FiftyMillisecondErrorsInBothTurnPoints_StillReachLanding', () => {
  const level = LEVELS[1];
  for (let entry = -6; entry <= 6; entry++) for (let curve = -6; curve <= 6; curve++) {
    const commands = REPLAYS[1].map((command, index) => ({
      ...command, ticks: command.ticks + (index === 0 ? entry : index === 1 ? curve : 0),
    }));
    const state = run(level, commands);
    assert.equal(state.deaths, 0, `entry ${entry}, curve ${curve}`);
    assert.equal(terrainAt(level, state.position).id, 'normal');
    assert.ok(state.position.x >= 13, 'reach the far landing, not just the entry pad');
    assert.equal(state.visited.length, level.checkpoints.length);
  }
});

test('HardIce_WrongAlignment_CannotSteerOutOfSpikeLane', () => {
  const level = LEVELS[2];
  let state = run(level, [{ ticks: 95, x: 1, y: 0 }]);
  assert.equal(terrainAt(level, state.position).id, 'hard');
  const lane = state.position.y;
  for (let tick = 0; tick < 100 && !state.deaths; tick++) state = step(level, state, { x: 0, y: -1 });
  assert.equal(state.deathCause, 'spikes');
  assert.equal(state.position.y, lane);
});

test('HardIce_Witness_StopsAtCurbBeforeRelaunchingNorth', () => {
  const level = LEVELS[2], state = run(level, REPLAYS[2].slice(0, 3));
  assert.equal(state.deaths, 0);
  assert.equal(terrainAt(level, state.position).id, 'hard');
  assert.deepEqual(state.velocity, { x: 0, y: 0 });
  const next = step(level, state, { x: 0, y: -1 });
  assert.equal(next.velocity.x, 0);
  assert.equal(next.velocity.y, -4.8);
});

test('HardIce_AlignmentAndCurbArrivalMargins_StillReachLandingAndExit', () => {
  const level = LEVELS[2];
  for (let alignment = -6; alignment <= 6; alignment++) for (const arrival of [-24, 0, 24]) {
    const commands = REPLAYS[2].map((command, index) => ({
      ...command, ticks: command.ticks + (index === 0 ? alignment : index === 2 ? arrival : 0),
    }));
    const landing = run(level, commands.slice(0, 4));
    assert.equal(landing.deaths, 0);
    assert.equal(terrainAt(level, landing.position).id, 'normal');
    assert.equal(landing.visited.length, level.checkpoints.length);
    // Keep walking on the landing until the exit, rather than requiring the same final marker tick.
    const state = run(level, [...commands.slice(0, 4), { ticks: 120, x: -1, y: 0 }]);
    assert.equal(state.deaths, 0, `alignment ${alignment}, arrival ${arrival}`);
    assert.equal(state.won, true);
    assert.equal(state.visited.length, level.checkpoints.length);
  }
});

test('Timing_GatesAndSawBridge_CannotBeWalkedAround', () => {
  for (const index of [3, 4, 5]) {
    const level = LEVELS[index];
    const gate = new Set(level.hazards.flatMap(hazard => {
      if (hazard.kind === 'pulse') return [`${hazard.x},${hazard.y}`];
      const tiles = [];
      for (let y = hazard.from.y; y <= hazard.to.y; y++) tiles.push(`${hazard.from.x},${y}`);
      return tiles;
    }));
    const reachable = (blocked: ReadonlySet<string>) => {
      const pending = [level.spawn], seen = new Set<string>();
      while (pending.length) {
        const point = pending.pop()!, key = `${point.x},${point.y}`;
        const terrain = terrainAt(level, point);
        if (seen.has(key) || blocked.has(key) || terrain.solid || terrain.lethal) continue;
        if (point.x === level.goal.x && point.y === level.goal.y) return true;
        seen.add(key);
        for (const [x, y] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) pending.push({ x: point.x + x, y: point.y + y });
      }
      return false;
    };
    assert.equal(reachable(new Set()), true, level.id);
    assert.equal(reachable(gate), false, `${level.id}: every walkable route must cross the hazard`);
  }
});

for (const [index, cause, unsafeWait] of [[3, 'pulse', 360], [4, 'saw', 0], [5, 'pulse', 650]] as const) {
  test(`Timing_${index}_AnUnsafeLaunchPhaseHitsTheHazard`, () => {
    const state = run(LEVELS[index], REPLAYS[index].map(command =>
      !command.x && !command.y ? { ...command, ticks: unsafeWait } : command));
    assert.equal(state.deathCause, cause);
  });
  test(`Timing_${index}_EveryLaunchOffsetWithinTwoHundredMillisecondsIsSafe`, () => {
    const level = LEVELS[index], commands = REPLAYS[index];
    const wait = commands.findIndex(command => !command.x && !command.y);
    assert.ok(wait >= 0 && commands[wait].ticks >= 30, 'a deliberate, meaningful wait');
    const waiting = run(level, commands.slice(0, wait));
    assert.equal(terrainAt(level, waiting.position).id, 'normal', 'wait on a safe planning pad');
    for (let offset = -24; offset <= 24; offset++) {
      const state = run(level, commands.map((command, i) => ({ ...command, ticks: command.ticks + (i === wait ? offset : 0) })));
      assert.equal(state.won, true, `launch offset ${offset}`);
      assert.equal(state.deaths, 0);
      assert.equal(state.visited.length, level.checkpoints.length);
    }
  });
}

test('PulseWitnesses_CrossInTheMiddleHalfOfTheQuietWindow', () => {
  const crossingTicks: number[] = [];
  for (const index of [3, 5]) {
    const level = LEVELS[index];
    let state = createState(level), crossing = 0;
    for (const command of REPLAYS[index]) for (let tick = 0; tick < command.ticks; tick++) {
      state = step(level, state, command);
      const pulse = level.hazards.find(hazard => {
        if (hazard.kind !== 'pulse') return false;
        const dx = Math.max(Math.abs(state.position.x - hazard.x - 0.5) - RULES.pulseRadius, 0);
        const dy = Math.max(Math.abs(state.position.y - hazard.y - 0.5) - RULES.pulseRadius, 0);
        return Math.hypot(dx, dy) < RULES.radius;
      });
      if (pulse?.kind !== 'pulse') continue;
      crossing++;
      const cycle = (state.tick + pulse.phase) % pulse.period, margin = (pulse.period - pulse.on) / 4;
      assert.ok(cycle >= pulse.on + margin && cycle <= pulse.period - margin, `${level.id}: tick ${state.tick}`);
    }
    assert.ok(crossing > 0, 'the witness must cross the blast footprint, not bypass it');
    crossingTicks.push(crossing);
  }
  assert.ok(crossingTicks[1] >= crossingTicks[0] * 2.3, 'mud needs more than twice the exposure time');
});

test('Mud_LateWindowThatWouldAllowWalking_IsTooShortForMud', () => {
  const level = LEVELS[5];
  const late = REPLAYS[5].map(command => !command.x && !command.y ? { ...command, ticks: 550 } : command);
  const missed = run(level, late);
  assert.equal(missed.deathCause, 'pulse', 'starting late must matter at mud speed');
  const normalGround = parseLevel({ ...level, tiles: level.tiles.map(row => row.replaceAll(':', '.')) });
  const walked = run(normalGround, late);
  assert.equal(walked.deaths, 0);
  assert.equal(walked.won, true, 'the same late window would have been long enough on normal ground');
});

test('Mud_ActualCrossing_IsSlowerAndStillAllowsReleaseToStop', () => {
  const level = LEVELS[5];
  let state = createState(level), mudTicks = 0;
  for (const command of REPLAYS[5]) for (let tick = 0; tick < command.ticks; tick++) {
    const onMud = terrainAt(level, state.position).id === 'mud';
    if (onMud) {
      mudTicks++;
      const stopped = step(level, state, { x: 0, y: 0 });
      assert.deepEqual(stopped.position, state.position);
      assert.deepEqual(stopped.velocity, { x: 0, y: 0 });
    }
    state = step(level, state, command);
    if (onMud && !state.won) assert.ok(Math.abs(Math.hypot(state.velocity.x, state.velocity.y) - 1.5) < 1e-9);
  }
  assert.ok(mudTicks >= 300, 'practice a sustained slow crossing');
});

test('Inspect_AllCourseIndices_RunWitnessesAndReportDynamicUsage', () => {
  const inspect = (index: string) => spawnSync(process.execPath, ['scripts/inspect.ts', index, '--replay'], {
    cwd: new URL('..', import.meta.url), encoding: 'utf8',
  });
  for (let index = 0; index < LEVELS.length; index++) {
    const result = inspect(String(index));
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /"won": true/);
    assert.match(result.stdout, /"deaths": 0/);
  }
  for (const index of ['-1', String(LEVELS.length), '1.5', 'invalid']) {
    const result = inspect(index);
    assert.notEqual(result.status, 0);
    assert.ok(result.stderr.includes(`<0..${LEVELS.length - 1}>`), result.stderr);
  }
});
