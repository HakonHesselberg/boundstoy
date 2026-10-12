import { AFTERSHOCK_WORLD } from './aftershock-world.ts';
import type { Level } from '../core/level.ts';
export const LEVELS: readonly Level[] = Object.freeze([AFTERSHOCK_WORLD]);
// Legacy imported courses retain their authored guidance, not selector entries.
export { AFTERSHOCK_LESSONS as COURSE_LESSONS } from './aftershock.ts';
export const MASTERY_TARGETS: Readonly<Record<string, number>> = Object.freeze({});
