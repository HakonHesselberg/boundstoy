import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRouteSign } from '../presentation/readability.ts';

type Call = { name: string; args: unknown[] };
function fakeCanvas() {
  const calls: Call[] = [];
  const state: Record<string, unknown> = {};
  const context = new Proxy(state, {
    get(target, key: string) {
      if (key in target) return target[key];
      return (...args: unknown[]) => { calls.push({ name: key, args }); };
    },
    set(target, key: string, value) { target[key] = value; calls.push({ name: `set:${key}`, args: [value] }); return true; },
  });
  const canvas = { width: 0, height: 0, getContext: () => context };
  return { canvas, calls, state };
}

test('RouteSign_RendersAboveMarkersPortalsAndHazards', () => {
  for (const label of ['START', '01', 'EXIT']) {
    const { canvas } = fakeCanvas();
    const sign = createRouteSign(label, 0xffce85, () => canvas as unknown as HTMLCanvasElement);
    assert.equal(sign.material.depthTest, false, `${label}: the exit portal cannot cut through its label`);
    assert.equal(sign.material.depthWrite, false);
    assert.ok(sign.sprite.renderOrder >= 1, `${label}: drawn after translucent bursts and halos`);
    assert.ok(sign.sprite.renderOrder < 2, `${label}: the small-screen player locator still wins`);
    sign.texture.dispose(); sign.material.dispose();
  }
});

test('RouteSign_UsesTheInterfaceTypefaceAndKeepsFittedAspectRatios', () => {
  for (const [label, aspect] of [['01', 1.5], ['EXIT', 3], ['START', 3]] as const) {
    const { canvas, state, calls } = fakeCanvas();
    const sign = createRouteSign(label, 0x86f2dd, () => canvas as unknown as HTMLCanvasElement);
    assert.equal(canvas.width / canvas.height, aspect, `${label}: matches fitRouteSigns width:height`);
    assert.ok(canvas.height >= 128, 'enough texels for crisp minified text');
    assert.match(String(state.font), /Inter|system-ui|sans-serif/, 'same family as the interface');
    assert.doesNotMatch(String(state.font), /monospace/, 'no pixel-looking monospace sign text');
    assert.ok(calls.some(call => call.name === 'fillText' && call.args[0] === label));
    assert.ok(calls.some(call => call.name === 'roundRect' || call.name === 'arcTo'), 'rounded label plate');
    assert.equal(sign.sprite.position.y, 1.05, 'existing anchor height is preserved');
    sign.texture.dispose(); sign.material.dispose();
  }
});
