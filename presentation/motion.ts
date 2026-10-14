import { TERRAIN } from '../data/terrain.ts';
import { DT, STILL, type State } from '../core/simulation.ts';
import type { Point } from '../core/level.ts';

/**
 * Presentation-only motion state. It observes simulation ticks and derives
 * poses; nothing here feeds back into `step`, input or collision.
 */
export const MOTION = Object.freeze({
  maxSpeed: Math.max(...Object.values(TERRAIN).map(terrain => terrain.speed)),
  /** Exponential smoothing rate (1/s); matches the former 0.18-per-60Hz-frame turn. */
  yawRate: 12,
  /** Fraction of top speed lost in one tick that reads as a contact. */
  impactThreshold: 0.25,
  /** Velocity changes the player caused with input only settle, they do not squash. */
  settleScale: 0.2,
  impactSeconds: 0.35,
  impactDecay: 11,
  impactFrequency: 26,
  spawnSeconds: 0.22,
  collectSeconds: 0.4,
  winSeconds: 0.7,
  /** After a stop the trail fades out over this time instead of vanishing. */
  trailFadeSeconds: 0.3,
  /** Larger single-tick jumps are teleports (respawn) and are never interpolated. */
  snapDistance: 0.5,
});

export const clamp01 = (t: number) => Math.min(Math.max(t, 0), 1);
export const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
export const easeInCubic = (t: number) => t ** 3;
export const easeInOutCubic = (t: number) => t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
export function easeOutBack(t: number) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

export function damp(current: number, target: number, rate: number, dt: number) {
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}
export function dampAngle(current: number, target: number, rate: number, dt: number) {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * (1 - Math.exp(-rate * dt));
}

/** Position between the previous and current tick; snaps over deaths and respawns. */
export function interpolate(previous: State | null, current: State, alpha: number): Point {
  if (!previous || alpha >= 1 || previous.deaths !== current.deaths
    || (previous.respawnTicks > 0) !== (current.respawnTicks > 0)) return current.position;
  const dx = current.position.x - previous.position.x, dy = current.position.y - previous.position.y;
  if (Math.hypot(dx, dy) > MOTION.snapDistance) return current.position;
  const t = clamp01(alpha);
  return { x: previous.position.x + dx * t, y: previous.position.y + dy * t };
}

/** 0..1 share of top speed removed by one tick's velocity change. */
export function impactOf(before: Point, after: Point, maxSpeed: number) {
  return Math.min(Math.hypot(after.x - before.x, after.y - before.y) / maxSpeed, 1);
}

/** Damped spring: positive squashes, the negative overshoot is follow-through. */
export function spring(seconds: number) {
  if (seconds < 0 || seconds >= MOTION.impactSeconds) return 0;
  return Math.exp(-MOTION.impactDecay * seconds) * Math.cos(MOTION.impactFrequency * seconds);
}

const sameInput = (a: Point, b: Point) => Math.sign(a.x) === Math.sign(b.x) && Math.sign(a.y) === Math.sign(b.y);

export class PlayerMotion {
  previous: State | null = null;
  fall: Point = STILL;
  private input: Point = STILL;
  private impactTick = -Infinity;
  private impactStrength = 0;
  private spawnTick = -Infinity;
  private collected = new Map<string, number>();

  /** New level or edit: no interpolation history and no pop until an actual respawn. */
  reset() {
    this.previous = null; this.fall = STILL; this.input = STILL;
    this.impactTick = -Infinity; this.impactStrength = 0;
    this.spawnTick = -Infinity; this.collected.clear();
  }

  record(before: State, after: State, input: Point) {
    const commanded = !sameInput(input, this.input);
    this.previous = before; this.input = input;
    if (after.event === 'death') { this.fall = before.velocity; this.impactStrength = 0; return; }
    if (before.respawnTicks > 0 && after.respawnTicks === 0) { this.spawnTick = after.tick; return; }
    for (const key of after.visited) if (!before.visited.includes(key)) this.collected.set(key, after.tick);
    if (after.respawnTicks > 0 || after.won) return;
    const strength = impactOf(before.velocity, after.velocity, MOTION.maxSpeed) * (commanded ? MOTION.settleScale : 1);
    if (strength >= MOTION.impactThreshold) { this.impactTick = after.tick; this.impactStrength = strength; }
  }

  private since(tick: number, state: State, alpha: number) {
    return (state.tick - tick - (1 - clamp01(alpha))) * DT;
  }
  position(state: State, alpha: number) {
    return interpolate(this.previous, state, alpha);
  }
  /** Signed squash amount for the current pose; 0 once settled. */
  squash(state: State, alpha: number) {
    if (state.respawnTicks > 0) return 0;
    return this.impactStrength * spring(Math.max(this.since(this.impactTick, state, alpha), 0));
  }
  /** 0..1 progress of the respawn/level-start pop. */
  spawn(state: State, alpha: number) {
    return clamp01(this.since(this.spawnTick, state, alpha) / MOTION.spawnSeconds);
  }
  /** 0..1 progress of a checkpoint collection; 1 when collected earlier or never animated. */
  collect(key: string, state: State) {
    const tick = this.collected.get(key);
    return tick === undefined ? 1 : clamp01((state.tick - tick) * DT / MOTION.collectSeconds);
  }
}
