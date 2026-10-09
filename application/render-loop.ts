import { DT } from '../core/simulation.ts';

interface FrameHost {
  request(callback: (now: number) => void): number;
  cancel(id: number): void;
  render(elapsed: number): void;
}

export function fixedSteps(accumulator: number, elapsed: number) {
  const total = accumulator + elapsed;
  if (!Number.isFinite(total) || accumulator < 0 || elapsed < 0) {
    throw new Error('Fixed-step elapsed time and remainder must be finite and non-negative.');
  }
  // Absorb floating-point error at tick boundaries, not real partial ticks.
  const count = Math.floor(total / DT + 1e-9);
  if (!Number.isSafeInteger(count)) throw new Error('Fixed-step count exceeds the safe integer range.');
  return { count, remainder: Math.max(0, total - count * DT) };
}

/** Owns one RAF chain; static scenes wake only when invalidated. */
export function createRenderLoop(host: FrameHost) {
  let active = false, visible = true, dirty = false, disposed = false, drawing = false;
  let pending: number | null = null, lastFrame: number | null = null;

  function cancel() {
    if (pending !== null) host.cancel(pending);
    pending = null;
  }
  function schedule() {
    if (disposed || !visible || drawing || pending !== null || !(active || dirty)) return;
    const id = host.request(now => {
      if (disposed || pending !== id) return;
      pending = null;
      const elapsed = active && lastFrame !== null ? Math.min((now - lastFrame) / 1000, 0.1) : 0;
      lastFrame = active ? now : null;
      draw(elapsed);
    });
    pending = id;
  }
  function draw(elapsed: number) {
    dirty = false; drawing = true;
    host.render(elapsed);
    drawing = false;
    schedule();
  }
  function invalidate() {
    if (disposed) return;
    dirty = true; schedule();
  }
  return {
    invalidate,
    setActive(value: boolean) {
      if (disposed) return;
      // Even intro -> play must discard elapsed time from the previous mode.
      active = value; lastFrame = null; invalidate();
    },
    setVisible(value: boolean) {
      if (disposed || visible === value) return;
      visible = value; lastFrame = null;
      if (!visible) cancel();
      invalidate();
    },
    drawNow() {
      if (disposed) return;
      dirty = true; lastFrame = null;
      if (!visible || drawing) return;
      cancel(); draw(0);
    },
    dispose() {
      disposed = true; dirty = false; lastFrame = null; cancel();
    },
  };
}
