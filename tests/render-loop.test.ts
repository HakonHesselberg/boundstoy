import assert from 'node:assert/strict';
import test from 'node:test';
import { createRenderLoop } from '../application/render-loop.ts';
import { createState, DT, step, STILL } from '../core/simulation.ts';
import { LEVELS } from '../data/levels.ts';

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
    accumulator += elapsed;
    while (accumulator >= DT) {
      state = step(LEVELS[0], state, STILL);
      accumulator -= DT;
    }
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
