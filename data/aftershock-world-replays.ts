/** Keyboard inputs only, at 120 Hz. No state edits or retry-phase resets. */
export type OpeningCommand = Readonly<{ ticks: number; x: number; y: number }>;
export const openingCommand = (ticks: number, x = 0, y = 0): OpeningCommand =>
  Object.freeze({ ticks, x, y });
const c = openingCommand;

export const OPENING_ROUTES = Object.freeze([
  Object.freeze({
    // Split at an in-field observation point for local-delay measurement,
    // without changing heading, speed or adding any ordinary waiting.
    ordinary: Object.freeze([c(200, 1), c(320, 1)]),
    fast: Object.freeze([c(520, 1)]),
  }),
  Object.freeze({
    ordinary: Object.freeze([
      c(167, 1), c(33, 0, 1), c(100, 1), c(33, 0, -1),
      c(33, 1), c(33, 0, -1), c(100, 1), c(33, 0, 1), c(186, 1),
    ]),
    fast: Object.freeze([
      // Cut diagonally across the lower shelf. The earlier return permits
      // passing the upper appointment directly; 104 real movement ticks saved.
      c(167, 1), c(47, 1, 1), c(33, 1), c(47, 1, -1), c(320, 1),
    ]),
  }),
]);

/** Continuous joined witnesses. The first 633 ticks walk through checkpoint
 * one to (20.49,3.5); section two starts at phase 153, not phase zero.
 * Its authored pulses require the ordinary refuge transfers at that arrival;
 * the faster diagonal earns an earlier return that avoids the upper shelf.
 * The ordinary final input differs by one tick because this legal connector
 * leaves the player 0.01 tile left of the standalone section spawn. */
export const OPENING_PAIR_ROUTES = Object.freeze({
  ordinary: Object.freeze([c(633, 1), ...OPENING_ROUTES[1].ordinary.slice(0, -1), c(187, 1)]),
  fast: Object.freeze([c(633, 1), ...OPENING_ROUTES[1].fast]),
});

/** Local movement from each observation point. Phase selection is separate:
 * the ordinary upper patrol line avoids the downward sweep, whereas an early
 * crossing passes directly behind it. In the fan, the ordinary outer elbow
 * follows spent ground; the fast inner diagonal outruns the closing fan. */
export const MIDDLE_ROUTES = Object.freeze([
  Object.freeze({
    ordinary: Object.freeze([c(100, 1), c(33, 0, -1), c(134, 1), c(33, 0, 1), c(120, 1)]),
    fast: Object.freeze([c(167, 1), c(187, 1)]),
  }),
  Object.freeze({
    ordinary: Object.freeze([c(200, 1), c(100, 0, 1), c(100, -1), c(153, 0, 1)]),
    fast: Object.freeze([c(134, 1), c(100, 0, 1), c(47, -1, 1), c(120, 0, 1)]),
  }),
]);

/** Input-only approaches walk through the two former artificial goals.
 * Ordinary/fast reach patrol at 1465/1361, and fan at 1998/1828. */
export const MIDDLE_APPROACHES = Object.freeze({
  ordinary: Object.freeze([...OPENING_PAIR_ROUTES.ordinary, c(113, 1)]),
  fast: Object.freeze([...OPENING_PAIR_ROUTES.fast, c(114, 1)]),
});
export const FOUR_SECTION_ROUTES = Object.freeze({
  ordinary: Object.freeze([...MIDDLE_APPROACHES.ordinary, ...MIDDLE_ROUTES[0].ordinary,
    c(113, 1), ...MIDDLE_ROUTES[1].ordinary]),
  fast: Object.freeze([...MIDDLE_APPROACHES.fast, ...MIDDLE_ROUTES[0].fast,
    c(113, 1), ...MIDDLE_ROUTES[1].fast]),
});

/** Section five's lower crossing passes the saw on spent, expiring ground.
 * Section six's lower arc costs 134 movement ticks but avoids a 175-tick
 * short-route wait at ordinary arrival. The earlier arrival can go directly.
 * All nominal commands move at full normal-ground speed, with no idle padding.
 * Final command lengths end at the actual joined position, not a local spawn. */
export const COMBINED_ROUTES = Object.freeze([
  Object.freeze({
    ordinary: Object.freeze([c(100, 0, 1), c(100, -1), c(33, 0, 1),
      c(167, -1), c(33, 0, -1), c(200, -1)]),
    fast: Object.freeze([c(100, 0, 1), c(200, -1), c(267, -1)]),
  }),
  Object.freeze({
    ordinary: Object.freeze([c(100, -1), c(67, 0, 1), c(333, -1),
      c(67, 0, -1), c(120, -1)]),
    fast: Object.freeze([c(200, -1), c(354, -1)]),
  }),
]);
export const COMBINED_APPROACHES = Object.freeze({
  ordinary: Object.freeze([...FOUR_SECTION_ROUTES.ordinary, c(114, 0, 1)]),
  fast: Object.freeze([...FOUR_SECTION_ROUTES.fast, c(114, 0, 1)]),
});
/** The 114-tick south connector preserves landing four, reaching section five
 * at ticks 2665/2343. Section six entries are 3398/3010. Combined cycle 1440;
 * arrival and retries never reset either clock. */
export const SIX_SECTION_ROUTES = Object.freeze({
  ordinary: Object.freeze([...COMBINED_APPROACHES.ordinary, ...COMBINED_ROUTES[0].ordinary,
    c(100, -1), ...COMBINED_ROUTES[1].ordinary]),
  fast: Object.freeze([...COMBINED_APPROACHES.fast, ...COMBINED_ROUTES[0].fast,
    c(100, -1), ...COMBINED_ROUTES[1].fast]),
});

/** Continuous west connector preserves checkpoint six and both world clocks. */
export const FINALE_APPROACHES = Object.freeze({
  ordinary: Object.freeze([...SIX_SECTION_ROUTES.ordinary, c(114, -1)]),
  fast: Object.freeze([...SIX_SECTION_ROUTES.fast, c(114, -1)]),
});
/** West crossing: no-wait outer commitment versus the earlier inside opening.
 * Finale: transfer from the inner bank to spent lower ground, or take the
 * shorter early diagonal. Every nominal tick moves; no comparator padding.
 * The seven/eight ordinary entries are 4199/4899; faster entries 3678/4244. */
export const FINALE_ROUTES = Object.freeze([
  Object.freeze({
    ordinary: Object.freeze([c(200, -1), c(200, 0, 1), c(67, 1), c(120, 0, 1)]),
    fast: Object.freeze([c(133, -1), c(200, 0, 1), c(120, 0, 1)]),
  }),
  Object.freeze({
    ordinary: Object.freeze([c(267, 0, 1), c(200, 1), c(67, 0, 1), c(200, 1), c(119, 0, 1)]),
    fast: Object.freeze([c(233, 0, 1), c(141, 1, 1), c(300, 1), c(120, 0, 1)]),
  }),
]);
export const EIGHT_SECTION_ROUTES = Object.freeze({
  ordinary: Object.freeze([...FINALE_APPROACHES.ordinary, ...FINALE_ROUTES[0].ordinary,
    c(113, 0, 1), ...FINALE_ROUTES[1].ordinary]),
  fast: Object.freeze([...FINALE_APPROACHES.fast, ...FINALE_ROUTES[0].fast,
    c(113, 0, 1), ...FINALE_ROUTES[1].fast]),
});

/** Revision 2: earn the shelter shortcut, then take ordinary later puzzles.
 * Local checkpoint resets remove the historical cross-puzzle phase advantage.
 * No idle padding: ordinary 5752, faster 5648 simulation ticks. */
export const CHECKPOINT_WORLD_ROUTES = Object.freeze({
  ordinary: EIGHT_SECTION_ROUTES.ordinary,
  fast: Object.freeze([...MIDDLE_APPROACHES.fast,
    ...EIGHT_SECTION_ROUTES.ordinary.slice(MIDDLE_APPROACHES.ordinary.length)]),
});
