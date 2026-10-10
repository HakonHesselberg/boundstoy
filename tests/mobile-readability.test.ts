import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { LEVELS } from '../data/levels.ts';
import { REPLAYS } from '../data/replays.ts';
import { LEVELS as RELAY_LEVELS } from './fixtures/relay-levels.ts';
import { REPLAYS as RELAY_REPLAYS } from './fixtures/relay-replays.ts';
import { createState, step } from '../core/simulation.ts';
import { Scene } from '../presentation/scene.ts';
import { createPulse } from '../presentation/hazard-visuals.ts';
import { createPlayerLocator, placePlayerLocator, fitRouteSigns, type RouteSign } from '../presentation/readability.ts';

const layouts = [
  { name: 'portrait', width: 360, height: 568 },
  { name: 'landscape', width: 810, height: 228 },
  { name: 'desktop', width: 1374, height: 1000 },
];

function cameraFor(index: number, layout: typeof layouts[number], level = LEVELS[index]) {
  const camera = new THREE.OrthographicCamera(-12, 12, 10, -10, 0.1, 100);
  Reflect.apply(Scene.prototype.resize, {
    level, camera, container: { clientWidth: layout.width, clientHeight: layout.height },
    renderer: { setSize() {} }, scene: new THREE.Scene(), routeSigns: [],
  }, []);
  return camera;
}

function projectedGeometry(object: THREE.Object3D, camera: THREE.Camera, layout: typeof layouts[number]) {
  object.updateMatrixWorld(true);
  const points: THREE.Vector3[] = [];
  object.traverse(child => {
    if (!(child instanceof THREE.Mesh)) return;
    const positions = child.geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      const point = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(child.matrixWorld).project(camera);
      points.push(new THREE.Vector3((point.x + 1) * layout.width / 2, (1 - point.y) * layout.height / 2));
    }
  });
  const box = new THREE.Box3().setFromPoints(points);
  return { width: box.max.x - box.min.x, height: box.max.y - box.min.y, box };
}

test('PlayerLocator_ActualOpaqueGeometry_IsAtLeastTwelveCssPixelsWithoutScalingTheBody', () => {
  for (const layout of layouts.slice(0, 2)) for (const [index, level] of LEVELS.entries()) {
    const camera = cameraFor(index, layout), locator = createPlayerLocator();
    placePlayerLocator(locator, camera, layout.height, level, { x: level.spawn.x + 0.5, y: level.spawn.y + 0.5 });
    const bounds = projectedGeometry(locator, camera, layout);
    assert.ok(bounds.width >= 12 - 1e-6 && bounds.height >= 12 - 1e-6,
      `${layout.name}/${level.id}: actual colored mesh ${bounds.width}x${bounds.height}, not a halo or nominal radius`);
    assert.equal(locator.visible, true);
  }
});

test('PlayerLocator_ChaseElbowsAndRiser_LeaveEveryLethalFootprintExposed', () => {
  const index = RELAY_LEVELS.findIndex(level => level.id === 'relay-crescendo-v2'), level = RELAY_LEVELS[index];
  assert.ok(level);
  let state = createState(level);
  const states = [state];
  for (const command of RELAY_REPLAYS[index]) for (let t = 0; t < command.ticks; t++) {
    state = step(level, state, command); states.push(state);
  }
  assert.equal(state.won, true);
  assert.equal(state.deaths, 0);
  const pulses = level.hazards.filter(hazard => hazard.kind === 'pulse');
  assert.equal(pulses.length, 20, 'both complete travelling phrases and the slow riser');
  const crossings = pulses.map(hazard => states.reduce((closest, next) =>
    Math.hypot(next.position.x - hazard.x - 0.5, next.position.y - hazard.y - 0.5)
      < Math.hypot(closest.position.x - hazard.x - 0.5, closest.position.y - hazard.y - 0.5) ? next : closest));
  const observations = [states[0], ...level.checkpoints.map(point => ({
    position: { x: point.x + 0.5, y: point.y + 0.5 },
  }))];
  const approaches = crossings.flatMap(crossing => [-24, -12, 0, 12, 24].map(offset =>
    states[Math.max(0, Math.min(states.length - 1, crossing.tick + offset))]));
  for (const layout of layouts.slice(0, 2)) for (const { position: { x, y } } of [...observations, ...approaches]) {
    const camera = cameraFor(index, layout, level), locator = createPlayerLocator();
    placePlayerLocator(locator, camera, layout.height, level, { x, y });
    const { box } = projectedGeometry(locator, camera, layout);
    assert.equal(locator.visible, true);
    for (const hazard of level.hazards) {
      if (hazard.kind !== 'pulse') continue;
      const { plate } = createPulse();
      plate.position.x = hazard.x + 0.5; plate.position.z = hazard.y + 0.5;
      const danger = projectedGeometry(plate, camera, layout).box;
      assert.ok(box.max.x <= danger.min.x || box.min.x >= danger.max.x
        || box.max.y <= danger.min.y || box.min.y >= danger.max.y,
      `${layout.name}/${x},${y}: locator covers pulse footprint ${hazard.x},${hazard.y}`);
    }
  }
});

test('RouteSigns_ActualSpriteProjection_KeepsNumbersAndExitLegibleAndSeparate', () => {
  for (const layout of layouts) for (const [index, level] of LEVELS.entries()) {
    const camera = cameraFor(index, layout);
    const signs: RouteSign[] = [{ point: level.goal, label: 'EXIT' },
      ...level.checkpoints.map(point => ({ point, label: '01' }))].map(({ point, label }) => {
      const parent = new THREE.Group(), sprite = new THREE.Sprite();
      parent.position.set(point.x + 0.5, 0, point.y + 0.5); parent.add(sprite); parent.updateMatrixWorld(true);
      return { sprite, label };
    });
    fitRouteSigns(signs, camera, layout.height);
    const boxes = signs.map(({ sprite, label }) => {
      sprite.parent!.updateMatrixWorld(true);
      const position = sprite.getWorldPosition(new THREE.Vector3()).project(camera);
      const ppu = layout.height / (camera.top - camera.bottom);
      const width = sprite.scale.x * ppu, height = sprite.scale.y * ppu;
      assert.ok(height >= 18 - 1e-6, `${layout.name}/${level.id}/${label}: projected sign is ${height}px`);
      const x = (position.x + 1) * layout.width / 2, y = (1 - position.y) * layout.height / 2;
      return { left: x - width / 2, right: x + width / 2, top: y - height / 2, bottom: y + height / 2 };
    });
    for (const [i, box] of boxes.entries()) {
      assert.ok(box.left >= 0 && box.right <= layout.width && box.top >= 0 && box.bottom <= layout.height);
      for (const other of boxes.slice(i + 1)) assert.ok(
        box.right <= other.left || other.right <= box.left || box.bottom <= other.top || other.bottom <= box.top,
        `${layout.name}/${level.id}: route labels overlap`);
    }
  }
});

test('Desktop_CompleteCourseCameraAndOriginalMarkerScale_AreUnchanged', () => {
  const layout = layouts[2];
  for (const [index, level] of LEVELS.entries()) {
    const camera = cameraFor(index, layout), locator = createPlayerLocator();
    placePlayerLocator(locator, camera, layout.height, level, { x: level.spawn.x + 0.5, y: level.spawn.y + 0.5 });
    assert.equal(locator.visible, false, 'desktop keeps the original robot without a redundant cue');
    const sprite = new THREE.Sprite();
    fitRouteSigns([{ sprite, label: '01' }], camera, layout.height);
    assert.deepEqual(sprite.scale.toArray(), [0.95, 0.45, 1]);
    assert.equal(sprite.position.y, 1.05);
    const aspect = layout.width / layout.height;
    const extent = Math.max(level.tiles.length * 0.85 + 3, (level.tiles[0].length + 2) / aspect);
    assert.equal(camera.right - camera.left, extent * aspect);
    assert.equal(camera.top - camera.bottom, extent);
    for (const x of [0, level.tiles[0].length]) for (const z of [0, level.tiles.length]) {
      const point = new THREE.Vector3(x, 0, z).project(camera);
      assert.ok(Math.abs(point.x) <= 1 && Math.abs(point.y) <= 1, 'the entire original route remains on screen');
    }
  }
});

// Optional real-pixel regression, using the existing isolated production runner:
// node tests/mobile-readability.test.ts --readability-browser --timeout 180000
if (process.argv.includes('--readability-browser')) {
  const { main } = await import('../scripts/browser-check.ts');
  const { waitFor } = await import('./browser/runtime.ts');
  const scenarios = LEVELS.map((_, index) => ({ index, name: 'spawn', commands: [] as { ticks: number; x: number; y: number }[] }));
  for (const [index, replay] of REPLAYS.entries()) for (const fraction of [0.25, 0.5, 0.75]) {
    const tick = Math.floor(replay.reduce((sum, command) => sum + command.ticks, 0) * fraction);
    let remaining = tick;
    const commands = replay.flatMap(command => {
      const ticks = Math.min(remaining, command.ticks); remaining -= ticks;
      return ticks ? [{ ...command, ticks }] : [];
    });
    scenarios.push({ index, name: `encounter at ${tick}`, commands });
  }
  await main(process.argv.slice(2).filter(arg => arg !== '--readability-browser'), async ({ page, log, signal }) => {
    let loads = 0;
    page.on('Page.loadEventFired', () => { loads++; });
    for (const [width, height, dpr] of [[390, 844, 1], [844, 390, 1], [390, 844, 2], [1440, 1200, 1]]) {
      await page.call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile: false });
      // The renderer chooses its pixel ratio at construction, just like a fresh device visit.
      const before = loads;
      await page.call('Page.reload');
      await waitFor('Readability viewport reload', async () => loads > before, 15_000, signal);
      await waitFor('Readability WebGL boot', () => page.evaluate('Boolean(window.__BOUNDSTOY__)'), 15_000, signal);
      for (const { index, name, commands } of scenarios) {
        const measurement = await page.evaluate<{
          width: number; height: number; overflow: boolean; routeVisible: boolean; deaths: number;
        }>(`(async () => {
          const debug = window.__BOUNDSTOY__;
          debug.load(${index});
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          for (const command of ${JSON.stringify(commands)}) debug.advance(command.ticks, {x: command.x, y: command.y});
          debug.advance(0);
          const canvas = document.querySelector('.viewport canvas'), rect = canvas.getBoundingClientRect();
          const image = document.createElement('canvas'); image.width = canvas.width; image.height = canvas.height;
          const context = image.getContext('2d');
          context.drawImage(canvas, 0, 0);
          const pixels = context.getImageData(0, 0, image.width, image.height).data;
          const {state, level} = debug.snapshot();
          const center = debug.project({x: state.position.x - 0.5, y: state.position.y - 0.5});
          const ratio = canvas.width / rect.width, xs = [], ys = [];
          for (let y = Math.floor((center.y - rect.top - 40) * ratio); y < (center.y - rect.top + 40) * ratio; y++)
            for (let x = Math.floor((center.x - rect.left - 40) * ratio); x < (center.x - rect.left + 40) * ratio; x++) {
              if (x < 0 || x >= image.width || y < 0 || y >= image.height) continue;
              const offset = (y * image.width + x) * 4;
              if (Math.abs(pixels[offset] - 176) <= 3 && pixels[offset + 1] >= 252
                && Math.abs(pixels[offset + 2] - 228) <= 3) { xs.push(x); ys.push(y); }
            }
          const routeVisible = [level.spawn, level.goal, ...level.checkpoints].every(point => {
            const p = debug.project(point);
            return p.x >= rect.left && p.x <= rect.right && p.y >= rect.top && p.y <= rect.bottom;
          });
          return {
            width: xs.length ? (Math.max(...xs) - Math.min(...xs) + 1) / ratio : 0,
            height: ys.length ? (Math.max(...ys) - Math.min(...ys) + 1) / ratio : 0,
            overflow: document.documentElement.scrollWidth > innerWidth, routeVisible, deaths: state.deaths,
          };
        })()`);
        log(`${width}x${height}@${dpr}/index ${index}/${name}: actual opaque locator pixels ${JSON.stringify(measurement)}`);
        assert.equal(measurement.overflow, false);
        assert.equal(measurement.routeVisible, true);
        assert.equal(measurement.deaths, 0, 'Encounter samples use the exact legal replay, never teleports.');
        if (width < 1440) assert.ok(measurement.width >= 12 && measurement.height >= 12,
          'Measure opaque rendered pixels, not a halo, sprite box, collider diameter, or projected proxy.');
        else assert.deepEqual([measurement.width, measurement.height], [0, 0], 'No redundant desktop locator.');
      }
    }
  });
}
