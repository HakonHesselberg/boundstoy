import type { TestOptions } from 'node:test';

/**
 * Exhaustive phase/margin sweeps over historical fixtures take minutes of CPU.
 * They are opt-in: `npm run test:exhaustive` (and `release:check`) runs them;
 * the default `npm test` reports them as skipped. Exact replays stay default.
 */
export const EXHAUSTIVE = process.env.BOUNDSTOY_EXHAUSTIVE === '1';

export const exhaustive: TestOptions = {
  skip: EXHAUSTIVE ? false : 'exhaustive sweep; run npm run test:exhaustive',
};
