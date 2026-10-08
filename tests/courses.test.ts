import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../data/levels.ts';
import { REPLAYS } from '../data/replays.ts';
import { createState, step, ascii, terrainAt } from '../core/simulation.ts';

for (const [index, level] of LEVELS.entries()) {
  test(`Replay_${level.id}_WinsDeathlessThroughEveryCheckpoint`, () => {
    let state = createState(level);
    for (const command of REPLAYS[index]) {
      for (let tick = 0; tick < command.ticks; tick++) state = step(level, state, command);
    }
    assert.equal(state.won, true, ascii(level, state));
    assert.equal(state.deaths, 0);
    assert.equal(state.visited.length, level.checkpoints.length);
    assert.equal(state.tick, REPLAYS[index].reduce((ticks, command) => ticks + command.ticks, 0));
  });
}
test('Step_NonFiniteInput_RejectsInvalidCommand', () => {
  assert.throws(() => step(LEVELS[0], createState(LEVELS[0]), { x: Infinity, y: 0 }), /finite/i);
});
test('Step_HardIceToGround_RegainsFullControl', () => {
  const level = LEVELS[0];
  let state = { ...createState(level), position: { x: 19.5, y: 6.02 }, velocity: { x: 0, y: -4.8 } };
  state = step(level, state, { x: -1, y: 0 });
  assert.equal(state.position.x, 19.5);
  const next = step(level, state, { x: -1, y: 0 });
  assert.equal(next.velocity.x, -3.6);
  assert.equal(next.velocity.y, 0);
});

test('Course_StraightAcrossOpeningIce_FailsInsteadOfBypassingSlalom', () => {
  for (const level of LEVELS) {
    let state = createState(level);
    for (let tick = 0; tick < 500 && !state.deaths; tick++) state = step(level, state, { x: 1, y: 0 });
    assert.ok(state.deaths > 0, `${level.name} needs obstacles across the old straight route`);
  }
});

test('Replay_Courses_RequireSteeringOnIceAndTimingAStop', () => {
  for (const [index, level] of LEVELS.entries()) {
    let state = createState(level), softTurns = 0, deliberateWait = 0;
    for (const command of REPLAYS[index]) {
      for (let tick = 0; tick < command.ticks; tick++) {
        const ground = terrainAt(level, state.position);
        if (ground.id === 'soft' && Math.abs(state.velocity.x * command.y - state.velocity.y * command.x) > 0.5) softTurns++;
        if (!command.x && !command.y && ground.id === 'normal') deliberateWait++;
        state = step(level, state, command);
        if (ground.id === 'soft' && !state.won && !state.respawnTicks) {
          assert.ok(Math.abs(Math.hypot(state.velocity.x, state.velocity.y) - 4.4) < 1e-9, 'every soft-ice tick maintains full forward speed');
        }
      }
    }
    assert.ok(softTurns >= 60, `${level.name} must exercise steering, not just coast in a straight line`);
    if (index === 1) assert.ok(deliberateWait >= 30, 'the second course needs a meaningful timing wait');
  }
});

test('Course_SecondCourseSkippingLaunchWait_HitsTheExplosion', () => {
  const level = LEVELS[1];
  let state = createState(level);
  for (const command of REPLAYS[1].slice(0, 4)) {
    if (command.x === 0 && command.y === 0) continue;
    for (let tick = 0; tick < command.ticks && !state.deaths; tick++) state = step(level, state, command);
  }
  assert.equal(state.deaths, 1, 'launch timing should affect survival');
});

test('Course_WrongHardIceLane_CannotSteerAwayFromSpikes', () => {
  const level = LEVELS[0];
  let state = { ...createState(level), position: { x: 19.5, y: 3.5 } };
  for (let tick = 0; tick < 65; tick++) state = step(level, state, { x: -1, y: 0 });
  assert.equal(terrainAt(level, state.position).id, 'hard');
  for (let tick = 0; tick < 180 && !state.deaths; tick++) state = step(level, state, { x: 0, y: 1 });
  assert.equal(state.deaths, 1);
  assert.equal(state.position.y, 3.5, 'alignment must be chosen before entering hard ice');
});

test('Course_FirstSlalom_WithFiftyMillisecondTurnErrors_StillLandsSafely', () => {
  for (const firstTurn of [-6, 0, 6]) for (const secondTurn of [-6, 0, 6]) for (const thirdTurn of [-6, 0, 6]) {
    let state = createState(LEVELS[0]);
    const adjustments = [0, firstTurn, secondTurn, thirdTurn, 0];
    for (const [index, command] of REPLAYS[0].slice(0, 5).entries()) {
      for (let tick = 0; tick < command.ticks + adjustments[index]; tick++) state = step(LEVELS[0], state, command);
    }
    assert.equal(state.deaths, 0, `turn offsets: ${firstTurn}, ${secondTurn}, ${thirdTurn}`);
    assert.equal(terrainAt(LEVELS[0], state.position).id, 'normal');
    assert.ok(state.position.x >= 16);
  }
});

test('Course_SecondCourse_TwoHundredMillisecondLaunchMargin_RemainsDeathless', () => {
  const waits = REPLAYS[1].flatMap((command, index) => command.x === 0 && command.y === 0 ? [index] : []);
  for (const wait of waits) for (const offset of [-24, 24]) {
    let state = createState(LEVELS[1]);
    for (const [index, command] of REPLAYS[1].entries()) {
      for (let tick = 0; tick < command.ticks + (index === wait ? offset : 0); tick++) state = step(LEVELS[1], state, command);
    }
    assert.equal(state.won, true, `launch ${wait}, offset ${offset}`);
    assert.equal(state.deaths, 0);
  }
});
