import assert from 'node:assert/strict';
import { test } from 'node:test';
import { center, parseLevel, type Point, type World } from '../core/level.ts';
import { createState, restartCheckpoint, step, STILL, type State } from '../core/simulation.ts';
import { RULES } from '../data/terrain.ts';
import { walkTo, worldFixture } from './fixtures/world.ts';
import {
  createRunSnapshot, createCheckpointSnapshot, validateRunSnapshot, encodeRunSnapshot, decodeRunSnapshot,
  MAX_RUN_SNAPSHOT_BYTES, RUN_SNAPSHOT_VERSION,
} from '../application/run-snapshot.ts';

const RIGHT = { x: 1, y: 0 };
const RUN_ID = 'run-042-0001';
test('CheckpointSnapshot_PauseLeaveAndReloadNormalizeOnlyDurablePositionAndEpoch_WinStaysExact', () => {
  const world = worldFixture({ puzzleMode: 'checkpoint', hazards: [] });
  let state = createState(world);
  for (let i = 0; i < 260; i++) state = step(world, state, RIGHT);
  assert.equal(state.visited.length, 1);
  const original = structuredClone(state);
  restore(world, state);
  const saved = createCheckpointSnapshot(world, RUN_ID, state);
  assert.deepEqual(state, original, 'live pause/editor-return state remains exact');
  assert.deepEqual(saved.state, restartCheckpoint(world, state));
  assert.notDeepEqual(saved.state.position, state.position);
  assert.equal(saved.state.patternOffset, state.tick);
  restore(world, saved.state);
  assert.equal(encodeRunSnapshot(world, saved),
    encodeRunSnapshot(world, createCheckpointSnapshot(world, RUN_ID, saved.state)), 'same tick restart is byte-identical');
  while (!state.won) state = step(world, state, RIGHT);
  assert.deepEqual(createCheckpointSnapshot(world, RUN_ID, state), createRunSnapshot(world, RUN_ID, state));
  const legacy = worldFixture();
  const live = step(legacy, createState(legacy), RIGHT);
  assert.deepEqual(createCheckpointSnapshot(legacy, RUN_ID, live), createRunSnapshot(legacy, RUN_ID, live));
});

test('CheckpointSnapshot_ActualDeathRestartSequencesKeepTotalsCauseAndCodecValidity', () => {
  const tiles = [...worldFixture().tiles];
  tiles[2] = '#.!....................#';
  const world = worldFixture({ puzzleMode: 'checkpoint', hazards: [], tiles });
  let state = createState(world);
  for (let death = 1; death <= 12; death++) {
    while (!state.respawnTicks) state = step(world, state, RIGHT);
    restore(world, state);
    assert.equal(state.deaths, death);
    const saved = createCheckpointSnapshot(world, RUN_ID, state);
    assert.equal(saved.state.deathCause, 'spikes');
    assert.equal(saved.state.tick, state.tick);
    assert.equal(saved.state.deaths, death);
    state = restartCheckpoint(world, state);
    assert.deepEqual(saved.state, state);
    restore(world, state);
  }
  assert.ok(state.deaths > Math.floor(state.tick / (RULES.respawnTicks + 1)));
});

test('CheckpointSnapshot_ActiveEpochDeathCountdownAndDormantHazardsRoundTrip', () => {
  const world = worldFixture({ puzzleMode: 'checkpoint', hazards: [
    { kind: 'pulse', x: 4, y: 2, period: 120, on: 1, phase: 20, sectionId: 'section-1' },
    { kind: 'saw', from: { x: 11, y: 2 }, to: { x: 11, y: 2 }, period: 120, phase: 0, sectionId: 'section-2' },
  ] });
  let state = createState(world);
  for (let i = 0; i < 31; i++) state = step(world, state, STILL);
  state = restartCheckpoint(world, state);
  while (!state.respawnTicks) state = step(world, state, RIGHT);
  assert.equal(state.deathCause, 'pulse');
  assert.equal(state.patternOffset, 31);
  for (let i = 0; i <= RULES.respawnTicks; i++) {
    restore(world, state);
    state = step(world, state, STILL);
    assert.equal(state.patternOffset, 31, 'ordinary respawn never restarts the active clock');
  }
  // A legal bypass through the future saw is safe while section 1 remains active.
  state = createState(world);
  for (let i = 0; i < 60; i++) state = step(world, state, { x: 0, y: 1 });
  for (let i = 0; i < 300; i++) state = step(world, state, RIGHT);
  for (let i = 0; i < 60; i++) state = step(world, state, { x: 0, y: -1 });
  assert.equal(state.visited.length, 0);
  assert.equal(state.deaths, 0);
  restore(world, state);
});

test('CheckpointSnapshot_InvalidLiveInputIsRejectedBeforeNormalization', () => {
  const world = worldFixture({ puzzleMode: 'checkpoint', hazards: [] });
  let state = createState(world);
  for (let i = 0; i < 160; i++) state = step(world, state, RIGHT);
  const raw = envelope(world, state);
  for (const patch of [
    { patternOffset: -1 }, { patternOffset: state.tick + 1 }, { patternOffset: 0.5 },
    { position: { x: 0.5, y: 0.5 } }, { velocity: { x: Infinity, y: 0 } },
    { event: 'death' }, { deaths: 1, deathCause: null },
    { tick: 1, patternOffset: 1, deaths: 1, deathCause: 'spikes', event: 'none' },
  ]) {
    const invalid = { ...raw.state, ...patch } as State;
    corrupt(world, { ...raw, state: invalid });
    assert.throws(() => createCheckpointSnapshot(world, RUN_ID, invalid));
  }
});

test('CheckpointSnapshot_CompletedSectionHazardsStayDormantInTheExactCodec', () => {
  const world = worldFixture({ puzzleMode: 'checkpoint', hazards: [
    { kind: 'pulse', x: 4, y: 5, period: 120, on: 1, phase: 0, sectionId: 'section-1' },
    { kind: 'saw', from: { x: 4, y: 5 }, to: { x: 4, y: 5 }, period: 120, phase: 0, sectionId: 'section-1' },
  ] });
  let state = createState(world);
  while (!state.visited.length) state = step(world, state, RIGHT);
  state = walkTo(world, state, { x: state.position.x, y: 5.5 });
  state = walkTo(world, state, { x: 4.5, y: 5.5 });
  for (let i = 0; i < 240; i++) {
    restore(world, state);
    state = step(world, state, STILL);
  }
  assert.equal(state.deaths, 0);
  assert.equal(state.visited.length, 1);
});
function restore(world: World, state: State): State {
  const snapshot = createRunSnapshot(world, RUN_ID, state);
  const result = decodeRunSnapshot(world, encodeRunSnapshot(world, snapshot));
  if (result.status !== 'valid') assert.fail(result.reason);
  assert.deepEqual(result.snapshot, snapshot);
  assert.deepEqual(result.snapshot.state, state, 'no position/history normalization');
  return result.snapshot.state;
}
function trace(world: World, inputs: readonly Point[]) {
  const states = [createState(world)];
  for (const input of inputs) states.push(step(world, states.at(-1)!, input));
  return states;
}
function deathWorld(cause: 'void' | 'spikes' | 'pulse' | 'saw'): World {
  const base = worldFixture(), tiles = [...base.tiles];
  if (cause === 'void' || cause === 'spikes')
    tiles[2] = `${tiles[2].slice(0, 4)}${cause === 'void' ? ' ' : '!'}${tiles[2].slice(5)}`;
  return worldFixture({ tiles, hazards: cause === 'pulse'
    ? [{ kind: 'pulse', x: 4, y: 2, period: 120, on: 1, phase: 20 }]
    : cause === 'saw'
      ? [{ kind: 'saw', from: { x: 4, y: 2 }, to: { x: 4, y: 2 }, period: 120, phase: 0 }] : [] });
}
function died(world: World): State {
  let state = createState(world);
  for (let i = 0; i < 1000 && !state.respawnTicks; i++) state = step(world, state, RIGHT);
  assert.equal(state.event, 'death');
  return state;
}
function envelope(world = worldFixture(), state = createState(world)) {
  return structuredClone(createRunSnapshot(world, RUN_ID, state));
}
function corrupt(world: World, value: unknown) {
  const result = validateRunSnapshot(world, value);
  assert.equal(result.status, 'corrupt', JSON.stringify(value));
  assert.throws(() => encodeRunSnapshot(world, value));
  assert.equal(decodeRunSnapshot(world, JSON.stringify(value)).status, 'corrupt');
}

test('Snapshot_ActualIdleMovingCheckpointAndWonBoundaries_RoundTripAndReplayExactly', () => {
  const world = worldFixture();
  const inputs = [...Array<Point>(17).fill(STILL), ...Array<Point>(760).fill(RIGHT)];
  const states = trace(world, inputs);
  const boundaries = [0, 17, 41, ...states.flatMap((s, i) => s.event === 'checkpoint' ? [i] : []),
    states.findIndex(s => s.won)];
  assert.equal(boundaries.length, 6);
  for (const boundary of boundaries) {
    let resumed = restore(world, states[boundary]);
    // Pausing/closure is an absence of steps, not serialized held input or wall time.
    const pausedBytes = encodeRunSnapshot(world, createRunSnapshot(world, RUN_ID, resumed));
    assert.equal(encodeRunSnapshot(world, createRunSnapshot(world, RUN_ID, resumed)), pausedBytes);
    for (let i = boundary; i < inputs.length; i++) {
      resumed = step(world, resumed, inputs[i]);
      assert.deepEqual(resumed, states[i + 1], `resume boundary ${boundary}, step ${i}`);
    }
    assert.equal(resumed.won, true);
    assert.equal(resumed.deaths, 0, 'continuation preserves deathless eligibility');
  }
});

test('Snapshot_AllActualDeathCauses_KeepDeathPositionCountdownAndPersistentCause', () => {
  for (const cause of ['void', 'spikes', 'pulse', 'saw'] as const) {
    const world = deathWorld(cause);
    let original = died(world);
    assert.equal(original.deathCause, cause);
    let resumed = restore(world, original);
    for (let i = 0; i < RULES.respawnTicks + 12; i++) {
      original = step(world, original, STILL);
      resumed = step(world, resumed, STILL);
      assert.deepEqual(resumed, original);
      resumed = restore(world, resumed); // every countdown boundary, including just-respawned
      assert.equal(resumed.deathCause, cause, 'cause survives respawn and live ticks');
      assert.equal(resumed.patternOffset, 0);
      assert.equal(resumed.event, 'none');
    }
    assert.deepEqual(resumed.position, center(world.spawn));
    assert.equal(resumed.respawnTicks, 0);
  }
});

test('Snapshot_DeathAfterCheckpoint_RecoversThenFinishesIdentically', () => {
  const world = worldFixture();
  let state = createState(world);
  for (let i = 0; i < 167; i++) state = step(world, state, RIGHT);
  assert.equal(state.visited.length, 1);
  for (let i = 0; i < 67; i++) state = step(world, state, { x: -1, y: 0 });
  for (let i = 0; i < 100; i++) state = step(world, state, { x: 0, y: 1 });
  for (let i = 0; i < 120 && !state.respawnTicks; i++) state = step(world, state, STILL);
  assert.equal(state.deathCause, 'pulse');
  let resumed = restore(world, state);
  for (let i = 0; i < 700; i++) {
    const input = i < RULES.respawnTicks ? STILL : RIGHT;
    state = step(world, state, input);
    resumed = step(world, resumed, input);
    assert.deepEqual(resumed, state);
  }
  assert.equal(resumed.won, true);
  assert.equal(resumed.deaths, 1);
  restore(world, resumed);
});

test('Snapshot_BoundaryOvershoot_UsesReachableTerrainSpeedIncludingHardIce', () => {
  const tiles = Array<string>(8).fill('.'.repeat(24));
  tiles[2] = `=${'.'.repeat(23)}`;
  const world = worldFixture({ tiles, hazards: [] });
  let state = step(world, createState(world), { x: 0.5, y: 0 });
  for (let i = 0; i < 100 && !state.respawnTicks; i++) state = step(world, state, { x: -1, y: -0.2 });
  assert.equal(state.deathCause, 'void');
  assert.ok(state.position.x < -0.03, 'actual hard-ice fall exceeds a walking-speed allowance');
  restore(world, state);
  const walking = worldFixture({ hazards: [], tiles: Array<string>(8).fill('.'.repeat(24)) });
  // Same envelope is not physically compatible with the slower bordering tile.
  corrupt(walking, envelope(world, state));
});

test('Snapshot_BoundaryFalls_AcceptReachableOvershootButNotArbitraryOutsidePositions', () => {
  for (const direction of [{ x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 }]) {
    const world = worldFixture({ hazards: [], tiles: Array<string>(8).fill('.'.repeat(24)) });
    let state = createState(world);
    // Bypass the exit before crossing the right edge.
    if (direction.x === 1) for (let i = 0; i < 60; i++) state = step(world, state, { x: 0, y: 1 });
    for (let i = 0; i < 1000 && !state.respawnTicks; i++) state = step(world, state, direction);
    assert.equal(state.deathCause, 'void');
    assert.ok(state.position.x < 0 || state.position.x >= 24 || state.position.y < 0 || state.position.y >= 8);
    const invalid = envelope(world, state);
    for (let i = 0; i <= RULES.respawnTicks; i++) {
      restore(world, state);
      state = step(world, state, STILL);
    }
    corrupt(world, { ...invalid, state: { ...invalid.state, position: { x: -0.041, y: 2.5 } } });
    corrupt(world, { ...invalid, state: { ...invalid.state, position: { x: -100, y: 2.5 } } });
    corrupt(world, { ...invalid, state: { ...invalid.state, position: { x: -0.035, y: -0.035 } } });
  }
});

test('Snapshot_ActualMixedSurfacesAndSoftIceTurns_PreserveSpeedsAndSignedZero', () => {
  const base = worldFixture(), tiles = [...base.tiles];
  tiles[2] = '#.~=:..................#';
  const world = worldFixture({ tiles, hazards: [] });
  const inputs = [...Array<Point>(200).fill(RIGHT), ...Array<Point>(200).fill({ x: -1, y: 0 }),
    ...Array<Point>(100).fill({ x: 0, y: -1 }), ...Array<Point>(100).fill(STILL)];
  const states = trace(world, inputs);
  assert.ok(states.some(s => Math.hypot(s.velocity.x, s.velocity.y) > 4.79));
  assert.ok(states.some(s => Math.abs(Math.hypot(s.velocity.x, s.velocity.y) - 4.4) < 1e-12));
  for (const state of states) restore(world, state);
  // Finite analog input is legal too; JSON must not silently turn -0 into +0.
  const signed = step(world, createState(world), { x: 1, y: -0 });
  assert.ok(Object.is(signed.velocity.y, -0));
  assert.ok(Object.is(restore(world, signed).velocity.y, -0));
});

test('Snapshot_ValidatedObjects_AreDetachedAndDeeplyFrozen', () => {
  const world = worldFixture();
  const state = trace(world, Array<Point>(160).fill(RIGHT)).at(-1)!;
  const raw = envelope(world, state), saved = structuredClone(raw);
  const result = validateRunSnapshot(world, raw);
  assert.equal(result.status, 'valid');
  if (result.status !== 'valid') return;
  for (const value of [result, result.snapshot, result.snapshot.state, result.snapshot.state.position,
    result.snapshot.state.velocity, result.snapshot.state.checkpoint, result.snapshot.state.visited])
    assert.ok(Object.isFrozen(value));
  assert.notEqual(result.snapshot.state.position, raw.state.position);
  assert.notEqual(result.snapshot.state.visited, raw.state.visited);
  assert.deepEqual(raw, saved, 'validation does not mutate its input');
});

test('Snapshot_MalformedNonfiniteOversizedAndUnknownKeys_AreExplicitlyCorrupt', () => {
  const world = worldFixture(), raw = envelope(world);
  for (const source of ['', '{', 'null', '[]', 'false', '1', '{"schemaVersion":1e999}',
    ' '.repeat(MAX_RUN_SNAPSHOT_BYTES + 1)])
    assert.equal(decodeRunSnapshot(world, source).status, 'corrupt');
  const unicode = JSON.stringify({ ...raw, extra: '🧊'.repeat(MAX_RUN_SNAPSHOT_BYTES / 3) });
  assert.ok(unicode.length < MAX_RUN_SNAPSHOT_BYTES);
  assert.ok(new TextEncoder().encode(unicode).length > MAX_RUN_SNAPSHOT_BYTES);
  assert.equal(decodeRunSnapshot(world, unicode).status, 'corrupt');
  for (const value of [
    { ...raw, heldKeys: [] }, { ...raw, renderer: {} }, { ...raw, savedAt: 123 },
    { ...raw, runId: '' }, { ...raw, runId: 'a'.repeat(129) }, { ...raw, runId: '../run' },
    { ...raw, revision: 0 }, { ...raw, worldId: 'BAD ID' },
    { ...raw, state: { ...raw.state, sectionIndex: 0 } },
    { ...raw, state: { ...raw.state, position: { x: 1.5, y: 2.5, z: 0 } } },
    { ...raw, state: { ...raw.state, velocity: { x: Infinity, y: 0 } } },
    { ...raw, state: { ...raw.state, velocity: { x: NaN, y: 0 } } },
  ]) corrupt(world, value);
  for (const key of Object.keys(raw.state)) {
    const missing: Record<string, unknown> = { ...raw.state };
    delete missing[key];
    corrupt(world, { ...raw, state: missing });
  }
});

test('Snapshot_ImpossibleClockResetProgressVelocityAndEventCombinations_AreCorrupt', () => {
  const world = worldFixture();
  const state = trace(world, Array<Point>(200).fill(RIGHT)).at(-1)!;
  const raw = envelope(world, state);
  for (const patch of [
    { tick: -1 }, { tick: 1.5 }, { tick: Number.MAX_SAFE_INTEGER + 1 },
    { tick: 0 }, { patternOffset: 1 }, { patternOffset: -1 }, { deaths: -1 }, { deaths: 1.5 },
    { deaths: 1 }, { deathCause: 'pulse' }, { deathCause: 'fire' },
    { deaths: 20, deathCause: 'void' }, { respawnTicks: 1 }, { respawnTicks: 55 },
    { respawnTicks: -1 }, { respawnTicks: 0.5 }, { won: 'false' }, { won: true },
    { event: 'win' }, { event: 'death' }, { event: 'checkpoint' }, { event: 'pause' },
    { velocity: { x: 4.8, y: 4.8 } }, { position: { x: 0.5, y: 0.5 } },
    { position: { x: -0.01, y: 2.5 } },
    { visited: ['14,2'] }, { visited: ['14,2', '6,2'] }, { visited: ['6,2', '6,2'] },
    { visited: ['unknown'] }, { visited: [] }, { checkpoint: world.spawn },
    { checkpoint: { ...world.checkpoints[0], id: 'wrong' } },
    { checkpoint: { ...world.checkpoints[0], radius: 3 } },
    { checkpoint: { x: 6, y: 2 } },
  ]) corrupt(world, { ...raw, state: { ...raw.state, ...patch } });
});

test('Snapshot_DeathAndWinConsistency_RejectForgedCountdownCauseAndFinish', () => {
  const world = deathWorld('pulse'), dead = envelope(world, died(world));
  for (const patch of [
    { event: 'none' }, { deaths: 0 }, { deathCause: null }, { deathCause: 'saw' },
    { velocity: RIGHT }, { won: true }, { position: center(world.spawn) },
    { tick: 1 }, { respawnTicks: 53 }, { checkpoint: world.checkpoints[0] },
  ]) corrupt(world, { ...dead, state: { ...dead.state, ...patch } });
  const clearWorld = worldFixture();
  const win = envelope(clearWorld, trace(clearWorld, Array<Point>(750).fill(RIGHT)).at(-1)!);
  assert.equal(win.state.won, true);
  for (const patch of [
    { event: 'none' }, { won: false }, { velocity: RIGHT }, { respawnTicks: 1 },
    { position: center(clearWorld.spawn) }, { visited: ['6,2'], checkpoint: clearWorld.checkpoints[0] },
  ]) corrupt(clearWorld, { ...win, state: { ...win.state, ...patch } });
});

test('Snapshot_ClockMustAllowCheckpointTicksInAdditionToDeathRecoveryTicks', () => {
  const world = worldFixture();
  const state = trace(world, Array<Point>(160).fill(RIGHT)).at(-1)!;
  const raw = envelope(world, state);
  // 55 ticks can contain one earliest death and its 54-tick recovery,
  // but cannot also contain a checkpoint collection.
  corrupt(world, { ...raw, state: { ...raw.state, tick: 55, event: 'none',
    deaths: 1, deathCause: 'void', position: center(world.checkpoints[0]), velocity: STILL } });
});

test('Snapshot_StrictObjectBoundary_RejectsHolesExtrasAccessorsAndMissingEnvelopeFields', () => {
  const world = worldFixture();
  const raw = envelope(world, trace(world, Array<Point>(160).fill(RIGHT)).at(-1)!);
  for (const key of Object.keys(raw)) {
    const value: Record<string, unknown> = { ...raw };
    delete value[key];
    corrupt(world, value);
  }
  for (const history of [Array(1), Object.assign(['6,2'], { extra: true })]) {
    assert.equal(validateRunSnapshot(world, { ...raw, state: { ...raw.state, visited: history } }).status, 'corrupt');
  }
  const accessor = { ...raw.state };
  Object.defineProperty(accessor, 'tick', { enumerable: true, get: () => raw.state.tick });
  assert.equal(validateRunSnapshot(world, { ...raw, state: accessor }).status, 'corrupt');
  const symbol = { ...raw, [Symbol('extra')]: 1 };
  assert.equal(validateRunSnapshot(world, symbol).status, 'corrupt');
  for (const schemaVersion of [null, '1', -1, 0, 1.5, Infinity])
    corrupt(world, { ...raw, schemaVersion });
});

test('Snapshot_DuplicateJSONFields_AreCorruptRatherThanLastValueWins', () => {
  const world = worldFixture(), bytes = encodeRunSnapshot(world, envelope(world));
  for (const source of [
    bytes.replace('"revision":1', '"revision":2,"revision":1'),
    bytes.replace('"tick":0', '"tick":7,"\\u0074ick":0'),
    bytes.replace('"x":1.5', '"x":999,"x":1.5'),
  ]) assert.equal(decodeRunSnapshot(world, source).status, 'corrupt');
});

test('Snapshot_LongActualInputTraces_RoundTripEveryStepIncludingRepeatedDeaths', () => {
  const base = worldFixture(), tiles = [...base.tiles];
  tiles[3] = '#.~~~===:::............#';
  const world = worldFixture({ tiles, hazards: [...base.hazards,
    { kind: 'saw', from: { x: 4, y: 2 }, to: { x: 4, y: 2 }, period: 120, phase: 0 }] });
  let state = createState(world);
  const directions = [RIGHT, { x: 1, y: 1 }, { x: 0, y: 1 }, STILL,
    { x: -1, y: 0 }, { x: -1, y: -1 }, { x: 0, y: -1 }];
  for (let i = 0; i < 4000; i++) {
    const input = i < 800 ? RIGHT : directions[Math.floor(i / 83) % directions.length];
    const next = step(world, state, input);
    assert.deepEqual(step(world, restore(world, state), input), next);
    state = next;
  }
  assert.ok(state.deaths > 1);
});

test('Snapshot_OneSectionIdleRunAndMaximumTextSize_AreSupportedWithoutInventedProgress', () => {
  const base = worldFixture();
  const world = worldFixture({ checkpoints: [], sections: [{
    ...base.sections[0], bounds: { x: 1, y: 1, width: 22, height: 6 }, completion: { kind: 'goal' },
    camera: { mode: 'fixed', frame: { x: 1, y: 1, width: 22, height: 6 } },
  }] });
  const states = trace(world, [...Array<Point>(1000).fill(STILL), ...Array<Point>(750).fill(RIGHT)]);
  for (const index of [0, 999, 1000, 1100, 1750]) restore(world, states[index]);
  assert.equal(states.at(-1)!.won, true);
  const bytes = encodeRunSnapshot(world, envelope(world));
  const padded = bytes + ' '.repeat(MAX_RUN_SNAPSHOT_BYTES - bytes.length);
  assert.equal(decodeRunSnapshot(world, padded).status, 'valid');
  assert.equal(decodeRunSnapshot(world, padded + ' ').status, 'corrupt');
});

test('Snapshot_SchemaAndWorldIdentityFailures_AreDistinctAndNeverFallbackOrMigrateV1', () => {
  const world = worldFixture(), raw = envelope(world);
  assert.equal(raw.schemaVersion, RUN_SNAPSHOT_VERSION);
  assert.equal(raw.worldVersion, 2);
  assert.equal(raw.runId, RUN_ID);
  for (const patch of [{ schemaVersion: RUN_SNAPSHOT_VERSION + 1 }, { worldVersion: 1 }, { worldVersion: 3 }])
    assert.equal(decodeRunSnapshot(world, JSON.stringify({ ...raw, ...patch })).status, 'unsupported');
  for (const patch of [{ worldId: 'other-world' }, { revision: world.revision + 1 }]) {
    const source = ` \n${JSON.stringify({ ...raw, ...patch })}\n`;
    const original = source;
    const result = decodeRunSnapshot(world, source);
    assert.equal(result.status, 'incompatible');
    assert.equal(source, original, 'caller retains original bytes; no replacement snapshot is supplied');
    assert.ok(!('snapshot' in result));
  }
  const legacy = parseLevel({ ...world, version: 1, resetPatternOnRetry: true });
  assert.equal(decodeRunSnapshot(legacy, JSON.stringify(raw)).status, 'unsupported');
  assert.throws(() => createRunSnapshot(legacy, RUN_ID, createState(legacy)));
  assert.equal(legacy.version, 1);
});
