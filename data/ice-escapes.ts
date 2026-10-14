import { parseLevel, type Hazard } from '../core/level.ts';
import type { ExplosionPuzzle } from './explosion-puzzles.ts';

/**
 * Hard soft-ice trials inspired by Warcraft III ice escape maps. Layouts,
 * creep rhythms and timings are original; only documented genre ideas are
 * borrowed (see `source`). Map legend: `~` soft ice, `.` normal ground,
 * `#` reflecting wall, space = void (falling off the track), `S` start, `G` exit.
 */
export type IceSource = Readonly<{ reference: string; credit: string; idea: string; adaptation: string }>;
export type IceEscape = ExplosionPuzzle & Readonly<{ source: IceSource }>;

/** A patrolling creep: a saw from (fx, fy) to (tx, ty) and back, at `from` on pattern ticks ≡ at (mod period). */
export type Creep = readonly [fx: number, fy: number, tx: number, ty: number, period: number, at: number];
type Puzzle = Readonly<{
  name: string; hint: string; bounds: readonly [x: number, y: number, width: number, height: number];
  entry: readonly [x: number, y: number]; creeps: readonly Creep[];
  /** Intermediate puzzles end on this normal-ground checkpoint. */
  checkpoint?: readonly [x: number, y: number, radius: number];
}>;
export type IceLayout = Readonly<{ id: string; name: string; revision?: number; width: number; rows: readonly string[]; puzzles: readonly Puzzle[]; source: IceSource }>;

function locate(rows: readonly string[], mark: string) {
  const y = rows.findIndex(row => row.includes(mark));
  if (y < 0) throw new Error(`Ice map is missing ${mark}.`);
  return { x: rows[y].indexOf(mark), y };
}
const creep = ([fx, fy, tx, ty, period, at]: Creep, sectionId: string): Hazard => ({ kind: 'saw',
  from: { x: fx, y: fy }, to: { x: tx, y: ty }, period, phase: (period - at % period) % period, sectionId });

export function buildIceEscape(layout: IceLayout): IceEscape {
  const { width } = layout;
  if (layout.rows.some(row => row.length > width)) throw new Error(`${layout.id}: row wider than ${width}.`);
  const rows = layout.rows.map(row => row.padEnd(width, ' '));
  const spawn = locate(rows, 'S'), goal = locate(rows, 'G');
  const sections = layout.puzzles.map((p, i) => {
    const [x, y, w, h] = p.bounds, bounds = { x, y, width: w, height: h }, [ex, ey] = p.entry;
    return { id: `part-${i + 1}`, name: p.name, bounds, entry: { x: ex, y: ey },
      observation: { x: ex, y: ey, width: 1, height: 1 },
      completion: i < layout.puzzles.length - 1 ? { kind: 'checkpoint', checkpointId: `checkpoint-${i + 1}` } : { kind: 'goal' },
      camera: { mode: 'fixed', frame: bounds } };
  });
  const level = parseLevel({
    version: 2, revision: layout.revision ?? 1, id: `ice-${layout.id}`, name: layout.name, description: layout.puzzles[0].hint,
    puzzleMode: 'checkpoint', resetPatternOnRetry: false,
    tiles: rows.map(row => row.replace(/[SG]/g, '.')), spawn, goal,
    checkpoints: layout.puzzles.slice(0, -1).map((p, i) => {
      if (!p.checkpoint) throw new Error(`${layout.id}: puzzle ${i + 1} needs a checkpoint.`);
      const [x, y, radius] = p.checkpoint;
      return { id: `checkpoint-${i + 1}`, x, y, radius };
    }),
    hazards: layout.puzzles.flatMap((p, i) => p.creeps.map(c => creep(c, `part-${i + 1}`))),
    sections,
  });
  if (level.version !== 2) throw new Error('Ice escape must be a world.');
  return Object.freeze({ question: layout.puzzles[0].hint, hints: Object.freeze(layout.puzzles.map(p => p.hint)),
    level, source: Object.freeze({ ...layout.source }) });
}

const TEMPLATE = 'Ice Escape Template (wc3maps.com archive)', TEMPLATE_CREDIT = 'IcemanBo';
const KITTY = 'Slide Kitty Slide v0.1 (wc3maps.com archive)', KITTY_CREDIT = 'version credited to TriggerHappy187';
const WARDEN = 'Warden Ice Escape (Hive Workshop thread)', WARDEN_CREDIT = 'Rufus';
/** A one-puzzle course: the whole map is its section and the exit completes it. */
function single(width: number, rows: readonly string[], name: string, hint: string, creeps: readonly Creep[]): Puzzle[] {
  const start = locate(rows, 'S');
  return [{ name, hint, bounds: [0, 0, width, rows.length], entry: [start.x, start.y], creeps }];
}
const SNOW_LINE = [
  '',
  ' ..~~~~~~~~~~~~',
  ' S.~~~~~~~~~~~~',
  '            ~~~',
  '   ~~~~    ~~~~',
  '   ~~~~~~~~~~~~',
  '   ~~~',
  '   ~~~~~~~~~~~~',
  '   ~~~~    ~~~~',
  '            ~~~',
  '   ~~~~~~~~~~~~',
  '   ~~~~~~~~~~~~',
  '   ~~~',
  '   ~~~~~~~~~~~~.G',
  '   ~~~~~~~~~~~~..',
  '',
];
const WOLF_LANES = [
  '',
  '',
  ' ..~~~~~~~~~~~~~~~~~~~~~~~..',
  ' S.~~~~~~~~~~~~~~~~~~~~~~~.G',
  ' ..~~~~~~~~~~~~~~~~~~~~~~~..',
  '',
  '',
];
const SAFE_ZONES = [
  '',
  ' ...~~~~...     ...~~~~..',
  ' .S.~~~~...     ...~~~~.G',
  ' ...~~~~...     ...~~~~..',
  '        ~~~     ~~~',
  '        ~~~     ~~~',
  '        ~~~     ~~~',
  '        ~~~     ~~~',
  '        ...~~~~~...',
  '        ...~~~~~...',
  '        ...~~~~~...',
  '',
];
const BUMPER_ALLEY = [
  '',
  '  ...        .G.~~~',
  '  .S.        ...~~~',
  '  #~~~~~~#   ~~~~~~#',
  '  #~~~~~~#   ~~~~~~#',
  '  #~~~~~~#  #   ~~~#',
  '  #  ~~~~#  #~~~~~~#',
  '  #   ~~~#  #~~~~~~#',
  '  #~~~~~~#  #~~~~  #',
  '  #~~~~~~#  #~~~~~~#',
  '  # ~~~~ #  #~~~~~~#',
  '  #~~~~  #  #~~~~  #',
  '  #~~~~~~#  #~~~~~ #',
  '  #~~    #  #~~~~~~#',
  '  #~~~~~~#  #~~~~~~#',
  '  #~~~~~~#  #   ~~~#',
  '  # ~~~~ #  #   ~~~#',
  '  #  ~~~ #  #~~~~~~#',
  '  #~~~~~~#  #~~~~~~#',
  '  #~~~~~~~~~~~~~~~~#',
  '  #~~~~~~~~~~~~~~~~#',
  '',
  '',
];
const SPIRAL = [
  '',
  ' S~~~~~~~~~~~~~~~~',
  ' .~~~~~~~~~~~~~~~~',
  '                ~~',
  '    ~~~~~~~~~~~ ~~',
  '    ~~~~~~~~~~~ ~~',
  '    ~~       ~~ ~~',
  '    ~~ ~~~~G ~~ ~~',
  '    ~~ ~~~~. ~~ ~~',
  '    ~~ ~~    ~~ ~~',
  '    ~~ ~~    ~~ ~~',
  '    ~~ ~~    ~~ ~~',
  '    ~~ ~~~~~~~~ ~~',
  '    ~~ ~~~~~~~~ ~~',
  '    ~~          ~~',
  '    ~~~~~~~~~~~~~~',
  '    ~~~~~~~~~~~~~~',
  '',
  '',
];
const WARDENS_RUN = [
  '',
  ' ..~~~~~~~~',
  ' S.~~~~~~~~',
  '        ~~~                  ############',
  '   ~~~  ~~~                  ~~~~~~~~~~~~',
  '   ~~~~~~~~                  ~~~~~~~~',
  '   ~~~                       ~~~~~~~~~',
  '   ~~~~~~~~....~~~~..~~~~....~~~~~~~~~~~~',
  '   ~~~~~~~~....~~~~..~~~~....~~~~~~~~~~~~',
  '                             ~       ~~~~..',
  '                             ~        ~~~.G',
  '                             ~~~~~~~~~~~~..',
  '                             ############',
  '',
];

const LAYOUTS: readonly IceLayout[] = [
  { id: 'snow-line', name: 'Snow Line', revision: 2, width: 19, rows: SNOW_LINE,
    puzzles: single(19, SNOW_LINE, 'Snow Line', 'Leaving the ice is a fall. Reversing always swings clockwise, so press down first on left-hand hairpins. Line up for the one-wide bridges.',
      []),
    source: { reference: TEMPLATE, credit: TEMPLATE_CREDIT, idea: 'Your hero slides on ice; touching snow kills.',
      adaptation: 'A two-wide track over the void with alternating hairpins and one-wide bridges; pure steering, no creeps.' } },
  { id: 'wolf-lanes', name: 'Wolf Lanes', width: 29, rows: WOLF_LANES,
    puzzles: single(29, WOLF_LANES, 'Wolf Lanes', 'Creeps run the length of all three rows. Keep gliding right and swerve between rows to slip past each one.',
      [[4, 2, 24, 2, 960, 0], [4, 2, 24, 2, 960, 480], [24, 3, 4, 3, 960, 0], [24, 3, 4, 3, 960, 480],
        [4, 4, 24, 4, 960, 240], [4, 4, 24, 4, 960, 720]]),
    source: { reference: TEMPLATE, credit: TEMPLATE_CREDIT, idea: 'Touching creeps kills.',
      adaptation: 'Six creeps patrol along three rows, so you dodge by changing rows while sliding.' } },
  { id: 'safe-zones', name: 'Safe Zones', width: 26, rows: SAFE_ZONES,
    puzzles: single(26, SAFE_ZONES, 'Safe Zones', 'Stop on each patch of ground. Launch the moment both creeps in the next chute have swept past.',
      [[5, 1, 5, 3, 180, 0], [6, 3, 6, 1, 180, 45], [8, 5, 10, 5, 180, 0], [10, 6, 8, 6, 180, 45],
        [12, 8, 12, 10, 180, 0], [14, 10, 14, 8, 180, 45], [16, 6, 18, 6, 180, 0], [18, 5, 16, 5, 180, 45],
        [20, 1, 20, 3, 180, 0], [21, 3, 21, 1, 180, 45]]),
    source: { reference: KITTY, credit: KITTY_CREDIT, idea: 'Avoid the dogs; safe points between slides.',
      adaptation: 'Normal-ground islands where you can stop, linked by ice chutes that paired creeps sweep.' } },
  { id: 'bumper-alley', name: 'Bumper Alley', revision: 2, width: 22, rows: BUMPER_ALLEY,
    puzzles: single(22, BUMPER_ALLEY, 'Bumper Alley', 'Walls reflect your slide. Launch diagonally, let go and bounce through the gaps; press down to straighten, then climb the second alley.',
      []),
    source: { reference: WARDEN, credit: WARDEN_CREDIT, idea: 'Tester feedback favoured creative paths and turns over repeated patrols.',
      adaptation: 'Boundstoy walls reflect momentum, so two walled alleys become released bank shots through void gaps; no creeps.' } },
  { id: 'spiral', name: 'Spiral', revision: 2, width: 20, rows: SPIRAL,
    puzzles: single(20, SPIRAL, 'Spiral', 'Quarter turns come faster toward the centre. Time your start so the creep on each arm has just crossed.',
      [[10, 0, 10, 3, 160, 80], [18, 9, 15, 9, 160, 60], [10, 17, 10, 14, 160, 60], [3, 10, 6, 10, 160, 40]]),
    source: { reference: WARDEN, credit: WARDEN_CREDIT, idea: 'Arrow-key sliding along steering tracks.',
      adaptation: 'A clockwise spiral of quarter turns whose arms are crossed by creeps.' } },
  { id: 'wardens-run', name: "Warden's Run", revision: 2, width: 44, rows: WARDENS_RUN,
    puzzles: [
      { name: 'Hairpins', hint: 'Swing the right hairpin, press down first for the left one, cross the bridge and stop on the checkpoint.',
        bounds: [0, 0, 13, 14], entry: [1, 2], creeps: [], checkpoint: [12, 7, 1.5] },
      { name: 'Creep chutes', hint: 'Stop on the island between the two chutes. Launch as each pair of creeps sweeps clear.',
        bounds: [13, 0, 14, 14], entry: [13, 7], checkpoint: [26, 7, 1.5],
        creeps: [[16, 6, 16, 9, 120, 0], [17, 9, 17, 6, 120, 30], [22, 6, 22, 9, 120, 75], [23, 9, 23, 6, 120, 105]] },
      { name: 'Bank shot', hint: 'Slide right, turn up-right and let go. Bounce off the top wall through the gap, then steer right to the exit.',
        bounds: [27, 0, 17, 14], entry: [27, 7], creeps: [] },
    ],
    source: { reference: WARDEN, credit: WARDEN_CREDIT, idea: 'Frequent checkpoints break a sliding course into short tracks.',
      adaptation: 'Steering hairpins, creep chutes and a bank shot joined by two normal-ground checkpoints.' } },
];

export const ICE_ESCAPES: readonly IceEscape[] = Object.freeze(LAYOUTS.map(buildIceEscape));
