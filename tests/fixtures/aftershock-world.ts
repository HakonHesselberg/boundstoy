import { assembleAftershock, AFTERSHOCK_OPENING, AFTERSHOCK_MIDDLE, AFTERSHOCK_COMBINED,
  AFTERSHOCK_FINALE, type AftershockFragment, type AftershockGoalFragment } from '../../data/aftershock-world.ts';
import type { Hazard } from '../../core/level.ts';
import { openingCommand as c } from '../../data/aftershock-world-replays.ts';
import * as routes from '../../data/aftershock-world-replays.ts';
export * from '../../data/aftershock-world.ts';

function boundedWorld(fragments: readonly (AftershockFragment<Hazard> | AftershockGoalFragment)[],
  id: string, label = 'opening') {
  return assembleAftershock(fragments, id, `Aftershock ${label} authoring fixture`,
    'goal' in fragments.at(-1)! ? 'Unregistered complete eight-section Aftershock authoring world.'
      : `Unregistered bounded ${label} fragments; not the complete eight-section world.`);
}
export const openingSectionWorlds = Object.freeze(AFTERSHOCK_OPENING.map(f =>
  boundedWorld([f], `${f.section.id}-fixture`)));
export const openingPair = boundedWorld(AFTERSHOCK_OPENING, 'aftershock-opening-pair-fixture');
export const middleSectionWorlds = Object.freeze(AFTERSHOCK_MIDDLE.map(f =>
  boundedWorld([f], `${f.section.id}-fixture`, 'middle')));
export const firstFour = boundedWorld([...AFTERSHOCK_OPENING, ...AFTERSHOCK_MIDDLE],
  'aftershock-first-four-fixture', 'first four');
export const combinedSectionWorlds = Object.freeze(AFTERSHOCK_COMBINED.map(f =>
  boundedWorld([f], `${f.section.id}-fixture`, 'combined')));
export const firstSix = boundedWorld([...AFTERSHOCK_OPENING, ...AFTERSHOCK_MIDDLE, ...AFTERSHOCK_COMBINED],
  'aftershock-first-six-fixture', 'first six');
export const finaleSectionWorlds = Object.freeze(AFTERSHOCK_FINALE.map(f =>
  boundedWorld([f], `${f.section.id}-fixture`, 'final pair')));
export const completeEight = boundedWorld(
  [...AFTERSHOCK_OPENING, ...AFTERSHOCK_MIDDLE, ...AFTERSHOCK_COMBINED, ...AFTERSHOCK_FINALE],
  'aftershock-complete-eight-fixture', 'complete eight');

export const CHECKPOINT_RECOVERIES = [
  { prefix: [c(633, 1)], attempt: [c(220, 1)], connector: c(100, 1),
    route: routes.OPENING_ROUTES[1].ordinary, count: 2, cycle: 480 },
  { prefix: routes.MIDDLE_APPROACHES.ordinary, attempt: [c(152, 1)], connector: c(100, 1),
    route: routes.MIDDLE_ROUTES[0].ordinary, count: 3, cycle: 480 },
  { prefix: [...routes.MIDDLE_APPROACHES.ordinary, ...routes.MIDDLE_ROUTES[0].ordinary, c(113, 1)],
    attempt: [c(134, 1), c(36, 0, 1)], connector: c(100, 1),
    route: routes.MIDDLE_ROUTES[1].ordinary, count: 4, cycle: 480 },
  { prefix: routes.COMBINED_APPROACHES.ordinary, attempt: [c(100, 0, 1), c(186, -1)],
    connector: c(100, 0, 1), route: routes.COMBINED_ROUTES[0].ordinary, count: 5, cycle: 480 },
  { prefix: [...routes.COMBINED_APPROACHES.ordinary, ...routes.COMBINED_ROUTES[0].ordinary, c(100, -1)],
    attempt: [c(335, -1)], connector: c(100, -1), route: routes.COMBINED_ROUTES[1].ordinary, count: 6, cycle: 720 },
  ...[0, 1].map(section => ({
    prefix: section === 0 ? routes.FINALE_APPROACHES.ordinary
      : [...routes.FINALE_APPROACHES.ordinary, ...routes.FINALE_ROUTES[0].ordinary, c(113, 0, 1)],
    attempt: section === 0 ? [c(200, -1), c(449)] : [c(333, 0, 1), c(52, 1)],
    connector: section === 0 ? c(100, -1) : c(100, 0, 1),
    route: routes.FINALE_ROUTES[section].ordinary, count: section + 7, cycle: 480,
  })),
] as const;
