import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { LEVELS, COURSE_LESSONS } from '../data/levels.ts';
import { REPLAYS } from '../data/replays.ts';
import { RULES } from '../data/terrain.ts';
import { readProgress, recordFinish } from '../application/storage.ts';
import { parseLevel, type Level } from '../core/level.ts';
import { createState, step, ascii, terrainAt, hazardSample, type State } from '../core/simulation.ts';

type Command = Readonly<{ ticks: number; x: number; y: number }>;
function run(level: Level, commands: readonly Command[], initial = createState(level)) {
  let state = initial;
  for (const command of commands) for (let tick = 0; tick < command.ticks; tick++) {
    state = step(level, state, command);
    if (state.deaths || state.won) return state;
  }
  return state;
}
function statesFor(index: number) {
  const states: State[] = [createState(LEVELS[index])];
  for (const command of REPLAYS[index]) for (let tick = 0; tick < command.ticks; tick++)
    states.push(step(LEVELS[index], states.at(-1)!, command));
  return states;
}

// Captured from e9a1eaa. Translation, rotation and reflection cannot disguise reuse.
const prototypeIds = ['first-steps-v1', 'gentle-curve-v1', 'curb-turn-v1', 'pulse-crossing-v1',
  'saw-crossing-v1', 'mud-crossing-v1', 'soft-switchbacks-v1', 'hard-routing-v1', 'pocket-wave-v1'];
const prototypeShapes = [
  '451492545e1dba941ef1954d7db1652fc7f16913bf3cda2ef117c03feaaef361',
  '540fdb306b88fcabdd5157f5cc25c02b3a09ac0456591f0c0f76b3646aaa802e',
  'c21ed8362087cf00c18cc77b3d89a96511d6e2e89ddb66004fe83d5249b7e4de',
  '0279e591a5d055a3df4e25aa9a683dd2dc1a2d5eea1824a465ba29debe22faff',
  '4278d1b1706db2df17c053f4a14fd8406a63d2ae7724db09f22b47056741b00f',
  'ef749a29f7638aa0d14ff71a5f036cf25cb6fcaed21353a75b11a19bdb05e4f9',
  'a1a3ec1f537335d0caf69125d8ead2aec7f65ee4c6a11503bd26de37295a63c5',
  'd5932b39b6ee3550760a5f6b8e226abea2a47a274741f52e7ee91517a1456a86',
  '60e91a46177db88f45286317453aaac7f396b7c69a4a941e20656395c33d85a2',
];
function shape(rows: readonly string[]) {
  const shapes: string[] = [];
  for (let rotation = 0; rotation < 4; rotation++) {
    for (const flip of [false, true]) {
      let a = rows.map(s => flip ? [...s].reverse().join('') : s);
      while (!a[0].trim()) a.shift();
      while (!a.at(-1)!.trim()) a.pop();
      while (a.every(s => s[0] === ' ')) a = a.map(s => s.slice(1));
      while (a.every(s => s.at(-1) === ' ')) a = a.map(s => s.slice(0, -1));
      shapes.push(a.join('\n'));
    }
    rows = Array.from({ length: rows[0].length }, (_, x) => rows.map(s => s[x]).reverse().join(''));
  }
  return createHash('sha256').update(shapes.sort()[0]).digest('hex');
}

test('Campaign_EightOriginalRelayCourses_NeverInheritPrototypeIdsOrLayouts', () => {
  assert.deepEqual(LEVELS.map(level => level.id), [
    'relay-courtyard-v1', 'relay-hairpin-v1', 'relay-spillway-v1', 'relay-signal-v2',
    'relay-looms-v1', 'relay-terraces-v2', 'relay-interchange-v2', 'relay-crescendo-v2',
  ]);
  assert.ok(LEVELS.length >= 8 && LEVELS.length <= 10);
  assert.equal(new Set(LEVELS.map(level => level.name)).size, LEVELS.length);
  assert.equal(new Set(LEVELS.map(level => shape(level.tiles))).size, LEVELS.length);
  for (const level of LEVELS) {
    assert.ok(!prototypeIds.includes(level.id), 'old saves remain separate');
    assert.ok(!prototypeShapes.includes(shape(level.tiles)), `${level.id}: not a transformed prototype`);
  }
});

test('Campaign_NewIds_PreserveButNeverInheritRetiredRecords', () => {
  const oldRuns = Object.fromEntries(prototypeIds.map(id => [id, { ticks: 1, deaths: 0 }]));
  const saved = readProgress(JSON.stringify({ version: 1, runs: oldRuns }));
  assert.deepEqual(saved, oldRuns);
  assert.ok(LEVELS.every(level => saved[level.id] === undefined), 'no prototype clear counts toward this campaign');
  let progress = saved;
  for (const [index, level] of LEVELS.entries())
    progress = recordFinish(progress, level.id, REPLAYS[index].reduce((sum, c) => sum + c.ticks, 0), 0);
  const restored = readProgress(JSON.stringify({ version: 1, runs: progress }));
  assert.equal(Object.keys(restored).length, prototypeIds.length + LEVELS.length);
  for (const id of prototypeIds) assert.deepEqual(restored[id], oldRuns[id], 'retired records survive current wins');
  assert.deepEqual(saved, oldRuns, 'the original save is not mutated');
});

test('Campaign_ProgressionAndHints_TeachBeforeMixingOnCompactSafeLandings', () => {
  const expected = [
    ['.', []], ['.~', []], ['.=', []], ['.', ['pulse']],
    ['.', ['saw']], ['.:', ['pulse']], ['.~=', ['pulse']], ['.:', ['pulse', 'saw']],
  ] as const;
  assert.equal(REPLAYS.length, LEVELS.length);
  assert.deepEqual(Object.keys(COURSE_LESSONS), LEVELS.map(level => level.id));
  for (const [index, level] of LEVELS.entries()) {
    assert.deepEqual([...new Set(level.tiles.join(''))].filter(t => '.~=:'.includes(t)).sort(),
      [...expected[index][0]].sort(), level.id);
    assert.deepEqual([...new Set(level.hazards.map(h => h.kind))].sort(), [...expected[index][1]], level.id);
    assert.ok(level.tiles.length <= 24 && level.tiles[0].length <= 24);
    assert.ok(level.checkpoints.length >= (index >= 6 ? 3 : 1));
    for (const point of [level.spawn, ...level.checkpoints, level.goal])
      assert.equal(terrainAt(level, point).id, 'normal', 'stoppable observation and recovery');
    assert.ok(Object.isFrozen(level) && Object.isFrozen(level.hazards));
    const lessons = COURSE_LESSONS[level.id];
    assert.ok(Object.isFrozen(lessons));
    assert.equal(lessons.length, level.checkpoints.length + 1);
    for (const lesson of lessons)
      assert.ok(Object.isFrozen(lesson) && lesson.title.length > 0 && lesson.hint.length > 0 && lesson.hint.length <= 200);
  }
});

for (const [index, level] of LEVELS.entries()) {
  test(`Replay_${level.id}_WinsAtExactFinalTickThroughOrderedCheckpoints`, () => {
    assert.ok(Object.isFrozen(REPLAYS[index]));
    let state = createState(level);
    for (const command of REPLAYS[index]) {
      assert.ok(Object.isFrozen(command));
      assert.ok(Number.isInteger(command.ticks) && command.ticks > 0);
      assert.ok([-1, 0, 1].includes(command.x) && [-1, 0, 1].includes(command.y));
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
  test(`Observation_${level.id}_EveryReachedCheckpointIsSafeForTwoFullCycles`, () => {
    const period = Math.max(120, ...level.hazards.map(h => h.period));
    const sites = statesFor(index).filter(state => state.event === 'checkpoint' || state.tick === 0);
    assert.equal(sites.length, level.checkpoints.length + 1);
    for (const site of sites) {
      const stopped = run(level, [{ ticks: 2 * period, x: 0, y: 0 }], site);
      assert.equal(stopped.deaths, 0);
      assert.deepEqual(stopped.position, site.position);
      assert.deepEqual(stopped.velocity, { x: 0, y: 0 });
    }
  });
  test(`Decisions_${level.id}_CannotWinWithOneHeldDirectionOrOmittedTurns`, () => {
    for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1])
      assert.equal(run(level, [{ ticks: 2400, x, y }]).won, false);
    let necessary = 0;
    const commands = REPLAYS[index];
    for (let i = 1; i < commands.length; i++) {
      if ((!commands[i].x && !commands[i].y) || (!commands[i - 1].x && !commands[i - 1].y)) continue;
      if (commands[i].x === commands[i - 1].x && commands[i].y === commands[i - 1].y) continue;
      const altered = commands.map((c, j) => j === i ? { ...commands[i - 1], ticks: c.ticks } : c);
      if (!run(level, altered).won) necessary++;
    }
    assert.ok(necessary >= (index >= 6 ? 3 : 1), `${level.id}: ${necessary} necessary direction decisions`);
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
  assert.deepEqual(next.velocity, { x: 0, y: 3.6 });
});

test('Campaign_CheckpointPhrases_AreSubstantialButLessThanFifteenSeconds', () => {
  for (const [index, level] of LEVELS.entries()) {
    const states = statesFor(index);
    let distance = 0, previousMarker = 0;
    for (let i = 1; i < states.length; i++) {
      distance += Math.hypot(states[i].position.x - states[i - 1].position.x,
        states[i].position.y - states[i - 1].position.y);
      if (states[i].event === 'checkpoint' || states[i].won) {
        assert.ok(i - previousMarker < 15 * RULES.tickRate, `${level.id}: checkpoint retry cost`);
        previousMarker = i;
      }
    }
    assert.ok(distance >= (index >= 6 ? 30 : 15), `${level.id}: ${distance} tiles of actual route`);
  }
});

function reachable(level: Level, blocked: readonly string[]) {
  const seen = new Set(blocked), pending = [level.spawn];
  while (pending.length) {
    const point = pending.pop()!, key = `${point.x},${point.y}`, ground = terrainAt(level, point);
    if (seen.has(key) || ground.solid || ground.lethal) continue;
    if (point.x === level.goal.x && point.y === level.goal.y) return true;
    seen.add(key);
    // Deliberately over-approximate movement, including diagonal corner cutting.
    // Even this more permissive graph must not find a bypass.
    for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1])
      if (x || y) pending.push({ x: point.x + x, y: point.y + y });
  }
  return false;
}
test('Routes_EveryAuthoredBottleneck_IsNecessaryEvenInAnOverPermissiveWalkGraph', () => {
  const cuts = [
    [['10,7', '11,7']],
    [['8,11', '8,12', '8,13', '8,14'], ['11,7', '12,7', '13,7', '14,7']],
    [['11,6', '12,6', '13,6'], ['5,11', '6,11']],
    [['2,8', '3,8', '4,8'], ['8,4', '8,5', '8,6']],
    [['6,13'], ['8,9']],
    [['9,3', '9,4'], ['13,9', '14,9']],
    [['9,13', '10,13', '11,13', '12,13'], ['4,6', '5,6'], ['11,2'], ['14,2']],
    [['7,18'], ['9,16'], ['14,12'], ['17,15'], ['21,10'], ['16,5']],
  ];
  for (const [index, level] of LEVELS.entries()) {
    assert.equal(reachable(level, []), true, level.id);
    for (const cut of cuts[index]) assert.equal(reachable(level, cut), false, `${level.id}: required ${cut}`);
  }
});

test('Walking_ReleaseAndSafeCurb_StopImmediatelyWithoutWinning', () => {
  const level = LEVELS[0], walked = run(level, [{ ticks: 60, x: 1, y: 0 }]);
  const stopped = step(level, walked, { x: 0, y: 0 });
  assert.deepEqual(stopped.position, walked.position);
  assert.deepEqual(stopped.velocity, { x: 0, y: 0 });
  const blocked = run(level, [{ ticks: 600, x: 1, y: 0 }]);
  assert.equal(blocked.deaths, 0);
  assert.equal(blocked.won, false);
  assert.deepEqual(blocked.velocity, { x: 0, y: 0 });
});

test('SoftIce_HairpinAndInterchange_UseRealConstantSpeedArcsWithoutReflections', () => {
  for (const [index, minimumTicks, expectedTurn] of [[1, 600, Math.PI], [6, 300, Math.PI / 2]]) {
    const level = LEVELS[index], states = statesFor(index);
    let iceTicks = 0, totalTurn = 0;
    for (let i = 1; i < states.length; i++) {
      const before = states[i - 1], after = states[i];
      if (terrainAt(level, before.position).id !== 'soft') continue;
      iceTicks++;
      assert.ok(Math.abs(Math.hypot(after.velocity.x, after.velocity.y) - 4.4) < 1e-9);
      const turn = Math.abs(Math.atan2(before.velocity.x * after.velocity.y - before.velocity.y * after.velocity.x,
        before.velocity.x * after.velocity.x + before.velocity.y * after.velocity.y));
      assert.ok(turn <= 3.2 / RULES.tickRate + 1e-9, 'no wall-bounce shortcut');
      totalTurn += turn;
    }
    assert.ok(iceTicks >= minimumTicks);
    assert.ok(Math.abs(totalTurn - expectedTurn) < 1e-9);
    for (const commandIndex of index === 1 ? [1, 2] : [1]) {
      const altered = REPLAYS[index].map((c, i) =>
        i === commandIndex ? { ...REPLAYS[index][i - 1], ticks: c.ticks } : c);
      assert.ok(run(level, altered).deaths > 0, 'omitting an arc leaves the route, not merely a late finish');
    }
  }
});

test('SoftIce_IntroductoryHairpin_AllPairsOfFiftyMillisecondSteeringErrorsRecover', () => {
  for (let entry = -6; entry <= 6; entry++) for (let turn = -6; turn <= 6; turn++) {
    const commands = REPLAYS[1].map((c, i) => ({
      ...c, ticks: i === 0 ? c.ticks + entry : i === 1 ? c.ticks + turn : i === 3 ? 140 : c.ticks,
    }));
    const state = run(LEVELS[1], commands);
    assert.equal(state.deaths, 0, `${entry},${turn}`);
    assert.equal(state.won, true, `${entry},${turn}`);
    assert.equal(state.visited.length, 1);
  }
});

test('HardIce_Spillway_TwoCurbStopsRequireNewLaunchesAndRejectTheInsideLane', () => {
  const level = LEVELS[2];
  for (const [boundary, x, y] of [[1, -1, 0], [2, 0, 1]]) {
    const stopped = run(level, REPLAYS[2].slice(0, boundary + 1));
    assert.equal(terrainAt(level, stopped.position).id, 'hard');
    assert.deepEqual(stopped.velocity, { x: 0, y: 0 });
    assert.deepEqual(step(level, stopped, { x, y }).velocity, { x: 4.8 * x, y: 4.8 * y });
    assert.deepEqual(run(level, [{ ...REPLAYS[2][boundary], ticks: 240 }], stopped).position, stopped.position);
  }
  const badLane = run(level, [{ ticks: 67, x: 1, y: 0 }, { ticks: 65, x: 0, y: 1 }]);
  assert.equal(terrainAt(level, badLane.position).id, 'hard');
  const wrongSteering = run(level, [{ ticks: 240, x: 1, y: 0 }], badLane);
  assert.equal(wrongSteering.deathCause, 'spikes');
  assert.equal(wrongSteering.position.x, badLane.position.x, 'steering cannot repair the locked line');
});

test('HardIce_AlignmentAndBothCurbArrivals_HaveIndependentForgivingMargins', () => {
  for (let align = -6; align <= 6; align++) for (const first of [-24, 0, 24]) for (const second of [-24, 0, 24]) {
    const state = run(LEVELS[2], REPLAYS[2].map((c, i) => ({
      ...c, ticks: i === 4 ? 150 : c.ticks + (i === 0 ? align : i === 1 ? first : i === 2 ? second : 0),
    })));
    assert.equal(state.deaths, 0);
    assert.equal(state.won, true, `${align},${first},${second}`);
    assert.equal(state.visited.length, 2);
  }
});

for (const [index, cause, unsafeOffsets] of [
  [3, 'pulse', [240, 240]], [4, 'saw', [150, 150]], [5, 'pulse', [240, 300]],
] as const) {
  test(`Timing_${index}_BothIntroducedCrossingsTolerateEveryTwoHundredMillisecondLaunchError`, () => {
    const waits = REPLAYS[index].flatMap((c, i) => !c.x && !c.y ? [i] : []);
    assert.equal(waits.length, 2);
    for (const [w, boundary] of waits.entries()) {
      const waiting = run(LEVELS[index], REPLAYS[index].slice(0, boundary));
      assert.equal(terrainAt(LEVELS[index], waiting.position).id, 'normal');
      for (let offset = -24; offset <= 24; offset++) {
        const state = run(LEVELS[index], REPLAYS[index].map((c, i) =>
          ({ ...c, ticks: c.ticks + (i === boundary ? offset : 0) })));
        assert.equal(state.deaths, 0, `${boundary},${offset}`);
        assert.equal(state.won, true);
        assert.equal(state.visited.length, LEVELS[index].checkpoints.length);
      }
      const unsafe = run(LEVELS[index], REPLAYS[index].map((c, i) =>
        ({ ...c, ticks: c.ticks + (i === boundary ? unsafeOffsets[w] : 0) })));
      assert.equal(unsafe.deathCause, cause, 'timing must matter, not just decorative hazards');
    }
  });
}

test('PulseIntroductions_AllActualExposureIsInTheMiddleHalfOfTheQuietWindow', () => {
  for (const index of [3, 5]) {
    const level = LEVELS[index];
    let exposure = 0;
    for (const state of statesFor(index)) for (const hazard of level.hazards) {
      if (hazard.kind !== 'pulse') continue;
      const dx = Math.max(Math.abs(state.position.x - hazard.x - 0.5) - RULES.pulseRadius, 0);
      const dy = Math.max(Math.abs(state.position.y - hazard.y - 0.5) - RULES.pulseRadius, 0);
      if (Math.hypot(dx, dy) >= RULES.radius) continue;
      exposure++;
      const phase = (state.tick + hazard.phase) % hazard.period, margin = (hazard.period - hazard.on) / 4;
      assert.ok(phase >= hazard.on + margin && phase <= hazard.period - margin);
    }
    assert.equal(exposure, index === 3 ? 84 : 201, 'both unavoidable gates are traversed');
  }
});

test('Mud_BothTerracesRemainControllableAndALateWalkingWindowIsTooShort', () => {
  const level = LEVELS[5], states = statesFor(5);
  let mudTicks = 0;
  for (const state of states) if (terrainAt(level, state.position).id === 'mud') {
    mudTicks++;
    const stopped = step(level, state, { x: 0, y: 0 });
    assert.deepEqual(stopped.position, state.position);
    assert.deepEqual(stopped.velocity, { x: 0, y: 0 });
    assert.equal(stopped.deaths, 0);
  }
  assert.ok(mudTicks >= 870);
  for (let i = 0; i < states.length - 1; i++) if (terrainAt(level, states[i].position).id === 'mud')
    assert.ok(Math.abs(Math.hypot(states[i + 1].velocity.x, states[i + 1].velocity.y) - 1.5) < 1e-9);
  function firstCrossing(course: Level) {
    let state = run(course, [{ ticks: 350, x: 0, y: 0 }]);
    while (!state.deaths && !state.visited.length && state.tick < 1300) state = step(course, state, { x: 1, y: 0 });
    return state;
  }
  assert.equal(firstCrossing(level).deathCause, 'pulse');
  const walking = parseLevel({ ...level, tiles: level.tiles.map(row => row.replaceAll(':', '.')) });
  const crossed = firstCrossing(walking);
  assert.equal(crossed.deaths, 0);
  assert.equal(crossed.visited.length, 1);
});

test('Finale_TravellingPhrasesFollowWalkingCadenceAndCampingMeetsTheReturningBlast', () => {
  const level = LEVELS[7], states = statesFor(7);
  for (const [start, length] of [[0, 9], [9, 10]]) {
    for (let i = 0; i < length; i++) {
      const hazard = level.hazards[start + i];
      assert.equal(hazard.kind, 'pulse');
      if (hazard.kind !== 'pulse') continue;
      if (i) assert.equal((level.hazards[start + i - 1].phase - hazard.phase + hazard.period) % hazard.period, 33);
      const nearest = states.reduce((best, next) =>
        Math.hypot(next.position.x - hazard.x - 0.5, next.position.y - hazard.y - 0.5)
          < Math.hypot(best.position.x - hazard.x - 0.5, best.position.y - hazard.y - 0.5) ? next : best);
      assert.equal(hazardSample(hazard, nearest.tick).active, false);
      const untilBlast = hazard.period - (nearest.tick + hazard.phase) % hazard.period;
      assert.ok(untilBlast >= 65 && untilBlast <= 85, 'the chase follows close behind the legal runner');
      const camped = run(level, [{ ticks: hazard.period, x: 0, y: 0 }], nearest);
      assert.equal(camped.deathCause, 'pulse');
      assert.equal(camped.tick, nearest.tick + untilBlast);
    }
  }
});

test('LaterCourses_EveryMovementBoundaryHasAFourTickMarginAndChaseLaunchesHaveTwelve', () => {
  for (const index of [6, 7]) {
    for (let boundary = 0; boundary < REPLAYS[index].length - 1; boundary++) {
      const c = REPLAYS[index][boundary], margin = !c.x && !c.y ? 12 : 4;
      for (let offset = -margin; offset <= margin; offset++) {
        const state = run(LEVELS[index], REPLAYS[index].map((c, i) => ({
          ...c, ticks: i === REPLAYS[index].length - 1 ? c.ticks + 120 : c.ticks + (i === boundary ? offset : 0),
        })));
        assert.equal(state.deaths, 0, `${index}/${boundary}/${offset}`);
        assert.equal(state.won, true, `${index}/${boundary}/${offset}`);
        assert.equal(state.visited.length, 3);
      }
    }
  }
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
