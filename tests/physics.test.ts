import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, step, terrainAt, hazardSample, DT, type State } from '../core/simulation.ts';
import { parseLevel, type Level } from '../core/level.ts';
import { TERRAIN, RULES } from '../data/terrain.ts';

function room(tile = '.', hazards: unknown[] = []): Level {
  return parseLevel({
    version: 1, id: 'test', name: 'Test', description: 'Test chamber',
    tiles: Array.from({ length: 12 }, (_, y) =>
      y === 0 || y === 11 ? '#'.repeat(16) : `#${tile.repeat(14)}#`),
    spawn: { x: 3, y: 5 }, goal: { x: 14, y: 9 }, checkpoints: [], hazards,
  });
}
function run(level: Level, state: State, input: { x: number; y: number }, ticks: number) {
  for (let i = 0; i < ticks; i++) state = step(level, state, input);
  return state;
}

test('Checkpoint_WideLanding_CollectsAcrossTheCorridorAndRespawnsAtItsCenter', () => {
  const level = parseLevel({ ...room(), resetPatternOnRetry: true, checkpoints: [{ x: 7, y: 5, radius: 1.4 }] });
  for (const offset of [-1.2, 0, 1.2]) {
    const start = { ...createState(level), position: { x: 3.5, y: 5.5 + offset } };
    const crossed = run(level, start, { x: 1, y: 0 }, 160);
    assert.deepEqual(crossed.visited, ['7,5']);
    assert.equal(crossed.checkpoint.x, 7);
    const dying: State = { ...crossed, deaths: 1, respawnTicks: RULES.respawnTicks };
    const returned = run(level, dying, { x: 0, y: 0 }, RULES.respawnTicks);
    assert.deepEqual(returned.position, { x: 7.5, y: 5.5 });
    assert.equal(returned.tick - returned.patternOffset, 0);
    assert.deepEqual(returned.visited, ['7,5']);
  }
});

test('Checkpoint_RadiusValidationAndLegacyDefaults_PreserveExistingLevelsAndGoalTrigger', () => {
  for (const radius of [0, -1, 3.1, NaN, Infinity, '1.4', null]) {
    assert.throws(() => parseLevel({ ...room(), checkpoints: [{ x: 7, y: 5, radius }] }), /radius/i);
  }
  const legacy = parseLevel({ ...room(), checkpoints: [{ x: 7, y: 5 }] });
  const before = { ...createState(legacy), position: { x: 6.9, y: 5.5 } };
  assert.deepEqual(step(legacy, before, { x: 0, y: 0 }).visited, []);
  const level = parseLevel({ ...room(), checkpoints: [{ x: 7, y: 5, radius: 1.4 }] });
  assert.deepEqual(parseLevel(JSON.parse(JSON.stringify(level))).checkpoints, level.checkpoints);
  const nearGoal = { ...createState(level), position: { x: 13.8, y: 9.5 } };
  assert.equal(step(level, nearGoal, { x: 0, y: 0 }).won, false);
});

test('Checkpoint_LargeTrigger_DoesNotCollectThroughWallsOrOutsideItsRadius', () => {
  const base = room(), tiles = [...base.tiles];
  tiles[5] = '#......#.......#';
  const level = parseLevel({ ...base, tiles, checkpoints: [{ x: 8, y: 5, radius: 3 }] });
  const behindWall = { ...createState(level), position: { x: 6.5, y: 5.5 } };
  assert.deepEqual(step(level, behindWall, { x: 0, y: 0 }).visited, []);
  const clear = parseLevel({ ...base, checkpoints: [{ x: 8, y: 5, radius: 1.4 }] });
  const outside = { ...createState(clear), position: { x: 7.09, y: 5.5 } };
  assert.deepEqual(step(clear, outside, { x: 0, y: 0 }).visited, []);
});

test('Step_PlayerHitbox_PointTwoRadiusAllowsCloserWallPulseAndSawClearance', () => {
  assert.equal(RULES.radius, 0.20);
  const level = room(), nearWall = { ...createState(level), position: { x: 14.76, y: 5.5 } };
  const moved = step(level, nearWall, { x: 1, y: 0 });
  assert.ok(Math.abs(moved.position.x - 14.79) < 1e-9);
  assert.deepEqual(step(level, moved, { x: 1, y: 0 }).position, moved.position);
  for (const [hazard, safeX, lethalX] of [
    [{ kind: 'pulse', x: 5, y: 5, period: 240, on: 120, phase: 239 }, 6.135, 6.125],
    [{ kind: 'saw', from: { x: 5, y: 5 }, to: { x: 5, y: 5 }, period: 240, phase: 0 }, 6.015, 6.005],
  ] as const) {
    const danger = room('.', [hazard]);
    const at = (x: number) => step(danger, { ...createState(danger), position: { x, y: 5.5 } }, { x: 0, y: 0 });
    assert.equal(at(safeX).deaths, 0, hazard.kind);
    assert.equal(at(lethalX).deathCause, hazard.kind);
  }
});

test('Step_NormalGround_StopsImmediatelyWithoutInput', () => {
  const level = room();
  const moving = run(level, createState(level), { x: 1, y: 0 }, 60);
  assert.ok(moving.position.x > 5);
  const stopped = step(level, moving, { x: 0, y: 0 });
  assert.deepEqual(stopped.position, moving.position);
  assert.deepEqual(stopped.velocity, { x: 0, y: 0 });
});

test('Step_SoftIce_KeepsSpeedAndTurnsThroughAnArc', () => {
  const level = room('~');
  const moving = run(level, createState(level), { x: 1, y: 0 }, 100);
  const coasting = run(level, moving, { x: 0, y: 0 }, 20);
  assert.ok(coasting.position.x > moving.position.x + 0.2);
  const turning = run(level, moving, { x: 0, y: -1 }, 20);
  assert.ok(turning.position.y < moving.position.y - 0.1);
  assert.ok(turning.velocity.x > 0, 'momentum is not replaced by walking');
  assert.ok(Math.abs(Math.hypot(turning.velocity.x, turning.velocity.y) - TERRAIN['~'].speed) < 1e-9);
  assert.equal(coasting.velocity.x, moving.velocity.x, 'releasing input must not introduce drag');
});

test('Step_SoftIceReverse_TurnsWithoutEverBraking', () => {
  const level = room('~');
  let state = run(level, createState(level), { x: 1, y: 0 }, 30);
  const start = state.position;
  for (let tick = 0; tick < 120; tick++) {
    const previous = state;
    state = step(level, state, { x: -1, y: 0 });
    assert.ok(Math.abs(Math.hypot(state.velocity.x, state.velocity.y) - 4.4) < 1e-9);
    assert.ok(Math.abs(Math.hypot(state.position.x - previous.position.x, state.position.y - previous.position.y) - 4.4 * DT) < 1e-9);
  }
  assert.ok(state.velocity.x < -4.3, 'reverse eventually makes a U-turn');
  assert.ok(state.position.y > start.y + 2, 'reverse describes an arc, not an instant flip');
});

test('Step_SoftIceWithoutInput_AlwaysHasForwardMomentum', () => {
  const level = room('~');
  const state = run(level, createState(level), { x: 0, y: 0 }, 120);
  assert.ok(Math.abs(state.position.x - 3.5 - 4.4) < 1e-9);
  assert.ok(Math.abs(Math.hypot(state.velocity.x, state.velocity.y) - 4.4) < 1e-9);
});

test('Step_SoftIceWall_BouncesWithoutLosingSpeed', () => {
  const level = room('~');
  const prior = { ...createState(level), position: { x: 14.77, y: 5.5 }, velocity: { x: 4.4, y: 0 } };
  const bounced = step(level, prior, { x: 0, y: 0 });
  assert.ok(bounced.velocity.x < 0);
  assert.ok(bounced.position.x < prior.position.x);
  assert.equal(Math.hypot(bounced.velocity.x, bounced.velocity.y), 4.4);
});

test('Step_SoftIceLowAnalogInput_DoesNotReduceGlideSpeed', () => {
  const level = room('~');
  const next = step(level, createState(level), { x: 0.1, y: 0 });
  assert.equal(next.velocity.x, 4.4);
});

test('Step_SoftIceRespawn_ResumesForwardMomentumWithoutInput', () => {
  const level = room('~');
  const waiting = { ...createState(level), respawnTicks: 1, deaths: 1 };
  const respawned = step(level, waiting, { x: 0, y: 0 });
  const moving = step(level, respawned, { x: 0, y: 0 });
  assert.equal(moving.velocity.x, 4.4);
  assert.ok(moving.position.x > respawned.position.x);
});

test('Step_HardIce_LocksDirectionAndIgnoresReverseInput', () => {
  const level = room('=');
  const moving = run(level, createState(level), { x: 1, y: 0 }, 30);
  const turning = run(level, moving, { x: -1, y: -1 }, 30);
  assert.equal(turning.position.y, moving.position.y);
  assert.ok(turning.position.x > moving.position.x);
  assert.equal(turning.velocity.y, 0);
});

test('Step_HardIceWall_StopsAndAllowsRelaunch', () => {
  const level = room('=');
  const hit = run(level, createState(level), { x: 1, y: 0 }, 500);
  assert.ok(hit.position.x < 15);
  const relaunched = run(level, hit, { x: 0, y: -1 }, 30);
  assert.ok(relaunched.position.y < hit.position.y);
});

test('Step_HardIceDiagonalIntoWall_DoesNotSlideAlongWall', () => {
  const level = room('=');
  const state = { ...createState(level), position: { x: 15 - RULES.radius - 0.01, y: 5.5 } };
  const blocked = run(level, state, { x: 1, y: 1 }, 120);
  assert.deepEqual(blocked.position, state.position);
  assert.deepEqual(blocked.velocity, { x: 0, y: 0 });
});

for (const tile of ['.', '~', '=']) {
  test(`Step_${tile}_DiagonalInputCannotPassBetweenTouchingWallCorners`, () => {
    const base = room(tile), rows = [...base.tiles];
    for (let y = 1; y <= 5; y++) rows[y] = `${rows[y].slice(0, 4)}#${rows[y].slice(5)}`;
    rows[6] = `####${rows[6].slice(4)}`;
    const level = parseLevel({ ...base, tiles: rows });
    let state = createState(level);
    for (let tick = 0; tick < 600; tick++) {
      state = step(level, state, { x: 1, y: 1 });
      assert.ok(state.position.x < 4 && state.position.y < 6, 'the corner seam is not a shortcut');
      assert.equal(state.deaths, 0);
      assert.equal(state.won, false);
    }
  });
}

test('Step_Mud_IsSlowerThanWalking', () => {
  const normal = room(), mud = room(':');
  const walk = run(normal, createState(normal), { x: 1, y: 0 }, 120);
  const slog = run(mud, createState(mud), { x: 1, y: 0 }, 120);
  assert.ok(slog.position.x - 3.5 < (walk.position.x - 3.5) * 0.6);
});

test('Step_DiagonalInput_DoesNotIncreaseSpeed', () => {
  const level = room();
  const straight = step(level, createState(level), { x: 1, y: 0 });
  const diagonal = step(level, createState(level), { x: 1, y: 1 });
  assert.ok(Math.abs(Math.hypot(diagonal.velocity.x, diagonal.velocity.y) - straight.velocity.x) < 1e-9);
});

test('Step_AnyInput_DoesNotMutatePriorState', () => {
  const level = room('~'), state = createState(level);
  const original = structuredClone(state);
  const next = step(level, state, { x: 1, y: 0 });
  assert.notEqual(next, state);
  assert.deepEqual(state, original);
});

test('Step_RepeatedInput_IsDeterministic', () => {
  const level = room('~');
  assert.deepEqual(
    run(level, createState(level), { x: 1, y: -0.3 }, 420),
    run(level, createState(level), { x: 1, y: -0.3 }, 420),
  );
});

test('Step_Pit_RespawnsAtCheckpointAndPreservesRunTime', () => {
  const base = room();
  const rows = [...base.tiles];
  rows[5] = '#....  ........#';
  const level = parseLevel({ ...base, tiles: rows, checkpoints: [{ x: 4, y: 5 }] });
  let state = run(level, createState(level), { x: 1, y: 0 }, 90);
  assert.ok(state.deaths > 0);
  assert.equal(state.deathCause, 'void');
  assert.deepEqual(state.checkpoint, { x: 4, y: 5 });
  state = run(level, state, { x: 0, y: 0 }, 120);
  assert.deepEqual(state.position, { x: 4.5, y: 5.5 });
  assert.equal(state.tick, 210);
});

test('Hazard_Pulse_OnlyDetonationTickIsLethalRegardlessOfLegacyDuration', () => {
  for (const period of [120, 240, 601, 3600]) for (const phase of [0, 1, period - 1]) {
    const hazard = { kind: 'pulse' as const, x: 5, y: 5, period, on: 60, phase };
    for (let tick = -period; tick <= 2 * period; tick++) {
      const cycle = ((tick + phase) % period + period) % period;
      const sample = hazardSample(hazard, tick);
      assert.equal(sample.active, cycle === 0, `${period}/${phase}@${tick}`);
      assert.equal(sample.warning, cycle >= period - 54);
    }
  }
});

test('Step_PulseFootprint_SafeBeforeAndImmediatelyAfterDetonation', () => {
  const level = room('.', [{ kind: 'pulse', x: 3, y: 5, period: 240, on: 60, phase: 0 }]);
  for (const tick of [238, 239, 240, 241, 478, 479, 480]) {
    const next = step(level, { ...createState(level), tick }, { x: 0, y: 0 });
    assert.equal(next.deaths, next.tick % 240 === 0 ? 1 : 0, `collision at ${next.tick}`);
  }
});

test('Step_PulseAftermath_CanEnterOnTheNextTickAndRemainUntilNextIgnition', () => {
  const level = room('.', [{ kind: 'pulse', x: 5, y: 5, period: 240, on: 120, phase: 0 }]);
  const outside = { ...createState(level), tick: 239, position: { x: 4.865, y: 5.5 } };
  const detonation = step(level, outside, { x: 0, y: 0 });
  assert.equal(detonation.deaths, 0);
  const entered = step(level, detonation, { x: 1, y: 0 });
  assert.ok(entered.position.x > 5.5 - RULES.pulseRadius - RULES.radius);
  const safe = run(level, entered, { x: 0, y: 0 }, 238);
  assert.equal(safe.tick, 479);
  assert.equal(safe.deaths, 0, 'even an overlapping footprint is safe between detonations');
  assert.equal(step(level, safe, { x: 0, y: 0 }).deathCause, 'pulse');
});

test('Step_OptedInRetry_RepeatsPatternWithoutErasingElapsedTimeOrDeaths', () => {
  for (const resetPatternOnRetry of [true, false]) {
    const level = parseLevel({ ...room('.', [
      { kind: 'pulse', x: 4, y: 5, period: 240, on: 1, phase: 225 },
    ]), resetPatternOnRetry });
    const first = run(level, createState(level), { x: 1, y: 0 }, 15);
    assert.equal(first.deaths, 1);
    assert.equal(first.tick, 15);
    const respawn = run(level, first, { x: 1, y: 0 }, 54);
    assert.equal(respawn.tick, 69);
    assert.equal(respawn.deaths, 1);
    assert.deepEqual(respawn.position, createState(level).position);
    assert.equal(respawn.patternOffset, resetPatternOnRetry ? 69 : 0);
    const repeated = run(level, respawn, { x: 1, y: 0 }, 15);
    assert.equal(repeated.tick, 84);
    assert.equal(repeated.deaths, resetPatternOnRetry ? 2 : 1);
    if (resetPatternOnRetry) assert.deepEqual(repeated.position, first.position);
  }
});

test('ParseLevel_RetryPatternFlag_IsOptionalAndRejectsNonBooleanValues', () => {
  assert.equal(room().resetPatternOnRetry, false);
  for (const resetPatternOnRetry of [null, 1, 'true', {}]) {
    assert.throws(() => parseLevel({ ...room(), resetPatternOnRetry }), /resetPatternOnRetry/);
  }
});

test('Hazard_Saw_MovesBetweenEndpoints', () => {
  const hazard = { kind: 'saw' as const, from: { x: 2, y: 3 }, to: { x: 6, y: 3 }, period: 240, phase: 0 };
  assert.equal(hazardSample(hazard, 0).position.x, 2.5);
  assert.equal(hazardSample(hazard, 120).position.x, 6.5);
  assert.equal(hazardSample(hazard, 240).position.x, 2.5);
});

test('Step_ActiveHazard_KillsPlayer', () => {
  const level = room('.', [{ kind: 'pulse', x: 3, y: 5, period: 240, on: 60, phase: 239 }]);
  const hit = step(level, createState(level), { x: 0, y: 0 });
  assert.equal(hit.deaths, 1);
  assert.equal(hit.deathCause, 'pulse');
});

test('Step_MovingSaw_KillsPlayerOnContact', () => {
  const level = room('.', [{ kind: 'saw', from: { x: 3, y: 5 }, to: { x: 6, y: 5 }, period: 240, phase: 0 }]);
  const hit = step(level, createState(level), { x: 0, y: 0 });
  assert.equal(hit.deaths, 1);
  assert.equal(hit.deathCause, 'saw');
});

test('Step_Goal_FreezesWinningTime', () => {
  const level = parseLevel({ ...room(), goal: { x: 4, y: 5 } });
  const won = run(level, createState(level), { x: 1, y: 0 }, 100);
  assert.equal(won.won, true);
  assert.equal(step(level, won, { x: 1, y: 0 }).tick, won.tick);
  assert.ok(won.tick * DT < 1);
});

test('Terrain_OutsideBoard_IsVoid', () => {
  assert.equal(terrainAt(room(), { x: -1, y: 0 }).id, 'void');
});

test('ParseLevel_UnsupportedOrMalformedData_ThrowsHelpfulError', () => {
  assert.throws(() => parseLevel({ ...room(), tiles: ['??'] }), /tiles|terrain|width/i);
  assert.throws(() => parseLevel({ ...room(), spawn: { x: 500, y: 0 } }), /spawn/i);
  assert.throws(() => parseLevel({ ...room(), version: 2 }), /version/i);
  assert.throws(() => parseLevel({ ...room(), hazards: [{ kind: 'pulse', x: 3, y: 3, period: 0 }] }), /period|pulse/i);
});
