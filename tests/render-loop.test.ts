import assert from 'node:assert/strict';
import test from 'node:test';
import { createRenderLoop, fixedSteps } from '../application/render-loop.ts';
import { createState, DT, step, STILL } from '../core/simulation.ts';
import { AFTERSHOCK_LEVELS as LEVELS } from '../data/aftershock.ts';
import { parseLevel } from '../core/level.ts';
import { blankLevel } from '../core/editor.ts';

for (const hz of [15, 30, 60, 120, 144]) {
  test(`FixedSteps_${hz}Hz_DoesNotSkipSingleTickDetonationsBetweenRenderedFrames`, () => {
    const base = blankLevel();
    const level = parseLevel({ ...base, hazards: [
      { kind: 'pulse', ...base.spawn, period: 120, phase: 119, on: 1 },
    ] });
    let state = createState(level), accumulator = 0;
    const deaths: number[] = [];
    for (let frame = 0; frame < hz * 2; frame++) {
      const pending = fixedSteps(accumulator, 1 / hz);
      accumulator = pending.remainder;
      for (let i = 0; i < pending.count; i++) {
        state = step(level, state, STILL);
        if (state.event === 'death') deaths.push(state.tick);
      }
    }
    assert.deepEqual(deaths, [1, 121]);
    assert.equal(state.tick, 240);
  });
}

function harness(onFrame?: (elapsed: number) => void) {
  let nextId = 0, requests = 0;
  const pending = new Map<number, (now: number) => void>();
  const frames: number[] = [], cancelled: number[] = [];
  const loop = createRenderLoop({
    request(callback) { requests++; pending.set(++nextId, callback); return nextId; },
    cancel(id) { cancelled.push(id); pending.delete(id); },
    render(elapsed) { frames.push(elapsed); onFrame?.(elapsed); },
  });
  function fire(now: number) {
    assert.equal(pending.size, 1, 'exactly one frame must be owned');
    const [id, callback] = [...pending][0];
    pending.delete(id); callback(now);
  }
  return { loop, pending, frames, cancelled, fire, requests: () => requests };
}

test('RenderLoop_Invalidation_CoalescesOneFrameThenStopsRequesting', () => {
  const h = harness();
  assert.equal(h.requests(), 0);
  h.loop.invalidate(); h.loop.invalidate(); h.loop.invalidate();
  assert.equal(h.requests(), 1);
  h.fire(100);
  assert.deepEqual(h.frames, [0]);
  assert.equal(h.pending.size, 0);
  assert.equal(h.requests(), 1);
});

test('RenderLoop_Animation_OwnsOneChainAndCapsHitches', () => {
  const h = harness();
  h.loop.setActive(true);
  h.fire(0); h.fire(10); h.fire(1010);
  assert.deepEqual(h.frames, [0, 0.01, 0.1]);
  assert.equal(h.pending.size, 1);
});

test('RenderLoop_Pause_SettlesFinalFrameWithoutIdleRequests', () => {
  const h = harness();
  h.loop.setActive(true); h.fire(100); h.fire(120);
  h.loop.setActive(false);
  h.fire(140);
  assert.deepEqual(h.frames, [0, 0.02, 0]);
  assert.equal(h.pending.size, 0);
  assert.equal(h.requests(), 3);
});

test('RenderLoop_Resume_DropsIdleTimeWithoutDuplicateChains', () => {
  const h = harness();
  h.loop.setActive(true); h.fire(100);
  h.loop.setActive(false); h.fire(120);
  h.loop.setActive(true); h.loop.setActive(true); h.loop.invalidate();
  h.fire(60_000); h.fire(60_010);
  assert.deepEqual(h.frames, [0, 0, 0, 0.01]);
  assert.equal(h.pending.size, 1);
});

test('RenderLoop_FixedStepSimulation_Preserves120HzAcrossPauseAndResize', () => {
  let state = createState(LEVELS[0]), accumulator = 0;
  const h = harness(elapsed => {
    const pending = fixedSteps(accumulator, elapsed);
    accumulator = pending.remainder;
    for (let tick = 0; tick < pending.count; tick++) state = step(LEVELS[0], state, STILL);
  });
  h.loop.setActive(true); h.fire(0);
  for (let i = 1; i <= 40; i++) h.fire(i * 25);
  assert.equal(state.tick, 120);
  h.loop.setActive(false); accumulator = 0;
  h.fire(60_000);
  h.loop.invalidate(); h.fire(70_000);
  assert.equal(state.tick, 120);
  assert.equal(h.pending.size, 0);
  h.loop.setActive(true); h.fire(90_000);
  assert.equal(state.tick, 120, 'resume must not catch up');
  h.fire(90_025);
  assert.equal(state.tick, 123);
});

for (const hz of [15, 30, 60, 120, 144]) {
  test(`RenderLoop_${hz}HzFrames_ProduceExactlyTheSameTenSecondsOfMovement`, () => {
    const level = LEVELS[0], input = { x: 1, y: 0 };
    assert.ok(level, 'Borrowed Ground exercises movement, death and resetting hazard phases');
    let state = createState(level), expected = state, accumulator = 0;
    for (let tick = 0; tick < 1200; tick++) expected = step(level, expected, input);
    assert.equal(expected.tick, 1200, 'the fixture must not freeze at an early win');
    assert.ok(expected.deaths > 0, 'the fixture must exercise death and respawn, not just idle movement');
    const h = harness(elapsed => {
      const pending = fixedSteps(accumulator, elapsed);
      accumulator = pending.remainder;
      for (let tick = 0; tick < pending.count; tick++) state = step(level, state, input);
    });
    h.loop.setActive(true); h.fire(0);
    for (let frame = 1; frame <= hz * 10; frame++) h.fire(frame * 1000 / hz);
    assert.deepEqual(state, expected, `${hz} Hz: same movement, deaths and hazard phase`);
    h.loop.dispose();
    assert.equal(h.pending.size, 0);
  });
}

test('FixedSteps_RoundingTolerance_DoesNotConsumeRealPartialTicksOrLoseRemainders', () => {
  assert.deepEqual(fixedSteps(0, 0), { count: 0, remainder: 0 });
  assert.equal(fixedSteps(0, DT - 1e-8).count, 0);
  const first = fixedSteps(0, DT * 1.25);
  assert.equal(first.count, 1);
  assert.ok(Math.abs(first.remainder - DT * 0.25) < 1e-15);
  assert.deepEqual(fixedSteps(first.remainder, DT * 0.75), { count: 1, remainder: 0 });
  assert.deepEqual(fixedSteps(0, DT - Number.EPSILON), { count: 1, remainder: 0 });
  for (const value of [-1, NaN, Infinity]) {
    assert.throws(() => fixedSteps(value, 0), /finite and non-negative/);
    assert.throws(() => fixedSteps(0, value), /finite and non-negative/);
  }
  assert.throws(() => fixedSteps(0, Number.MAX_VALUE), /safe integer/);
});

test('RenderLoop_IrregularFramesAndLongStall_KeepBoundedWorkWithoutFutureCatchUp', () => {
  let accumulator = 0, ticks = 0, lastCount = 0;
  const h = harness(elapsed => {
    const pending = fixedSteps(accumulator, elapsed);
    accumulator = pending.remainder; lastCount = pending.count; ticks += pending.count;
  });
  h.loop.setActive(true); h.fire(0);
  const intervals = [4, 55, 16, 8, 31, 11];
  let now = 0;
  for (let frame = 0; now < 10_000; frame++) {
    now = Math.min(10_000, now + intervals[frame % intervals.length]); h.fire(now);
  }
  assert.equal(ticks, 1200);
  h.fire(15_000);
  assert.equal(lastCount, 12, 'a five-second stall consumes at most the capped 100 ms');
  assert.equal(ticks, 1212);
  h.fire(15_025);
  assert.equal(lastCount, 3, 'discarded wall time is not carried into later frames');
  h.loop.setActive(false); accumulator = 0; h.fire(20_000);
  h.loop.setActive(true); h.fire(100_000);
  assert.equal(ticks, 1215, 'resume consumes none of the pause');
  h.loop.dispose();
});

test('RenderLoop_IntroToPlay_ResetsTimeEvenWhenBothAnimate', () => {
  const h = harness();
  h.loop.setActive(true); h.fire(100);
  h.loop.setActive(true); h.fire(500);
  assert.deepEqual(h.frames, [0, 0]);
  assert.equal(h.pending.size, 1);
});

test('RenderLoop_PausedResize_RendersWithoutAdvancingThenSleeps', () => {
  const h = harness();
  h.loop.setActive(false); h.fire(100);
  h.loop.invalidate(); h.loop.invalidate();
  h.fire(50_000);
  assert.deepEqual(h.frames, [0, 0]);
  assert.equal(h.pending.size, 0);
});

test('RenderLoop_Hidden_CancelsWorkAndRetainsInvalidation', () => {
  const h = harness();
  h.loop.setActive(true); h.fire(100);
  h.loop.setVisible(false);
  h.loop.invalidate(); h.loop.setActive(false); h.loop.drawNow();
  assert.equal(h.pending.size, 0);
  assert.equal(h.requests(), 2);
  assert.equal(h.cancelled.length, 1);
  assert.deepEqual(h.frames, [0]);
  h.loop.setVisible(true); h.fire(50_000);
  assert.deepEqual(h.frames, [0, 0]);
  assert.equal(h.pending.size, 0, 'visibility must not resume paused gameplay');
});

test('RenderLoop_HiddenAnimation_RestoresWithNoCatchUp', () => {
  const h = harness();
  h.loop.setVisible(false); h.loop.setActive(true); h.loop.invalidate();
  assert.equal(h.requests(), 0);
  h.loop.setVisible(true); h.fire(100); h.fire(110);
  h.loop.setVisible(false); h.loop.setVisible(true); h.fire(50_000);
  assert.deepEqual(h.frames, [0, 0.01, 0]);
  assert.equal(h.pending.size, 1);
});

test('RenderLoop_DebugDraw_IsImmediateAndConsumesPendingPausedFrame', () => {
  const h = harness();
  h.loop.setActive(true); h.fire(100);
  h.loop.setActive(false); h.loop.drawNow();
  assert.deepEqual(h.frames, [0, 0]);
  assert.equal(h.cancelled.length, 1);
  assert.equal(h.pending.size, 0);
  h.loop.drawNow();
  assert.deepEqual(h.frames, [0, 0, 0]);
  assert.equal(h.pending.size, 0);
});

test('RenderLoop_DebugDrawDuringAnimation_PreservesOneFreshChain', () => {
  const h = harness();
  h.loop.setActive(true); h.fire(100);
  h.loop.drawNow(); h.fire(1000); h.fire(1010);
  assert.deepEqual(h.frames, [0, 0, 0, 0.01]);
  assert.equal(h.pending.size, 1);
});

test('RenderLoop_CancelledCallback_CannotDrawOrStealNewFrame', () => {
  const h = harness();
  h.loop.setActive(true);
  const stale = [...h.pending.values()][0];
  h.loop.setVisible(false); h.loop.setVisible(true);
  stale(100);
  assert.deepEqual(h.frames, []);
  assert.equal(h.pending.size, 1);
  h.fire(120);
  assert.deepEqual(h.frames, [0]);
});

test('RenderLoop_TransitionInsideFrame_PreservesInvalidationWithoutForking', () => {
  const h = harness(() => {
    if (h.frames.length === 1) {
      h.loop.setActive(false); h.loop.invalidate(); h.loop.drawNow();
    }
  });
  h.loop.setActive(true); h.fire(100); h.fire(110);
  assert.deepEqual(h.frames, [0, 0]);
  assert.equal(h.pending.size, 0);
  assert.equal(h.requests(), 2);
});

test('RenderLoop_Disposal_CancelsAndRejectsEveryRearmPath', () => {
  const h = harness();
  h.loop.setActive(true);
  const stale = [...h.pending.values()][0];
  h.loop.dispose(); h.loop.dispose();
  h.loop.setActive(true); h.loop.invalidate(); h.loop.drawNow();
  h.loop.setVisible(false); h.loop.setVisible(true);
  stale(100);
  assert.equal(h.pending.size, 0);
  assert.equal(h.requests(), 1);
  assert.equal(h.cancelled.length, 1);
  assert.deepEqual(h.frames, []);
});

test('RenderLoop_DisposalInsideFrame_DoesNotScheduleAgain', () => {
  const h = harness(() => h.loop.dispose());
  h.loop.setActive(true); h.fire(100);
  assert.equal(h.pending.size, 0);
  assert.equal(h.requests(), 1);
});
