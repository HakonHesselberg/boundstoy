type KeyAxis = -1 | 0 | 1;

// Each tuple is [ticks held, horizontal key, vertical key], ending on the win tick.
function replay(commands: readonly (readonly [number, KeyAxis, KeyAxis])[]) {
  return Object.freeze(commands.map(([ticks, x, y]) => Object.freeze({ ticks, x, y })));
}

export const REPLAYS = Object.freeze([
  // Courtyard: east balcony, south overlook, west return.
  replay([[233, 1, 0], [233, 0, 1], [186, -1, 0]]),
  // Reservoir: two quarter-circle steering arcs, with no curb reflections.
  replay([[234, 0, 1], [229, 1, 0], [286, 0, -1], [87, 1, 0]]),
  // Spillway: alignment, two complete curb stops, dry landing.
  replay([[100, 1, 0], [260, 0, 1], [220, -1, 0], [130, 0, 1], [96, 1, 0]]),
  replay([[90, 0, 0], [200, 0, -1], [90, 0, 0], [267, 1, 0], [87, 0, -1]]),
  replay([[90, 0, 0], [167, 1, 0], [90, 0, 0], [267, 0, -1], [186, 1, 0]]),
  replay([[90, 0, 0], [614, 1, 0], [90, 0, 0], [567, 0, 1], [254, -1, 0]]),
  replay([[195, 1, 0], [220, 0, -1], [33, 0, -1], [240, -1, 0], [190, 0, -1],
    [100, 0, 0], [470, 1, 0], [156, 0, 1]]),
  replay([[90, 0, 0], [200, 1, 0], [200, 0, -1], [90, 0, 0], [267, 1, 0], [267, 0, 1],
    [133, 1, 0], [1017, 0, -1], [90, 0, 0], [287, -1, 0]]),
]);
