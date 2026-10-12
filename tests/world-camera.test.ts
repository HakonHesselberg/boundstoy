import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CheckpointCamera, selectWorldView, fitWorldFrame } from '../presentation/world-camera.ts';
import { Scene } from '../presentation/scene.ts';
import { worldFixture, walkTo } from './fixtures/world.ts';
import { createState, step, DT } from '../core/simulation.ts';
import { worldSectionIndex } from '../core/world.ts';
import type { Bounds } from '../core/world.ts';
import { AFTERSHOCK_WORLD } from '../data/aftershock-world.ts';
import { CHECKPOINT_WORLD_ROUTES as EIGHT_SECTION_ROUTES } from '../data/aftershock-world-replays.ts';
import { center } from '../core/level.ts';

const contains = (a: Bounds, b: Bounds) => a.x <= b.x && a.y <= b.y
  && a.x + a.width >= b.x + b.width && a.y + a.height >= b.y + b.height;

test('CheckpointCamera_ApproachDoesNotReveal_CheckpointPansAtFixedScale', () => {
  const world = worldFixture(), camera = new CheckpointCamera(world);
  const initial = camera.update(center(world.spawn), [], 0, false);
  const approach = camera.update({ x: 6.4, y: 2.5 }, [], 1, false);
  assert.deepEqual(approach.sections, [0]);
  assert.deepEqual(approach.frame, initial.frame);
  const cp = world.checkpoints[0], visited = [`${cp.x},${cp.y}`];
  const start = camera.update(center(cp), visited, 2, false);
  assert.deepEqual(start.frame, initial.frame, 'pan starts at the previous center, never jumps or zooms');
  const midway = camera.update(center(cp), visited, 2.35, false);
  const paused = camera.update(center(cp), visited, 2.35, false);
  assert.deepEqual(paused, midway, 'a frozen visual clock freezes the pan');
  const end = camera.update(center(cp), visited, 2.7, false);
  assert.ok(midway.frame.x > start.frame.x && midway.frame.x < end.frame.x);
  assert.ok(contains(end.frame, world.sections[1].camera.frame));
  for (const view of [start, midway, end]) {
    assert.equal(view.frame.width, initial.frame.width);
    assert.equal(view.frame.height, initial.frame.height);
    assert.ok(contains(view.frame, { x: cp.x + 0.3, y: cp.y + 0.3, width: 0.4, height: 0.4 }));
  }
});

test('CheckpointCamera_ReducedMotionAndRestore_SnapToWholePuzzleAndIncomingLanding', () => {
  const world = AFTERSHOCK_WORLD;
  for (let i = 0; i < world.sections.length; i++) {
    const visited = world.checkpoints.slice(0, i).map(p => `${p.x},${p.y}`);
    const position = center(i ? world.checkpoints[i - 1] : world.spawn);
    const camera = new CheckpointCamera(world);
    camera.update(center(world.spawn), [], 0, true);
    const reduced = camera.update(position, visited, 1, true);
    const restored = new CheckpointCamera(world).update(position, visited, 30, false);
    assert.deepEqual(restored.frame, reduced.frame);
    assert.ok(contains(reduced.frame, world.sections[i].camera.frame), `whole puzzle ${i + 1}`);
    if (i) {
      const cp = world.checkpoints[i - 1], r = cp.radius + 0.75;
      assert.ok(contains(reduced.frame, { x: cp.x + 0.5 - r, y: cp.y + 0.5 - r, width: r * 2, height: r * 2 }));
    }
  }
});

test('CheckpointCamera_ProductionRoutes_AllSevenRevealsFitWithoutZoomOrPlayerCropping', () => {
  const world = AFTERSHOCK_WORLD;
  for (const reduced of [false, true]) for (const route of Object.values(EIGHT_SECTION_ROUTES)) {
    let state = createState(world), revealTick = 0, reveals = 0;
    const camera = new CheckpointCamera(world);
    const initial = camera.update(state.position, state.visited, 0, reduced);
    for (const c of route) for (let i = 0; i < c.ticks; i++) {
      state = step(world, state, c);
      const view = camera.update(state.position, state.visited, state.tick * DT, reduced);
      assert.equal(view.frame.width, initial.frame.width);
      assert.equal(view.frame.height, initial.frame.height);
      assert.ok(contains(view.frame, { x: state.position.x - 0.2, y: state.position.y - 0.2, width: 0.4, height: 0.4 }),
        `visible player at ${state.tick}`);
      if (state.event === 'checkpoint') revealTick = state.tick;
      if (revealTick && state.tick === revealTick + (reduced ? 0 : 84)) {
        const index = worldSectionIndex(world, state.visited), b = world.sections[index].bounds;
        assert.ok(contains(view.frame, world.sections[index].camera.frame), `whole puzzle ${index + 1} at ${state.tick}`);
        for (const hazard of world.hazards) {
          const a = hazard.kind === 'pulse' ? hazard : hazard.from, z = hazard.kind === 'pulse' ? hazard : hazard.to;
          const sweep = { x: Math.min(a.x, z.x), y: Math.min(a.y, z.y),
            width: Math.abs(a.x - z.x) + 1, height: Math.abs(a.y - z.y) + 1 };
          if (sweep.x < b.x + b.width && sweep.x + sweep.width > b.x && sweep.y < b.y + b.height && sweep.y + sweep.height > b.y)
            assert.ok(contains(view.frame, sweep), 'entire threatening hazard sweep is revealed');
        }
        reveals++;
      }
    }
    assert.equal(state.won, true); assert.equal(state.deaths, 0); assert.equal(reveals, 7);
  }
});

test('CheckpointCamera_BacktrackAndReturn_OnlyPanToRetainPlayerWithoutDowngradingProgress', () => {
  const world = worldFixture(), camera = new CheckpointCamera(world);
  let state = walkTo(world, createState(world), { x: 18.5, y: 2.5 });
  const end = camera.update(state.position, state.visited, state.tick * DT, false);
  for (const direction of [-1, 1]) for (let i = 0; i < 480; i++) {
    state = step(world, state, { x: direction, y: 0 });
    const view = camera.update(state.position, state.visited, state.tick * DT, false);
    assert.equal(view.frame.width, end.frame.width); assert.equal(view.frame.height, end.frame.height);
    assert.deepEqual(view.sections, [2]); assert.equal(state.visited.length, 2);
    assert.ok(contains(view.frame, { x: state.position.x - 0.2, y: state.position.y - 0.2, width: 0.4, height: 0.4 }));
  }
});

test('WorldCamera_Interior_IsFixedAndContainsEntryObservationCompletionAndHazards', () => {
  const world = worldFixture();
  const a = selectWorldView(world, { x: 3, y: 3 });
  const b = selectWorldView(world, { x: 5, y: 4 });
  assert.deepEqual(a, b);
  assert.deepEqual(a.sections, [0]);
  assert.deepEqual(a.frame, world.sections[0].camera.frame);
});

test('WorldCamera_ApproachAndConnector_PreviewBothNeighborsBeforeLeavingSection', () => {
  const world = worldFixture();
  for (const x of [6.4, 6.99, 7, 8, 8.99, 9, 9.6]) {
    const view = selectWorldView(world, { x, y: 2.5 });
    assert.equal(view.kind, 'connector', `x=${x}`);
    assert.deepEqual(view.sections, [0, 1]);
    for (const section of world.sections.slice(0, 2)) assert.ok(contains(view.frame, section.camera.frame));
  }
  // Arbitrarily bent/global connector floor is legal: never crop the footprint.
  const detour = selectWorldView(world, { x: 8, y: 0.5 });
  assert.ok(contains(detour.frame, { x: 7.25, y: -0.25, width: 1.5, height: 1.5 }));
});

test('WorldCamera_CrossBoundarySaw_ShowsItsEntireRelevantPatrolBeforeCommitment', () => {
  const world = worldFixture({ hazards: [
    { kind: 'saw', from: { x: 11, y: 4 }, to: { x: 19, y: 4 }, period: 240, phase: 0 },
  ] });
  for (const position of [{ x: 8, y: 2.5 }, { x: 11, y: 2.5 }, { x: 19, y: 2.5 }]) {
    const frame = selectWorldView(world, position).frame;
    assert.ok(frame.x <= 11 && frame.x + frame.width >= 20,
      'a saw threatening this section must not arrive from beyond the framed patrol');
  }
});

test('WorldCamera_LegalBacktrack_UsesLocationNotNextUnsolvedSection', () => {
  const world = worldFixture();
  let state = walkTo(world, createState(world), { x: 18.5, y: 2.5 });
  assert.equal(worldSectionIndex(world, state.visited), 2);
  const tick = state.tick, visited = state.visited;
  state = walkTo(world, state, { x: 3.5, y: 2.5 });
  assert.ok(state.tick > tick);
  assert.deepEqual(state.visited, visited);
  assert.equal(worldSectionIndex(world, state.visited), 2);
  assert.deepEqual(selectWorldView(world, state.position).sections, [0]);
});

test('WorldCamera_VerticalGlobalSections_PreviewAndBacktrackWithoutAssumingHorizontalOrder', () => {
  const source = worldFixture();
  const transpose = (p: { x: number; y: number }) => ({ x: p.y, y: p.x });
  const bounds = (b: Bounds): Bounds => ({ ...transpose(b), width: b.height, height: b.width });
  const world = worldFixture({
    tiles: Array.from({ length: source.tiles[0].length }, (_, x) => source.tiles.map(row => row[x]).join('')),
    spawn: transpose(source.spawn), goal: transpose(source.goal),
    checkpoints: source.checkpoints.map(p => ({ ...p, ...transpose(p) })),
    hazards: source.hazards.map(h => h.kind === 'pulse' ? { ...h, ...transpose(h) }
      : { ...h, from: transpose(h.from), to: transpose(h.to) }),
    sections: source.sections.map(s => ({ ...s, bounds: bounds(s.bounds), entry: transpose(s.entry),
      observation: bounds(s.observation), camera: { ...s.camera, frame: bounds(s.camera.frame) } })),
  });
  for (const y of [6.4, 7.5, 8.5, 9.6]) {
    const view = selectWorldView(world, { x: 2.5, y });
    assert.deepEqual(view.sections, [0, 1]);
    assert.ok(contains(view.frame, world.sections[1].bounds));
    assert.deepEqual(fitWorldFrame(view.frame, 1), { x: 4, z: 8, extent: 14 * (25 / Math.hypot(25, 17)) + 1.5 });
  }
  let state = walkTo(world, createState(world), { x: 2.5, y: 18.5 });
  state = walkTo(world, state, { x: 2.5, y: 3.5 });
  assert.equal(state.visited.length, 2);
  assert.deepEqual(selectWorldView(world, state.position).sections, [0]);
});

test('WorldCamera_Follow_ClampsAuthoredWindowWithoutHidingRequiredSection', () => {
  const source = worldFixture();
  const world = worldFixture({ sections: source.sections.map((s, i) => i !== 1 ? s : {
    ...s, camera: { mode: 'follow', frame: { x: 7, y: 0, width: 10, height: 8 } },
  }) });
  const a = selectWorldView(world, { x: 10.5, y: 3 });
  const b = selectWorldView(world, { x: 13.5, y: 4 });
  assert.equal(a.kind, 'follow');
  assert.notEqual(a.frame.x, b.frame.x);
  for (const view of [a, b]) {
    assert.equal(view.frame.width, 10);
    assert.ok(contains(view.frame, world.sections[1].bounds));
  }
  // Equal frame/bounds leaves no safe panning room, so remains stable.
  const tight = worldFixture({ sections: source.sections.map(s => ({ ...s, camera: { ...s.camera, mode: 'follow' } })) });
  assert.deepEqual(selectWorldView(tight, { x: 11, y: 3 }).frame, selectWorldView(tight, { x: 13, y: 4 }).frame);
});

test('WorldCamera_ProductionResizeProjectPick_StayGlobalAtEveryViewAndAspect', () => {
  const level = worldFixture();
  for (const [width, height] of [[1280, 900], [390, 844], [844, 390]]) {
    for (const position of [{ x: 3.5, y: 3.5 }, { x: 8.5, y: 3.5 }, { x: 12.5, y: 3.5 }, { x: 20.5, y: 3.5 }]) {
      const worldView = selectWorldView(level, position);
      const camera = new THREE.OrthographicCamera(-12, 12, 10, -10, 0.1, 100);
      const rect = { left: 17, top: 23, width, height };
      const sizes: number[][] = [];
      const view = {
        level, worldView, camera, scene: new THREE.Scene(), routeSigns: [],
        key: new THREE.DirectionalLight(),
        container: { clientWidth: width, clientHeight: height },
        renderer: { setSize(w: number, h: number) { sizes.push([w, h]); }, domElement: { getBoundingClientRect: () => rect } },
        raycaster: new THREE.Raycaster(), plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
      };
      Reflect.apply(Scene.prototype.resize, view, []);
      const fit = fitWorldFrame(worldView.frame, width / height);
      assert.equal(camera.position.x, fit.x);
      assert.equal(camera.position.z, fit.z + 17);
      assert.deepEqual(view.key.target.position.toArray(), [fit.x, 0, fit.z], 'world shadows follow the view');
      for (const index of worldView.sections) {
        const bounds = level.sections[index].bounds;
        for (const point of [{ x: bounds.x, y: bounds.y },
          { x: bounds.x + bounds.width - 1, y: bounds.y + bounds.height - 1 }]) {
          const screen = Reflect.apply(Scene.prototype.project, view, [point]);
          assert.ok(screen.x > rect.left && screen.x < rect.left + width);
          assert.ok(screen.y > rect.top && screen.y < rect.top + height);
          assert.deepEqual(Reflect.apply(Scene.prototype.pick, view, [screen.x, screen.y]), point);
        }
      }
      Reflect.apply(Scene.prototype.resize, view, [false]);
      assert.equal(sizes.length, 1, 'camera-only change must not resize an unchanged canvas');
      view.container.clientWidth++;
      Reflect.apply(Scene.prototype.resize, view, [false]);
      assert.deepEqual(sizes.at(-1), [width + 1, height], 'layout changes during an import still resize the canvas');
    }
  }
});

test('WorldCamera_V1Resize_RetainsExactWholeBoardCamera', () => {
  const source = worldFixture();
  const level = { ...source, version: 1 };
  for (const [width, height] of [[1280, 900], [390, 844], [844, 390]]) {
    const camera = new THREE.OrthographicCamera();
    const view = { level, camera, key: new THREE.DirectionalLight(), scene: new THREE.Scene(), routeSigns: [],
      container: { clientWidth: width, clientHeight: height }, renderer: { setSize() {} } };
    Reflect.apply(Scene.prototype.resize, view, []);
    const extent = Math.max(level.tiles.length * 0.85 + 3, (level.tiles[0].length + 2) / (width / height));
    assert.equal(camera.top, extent / 2);
    assert.equal(camera.right, extent * width / height / 2);
    assert.deepEqual(camera.position.toArray(), [12, 25, 21]);
  }
});

test('WorldCamera_LongConnectorDepth_DoesNotClipThePlayerDespiteFittingInTwoDimensions', () => {
  const source = worldFixture();
  const level = worldFixture({
    checkpoints: [],
    tiles: ['#'.repeat(24), ...Array(126).fill('#......................#'), '#'.repeat(24)],
    sections: [{ ...source.sections[0], bounds: { x: 1, y: 1, width: 22, height: 126 },
      completion: { kind: 'goal' }, camera: { mode: 'fixed', frame: { x: 0, y: 0, width: 24, height: 128 } } }],
  });
  const camera = new THREE.OrthographicCamera(-12, 12, 10, -10, 0.1, 100);
  Reflect.apply(Scene.prototype.resize, {
    level, worldView: selectWorldView(level, { x: 1.5, y: 2.5 }), camera,
    key: new THREE.DirectionalLight(), scene: new THREE.Scene(), routeSigns: [],
    container: { clientWidth: 390, clientHeight: 844 }, renderer: { setSize() {} },
  }, []);
  for (const y of [0, 64, 128]) {
    const p = new THREE.Vector3(12, 0, y).project(camera);
    assert.ok(p.z > -1 && p.z < 1, `global y=${y} must stay inside the camera depth planes`);
  }
});

test('WorldCamera_Fit_UsesTighterPaddingWhileWholePuzzlesWallsAndLabelsStayOnScreen', () => {
  const frames: Bounds[] = Reflect.get(new CheckpointCamera(AFTERSHOCK_WORLD), 'frames');
  // Canvas sizes measured from the shipped layout at 1280x900, 390x844 and 844x390.
  for (const [width, height] of [[1214, 697], [360, 530], [800, 254]]) {
    const aspect = width / height;
    for (const frame of frames) {
      const fit = fitWorldFrame(frame, aspect);
      const camera = new THREE.OrthographicCamera(-fit.extent * aspect / 2, fit.extent * aspect / 2,
        fit.extent / 2, -fit.extent / 2, 0.1, 100);
      camera.position.set(fit.x, 25, fit.z + 17); camera.lookAt(fit.x, 0, fit.z);
      camera.updateProjectionMatrix(); camera.updateMatrixWorld();
      const left = frame.x, right = frame.x + frame.width, top = frame.y, bottom = frame.y + frame.height;
      const points = [
        ...[left, right].flatMap(x => [top, bottom].flatMap(z => [new THREE.Vector3(x, 0, z), new THREE.Vector3(x, -0.38, z)])),
        // Route-sign tops (1.05 + half of 0.45) above cells on the top edge.
        new THREE.Vector3(left + 0.5, 1.275, top + 0.5), new THREE.Vector3(right - 0.5, 1.275, top + 0.5),
      ];
      for (const point of points) {
        const p = point.clone().project(camera);
        assert.ok(Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1, `${width}x${height} ${JSON.stringify(frame)} clips ${point.toArray()}`);
      }
    }
  }
  const desktop = 1214 / 697, common = { x: 0, y: 0, width: 25.05, height: 20.05 };
  const before = Math.max(common.height * 0.85 + 3, (common.width + 2) / desktop);
  assert.ok(fitWorldFrame(common, desktop).extent <= before * 0.92, 'desktop world tiles grow by at least 8%');
});
