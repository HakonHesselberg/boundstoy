import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Audio, AUDIO_SAMPLES, MAX_AUDIO_VOICES, iceMotion } from '../presentation/audio.ts';
import { ICE_AUDIO, ICE_SAMPLES } from '../data/ice-audio.ts';
import { ICE_PALETTE_IDS, ICE_PALETTE_AUDIO } from '../data/ice-palette.ts';
import { renderIceLoop } from '../scripts/prepare-ice-audio.ts';
import { SOUND_ICE_DEMO } from '../data/sound-demo.ts';
import { createState, step } from '../core/simulation.ts';

test('IceLoops_DeterministicPeriodicMastersHaveNoFadeGapAtTheSeam', () => {
  let bytes = 0;
  for (const id of ['wind', 'pad'] as const) {
    const pcm = renderIceLoop(id);
    assert.deepEqual(pcm, renderIceLoop(id));
    assert.equal(pcm.length, ICE_AUDIO.sampleRate * ICE_AUDIO.loopSeconds);
    let adjacent = 0, peak = 0;
    for (let i = 0; i < pcm.length; i++) {
      assert.ok(Number.isFinite(pcm[i]));
      peak = Math.max(peak, Math.abs(pcm[i]));
      if (i) adjacent = Math.max(adjacent, Math.abs(pcm[i] - pcm[i - 1]));
    }
    assert.ok(Math.abs(pcm[0] - pcm.at(-1)!) <= adjacent, 'seam is no sharper than interior sample changes');
    const energy = (samples: Float32Array) => samples.reduce((sum, x) => sum + x * x, 0) / samples.length;
    assert.ok(energy(pcm.subarray(0, 3200)) > energy(pcm) * 0.5, 'no loop-start silence or attack');
    const wav = readFileSync(new URL(`../public/audio/${ICE_SAMPLES[id]}.wav`, import.meta.url));
    assert.equal(wav.length, 44 + pcm.length * 2);
    assert.equal(wav.readUInt32LE(24), ICE_AUDIO.sampleRate);
    for (let i = 0; i < pcm.length; i++)
      assert.equal(wav.readInt16LE(44 + i * 2), Math.round(pcm[i] * (10 ** (-3 / 20) / peak) * 32767) + 0);
    bytes += wav.length;
  }
  assert.ok(bytes < 520_000);
});

test('IceMotion_TracksActualSlidingNotHeldInputAndStopsAtHardWalls', () => {
  const { level } = SOUND_ICE_DEMO;
  let before = createState(level), after = step(level, before, { x: 0, y: 0 });
  assert.equal(iceMotion(level, before, after), null);
  for (let i = 0; i < 40; i++) { before = after; after = step(level, before, { x: 1, y: 0 }); }
  assert.equal(iceMotion(level, before, after), 'soft');
  before = after; after = step(level, before, { x: 0, y: 0 });
  assert.equal(iceMotion(level, before, after), 'soft', 'released key does not stop gliding');
  assert.equal(iceMotion(level, after, after), null, 'paused snapshot');
  before = { ...createState(level), position: { x: 22.79, y: 8.5 }, velocity: { x: 6, y: 0 } };
  for (let i = 0; i < 100; i++) { after = step(level, before, { x: 1, y: 0 }); before = after; }
  assert.equal(iceMotion(level, before, step(level, before, { x: 1, y: 0 })), null);
  assert.equal(iceMotion(level, after, { ...after, tick: after.tick + 1, event: 'death', respawnTicks: 30 }), null);
});

test('IceAudio_SustainsCrossfadesBoundsAndCleansUpWithoutRetriggering', async t => {
  class Param {
    value = 0; holds = 0;
    setValueAtTime(value: number) { this.value = value; }
    linearRampToValueAtTime(value: number) { this.value = value; }
    setTargetAtTime(value: number) { this.value = value; }
    cancelAndHoldAtTime() { this.holds++; }
  }
  class Gain {
    gain = new Param(); frequency = new Param(); Q = new Param();
    disconnected = false; type = '';
    connect() { return this; }
    disconnect() { this.disconnected = true; }
  }
  class Source {
    playbackRate = new Param(); loop = false; onended: (() => void) | null = null;
    disconnected = false; stops: number[] = [];
    connect() { return this; }
    disconnect() { this.disconnected = true; }
    start() {}
    stop(at = 0) { this.stops.push(at); }
  }
  const sources: Source[] = [], gains: Gain[] = [];
  class Context {
    static instance: Context;
    currentTime = 0; state = 'running'; destination = {};
    constructor() { Context.instance = this; }
    createGain() { const gain = new Gain(); gains.push(gain); return gain; }
    createWaveShaper() { return { connect() {}, disconnect() {} }; }
    createBiquadFilter() { return new Gain(); }
    createBufferSource() { const source = new Source(); sources.push(source); return source; }
    async decodeAudioData() { return { duration: ICE_AUDIO.loopSeconds }; }
    async resume() { this.state = 'running'; }
    async suspend() { this.state = 'suspended'; }
    async close() { this.state = 'closed'; }
  }
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
  Object.defineProperty(globalThis, 'AudioContext', { configurable: true, value: Context });
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, 'AudioContext', descriptor);
    else Reflect.deleteProperty(globalThis, 'AudioContext');
  });
  t.mock.method(globalThis, 'fetch', async () => new Response(new ArrayBuffer(4)));
  const audio = new Audio();
  audio.updateGlide('soft', 'pad');
  assert.equal(sources.length, 0, 'no muted allocation');
  await audio.setEnabled(true);
  assert.equal(audio.inspect().loaded, AUDIO_SAMPLES.length);
  audio.updateGlide('soft', 'pad');
  assert.equal(sources.length, 2);
  assert.ok(sources.every(source => source.loop));
  for (let i = 0; i < 1200; i++) audio.updateGlide('soft', 'pad');
  const windHolds = gains[3].gain.holds;
  audio.updateGlide('soft', 'wind');
  assert.equal(gains[3].gain.holds, windHolds, 'A/B leaves even an in-progress wind attack untouched');
  audio.updateGlide('hard', 'wind');
  assert.ok(gains[3].gain.holds > windHolds, 'surface change may reshape the wind');
  assert.equal(sources.length, 2, 'movement, surface and A/B never retrigger');
  assert.deepEqual(audio.inspect().glide, { surface: 'hard', variant: 'wind' });
  for (let i = 0; i < 100; i++) {
    Context.instance.currentTime += 0.1; audio.play('blast');
  }
  assert.equal(audio.inspect().voices, MAX_AUDIO_VOICES, 'loops share the total voice budget');
  audio.play('win');
  assert.equal(audio.inspect().voices, MAX_AUDIO_VOICES);
  audio.updateGlide(null, 'wind');
  assert.equal(audio.inspect().glide, null);
  assert.ok(sources[0].stops.at(-1)! > Context.instance.currentTime, 'normal exit fades rather than cuts');
  audio.stop();
  assert.equal(audio.inspect().voices, 0);
  assert.ok(sources.every(source => source.disconnected));
  audio.auditionGlide('soft', 'pad');
  const preview = sources.slice(-2);
  assert.ok(preview.every(source => source.stops.at(-1) === Context.instance.currentTime + ICE_AUDIO.previewSeconds));
  audio.updateGlide('soft', 'wind');
  assert.equal(sources.slice(-2)[0], preview[0]);
  for (const source of preview) source.onended?.();
  assert.equal(audio.inspect().glide, null);
  assert.equal(audio.inspect().voices, 0, 'preview ends without a UI timer');
  audio.updateGlide('soft', 'pad'); audio.setVolume(0);
  assert.equal(audio.inspect().voices, 0);
  audio.setVolume(1); audio.updateGlide('soft', 'pad');
  await audio.setEnabled(false);
  assert.equal(audio.inspect().voices, 0);
  await audio.setEnabled(true, 'weightless');
  assert.equal(audio.inspect().loaded, AUDIO_SAMPLES.length + 1, 'Only the chosen palette loop is loaded');
  const paletteStart = sources.length;
  audio.updateGlide('soft', 'weightless');
  for (let i = 0; i < 1500; i++) audio.updateGlide('soft', 'weightless');
  audio.updateGlide('hard', 'weightless');
  assert.equal(sources.length, paletteStart + 1, 'Palette motion and surface changes use one sustained source');
  for (const id of ICE_PALETTE_IDS) {
    await audio.setEnabled(true, id);
    audio.updateGlide('soft', id);
    assert.equal(audio.inspect().glide?.variant, id);
    assert.ok(audio.inspect().voices <= MAX_AUDIO_VOICES, 'Rapid switching also bounds retiring voices');
  }
  audio.updateGlide(null, 'weightless');
  assert.equal(audio.inspect().glide, null);
  audio.stop();
  audio.auditionGlide('soft', 'veil');
  assert.equal(audio.inspect().loops, 1);
  assert.equal(sources.at(-1)!.stops.at(-1), Context.instance.currentTime + ICE_PALETTE_AUDIO.previewSeconds);
  sources.at(-1)!.onended?.();
  assert.equal(audio.inspect().glide, null);
  audio.updateGlide('soft', 'weightless'); audio.setVolume(0);
  assert.equal(audio.inspect().voices, 0);
  audio.setVolume(1); audio.updateGlide('hard', 'veil'); audio.dispose();
  assert.equal(audio.inspect().voices, 0);
});
