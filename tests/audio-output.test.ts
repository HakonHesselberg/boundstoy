import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AUDIO_OUTPUT, createAudioOutput } from '../public/audio/output.js';

test('AudioOutput_AddsTwelveDecibelsWithPeakControlBeforeTheVolumeSlider', () => {
  class Param { value = 0; setValueAtTime(value: number) { this.value = value; } }
  class Node {
    gain = new Param(); curve?: Float32Array; oversample = 'none';
    target?: Node; disconnected = false;
    connect(target: Node) { this.target = target; return target; }
    disconnect() { this.disconnected = true; }
  }
  const nodes: Node[] = [], destination = new Node();
  const create = () => { const node = new Node(); nodes.push(node); return node; };
  const context = { currentTime: 0, destination, createGain: create, createWaveShaper: create };
  const output = createAudioOutput(context as unknown as BaseAudioContext);
  assert.equal(AUDIO_OUTPUT.boostDb, 12);
  const [boost, ceiling, volume] = nodes;
  assert.ok(Math.abs(boost.gain.value - 3.9810717055349722) < 1e-10);
  assert.equal(boost.target, ceiling);
  assert.equal(ceiling.target, volume);
  assert.equal(volume.target, destination, 'User volume is after peak control, not its drive');
  assert.equal(ceiling.oversample, 'none');
  assert.ok(ceiling.curve);
  for (let i = 0; i < ceiling.curve.length; i++) {
    const x: number = i * 2 / (ceiling.curve.length - 1) - 1, value: number = ceiling.curve[i];
    if (Math.abs(x) <= .7) assert.equal(value, x, 'Normal-level signal remains linear');
    assert.ok(Math.abs(value) <= .851);
    if (i) assert.ok(value >= ceiling.curve[i - 1], 'Ceiling must not fold or invert peaks');
  }
  assert.equal(ceiling.curve[(ceiling.curve.length - 1) / 2], 0, 'No added DC signal');
  assert.equal(volume.gain.value, 1);
  output.dispose();
  assert.ok(nodes.every(node => node.disconnected));
});
