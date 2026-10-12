import type { Level, LevelV1, Point, Checkpoint, Hazard } from './level.ts';
import { RULES, TERRAIN } from '../data/terrain.ts';
import { V2_LIMITS } from '../data/level-limits.ts';

/** Integer global tile rectangle, with exclusive right/bottom edges. */
export type Bounds = Readonly<{ x: number; y: number; width: number; height: number }>;
export type WorldCheckpoint = Checkpoint & Readonly<{ id: string; radius: number }>;
export type SectionCompletion =
  | Readonly<{ kind: 'checkpoint'; checkpointId: string }>
  | Readonly<{ kind: 'goal' }>;
/** Presentation hints only; never define collection or progression. */
export type SectionCamera = Readonly<{ mode: 'fixed' | 'follow'; frame: Bounds }>;
export type Section = Readonly<{
  id: string; name: string; bounds: Bounds; entry: Point; observation: Bounds;
  completion: SectionCompletion; camera: SectionCamera;
}>;
export type World = Readonly<Omit<LevelV1, 'version' | 'checkpoints' | 'resetPatternOnRetry'> & {
  version: 2; revision: number; checkpoints: readonly WorldCheckpoint[];
  sections: readonly Section[]; resetPatternOnRetry: false;
  puzzleMode?: 'checkpoint';
}>;

export function checkpointPuzzles(level: Level): level is World & { puzzleMode: 'checkpoint' } {
  return level.version === 2 && level.puzzleMode === 'checkpoint';
}

/**
 * First incomplete section, or the final goal section once all checkpoints are
 * visited. Uses the existing coordinate keys and validated checkpoint order.
 * This is progression, not the section containing the player/camera; it remains
 * the final section after winning. Does not validate externally supplied state.
 */
export function worldSectionIndex(world: World, visited: readonly string[]): number {
  const next = world.checkpoints.findIndex(p => !visited.includes(`${p.x},${p.y}`));
  return next < 0 ? world.sections.length - 1 : next;
}

function object(value: unknown, label: string, keys?: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  if (keys) for (const key of Object.keys(value))
    if (!keys.includes(key)) throw new Error(`${label}: unknown field "${key}".`);
  return value as Record<string, unknown>;
}
function integer(value: unknown, label: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max)
    throw new Error(`${label} must be an integer from ${min} to ${max}.`);
  return value;
}
function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 60)
    throw new Error(`${label} must be 1-60 characters.`);
  return value;
}
function id(value: unknown, label: string): string {
  const result = text(value, label);
  if (!/^[a-z0-9-]+$/.test(result)) throw new Error(`${label} must use lowercase letters, numbers and hyphens.`);
  return result;
}
function inside(p: Point, b: Bounds): boolean {
  return p.x >= b.x && p.x < b.x + b.width && p.y >= b.y && p.y < b.y + b.height;
}
function contains(a: Bounds, b: Bounds): boolean {
  return inside(b, a) && inside({ x: b.x + b.width - 1, y: b.y + b.height - 1 }, a);
}
function overlaps(a: Bounds, b: Bounds): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}
const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y;

// Conservative all-phase swept AABB, expanded for the player's footprint.
// This may reject close diagonal saw arrangements; it cannot certify playable timing.
function hazardBounds(h: Hazard): Bounds {
  const from = h.kind === 'pulse' ? h : h.from, to = h.kind === 'pulse' ? h : h.to;
  const r = RULES.radius + (h.kind === 'pulse' ? RULES.pulseRadius : RULES.sawRadius);
  return { x: Math.min(from.x, to.x) + 0.5 - r, y: Math.min(from.y, to.y) + 0.5 - r,
    width: Math.abs(from.x - to.x) + 2 * r, height: Math.abs(from.y - to.y) + 2 * r };
}

/** Internal second validation stage; callers should use parseLevel/importLevel. */
export function parseWorldMetadata(raw: Record<string, unknown>, common: Omit<LevelV1, 'version'>): World {
  if (common.resetPatternOnRetry) throw new Error('Version 2 resetPatternOnRetry must be false.');
  const revision = integer(raw.revision, 'Version 2 revision', 1, Number.MAX_SAFE_INTEGER);
  const board = { x: 0, y: 0, width: common.tiles[0].length, height: common.tiles.length };
  const bounds = (value: unknown, label: string): Bounds => {
    const b = object(value, label, ['x', 'y', 'width', 'height']);
    const result = Object.freeze({
      x: integer(b.x, `${label}.x`, 0, board.width - 1),
      y: integer(b.y, `${label}.y`, 0, board.height - 1),
      width: integer(b.width, `${label}.width`, 1, board.width),
      height: integer(b.height, `${label}.height`, 1, board.height),
    });
    if (!contains(board, result)) throw new Error(`${label} bounds exceed the world.`);
    return result;
  };
  const point = (value: unknown, label: string): Point => {
    const p = object(value, label, ['x', 'y']);
    return Object.freeze({ x: integer(p.x, `${label}.x`, 0, board.width - 1),
      y: integer(p.y, `${label}.y`, 0, board.height - 1) });
  };
  const checkpointIds = new Set<string>(), positions = new Set<string>();
  // The common parser already checked coordinates/radii; copy IDs without mutating that geometry.
  if (!Array.isArray(raw.checkpoints)) throw new Error('checkpoints must be an array.');
  const rawCheckpoints = raw.checkpoints;
  const checkpoints = common.checkpoints.map((p, i): WorldCheckpoint => {
    const name = id(object(rawCheckpoints[i], `checkpoint[${i}]`).id, `checkpoint[${i}].id`);
    const key = `${p.x},${p.y}`;
    if (checkpointIds.has(name) || positions.has(key)) throw new Error('Duplicate checkpoint ID or position.');
    checkpointIds.add(name); positions.add(key);
    if (same(p, common.spawn) || same(p, common.goal)) throw new Error('Checkpoint overlaps spawn or goal.');
    // Explicitly revalidated here to keep the typed contract independent of optional V1 radius.
    if (typeof p.radius !== 'number') throw new Error('Version 2 checkpoint radius is required.');
    return Object.freeze({ ...p, id: name, radius: p.radius });
  });
  const pulsePositions = new Set<string>(), sawDefinitions = new Set<string>();
  for (const h of common.hazards) {
    if (h.kind === 'pulse') {
      const key = `${h.x},${h.y}`;
      if (pulsePositions.has(key)) throw new Error('Duplicate pulse tile; stacked detonations are not allowed.');
      pulsePositions.add(key);
    } else {
      const key = `${h.from.x},${h.from.y},${h.to.x},${h.to.y},${h.period},${h.phase}`;
      if (sawDefinitions.has(key)) throw new Error('Duplicate saw definition.');
      sawDefinitions.add(key);
    }
  }
  if (!Array.isArray(raw.sections) || raw.sections.length < 1 || raw.sections.length > V2_LIMITS.sections)
    throw new Error(`sections must contain 1-${V2_LIMITS.sections} entries.`);
  const rawSections = raw.sections, sectionIds = new Set<string>();
  for (let i = 0; i < rawSections.length; i++)
    if (!Object.hasOwn(rawSections, i)) throw new Error(`sections[${i}] must not be a sparse array entry.`);
  const sections = rawSections.map((value, i): Section => {
    const label = `section[${i}]`;
    const s = object(value, label, ['id', 'name', 'bounds', 'entry', 'observation', 'completion', 'camera']);
    const name = id(s.id, `${label}.id`);
    if (sectionIds.has(name)) throw new Error('Duplicate section ID.');
    sectionIds.add(name);
    const c = object(s.completion, `${label}.completion`,
      ['kind', ...(object(s.completion, `${label}.completion`).kind === 'checkpoint' ? ['checkpointId'] : [])]);
    let completion: SectionCompletion;
    if (i === rawSections.length - 1) {
      if (c.kind !== 'goal') throw new Error('Final section completion must be goal.');
      completion = Object.freeze({ kind: 'goal' });
    } else {
      if (c.kind !== 'checkpoint') throw new Error('Intermediate section completion must reference a checkpoint.');
      completion = Object.freeze({ kind: 'checkpoint', checkpointId: id(c.checkpointId, `${label}.completion.checkpointId`) });
    }
    const camera = object(s.camera, `${label}.camera`, ['mode', 'frame']);
    if (camera.mode !== 'fixed' && camera.mode !== 'follow') throw new Error(`${label}.camera.mode must be fixed or follow.`);
    return Object.freeze({
      id: name, name: text(s.name, `${label}.name`), bounds: bounds(s.bounds, `${label}.bounds`),
      entry: point(s.entry, `${label}.entry`), observation: bounds(s.observation, `${label}.observation`),
      completion, camera: Object.freeze({ mode: camera.mode, frame: bounds(camera.frame, `${label}.camera.frame`) }),
    });
  });
  if (raw.puzzleMode === 'checkpoint') common.hazards.forEach((h, i) => {
    const owner = id(h.sectionId, `hazards[${i}].sectionId`);
    if (!sectionIds.has(owner)) throw new Error(`hazards[${i}].sectionId must reference an existing section.`);
    // Ownership is explicit: connector hazards and saws may cross section bounds/walls.
  });
  const safeTiles = new Set(Object.entries(TERRAIN).filter(([, t]) => !t.solid && !t.lethal).map(([key]) => key));
  const safe = (p: Point) => safeTiles.has(common.tiles[p.y]?.[p.x]);
  const swept = common.hazards.map(hazardBounds);
  const observationSafe = (b: Bounds, label: string) => {
    for (let y = b.y; y < b.y + b.height; y++) for (let x = b.x; x < b.x + b.width; x++)
      if (!['.', ':'].includes(common.tiles[y][x])) throw new Error(`${label} must be safe, stoppable observation ground.`);
    if (swept.some(h => overlaps(h, b))) throw new Error(`${label} overlaps a hazard's observation clearance.`);
  };
  // Reject ambiguous ownership before other per-section errors.
  sections.forEach((s, i) => {
    for (const previous of sections.slice(0, i))
      if (overlaps(previous.bounds, s.bounds)) throw new Error('Section bounds overlap.');
  });
  const referenced = new Set<string>();
  const destinations = sections.map((s, i): Point => {
    if (!contains(s.bounds, s.observation)) throw new Error(`section[${i}].observation must be inside section bounds.`);
    if (!inside(s.entry, s.observation)) throw new Error(`section[${i}].entry must be inside observation.`);
    if (!contains(s.camera.frame, s.bounds)) throw new Error(`section[${i}].camera.frame must contain section bounds.`);
    observationSafe(s.observation, `section[${i}].observation`);
    let destination: Point = common.goal;
    if (s.completion.kind === 'checkpoint') {
      const checkpointId = s.completion.checkpointId;
      const checkpoint = checkpoints.find(p => p.id === checkpointId);
      if (!checkpoint || referenced.has(checkpointId)) throw new Error('Invalid or repeated checkpoint completion reference.');
      if (checkpoint.id !== checkpoints[i]?.id) throw new Error('Checkpoint references must follow checkpoint array order.');
      referenced.add(checkpointId);
      destination = checkpoint;
      observationSafe({ ...checkpoint, width: 1, height: 1 }, `checkpoint ${checkpointId} landing`);
    }
    if (!inside(destination, s.bounds)) throw new Error(`section[${i}] completion must be inside section bounds.`);
    if (same(s.entry, destination)) throw new Error(`section[${i}] entry and completion must differ.`);
    return destination;
  });
  if (referenced.size !== checkpoints.length) throw new Error('Every checkpoint must have one section completion reference.');
  if (!same(common.spawn, sections[0].entry)) throw new Error('First section entry must equal spawn.');

  // Cardinal safe-terrain graph only: ignores hazard timing and movement dynamics.
  const route = (from: Point, to: Point, allowed: (p: Point) => boolean, label: string) => {
    const visited = new Uint8Array(board.width * board.height), queue: Point[] = [from];
    visited[from.y * board.width + from.x] = 1;
    for (let index = 0; index < queue.length; index++) {
      const p = queue[index];
      if (same(p, to)) return;
      for (const next of [{ x: p.x - 1, y: p.y }, { x: p.x + 1, y: p.y },
        { x: p.x, y: p.y - 1 }, { x: p.x, y: p.y + 1 }]) {
        if (!inside(next, board)) continue;
        const key = next.y * board.width + next.x;
        if (!visited[key] && safe(next) && allowed(next)) { visited[key] = 1; queue.push(next); }
      }
    }
    throw new Error(`${label} has no connected safe-terrain route.`);
  };
  sections.forEach((s, i) => {
    route(s.entry, destinations[i], p => inside(p, s.bounds), `section[${i}] route`);
    if (i > 0) route(destinations[i - 1], s.entry,
      p => inside(p, sections[i - 1].bounds) || inside(p, s.observation)
        || !sections.some(other => inside(p, other.bounds)), `connector[${i - 1}] route`);
  });
  return Object.freeze({ ...common, version: 2, revision, resetPatternOnRetry: false,
    ...(raw.puzzleMode === 'checkpoint' ? { puzzleMode: 'checkpoint' as const } : {}),
    checkpoints: Object.freeze(checkpoints), sections: Object.freeze(sections) });
}
