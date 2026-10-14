import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { AUDIO_SAMPLES } from '../presentation/audio.ts';
import { SOUNDS, SOUND_MIX } from '../data/sounds.ts';

const root = new URL('../public/audio/ice-candidates/', import.meta.url);
const ids = ['weightless', 'silk', 'veil'];

test('IceCandidates_ThreeDistinctLicensedPreviewsAreNotInTheRuntimeBank', () => {
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', root), 'utf8'));
  assert.deepEqual(manifest.candidates.map((entry: { id: string }) => entry.id), ids);
  assert.equal(manifest.selected, null);
  assert.deepEqual(manifest.context, ([['bump', 4], ['warning', 7], ['blast', 7.225]] as const).map(([id, time]) => ({
    id, time, file: `../${SOUNDS[id].sample}.wav`, gain: SOUNDS[id].gain * SOUND_MIX.masterGain,
    attack: SOUND_MIX.attack, release: SOUND_MIX.release,
  })));
  assert.ok(!AUDIO_SAMPLES.some(path => path.includes('ice-candidates')));
  for (const candidate of manifest.candidates) {
    const wav = readFileSync(new URL(`${candidate.id}.wav`, root));
    assert.equal(createHash('sha256').update(wav).digest('hex'), candidate.sha256);
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
    assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
    assert.equal(wav.readUInt16LE(20), 1);
    assert.equal(wav.readUInt16LE(22), 2);
    assert.equal(wav.readUInt32LE(24), 48000);
    assert.equal(wav.readUInt16LE(34), 16);
    assert.equal(wav.length, 44 + 12 * 48000 * 4);
    let peak = 0, monoEnergy = 0, energy = 0;
    for (let offset = 44; offset < wav.length; offset += 4) {
      const left = wav.readInt16LE(offset) / 32768, right = wav.readInt16LE(offset + 2) / 32768;
      peak = Math.max(peak, Math.abs(left), Math.abs(right));
      energy += (left ** 2 + right ** 2) / 2;
      monoEnergy += ((left + right) / 2) ** 2;
    }
    assert.ok(peak > .005 && peak < .5, `${candidate.id}: silence or unsafe peak`);
    assert.ok(peak / Math.sqrt(energy / (12 * 48000)) < 10, `${candidate.id}: transient spike`);
    assert.ok(monoEnergy / energy > .65, `${candidate.id}: mono cancellation`);
    for (const offset of [44, wav.length - 4]) {
      assert.ok(Math.abs(wav.readInt16LE(offset)) <= 1, 'Preview must start and end gently at zero');
    }
    assert.ok(Math.abs(candidate.lufs + 30) < .6, `${candidate.id}: loudness not matched`);
    assert.ok(candidate.truePeakDb < -6, `${candidate.id}: true-peak headroom`);
    assert.match(candidate.license, /^CC0-1.0$|^CC-BY-3.0$/);
    assert.ok(candidate.provenance.length > 0);
  }
});

test('IceCandidates_TonalSourcesUseActualPinnedStrudelOfflineExports', () => {
  for (const id of ['weightless', 'veil']) {
    const source = readFileSync(new URL(`${id}.strudel.js`, root), 'utf8');
    const evidence = JSON.parse(readFileSync(new URL(`${id}.render.json`, root), 'utf8'));
    assert.equal(evidence.engine, '@strudel/web@1.3.0');
    assert.equal(evidence.bundleSha256, '50beb01abd04589333a10e078dce182c82e2de75b43e9bbe81a34bd069948931');
    assert.equal(evidence.method, 'renderPatternAudio / OfflineAudioContext');
    assert.equal(evidence.patternSha256, createHash('sha256').update(source).digest('hex'));
    assert.equal(evidence.sampleRate, 48000);
    assert.equal(evidence.seconds, 28);
    assert.ok(evidence.onsets >= 2 && evidence.onsets <= 8);
    assert.ok(evidence.peak > .001 && evidence.peak < 1);
    assert.match(evidence.rawSha256, /^[0-9a-f]{64}$/);
    assert.equal(evidence.requests.every((url: string) => new URL(url).hostname === '127.0.0.1'), true);
    assert.doesNotMatch(source, /\b(noise|samples|soundfont|sawtooth|square)\b/);
  }
});
