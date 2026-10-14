import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ICE_PALETTE, ICE_PALETTE_IDS, ICE_PALETTE_AUDIO } from '../data/ice-palette.ts';
import { AUDIO_SAMPLES } from '../presentation/audio.ts';
import { SOUND_MIX } from '../data/sounds.ts';
import { SOUND_ICE_DEMO } from '../data/sound-demo.ts';

test('IcePalette_DemoCopyDescribesTheTwelveSoundSelection', () => {
  assert.equal(SOUND_ICE_DEMO.level.name, 'Ice sound garden');
  assert.match(SOUND_ICE_DEMO.question, /twelve/i);
  assert.doesNotMatch(SOUND_ICE_DEMO.hints.join(' '), /Compare A\/B|wind with/i);
  const main = readFileSync(new URL('../presentation/main.ts', import.meta.url), 'utf8');
  assert.match(main, /SOUND GARDEN · ICE SOUNDS/);
  assert.doesNotMatch(main, /SOUND GARDEN · WIND & ICE/i);
});

test('IcePalette_TwelveOriginalFamiliesHaveMatchedSeamlessMastersAndNoRejectedCloth', () => {
  assert.equal(ICE_PALETTE_IDS.length, 12);
  assert.ok(new Set(Object.values(ICE_PALETTE).map(sound => sound.family)).size >= 4);
  assert.ok(!ICE_PALETTE_IDS.some(id => /silk|wind/.test(id)));
  const manifest = JSON.parse(readFileSync(new URL('../public/audio/ice-palette/manifest.json', import.meta.url), 'utf8'));
  assert.deepEqual(manifest.sounds.map((sound: { id: string }) => sound.id), ICE_PALETTE_IDS);
  for (const id of ICE_PALETTE_IDS) {
    const definition = ICE_PALETTE[id], metadata = manifest.sounds.find((sound: { id: string }) => sound.id === id);
    assert.ok(!AUDIO_SAMPLES.includes(definition.sample), 'The palette must not be fetched by normal gameplay');
    const wav = readFileSync(new URL(`../public/audio/${definition.sample}.wav`, import.meta.url));
    assert.equal(wav.readUInt16LE(20), 1);
    assert.equal(wav.readUInt16LE(22), 2);
    assert.equal(wav.readUInt32LE(24), 48000);
    assert.equal(wav.readUInt16LE(34), 16);
    const frames = (wav.length - 44) / 4;
    assert.ok(frames >= 6 * 48000 && frames <= 10 * 48000);
    const blocks: number[] = [];
    let energy = 0, mono = 0, peak = 0, adjacent = 0;
    for (let frame = 0; frame < frames; frame++) {
      const left = wav.readInt16LE(44 + frame * 4) / 32768, right = wav.readInt16LE(46 + frame * 4) / 32768;
      const power = (left * left + right * right) / 2;
      energy += power; mono += ((left + right) / 2) ** 2;
      peak = Math.max(peak, Math.abs(left), Math.abs(right));
      if (frame) adjacent = Math.max(adjacent, Math.abs(left - wav.readInt16LE(40 + frame * 4) / 32768));
      const block = Math.floor(frame / 4800);
      blocks[block] = (blocks[block] ?? 0) + power;
    }
    const wholeBlocks = blocks.slice(0, Math.floor(frames / 4800)).map(value => value / 4800);
    const mean = energy / frames;
    assert.ok(Math.min(...wholeBlocks) / mean > .72, `${id}: repeated fade gap or pumping`);
    assert.ok(Math.max(...wholeBlocks) / mean < 1.3, `${id}: repeated swell`);
    assert.ok(mono / energy > .65, `${id}: mono cancellation`);
    assert.ok(peak > .005 && peak < .2, `${id}: non-silent, restrained peak`);
    assert.ok(peak * ICE_PALETTE_AUDIO.gain * SOUND_MIX.masterGain * SOUND_MIX.maxVoices < .8,
      `${id}: conservative eight-voice peak budget`);
    for (let channel = 0; channel < 2; channel++) {
      const first = wav.readInt16LE(44 + channel * 2), last = wav.readInt16LE(wav.length - 4 + channel * 2);
      assert.ok(Math.abs(first - last) / 32768 <= adjacent * 1.1 + 1 / 32768, `${id}: sharp loop join`);
    }
    assert.ok(Math.abs(metadata.lufs - ICE_PALETTE_AUDIO.targetLufs) < .6);
    assert.ok(metadata.truePeakDb < -14);
    assert.equal(metadata.license, 'CC0-1.0');
    assert.equal(metadata.sha256, createHash('sha256').update(wav).digest('hex'));
    const source = readFileSync(new URL(`../public/audio/ice-palette/${id}.strudel.js`, import.meta.url));
    assert.equal(metadata.patternSha256, createHash('sha256').update(source).digest('hex'));
    assert.match(metadata.rawSha256, /^[a-f0-9]{64}$/);
  }
});
