import { CHECKPOINT_WORLD_ROUTES, type OpeningCommand } from './aftershock-world-replays.ts';
export const REPLAYS = Object.freeze([CHECKPOINT_WORLD_ROUTES.ordinary]);
export const FAST_REPLAYS = Object.freeze([CHECKPOINT_WORLD_ROUTES.fast]);
export const MASTERY_REPLAYS: readonly (readonly OpeningCommand[])[] = Object.freeze([]);
