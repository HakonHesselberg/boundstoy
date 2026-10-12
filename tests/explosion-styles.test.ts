import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { EXPLOSION_STYLES, EXPLOSION_STYLE_IDS, DEFAULT_EXPLOSION_STYLE, DORMANT_FRAME, explosionStyle }
  from '../data/explosion-styles.ts';
import { TERRAIN, GROUND_COLORS } from '../data/terrain.ts';
import { parseLevel, importLevel, type Pulse } from '../core/level.ts';
import { paint } from '../core/editor.ts';
import { AFTERSHOCK_WORLD } from '../data/aftershock-world.ts';

const linear = (c: number) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const luminance = (hex: number) => {
  const [r, g, b] = [hex >> 16 & 255, hex >> 8 & 255, hex & 255].map(v => linear(v / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: number, b: number) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const hsl = (hex: number) => new THREE.Color().setHex(hex, THREE.SRGBColorSpace).getHSL({ h: 0, s: 0, l: 0 }, THREE.SRGBColorSpace);
const hueGap = (a: number, b: number) => {
  const d = Math.abs(hsl(a).h - hsl(b).h) * 360;
  return Math.min(d, 360 - d);
};
const FLOORS = [...GROUND_COLORS, ...['~', '=', ':'].map(tile => parseInt(TERRAIN[tile as '~'].color.slice(1), 16))];

test('ExplosionStyles_Registry_IsFrozenWithEmberDefaultAndNoRedStyle', () => {
  assert.deepEqual(EXPLOSION_STYLE_IDS, ['ember', 'plasma', 'toxic', 'psionic']);
  assert.equal(DEFAULT_EXPLOSION_STYLE, 'ember');
  assert.ok(Object.isFrozen(EXPLOSION_STYLES) && EXPLOSION_STYLE_IDS.every(id => Object.isFrozen(EXPLOSION_STYLES[id])));
  for (const id of EXPLOSION_STYLE_IDS) {
    const hue = hsl(EXPLOSION_STYLES[id].frame).h * 360;
    assert.ok(hue > 20 && hue < 340, `${id}: red belongs to spikes, saws and death feedback`);
  }
  assert.equal(explosionStyle({ style: undefined }), EXPLOSION_STYLES.ember);
  assert.equal(explosionStyle({ style: 'toxic' }), EXPLOSION_STYLES.toxic);
});

test('ExplosionStyles_Frames_AreDistinctFromEachOtherAndReadableOnEveryFloor', () => {
  for (const id of EXPLOSION_STYLE_IDS) {
    const { frame } = EXPLOSION_STYLES[id];
    assert.ok(hsl(frame).s >= 0.6, `${id}: saturated, unlike the neutral dormant frame`);
    for (const floor of FLOORS) assert.ok(contrast(frame, floor) >= 1.6 || hueGap(frame, floor) >= 40,
      `${id} frame vs floor #${floor.toString(16)}`);
    for (const other of EXPLOSION_STYLE_IDS) if (other !== id)
      assert.ok(hueGap(frame, EXPLOSION_STYLES[other].frame) >= 45, `${id} vs ${other}: groups stay distinguishable`);
  }
  assert.ok(hsl(DORMANT_FRAME).s <= 0.12, 'dormant pads are neutral');
});

test('ExplosionStyles_Burst_IsBrighterThanItsChargeUp', () => {
  for (const id of EXPLOSION_STYLE_IDS) {
    const style = EXPLOSION_STYLES[id];
    assert.ok(luminance(style.core) > luminance(style.hot), `${id}: ignition core outshines the fuse`);
    assert.ok(luminance(style.core) >= 0.75, `${id}: near white-hot core`);
    assert.ok(luminance(style.scorch) < luminance(style.frame), `${id}: scorch reads as spent`);
    assert.ok(hsl(style.debris).s < hsl(style.burst).s, `${id}: debris cools and desaturates`);
  }
});

const levelWith = (pulse: Record<string, unknown>) => ({
  version: 1, id: 'styled', name: 'Styled', description: 'Style fixture.',
  tiles: Array(6).fill('........'), spawn: { x: 0, y: 0 }, goal: { x: 7, y: 5 }, checkpoints: [],
  hazards: [{ kind: 'pulse', x: 3, y: 3, period: 360, on: 1, phase: 0, ...pulse }],
});

test('PulseStyle_Schema_ValidatesKeepsNonDefaultsAndOmitsTheDefault', () => {
  const styled = parseLevel(levelWith({ style: 'plasma' })).hazards[0] as Pulse;
  assert.equal(styled.style, 'plasma');
  assert.ok(Object.isFrozen(styled));
  for (const source of [levelWith({}), levelWith({ style: 'ember' })]) {
    const pulse = parseLevel(source).hazards[0];
    assert.equal(Object.hasOwn(pulse, 'style'), false, 'the default is canonical and absent');
  }
  assert.throws(() => parseLevel(levelWith({ style: 'crimson' })), /style/);
  assert.throws(() => parseLevel(levelWith({ style: 3 })), /style/);
  const roundtrip = importLevel(JSON.stringify(parseLevel(levelWith({ style: 'psionic' }))));
  assert.equal((roundtrip.hazards[0] as Pulse).style, 'psionic');
  assert.doesNotMatch(JSON.stringify(parseLevel(levelWith({}))), /"style"/, 'existing exports stay byte-identical');
});

test('PulseStyle_EditorPaint_SetsAndRepaintsStyleWithoutChangingTiming', () => {
  const level = parseLevel(levelWith({ period: 480, phase: 37 }));
  const restyled = paint(level, { x: 3, y: 3 }, 'pulse', undefined, 'toxic');
  assert.deepEqual(restyled.hazards, [{ ...level.hazards[0], style: 'toxic' }], 'keeps period and phase');
  const added = paint(level, { x: 5, y: 1 }, 'pulse', undefined, 'psionic');
  assert.equal((added.hazards.at(-1) as Pulse).style, 'psionic');
  const plain = paint(restyled, { x: 3, y: 3 }, 'pulse', undefined, 'ember');
  assert.equal(Object.hasOwn(plain.hazards[0], 'style'), false, 'painting the default restores canonical data');
  assert.equal((plain.hazards[0] as Pulse).period, 480);
});

test('PulseStyle_V2World_AcceptsStylesOnOwnedPads', () => {
  const world = JSON.parse(JSON.stringify(AFTERSHOCK_WORLD));
  const index = world.hazards.findIndex((h: { kind: string }) => h.kind === 'pulse');
  world.hazards[index].style = 'plasma';
  assert.equal((parseLevel(world).hazards[index] as Pulse).style, 'plasma');
});
