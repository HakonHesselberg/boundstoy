import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { parseLevel, type Point } from '../core/level.ts';
import { createState, step, DT, STILL, type State } from '../core/simulation.ts';
import { PlayerMotion, MOTION } from '../presentation/motion.ts';
import { Scene } from '../presentation/scene.ts';

const TRAIL_DOTS = 14;
const hardIceRoom = parseLevel({
  version: 1, id: 'trail-hard', name: 'Trail', description: 'Trail fixture.',
  tiles: ['########', ...Array.from({ length: 4 }, () => '#======#'), '########'],
  spawn: { x: 2, y: 2 }, goal: { x: 6, y: 4 }, checkpoints: [], hazards: [],
});

type Dot = THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;

/** Drives `Scene.draw` with real simulation ticks, as the browser frame loop does. */
function trailHarness(reducedMotion = false) {
  const level = hardIceRoom;
  const motion = new PlayerMotion();
  const trail: Dot[] = Array.from({ length: TRAIL_DOTS }, () =>
    new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })));
  const player = new THREE.Group(), rig = new THREE.Group();
  player.add(rig, new THREE.Object3D());
  const goal = new THREE.Group();
  goal.add(new THREE.Object3D(), new THREE.Object3D(), new THREE.Object3D());
  const view = {
    level, player, rig, goal, motion, reducedMotion, lastVisualTime: 0, winStart: null, turnRate: 0,
    antenna: new THREE.Object3D(), playerLocator: new THREE.Group(),
    camera: new THREE.OrthographicCamera(-4, 4, 3, -3),
    container: { clientHeight: 900 }, deathRing: { visible: false, position: new THREE.Vector3(),
      scale: new THREE.Vector3(), material: { opacity: 0 } },
    headingArrow: new THREE.Group(), trailPoints: [], trail, hazards: [], checkpoints: [],
    renderer: { render() {} }, scene: new THREE.Scene(),
    syncEditorAids: Reflect.get(Scene.prototype, 'syncEditorAids'), playerDetails: new THREE.Group(),
  };
  let state: State = createState(level);
  let visualTime = 0;
  const draw = () => Reflect.apply(Scene.prototype.draw, view, [state, visualTime, false, 1]);
  return {
    trail,
    get state() { return state; },
    /** One fixed tick followed by one rendered frame at the tick's visual time. */
    tick(input: Point) {
      const next = step(level, state, input);
      motion.record(state, next, input);
      state = next; visualTime = state.tick * DT; draw();
    },
    /** A rendered frame that does not advance the visual clock (paused). */
    redraw: draw,
    visible: () => trail.filter(dot => dot.visible),
  };
}

function slideIntoCurb(run: ReturnType<typeof trailHarness>) {
  for (let i = 0; i < 400; i++) {
    run.tick({ x: 1, y: 0 });
    if (i > 10 && Math.hypot(run.state.velocity.x, run.state.velocity.y) === 0) return;
  }
  assert.fail('hard ice reaches the curb and stops');
}

test('SceneDraw_TrailAfterStop_FadesOverTrailFadeSecondsInsteadOfVanishing', () => {
  const run = trailHarness();
  slideIntoCurb(run);
  assert.ok(run.visible().length >= TRAIL_DOTS - 1, 'the slide laid a full trail that is still shown on the stopping frame');

  const fadeTicks = Math.round(MOTION.trailFadeSeconds / DT);
  assert.ok(fadeTicks >= 12, 'the fade lasts long enough to be seen (at least 100 ms)');
  let lastOpacity = run.trail[0].material.opacity;
  const halfway = Math.floor(fadeTicks / 2);
  for (let i = 1; i < fadeTicks; i++) {
    run.tick(STILL);
    const opacity = run.trail[0].material.opacity;
    assert.ok(opacity < lastOpacity, `trail keeps fading ${i} ticks after the stop`);
    assert.ok(run.visible().length > 0, `trail is still visible ${i} ticks after the stop`);
    if (i === halfway) assert.ok(opacity > 0.15 && opacity < 0.45, `halfway opacity ${opacity} is a partial fade`);
    lastOpacity = opacity;
  }
  for (let i = 0; i < 2; i++) run.tick(STILL);
  assert.equal(run.visible().length, 0, 'the trail has fully faded once the fade time has passed');
});

test('SceneDraw_TrailFadeWhilePaused_HoldsWithoutVisualTime', () => {
  const run = trailHarness();
  slideIntoCurb(run);
  for (let i = 0; i < 5; i++) run.tick(STILL);
  const opacities = run.trail.map(dot => dot.material.opacity);
  const shown = run.visible().length;
  for (let i = 0; i < 30; i++) run.redraw();
  assert.deepEqual(run.trail.map(dot => dot.material.opacity), opacities, 'pausing freezes the fade');
  assert.equal(run.visible().length, shown);
});

test('SceneDraw_TrailAfterLongStop_DoesNotRestoreStaleDotsWhenMovingAgain', () => {
  const run = trailHarness();
  slideIntoCurb(run);
  const curb = { ...run.state.position };
  for (let i = 0; i < Math.round(1 / DT); i++) run.tick(STILL);
  for (let i = 0; i < 4; i++) run.tick({ x: -1, y: 0 });
  const travelled = curb.x - run.state.position.x;
  assert.ok(travelled > 0, 'the player launches back off the curb');
  for (const dot of run.visible()) {
    assert.ok(dot.position.x >= run.state.position.x - 1e-6 && dot.position.x <= curb.x + 1e-6,
      `dot at x=${dot.position.x.toFixed(3)} lies on the new path between ${run.state.position.x.toFixed(3)} and ${curb.x.toFixed(3)}`);
  }
});

test('SceneDraw_TrailQuickRelaunchMidFade_KeepsFadingTheOldRun', () => {
  const run = trailHarness();
  slideIntoCurb(run);
  for (let i = 0; i < 10; i++) run.tick(STILL);
  const oldBrightest = Math.max(...run.visible().map(dot => dot.material.opacity));
  assert.ok(oldBrightest > 0, 'the old run is still fading when the player relaunches');
  for (let i = 0; i < 12; i++) {
    run.tick({ x: -1, y: 0 });
    for (const dot of run.visible()) {
      if (dot.position.x < run.state.position.x - 1e-6) {
        assert.ok(dot.material.opacity < oldBrightest, `old dot ahead of the player at x=${dot.position.x.toFixed(3)} does not brighten again`);
      }
    }
  }
  for (let i = 0; i < Math.round(MOTION.trailFadeSeconds / DT); i++) run.tick({ x: -1, y: 0 });
  assert.ok(run.visible().every(dot => dot.position.x >= run.state.position.x - 1e-6), 'the old run has faded away');
  assert.ok(run.visible().length > 0, 'the new run lays its own trail');
});

test('SceneDraw_TrailWithReducedMotion_StaysHidden', () => {
  const run = trailHarness(true);
  for (let i = 0; i < 40; i++) {
    run.tick({ x: 1, y: 0 });
    assert.equal(run.visible().length, 0);
  }
  slideIntoCurb(run);
  for (let i = 0; i < 10; i++) { run.tick(STILL); assert.equal(run.visible().length, 0); }
});
