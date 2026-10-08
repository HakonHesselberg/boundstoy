import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { LEVELS, COURSE_LESSONS } from '../data/levels.ts';
import { REPLAYS } from '../data/replays.ts';
import { RULES } from '../data/terrain.ts';
import { parseLevel, type Level } from '../core/level.ts';
import { createState, step, ascii, terrainAt } from '../core/simulation.ts';

type Command = Readonly<{ ticks: number; x: number; y: number }>;
function run(level: Level, commands: readonly Command[]) {
  let state = createState(level);
  for (const command of commands) {
    for (let tick = 0; tick < command.ticks; tick++) {
      state = step(level, state, command);
      if (state.deaths || state.won) return state;
    }
  }
  return state;
}

test('Curriculum_SixConcepts_IntroducesOnlyTheNamedMechanic', () => {
  const expected = [
    ['first-steps-v1', '.', []],
    ['gentle-curve-v1', '.~', []],
    ['curb-turn-v1', '.=', []],
    ['pulse-crossing-v1', '.', ['pulse']],
    ['saw-crossing-v1', '.', ['saw']],
    ['mud-crossing-v1', '.:', ['pulse']],
  ] as const;
  assert.equal(LEVELS.length, 6);
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

for (const [index, cause] of [[3, 'pulse'], [4, 'saw'], [5, 'pulse']] as const) {
  test(`Timing_${index}_SkippingTheWaitHitsTheHazard`, () => {
    const state = run(LEVELS[index], REPLAYS[index].filter(command => command.x || command.y));
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
  for (let index = 0; index < 6; index++) {
    const result = inspect(String(index));
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /"won": true/);
    assert.match(result.stdout, /"deaths": 0/);
  }
  for (const index of ['-1', '6', '1.5', 'invalid']) {
    const result = inspect(index);
    assert.notEqual(result.status, 0);
    assert.ok(result.stderr.includes(`<0..${LEVELS.length - 1}>`), result.stderr);
  }
});
