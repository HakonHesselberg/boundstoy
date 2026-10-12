import type { Bounds, Point, World } from '../core/level.ts';
import { RULES } from '../data/terrain.ts';
import { worldSectionIndex } from '../core/world.ts';
import { easeInOutCubic } from './motion.ts';

/** Direct, presentation-only views. No progression, clock, or motion state. */
export type WorldView = Readonly<{
  kind: 'fixed' | 'follow' | 'connector' | 'reveal' | 'track';
  sections: readonly number[];
  frame: Bounds;
}>;
// More than the live footprint plus one maximum-speed simulation step.
const EDGE_PREVIEW = 0.75;
const REVEAL_SECONDS = 0.7;
const distance = (p: Point, b: Bounds) => Math.hypot(
  Math.max(b.x - p.x, 0, p.x - b.x - b.width),
  Math.max(b.y - p.y, 0, p.y - b.y - b.height));
const gap = (a: Bounds, b: Bounds) => Math.hypot(
  Math.max(a.x - b.x - b.width, b.x - a.x - a.width, 0),
  Math.max(a.y - b.y - b.height, b.y - a.y - a.height, 0));
const union = (a: Bounds, b: Bounds): Bounds => {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y };
};
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));

function sectionFrame(world: World, index: number) {
  const section = world.sections[index], b = section.bounds;
  let required = b;
  // Metadata need not assign hazards to sections. Include the entire tile
  // sweep of any hazard that can threaten this section, not just its current
  // phase/position; otherwise a cross-boundary saw can arrive unannounced.
  for (const hazard of world.hazards) {
    const from = hazard.kind === 'pulse' ? hazard : hazard.from;
    const to = hazard.kind === 'pulse' ? hazard : hazard.to;
    const sweep = { x: Math.min(from.x, to.x), y: Math.min(from.y, to.y),
      width: Math.abs(from.x - to.x) + 1, height: Math.abs(from.y - to.y) + 1 };
    if (sweep.x < b.x + b.width + RULES.radius && sweep.x + sweep.width > b.x - RULES.radius
      && sweep.y < b.y + b.height + RULES.radius && sweep.y + sweep.height > b.y - RULES.radius)
      required = union(required, sweep);
  }
  return { required, frame: union(section.camera.frame, required) };
}

/**
 * Gameplay camera: a common whole-puzzle scale, checkpoint reveals, then
 * edge tracking. Only the visual clock drives pans; no state feeds simulation.
 * Positional selection below remains useful for editor focus and local audio.
 */
export class CheckpointCamera {
  private readonly world: World;
  private readonly frames: readonly Bounds[];
  private readonly width: number;
  private readonly height: number;
  private index = -1;
  private frame: Bounds | null = null;
  private pan: { from: Bounds; to: Bounds; start: number } | null = null;

  constructor(world: World) {
    this.world = world;
    this.frames = world.sections.map((_, i) => {
      let frame = sectionFrame(world, i).frame;
      if (i) {
        const checkpoint = world.checkpoints[i - 1], radius = checkpoint.radius + EDGE_PREVIEW;
        frame = union(frame, { x: checkpoint.x + 0.5 - radius, y: checkpoint.y + 0.5 - radius,
          width: radius * 2, height: radius * 2 });
      }
      return frame;
    });
    this.width = Math.max(...this.frames.map(frame => frame.width));
    this.height = Math.max(...this.frames.map(frame => frame.height));
  }

  update(position: Point, visited: readonly string[], time: number, reduced: boolean): WorldView {
    const index = worldSectionIndex(this.world, visited), required = this.frames[index];
    const target = { x: required.x + (required.width - this.width) / 2,
      y: required.y + (required.height - this.height) / 2, width: this.width, height: this.height };
    if (!this.frame || index < this.index) {
      this.frame = target; this.pan = null;
    } else if (index !== this.index) {
      this.pan = { from: this.frame, to: target, start: time };
    }
    this.index = index;
    if (this.pan) {
      const t = reduced ? 1 : Math.min(1, Math.max(0, (time - this.pan.start) / REVEAL_SECONDS));
      const amount = easeInOutCubic(t), { from, to } = this.pan;
      this.frame = { ...target, x: from.x + (to.x - from.x) * amount, y: from.y + (to.y - from.y) * amount };
      if (t === 1) { this.frame = to; this.pan = null; }
    }
    // Retain the footprint even during a reveal or a distant backtrack.
    // Keep this offset afterwards instead of springing toward the puzzle.
    this.frame = { ...this.frame,
      x: clamp(this.frame.x, position.x + EDGE_PREVIEW - this.width, position.x - EDGE_PREVIEW),
      y: clamp(this.frame.y, position.y + EDGE_PREVIEW - this.height, position.y - EDGE_PREVIEW) };
    return { kind: this.pan ? 'reveal' : this.frame.x === target.x && this.frame.y === target.y ? 'fixed' : 'track',
      sections: [index], frame: this.frame };
  }
}

export function selectWorldView(world: World, position: Point): WorldView {
  const sections = world.sections;
  const inside = sections.findIndex(({ bounds: b }) => position.x >= b.x && position.x < b.x + b.width
    && position.y >= b.y && position.y < b.y + b.height);
  let indices: number[];
  if (inside >= 0) {
    const current = sections[inside].bounds;
    indices = [inside - 1, inside, inside + 1].filter(i => i >= 0 && i < sections.length
      && (i === inside || distance(position, sections[i].bounds) <= gap(current, sections[i].bounds) + EDGE_PREVIEW));
  } else {
    // Connectors may bend outside both rectangles. Select the nearest ordered
    // pair, and include the actual footprint even on a distant detour.
    let nearest = 0, score = Infinity;
    for (let i = 0; i < sections.length - 1; i++) {
      const candidate = distance(position, sections[i].bounds) + distance(position, sections[i + 1].bounds);
      if (candidate < score) { nearest = i; score = candidate; }
    }
    indices = sections.length === 1 ? [0] : [nearest, nearest + 1];
  }
  const first = sectionFrame(world, indices[0]);
  let frame = first.frame;
  const kind = indices.length > 1 || inside < 0 ? 'connector' : sections[inside].camera.mode;
  if (kind === 'follow') {
    // A follow hint is not permission to crop the puzzle. Pan only through
    // surplus authored frame space; an exactly fitted frame stays fixed.
    const b = first.required;
    frame = { ...frame,
      x: clamp(position.x - frame.width / 2, Math.max(0, b.x + b.width - frame.width),
        Math.min(b.x, world.tiles[0].length - frame.width)),
      y: clamp(position.y - frame.height / 2, Math.max(0, b.y + b.height - frame.height),
        Math.min(b.y, world.tiles.length - frame.height)) };
  }
  for (const i of indices.slice(1)) frame = union(frame, sectionFrame(world, i).frame);
  if (kind === 'connector') frame = union(frame, {
    x: position.x - EDGE_PREVIEW, y: position.y - EDGE_PREVIEW, width: EDGE_PREVIEW * 2, height: EDGE_PREVIEW * 2,
  });
  return { kind, sections: indices, frame };
}

// Screen height per tile of floor depth at the fixed 25:17 elevation:offset tilt.
const GROUND_DEPTH_SCALE = 25 / Math.hypot(25, 17);
// Room for wall bases below and route signs above edge cells (see world-camera tests).
const VERTICAL_PADDING = 1.5;
const HORIZONTAL_PADDING = 2;

/** Legacy tilt, with padding trimmed to what walls and signs need; centred on a global rectangle. */
export function fitWorldFrame(frame: Bounds, aspect: number) {
  return { x: frame.x + frame.width / 2, z: frame.y + frame.height / 2,
    extent: Math.max(frame.height * GROUND_DEPTH_SCALE + VERTICAL_PADDING, (frame.width + HORIZONTAL_PADDING) / aspect) };
}
