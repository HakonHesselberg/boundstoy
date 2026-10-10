type Axis = -1 | 0 | 1;
function replay(commands: readonly (readonly [number, Axis, Axis])[]) {
  return Object.freeze(commands.map(([ticks, x, y]) => Object.freeze({ ticks, x, y })));
}

export const AFTERSHOCK_REPLAYS = Object.freeze([
  // Reach the elbow, borrow the spent approach during its flash, then return.
  // Cross the final landing before the safe, square exit approach.
  replay([[133, 1, 0], [50, -1, 0], [50, 1, 0],
    [133, 0, 1], [233, 1, 0], [67, 1, 0], [86, 0, -1]]),
  // Cross the lower lane, turn across the wave, then follow the upper lane.
  replay([[125, 1, 0], [100, 0, -1], [275, 1, 0], [67, 0, 1], [53, 1, 0]]),
  // Observe light on a dark tile, transfer north, observe dark on a light
  // tile, then cross east. Removing either observation stop causes a death.
  replay([[100, 1, 0], [80, 0, 0], [100, 0, -1], [50, 0, 0],
    [267, 1, 0], [33, 0, -1], [81, 1, -1]]),
]);
export const AFTERSHOCK_MASTERY_REPLAYS = Object.freeze([
  // Transfer immediately instead of retreating, then cut diagonally across the safe landing.
  replay([[133, 1, 0], [133, 0, 1], [233, 1, 0], [94, 1, -1], [20, 0, -1]]),
  // Climb across the corridor early, using the wake rather than a sidepath.
  replay([[141, 1, -1], [300, 1, 0], [67, 0, 1], [53, 1, 0]]),
  // Change colour with the approach, then carry a diagonal through the light
  // flash. Turn east onto the other parity for the dark flash.
  replay([[100, 1, 0], [94, 1, -1], [33, 1, 0], [94, 1, -1], [101, 1, 0], [81, 1, -1]]),
]);
