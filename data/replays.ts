type KeyAxis = -1 | 0 | 1;

// Each tuple is [ticks held, horizontal key, vertical key], ending on the win tick.
function replay(commands: readonly (readonly [number, KeyAxis, KeyAxis])[]) {
  return Object.freeze(commands.map(([ticks, x, y]) => Object.freeze({ ticks, x, y })));
}

export const REPLAYS = Object.freeze([
  replay([[100, 1, 0], [30, 0, 0], [167, 0, -1], [187, 1, 0]]),
  replay([[100, 1, 0], [114, 1, -1], [221, 1, 0]]),
  replay([[67, 0, -1], [33, 1, 0], [240, 1, 0], [139, 0, -1], [96, -1, 0]]),
  replay([[100, 1, 0], [200, 0, 0], [220, 1, 0]]),
  replay([[100, 1, 0], [120, 0, 0], [220, 1, 0]]),
  replay([[67, 0, 1], [287, 0, 0], [452, 0, 1]]),
]);
