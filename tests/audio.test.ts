import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Audio, MAX_AUDIO_VOICES } from '../presentation/audio.ts';
import * as audioSelection from '../presentation/audio.ts';
import { completeEight } from './fixtures/aftershock-world.ts';
import { selectWorldView } from '../presentation/world-camera.ts';

test('Audio_InvalidVolume_IsRejectedBeforeCreatingBrowserResources', () => {
  const audio = new Audio();
  for (const volume of [-0.1, 1.1, NaN, Infinity]) assert.throws(() => audio.setVolume(volume), /volume/i);
  assert.doesNotThrow(() => audio.setVolume(0));
  assert.doesNotThrow(() => audio.setVolume(1));
  assert.ok(MAX_AUDIO_VOICES <= 12);
  audio.dispose();
});

test('Audio_DenseBlasts_BoundsVoicesPrioritizesWinAndDisconnectsOnMute', async t => {
  const oscillators: FakeOscillator[] = [];
  const gains: FakeGain[] = [];
  const parameter = () => ({
    setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {}, setTargetAtTime() {},
  });
  class FakeGain {
    gain = parameter();
    disconnected = false;
    connect() { return this; }
    disconnect() { this.disconnected = true; }
  }
  class FakeOscillator {
    frequency = parameter();
    onended: (() => void) | null = null;
    disconnected = false;
    connect(gain: FakeGain) { return gain; }
    disconnect() { this.disconnected = true; }
    start() {}
    stop() {}
  }
  class FakeContext {
    currentTime = 0;
    state = 'running';
    destination = {};
    createGain() { const gain = new FakeGain(); gains.push(gain); return gain; }
    createOscillator() { const voice = new FakeOscillator(); oscillators.push(voice); return voice; }
    async resume() { this.state = 'running'; }
    async suspend() { this.state = 'suspended'; }
    async close() { this.state = 'closed'; }
  }
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
  Object.defineProperty(globalThis, 'AudioContext', { configurable: true, value: FakeContext });
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, 'AudioContext', descriptor);
    else Reflect.deleteProperty(globalThis, 'AudioContext');
  });
  const audio = new Audio();
  audio.play('blast');
  assert.equal(oscillators.length, 0, 'muted audio allocates no voices');
  await audio.setEnabled(true);
  for (let i = 0; i < 100; i++) audio.play('blast');
  assert.equal(oscillators.length, MAX_AUDIO_VOICES);
  audio.play('win');
  assert.equal(oscillators.filter(voice => !voice.disconnected).length, 4);
  for (const voice of oscillators.slice(-4)) voice.onended?.();
  assert.equal(oscillators.filter(voice => !voice.disconnected).length, 0);
  audio.play('checkpoint');
  await audio.setEnabled(false);
  assert.ok(oscillators.every(voice => voice.disconnected));
  assert.ok(gains.slice(1).every(gain => gain.disconnected), 'all per-voice gains disconnect');
  audio.dispose();
  assert.ok(gains[0].disconnected, 'master gain disconnects on disposal');
});
test('BlastAudio_UsesPositionBasedSectionAndConnectorNotGlobalDetonations', () => {
  assert.equal(typeof audioSelection.localBlast, 'function');
  const world = completeEight;
  const start = { x: 1.5, y: 3.5 };
  assert.equal(audioSelection.localBlast(world, start, 39, 40), true);
  const remoteTick = world.hazards.filter(h => h.kind === 'pulse' && h.y > 30)
    .map(h => (h.period - h.phase) % h.period)
    .find(tick => !world.hazards.some(h => h.kind === 'pulse' && h.x < 19
      && (h.period - h.phase) % h.period === tick))!;
  assert.equal(audioSelection.localBlast(world, start, remoteTick - 1, remoteTick), false);
  assert.equal(audioSelection.localBlast(world, start, 40, 40), false, 'pause is silent');
  const seam = { x: 19, y: 3.5 };
  assert.deepEqual(selectWorldView(world, seam).sections, [0, 1]);
  assert.equal(audioSelection.localBlast(world, seam, 172, 173), true);
  assert.equal(audioSelection.localBlast(world, { x: 1.5, y: 3.5 }, 172, 173), false,
    'backtracking follows camera position, not highest checkpoint');
});
