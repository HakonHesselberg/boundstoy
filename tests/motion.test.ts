import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { parseLevel } from '../core/level.ts';
import { createState, step, DT, STILL, type State } from '../core/simulation.ts';
import { PlayerMotion, damp, dampAngle, easeOutBack, easeOutCubic, impactOf, interpolate, MOTION } from '../presentation/motion.ts';
import { Scene } from '../presentation/scene.ts';

const roomOf = (tile: string, wall = '#') => parseLevel({
  version: 1, id: `motion-${{ '.': 'walk', '~': 'soft', '=': 'hard' }[tile] ?? 'room'}`, name: 'Motion', description: 'Motion fixture.',
  tiles: [wall.repeat(8), ...Array.from({ length: 4 }, () => `${wall}${tile.repeat(6)}${wall}`), wall.repeat(8)],
  spawn: { x: 2, y: 2 }, goal: { x: 6, y: 4 }, checkpoints: [], hazards: [],
});

test('Damp_SameElapsedTime_ConvergesIdenticallyAt60And144Hz', () => {
  const run = (hz: number) => {
    let value = 0;
    for (let i = 0; i < hz / 4; i++) value = damp(value, 1, MOTION.yawRate, 1 / hz);
    return value;
  };
  assert.ok(Math.abs(run(60) - run(144)) < 1e-9, 'smoothing depends on time, not refresh rate');
  assert.ok(Math.abs(dampAngle(Math.PI - 0.1, -Math.PI + 0.1, 1000, 1) - (-Math.PI + 0.1)) < 1e-6
    || Math.abs(dampAngle(Math.PI - 0.1, -Math.PI + 0.1, 1000, 1) - (Math.PI + 0.1)) < 1e-6, 'turns the short way');
});

test('Easing_Curves_StartAndEndExactlyAndOvershootOnlyWhereIntended', () => {
  for (const ease of [easeOutCubic, easeOutBack]) {
    assert.ok(Math.abs(ease(0)) < 1e-12); assert.ok(Math.abs(ease(1) - 1) < 1e-12);
  }
  assert.ok(easeOutCubic(0.5) > 0.5, 'slow out');
  assert.ok(Math.max(...Array.from({ length: 99 }, (_, i) => easeOutBack((i + 1) / 100))) > 1, 'pop overshoots');
});

test('Interpolate_BetweenTicks_BlendsMotionButSnapsAcrossRespawnAndDeath', () => {
  const level = roomOf('.');
  const a = createState(level), b = step(level, a, { x: 1, y: 0 });
  const mid = interpolate(a, b, 0.5);
  assert.ok(Math.abs(mid.x - (a.position.x + b.position.x) / 2) < 1e-12);
  assert.deepEqual(interpolate(a, b, 1), b.position);
  assert.deepEqual(interpolate(null, b, 0.3), b.position);
  const teleported = { ...b, position: { x: 6.5, y: 4.5 } } as State;
  assert.deepEqual(interpolate(a, teleported, 0.5), teleported.position, 'respawn never sweeps across the map');
  const dead = { ...b, deaths: 1, respawnTicks: 54 } as State;
  assert.deepEqual(interpolate(a, dead, 0.5), dead.position);
});

test('Interpolate_IsPresentationOnly_StepResultsAreUnchanged', () => {
  const level = roomOf('~');
  let state = createState(level);
  const motion = new PlayerMotion(); motion.reset();
  const witness: State[] = [];
  for (let i = 0; i < 240; i++) {
    const next = step(level, state, { x: 1, y: i > 120 ? -1 : 0 });
    motion.record(state, next, { x: 1, y: i > 120 ? -1 : 0 });
    motion.position(next, 0.5);
    witness.push(next); state = next;
  }
  let replay = createState(level);
  for (let i = 0; i < 240; i++) {
    replay = step(level, replay, { x: 1, y: i > 120 ? -1 : 0 });
    assert.deepEqual(replay, witness[i]);
  }
});

test('Impact_WallContacts_SquashButOrdinaryStartsAndStopsDoNot', () => {
  const max = MOTION.maxSpeed;
  assert.ok(impactOf({ x: 4.8, y: 0 }, STILL, max) > 0.9, 'hard-ice curb stop');
  assert.ok(impactOf({ x: 4.4, y: 0 }, { x: -4.4, y: 0 }, max) > 0.9, 'soft-ice reflection');
  assert.ok(impactOf({ x: 4.4, y: 0 }, { x: 4.4 * Math.cos(0.03), y: 4.4 * Math.sin(0.03) }, max) < MOTION.impactThreshold,
    'bounded soft-ice turning is not an impact');

  const level = roomOf('=');
  let state = createState(level);
  const motion = new PlayerMotion(); motion.reset();
  let hit = -1;
  for (let i = 0; i < 200 && hit < 0; i++) {
    const next = step(level, state, { x: 1, y: 0 });
    motion.record(state, next, { x: 1, y: 0 });
    if (motion.squash(next, 1) !== 0) hit = next.tick;
    state = next;
  }
  assert.ok(hit > 0, 'sliding into the curb triggers an impact');
  assert.ok(motion.squash(state, 1) > 0, 'impact begins squashed');
  const later = { ...state, tick: state.tick + Math.ceil(MOTION.impactSeconds / DT) + 1 } as State;
  assert.equal(motion.squash(later, 1), 0, 'impact settles completely');

  const walk = roomOf('.');
  let walker = createState(walk);
  const calm = new PlayerMotion(); calm.reset();
  for (const input of [{ x: 1, y: 0 }, { x: 1, y: 0 }, STILL, STILL, { x: 0, y: 1 }, STILL]) {
    const next = step(walk, walker, input);
    calm.record(walker, next, input);
    assert.equal(calm.squash(next, 1), 0, 'deliberate walking starts/stops have no exaggerated squash');
    walker = next;
  }
});

test('Respawn_PopAndCheckpointCollect_AreTimedBySimulationTicksAndFreezeWhenPaused', () => {
  const level = roomOf('.');
  const before = { ...createState(level), deaths: 1, respawnTicks: 1, tick: 100 } as State;
  const after = { ...before, respawnTicks: 0, tick: 101 } as State;
  const motion = new PlayerMotion(); motion.reset();
  assert.equal(motion.spawn(before, 1), 1, 'loading a level shows the player at full size');
  motion.record(before, after, STILL);
  assert.equal(motion.spawn(after, 1), 0);
  const settled = { ...after, tick: after.tick + Math.ceil(MOTION.spawnSeconds / DT) } as State;
  assert.equal(motion.spawn(settled, 1), 1);
  const halfway = motion.spawn({ ...after, tick: after.tick + 10 } as State, 1);
  assert.equal(motion.spawn({ ...after, tick: after.tick + 10 } as State, 1), halfway, 'same tick, same pose');

  const visitedBefore = { ...after, visited: [] } as State;
  const visited = { ...after, tick: 102, visited: ['3,2'], event: 'checkpoint' } as State;
  motion.record(visitedBefore, visited, STILL);
  assert.equal(motion.collect('3,2', visited), 0);
  assert.equal(motion.collect('3,2', { ...visited, tick: 400 } as State), 1);
  assert.equal(motion.collect('4,2', visited), 1, 'previously visited checkpoints stay collected');
});

test('Death_RecordsPreDeathVelocityForAnArcingFall', () => {
  const level = roomOf('.');
  const before = { ...createState(level), velocity: { x: 3.6, y: 0 } } as State;
  const after = { ...before, tick: 1, velocity: STILL, deaths: 1, respawnTicks: 54, event: 'death', deathCause: 'void' } as State;
  const motion = new PlayerMotion(); motion.reset();
  motion.record(before, after, { x: 1, y: 0 });
  assert.deepEqual(motion.fall, { x: 3.6, y: 0 });
});

test('SceneDraw_RespawnPop_KeepsLiveFootprintAtFullWorldScale', () => {
  const level = roomOf('.');
  const player = new THREE.Group(), rig = new THREE.Group(), ring = new THREE.Object3D();
  player.add(rig, ring);
  const goal = new THREE.Group();
  goal.add(new THREE.Object3D(), new THREE.Object3D(), new THREE.Object3D());
  const motion = new PlayerMotion();
  const before = { ...createState(level), deaths: 1, respawnTicks: 1, tick: 100 };
  const after = step(level, before, STILL);
  motion.record(before, after, STILL);
  const view = {
    level, player, rig, goal, motion, reducedMotion: false, lastVisualTime: 0, winStart: null, turnRate: 0,
    antenna: new THREE.Object3D(), playerLocator: new THREE.Group(),
    camera: new THREE.OrthographicCamera(-4, 4, 3, -3),
    container: { clientHeight: 900 }, deathRing: { visible: false, position: new THREE.Vector3(),
      scale: new THREE.Vector3(), material: { opacity: 0 } },
    headingArrow: new THREE.Group(), trailPoints: [], trail: [], hazards: [], checkpoints: [],
    renderer: { render() {} }, scene: new THREE.Scene(),
    syncEditorAids: Reflect.get(Scene.prototype, 'syncEditorAids'), playerDetails: new THREE.Group(),
  };
  for (const reduced of [false, true]) {
    view.reducedMotion = reduced;
    for (let tick = 0; tick <= Math.ceil(MOTION.spawnSeconds / DT); tick++) {
      for (const alpha of [0, 0.5, 1]) {
        Reflect.apply(Scene.prototype.draw, view, [{ ...after, tick: after.tick + tick }, tick * DT, false, alpha]);
        const scale = ring.getWorldScale(new THREE.Vector3());
        assert.deepEqual(scale.toArray(), [1, 1, 1], `live footprint at respawn tick ${tick}, alpha ${alpha}`);
        assert.equal(player.visible, true);
        if (!reduced && tick === 0) assert.ok(rig.scale.y < 1, 'only the body pops into view');
      }
    }
  }
});
