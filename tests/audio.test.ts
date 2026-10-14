import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Audio, AUDIO_SAMPLES, MAX_AUDIO_VOICES } from '../presentation/audio.ts';
import * as audioSelection from '../presentation/audio.ts';
import { completeEight } from './fixtures/aftershock-world.ts';
import { selectWorldView } from '../presentation/world-camera.ts';
import { createState, step } from '../core/simulation.ts';
import { parseLevel } from '../core/level.ts';
import { SOUNDS, SOUND_IDS, SOUND_MIX, SOUND_SAMPLES } from '../data/sounds.ts';
import { readFileSync, readdirSync } from 'node:fs';
import { renderDesignedSound } from '../scripts/prepare-audio.ts';
import { runInNewContext } from 'node:vm';
import { createHash } from 'node:crypto';

test('Explosion_UsesApprovedSoftPuffWithoutChangingWarningOrPlaybackLimits', () => {
  assert.equal(SOUNDS.blast.sample, 'explosion-candidates/airy-puff-blast');
  assert.equal(SOUNDS.blast.gain, 1.2, 'Compensate for the quieter asset master, not by changing global gain');
  assert.equal(SOUNDS.blast.cooldown, .055);
  assert.equal(SOUNDS.blast.priority, 2);
  assert.deepEqual(SOUNDS.blast.rates, [1]);
  assert.equal(SOUNDS.warning.sample, 'physical-v2/warning/sound');
  assert.equal(SOUNDS.warning.gain, .15);
  assert.equal(SOUND_MIX.masterGain, .5);
  assert.equal(MAX_AUDIO_VOICES, 8);
  const wav = readFileSync(new URL(`../public/audio/${SOUNDS.blast.sample}.wav`, import.meta.url));
  assert.equal(createHash('sha256').update(wav).digest('hex'),
    'de5a2d70ebfab6ee40a315a2e707ed6a8c2e2c19776edb75417a2094e635cec2',
    'Use the approved revision unchanged');
  assert.ok(!AUDIO_SAMPLES.includes('physical-v2/blast/sound'));
});

test('ApprovedRetryAndButton_UseExactAuditionedAssetsAtTheirAuditionedMixLevels', () => {
  for (const [id, sample, digest, cooldown, priority] of [
    ['death', 'death-feather', '21ee31246dd0934cebe759ea5375e0d6ec67785bebbb171e657441b3544127ee', .25, 3],
    ['ui', 'ui-tick', '9fa8473fde48c50eea5925ac5300744073255c963abb6f3f7281fa649e6a2e4e', .06, 1],
  ] as const) {
    assert.equal(SOUNDS[id].sample, `sound-board/${sample}`);
    assert.equal(SOUNDS[id].gain * SOUND_MIX.masterGain, 1);
    assert.deepEqual(SOUNDS[id].rates, [1]);
    assert.equal(SOUNDS[id].cooldown, cooldown); assert.equal(SOUNDS[id].priority, priority);
    assert.equal(createHash('sha256').update(readFileSync(new URL(`../public/audio/${SOUNDS[id].sample}.wav`, import.meta.url))).digest('hex'), digest);
  }
  for (const id of ['step', 'mud', 'bump', 'checkpoint', 'win', 'warning'] as const)
    assert.equal(SOUNDS[id].sample, `physical-v2/${id}/sound`, 'Only explicitly approved roles change in gameplay');
});

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
    playbackRate = parameter();
    onended: (() => void) | null = null;
    disconnected = false;
    connect(gain: FakeGain) { return gain; }
    disconnect() { this.disconnected = true; }
    start() {}
    stop() {}
  }
  class FakeContext {
    static instance: FakeContext;
    constructor() { FakeContext.instance = this; }
    currentTime = 0;
    state = 'running';
    destination = {};
    createGain() { const gain = new FakeGain(); gains.push(gain); return gain; }
    createWaveShaper() { return { connect() {}, disconnect() {} }; }
    createBufferSource() { const voice = new FakeOscillator(); oscillators.push(voice); return voice; }
    async decodeAudioData() { return { duration: 0.3 }; }
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
  t.mock.method(globalThis, 'fetch', async () => new Response(new ArrayBuffer(4)));
  audio.play('blast');
  assert.equal(oscillators.length, 0, 'muted audio allocates no voices');
  await audio.setEnabled(true);
  for (let i = 0; i < 100; i++) {
    FakeContext.instance.currentTime += 0.1;
    audio.play('blast');
  }
  assert.equal(oscillators.length, MAX_AUDIO_VOICES);
  audio.play('win');
  assert.equal(oscillators.filter(voice => !voice.disconnected).length, MAX_AUDIO_VOICES);
  assert.equal(oscillators.length, MAX_AUDIO_VOICES + SOUNDS.win.rates.length);
  for (const voice of oscillators) voice.onended?.();
  assert.equal(oscillators.filter(voice => !voice.disconnected).length, 0);
  audio.play('checkpoint');
  await audio.setEnabled(false);
  assert.ok(oscillators.every(voice => voice.disconnected));
  assert.ok(gains.slice(3).every(gain => gain.disconnected), 'all per-voice gains disconnect');
  await audio.setEnabled(true);
  const count = oscillators.length;
  for (let i = 0; i < 100; i++) audio.play('blast');
  assert.equal(oscillators.length, count + 1, 'same-frame catch-up does not stack 100 blasts');
  audio.setVolume(0);
  assert.equal(audio.inspect().voices, 0, 'volume zero clears tails, not just master gain');
  audio.play('win');
  assert.equal(oscillators.length, count + 1, 'volume zero allocates no voices');
  audio.setVolume(1);
  audio.play('checkpoint');
  audio.stop();
  assert.equal(audio.inspect().voices, 0, 'pause/navigation cancels scheduled notes');
  audio.dispose();
  assert.ok(gains[0].disconnected, 'master gain disconnects on disposal');
});

test('Audio_AsyncLoadingFailureRetriesAndMuteOrDisposeNeverReenables', async t => {
  class Context {
    currentTime = 0; state = 'running'; destination = {};
    createGain() { return { gain: { setValueAtTime() {} }, connect() {}, disconnect() {} }; }
    createWaveShaper() { return { connect() {}, disconnect() {} }; }
    async resume() { this.state = 'running'; }
    async suspend() { this.state = 'suspended'; }
    async close() { this.state = 'closed'; }
    async decodeAudioData() { return { duration: 0.3 }; }
  }
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
  Object.defineProperty(globalThis, 'AudioContext', { configurable: true, value: Context });
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, 'AudioContext', descriptor);
    else Reflect.deleteProperty(globalThis, 'AudioContext');
  });
  let release: (() => void) | undefined;
  let response = () => Promise.resolve(new Response('not found', { status: 404 }));
  const fetchMock = t.mock.method(globalThis, 'fetch', () => response());
  const audio = new Audio();
  await assert.rejects(audio.setEnabled(true), /Could not load/);
  assert.equal(audio.inspect().enabled, false);
  response = () => Promise.resolve(new Response(new ArrayBuffer(4)));
  await audio.setEnabled(true);
  assert.equal(audio.inspect().loaded, AUDIO_SAMPLES.length);
  response = () => Promise.resolve(new Response('unavailable', { status: 503 }));
  await assert.rejects(audio.setEnabled(true, 'weightless'), /Weightless pad.*503/);
  assert.equal(audio.inspect().enabled, false);
  assert.equal(audio.isGlideReady('weightless'), false);
  response = () => Promise.resolve(new Response(new ArrayBuffer(4)));
  await audio.setEnabled(true, 'weightless');
  assert.equal(audio.inspect().loaded, AUDIO_SAMPLES.length + 1);
  const requests = fetchMock.mock.calls.length;
  await audio.setEnabled(true, 'weightless');
  assert.equal(fetchMock.mock.calls.length, requests, 'Cached selection does not reload the bank');
  audio.dispose();
  for (const cancel of ['mute', 'dispose']) {
    const waiting = new Promise<void>(resolve => { release = resolve; });
    response = async () => { await waiting; return new Response(new ArrayBuffer(4)); };
    const pending = new Audio(), enable = pending.setEnabled(true, 'veil');
    if (cancel === 'mute') await pending.setEnabled(false);
    else pending.dispose();
    release!();
    await enable;
    assert.equal(pending.inspect().enabled, false, cancel);
    assert.equal(pending.inspect().voices, 0, cancel);
    pending.dispose();
  }
});

test('SoundMasters_AllLocalPCMWithHeadroomAndConservativeWorstCaseMix', () => {
  let bytes = 0;
  const peaks = new Map<string, number>();
  for (const name of SOUND_SAMPLES) {
    const wav = readFileSync(new URL(`../public/audio/${name}.wav`, import.meta.url));
    const puff = name === 'explosion-candidates/airy-puff-blast';
    const board = name === 'sound-board/death-feather' || name === 'sound-board/ui-tick';
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
    assert.equal(wav.readUInt16LE(22), puff || board ? 2 : 1);
    assert.equal(wav.readUInt32LE(24), puff || board ? 48000 : 32000);
    assert.equal(wav.readUInt16LE(34), 16);
    let peak = 0, energy = 0;
    for (let i = 44; i < wav.length; i += 2) {
      const amplitude = wav.readInt16LE(i) / 32768;
      peak = Math.max(peak, Math.abs(amplitude)); energy += amplitude * amplitude;
    }
    assert.ok(puff ? peak > .13 && peak < .14 : board ? peak > .005 && peak < .06
      : peak > .70 && peak < .71, `${name}: approved mastering headroom`);
    assert.ok(energy > 0);
    const duration = (wav.length - 44) / wav.readUInt32LE(28);
    assert.ok(duration <= .7, 'compact tails');
    if (puff) assert.equal(duration, .2);
    peaks.set(name, peak);
    bytes += wav.length;
  }
  assert.ok(bytes < 320_000, `${bytes} bytes should stay under 320 KB`);
  const worstPeak = Math.max(...SOUND_IDS.map(id => SOUNDS[id].gain * peaks.get(SOUNDS[id].sample)!))
    * SOUND_MIX.masterGain * MAX_AUDIO_VOICES;
  assert.ok(worstPeak < 0.7, `even eight aligned loudest voices have headroom: ${worstPeak}`);
});

test('PhysicalPalette_ReplacesEveryOldSampleAndRemovesGlassArpeggios', () => {
  assert.deepEqual(readdirSync(new URL('../public/audio/', import.meta.url)).sort(),
    ['audition-player.js', 'explosion-candidates', 'ice-candidates', 'ice-palette', 'ice-study', 'output.d.ts', 'output.js', 'physical-v2', 'sound-board']);
  assert.equal(SOUND_SAMPLES.length, 11);
  for (const id of SOUND_IDS) {
    assert.equal(SOUNDS[id].sample, id === 'blast' ? 'explosion-candidates/airy-puff-blast'
      : id === 'death' ? 'sound-board/death-feather' : id === 'ui' ? 'sound-board/ui-tick' : `physical-v2/${id}/sound`);
    assert.deepEqual(SOUNDS[id].rates, [1], 'no repitched stock note sequences');
  }
});

test('PhysicalPalette_CustomDesignIsDeterministicFiniteAndNonSilent', () => {
  for (const id of ['soft', 'hard', 'warning', 'blast', 'death', 'checkpoint', 'win'] as const) {
    const first = renderDesignedSound(id), again = renderDesignedSound(id);
    assert.deepEqual(first, again, id);
    assert.ok(first.length >= 32000 * 0.2 && first.length <= 32000 * 0.7);
    assert.ok(first.every(Number.isFinite));
    assert.ok(first.some(value => Math.abs(value) > 0.01));
    assert.notDeepEqual(first.subarray(0, 200), first.subarray(200, 400), 'non-static sound texture');
  }
});

test('PhysicalPalette_ArchivedStrudelRecipeMatchesOriginalFoldersAndGains', () => {
  const recipe = readFileSync(new URL('../public/audio/physical-v2/audition.strudel.js', import.meta.url), 'utf8');
  let tempo = 0, sounds = '', gains = '';
  runInNewContext(recipe, {
    setcpm(value: number) { tempo = value; },
    s(pattern: string) {
      sounds = pattern;
      return { gain(pattern: string) { gains = pattern; } };
    },
  }, { timeout: 1000 });
  assert.equal(tempo, 5);
  assert.deepEqual(sounds.split(' '), [...SOUND_IDS, '~']);
  assert.deepEqual(gains.split(' ').map(Number), [.06, .055, .035, .0325, .095, .075, .12, .095, .09, .10, .045, 0]);
  for (const id of SOUND_IDS)
    assert.deepEqual(readdirSync(new URL(`../public/audio/physical-v2/${id}/`, import.meta.url)), ['sound.wav']);
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

test('SoundEvents_StationaryPauseAndRespawnAreSilentButMovementHasMaterial', () => {
  const level = parseLevel({ version: 1, id: 'audio-test', name: 'Audio', description: 'Audio transition fixture.',
    tiles: ['########', '#......#', '#......#', '#......#', '#......#', '########'],
    spawn: { x: 1, y: 1 }, goal: { x: 6, y: 2 }, checkpoints: [], hazards: [] });
  const initial = createState(level);
  assert.deepEqual(audioSelection.soundEvents(level, initial, initial), []);
  assert.deepEqual(audioSelection.soundEvents(level, initial, step(level, initial, { x: 0, y: 0 })), []);
  const before = { ...initial, tick: 23 };
  assert.ok(audioSelection.soundEvents(level, before, step(level, before, { x: 1, y: 0 })).includes('step'));
  const dead = { ...before, respawnTicks: 1 };
  assert.deepEqual(audioSelection.soundEvents(level, dead, step(level, dead, { x: 1, y: 0 })), []);
});

test('SoundEvents_SoftIceUturnIsNotAWallContactButReflectionIs', () => {
  const level = parseLevel({ version: 1, id: 'audio-turn', name: 'Audio turn', description: 'An open ice room.',
    tiles: Array.from({ length: 12 }, (_, y) => y === 0 || y === 11 ? '#'.repeat(12) : `#${'~'.repeat(10)}#`),
    spawn: { x: 5, y: 5 }, goal: { x: 9, y: 9 }, checkpoints: [], hazards: [] });
  let before = { ...createState(level), velocity: { x: 4.4, y: 0 } };
  for (let i = 0; i < 120; i++) {
    const after = step(level, before, { x: -1, y: 0 });
    assert.ok(!audioSelection.soundEvents(level, before, after).includes('bump'), `free turn at tick ${i}`);
    before = after;
  }
  before = { ...createState(level), position: { x: 10.79, y: 5.5 }, velocity: { x: 4.4, y: 0 } };
  const after = step(level, before, { x: 1, y: 0 });
  assert.ok(audioSelection.soundEvents(level, before, after).includes('bump'));
});
