import { AFTERSHOCK_MASTERY_REPLAYS } from '../../data/aftershock-replays.ts';

type Axis = -1 | 0 | 1;
function replay(commands: readonly (readonly [number, Axis, Axis])[]) {
  return Object.freeze(commands.map(([ticks, x, y]) => Object.freeze({ ticks, x, y })));
}

// Real input from a fresh spawn, ending on the first death BEFORE banking a pad.
export const FAILURE_REPLAYS = Object.freeze([
  replay([[133, 1, 0], [57, 0, 0]]), // Camp on the expiring elbow.
  replay([[320, 1, 0]]), // Never change lanes.
  replay([[154, 1, 0]]), // Run through the first light flash.
]);

// Each room has ONE hazardous phrase, then a safe bank/exit. These deliberately
// backtrack into the completed field to test checkpoint retry; they do not
// pretend there is another downstream puzzle. All recovery endpoints are GOAL.
// The caller advances 54 respawn ticks between failure and recovery.
export const CHECKPOINT_REPLAYS = Object.freeze([
  Object.freeze({
    index: 0, checkpoint: 0,
    approach: Object.freeze(AFTERSHOCK_MASTERY_REPLAYS[0].slice(0, 3)),
    failure: replay([[100, -1, 0], [116, 0, 0]]),
    recovery: replay([[94, 1, -1], [20, 0, -1]]),
  }),
  Object.freeze({
    index: 1, checkpoint: 0,
    approach: Object.freeze(AFTERSHOCK_MASTERY_REPLAYS[1].slice(0, 2)),
    failure: replay([[89, -1, 0]]),
    recovery: replay([[33, 1, 0], [34, 1, 1]]),
  }),
  Object.freeze({
    index: 2, checkpoint: 0,
    approach: Object.freeze(AFTERSHOCK_MASTERY_REPLAYS[2].slice(0, 5)),
    failure: replay([[92, -1, 0]]),
    recovery: replay([[81, 1, -1]]),
  }),
]);
