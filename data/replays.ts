// Each tuple is [ticks held, horizontal input, vertical input].
function replay(commands: readonly (readonly [number, number, number])[]) {
  return Object.freeze(commands.map(([ticks, x, y]) => Object.freeze({ ticks, x, y })));
}

export const REPLAYS = Object.freeze([
  replay([
    [60, 1, 0], [84, 1, -1], [76, 1, 0], [59, 0, 1], [174, 1, 0],
    [10, 0, -1], [110, 1, 0], [239, 0, -1], [41, -1, 0], [138, 0, 0],
    [271, -1, 0], [150, 0, 1], [68, 1, 0],
  ]),
  replay([
    [32, 0, -1], [65, 1, 0], [192, 0, 0], [114, 1, 0], [131, 0, -1],
    [8, -1, 0], [77, 0, -1], [132, 1, 0], [28, 0, 1], [32, 1, 0],
    [238, 0, 0], [84, 1, 1], [115, 1, 0], [19, 0, 1], [31, 1, 0],
    [33, 0, 1], [50, 0, 0], [341, 0, 1],
  ]),
]);
