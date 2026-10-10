type Axis = -1 | 0 | 1;
function replay(commands: readonly (readonly [number, Axis, Axis])[]) {
  return Object.freeze(commands.map(([ticks, x, y]) => Object.freeze({ ticks, x, y })));
}

export const AFTERSHOCK_REPLAYS = Object.freeze([
  // Stop/read at safe seams. The first southbound and last eastbound arrivals
  // miss their window; neither long wait can be replaced by a four-tick read.
  replay([[33, 1, 0], [4, 0, 0], [134, 1, 0], [30, 0, 0], [233, 1, 0], [122, 0, 0],
    [133, 0, 1], [33, -1, 0], [11, 0, 0], [134, -1, 0], [35, 0, 0],
    [166, -1, 0], [4, 0, 0], [134, 0, 1], [33, 1, 0], [129, 0, 0],
    [134, 1, 0], [9, 0, 0], [153, 1, 0]]),
  // Borrow the spent first field while the landing burns, return, then transfer.
  replay([[133, 1, 0], [33, -1, 0], [46, 0, 0], [33, 1, 0], [144, 0, 0],
    [234, 0, 1], [133, 1, 0], [14, 0, 0], [233, 0, -1], [134, 1, 0],
    [233, 0, 1], [22, 0, 0], [134, 0, 1], [133, -1, 0], [133, 0, 1], [120, 1, 0]]),
  // Outside rail: no diagonal and no waits; this is the shorter route's honest comparator.
  replay([[867, 1, 0], [633, 0, -1], [67, -1, 0], [20, 0, 1]]),
]);
export const AFTERSHOCK_MASTERY_REPLAYS = Object.freeze([
  // Carry through the bends; only fields 2, 5 and 8 require cadence corrections.
  replay([[167, 1, 0], [25, 0, 0], [233, 1, 0], [133, 0, 1],
    [167, -1, 0], [36, 0, 0], [166, -1, 0], [134, 0, 1],
    [167, 1, 0], [20, 0, 0], [153, 1, 0]]),
  // Launch BEFORE the downstream flashes at 155, 530 and 1150.
  replay([[133, 1, 0], [16, 0, 0], [234, 0, 1], [133, 1, 0], [14, 0, 0],
    [233, 0, -1], [134, 1, 0], [233, 0, 1], [22, 0, 0], [134, 0, 1],
    [133, -1, 0], [133, 0, 1], [120, 1, 0]]),
  // Diagonal fork, midpoint retime, east landing, north gate, east goal.
  replay([[133, 1, 0], [236, 1, -1], [20, 0, 0], [235, 1, -1], [134, 1, 0],
    [20, 0, 0], [267, 0, -1], [186, 1, 0]]),
]);
