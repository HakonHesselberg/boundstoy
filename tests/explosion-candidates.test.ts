import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { EXPLOSION_PALETTE, EXPLOSION_AUDIO } from '../data/explosion-palette.ts';
import { renderExplosionCandidate } from '../scripts/prepare-explosion-palette.ts';
import { AUDIO_SAMPLES } from '../presentation/audio.ts';

const root = new URL('../public/audio/explosion-candidates/', import.meta.url);
const hash = (data: Buffer) => createHash('sha256').update(data).digest('hex');

test('ExplosionCandidates_EightDistinctOriginalPairsHaveReproducibleFiniteSynthesis', () => {
  assert.equal(EXPLOSION_PALETTE.length, 8);
  assert.equal(new Set(EXPLOSION_PALETTE.map(candidate => candidate.id)).size, 8);
  assert.equal(EXPLOSION_AUDIO.warningSeconds, 27 / 120);
  const signatures = new Set<string>();
  for (const candidate of EXPLOSION_PALETTE) {
    assert.ok(Object.isFrozen(candidate));
    for (const part of ['warning', 'blast'] as const) {
      const samples = renderExplosionCandidate(candidate, part);
      assert.equal(samples.length, Math.round(EXPLOSION_AUDIO.sampleRate *
        (part === 'warning' ? EXPLOSION_AUDIO.warningSeconds : candidate.decay)));
      assert.deepEqual(samples, renderExplosionCandidate(candidate, part));
      assert.ok(samples.every(Number.isFinite));
      assert.equal(samples[0], 0);
      assert.equal(samples.at(-1), 0);
      assert.ok(samples.some(value => Math.abs(value) > .01));
      signatures.add(hash(Buffer.from(samples.buffer)));
    }
  }
  assert.equal(signatures.size, 16, 'Every component has a distinct waveform');
});

test('ExplosionCandidates_DeliveredAssetsHaveHonestLicensesLoudnessAndHeadroom', () => {
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', root), 'utf8'));
  assert.deepEqual(manifest.selected, { blast: 'airy-puff', warning: null });
  assert.equal(manifest.warningSeconds, 27 / 120);
  assert.equal(manifest.patternCount, 4);
  assert.equal(manifest.patternInterval, 1.2);
  assert.match(manifest.measurement, /repeated.*1\.2/i);
  assert.equal(manifest.sourceSha256, hash(readFileSync(new URL('../scripts/prepare-explosion-palette.ts', import.meta.url))));
  assert.equal(manifest.registrySha256, hash(readFileSync(new URL('../data/explosion-palette.ts', import.meta.url))));
  assert.deepEqual(manifest.candidates.map((candidate: { id: string }) => candidate.id),
    EXPLOSION_PALETTE.map(candidate => candidate.id));
  assert.deepEqual(AUDIO_SAMPLES.filter(file => file.includes('explosion-candidates')),
    ['explosion-candidates/airy-puff-blast'], 'Only the approved impact enters the game bank');
  for (const candidate of manifest.candidates) {
    assert.equal(candidate.license, 'CC0-1.0');
    assert.match(candidate.provenance, /original.*synthesis/i);
    for (const part of ['warning', 'blast'] as const) {
      const asset = candidate[part], wav = readFileSync(new URL(asset.file, root));
      assert.equal(hash(wav), asset.sha256);
      assert.equal(wav.readUInt16LE(20), 1);
      assert.equal(wav.readUInt16LE(22), 2);
      assert.equal(wav.readUInt32LE(24), 48000);
      assert.equal(wav.readUInt16LE(34), 16);
      assert.equal((wav.length - 44) / 4, Math.round(asset.seconds * 48000));
      if (part === 'warning') assert.equal(asset.seconds, .225);
      const mono: number[] = [];
      let peak = 0;
      for (let offset = 44; offset < wav.length; offset += 4) {
        const left = wav.readInt16LE(offset) / 32768, right = wav.readInt16LE(offset + 2) / 32768;
        assert.equal(left, right, 'Centred short effects must survive mono unchanged');
        mono.push(left); peak = Math.max(peak, Math.abs(left));
      }
      assert.equal(mono[0], 0); assert.equal(mono.at(-1), 0);
      assert.ok(peak > .005 && peak < .16, `${asset.file}: restrained peak`);
      assert.ok(asset.truePeakDb < -15.5);
      const target = EXPLOSION_AUDIO.targetLufs[part] + (candidate.id === 'airy-puff' ? -3 : 0);
      assert.ok(Math.abs(asset.eventLufs - target) <= .2);
      if (part === 'blast') {
        const energy = (start: number, end: number) => mono.slice(start, end).reduce((sum, value) => sum + value * value, 0);
        assert.ok(energy(0, 4800) > energy(mono.length - 4800, mono.length) * 4,
          `${asset.file}: impact, not a sustained danger tone`);
      }
    }
    assert.ok(candidate.warning.eventLufs < candidate.blast.eventLufs - 5);
  }
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /audio\/explosion-candidates\/index\.html/);
});

test('AiryPuff_ShortRoundedAttackAndRestrictedTrebleSuitRapidRepetition', () => {
  const candidate = EXPLOSION_PALETTE.find(candidate => candidate.id === 'airy-puff')!;
  assert.equal(candidate.decay, .20);
  const samples = renderExplosionCandidate(candidate, 'blast');
  const energy = (start: number, end: number) => samples.slice(Math.round(start * 48000), Math.round(end * 48000))
    .reduce((sum, value) => sum + value * value, 0);
  assert.ok(energy(0, .005) < energy(.015, .020) * .15, 'No sharp leading transient');
  assert.ok(energy(.15, .20) < energy(0, .05) * .01, 'Tail clears before the next rapid puff');
  // Windowed DFT measures treble energy independently of mastering gain.
  let total = 0, treble = 0;
  const size = 512;
  for (let offset = 0; offset + size <= samples.length; offset += size) {
    for (let bin = 1; bin <= size / 2; bin++) {
      let real = 0, imaginary = 0;
      for (let i = 0; i < size; i++) {
        const value = samples[offset + i] * (.5 - .5 * Math.cos(2 * Math.PI * i / (size - 1)));
        const phase = 2 * Math.PI * bin * i / size;
        real += value * Math.cos(phase); imaginary -= value * Math.sin(phase);
      }
      const power = real * real + imaginary * imaginary;
      total += power;
      if (bin * 48000 / size >= 3000) treble += power;
    }
  }
  assert.ok(treble / total < .03, `Above-3kHz energy: ${treble / total}`);
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', root), 'utf8'));
  assert.equal(manifest.rapidInterval, .25);
  assert.equal(manifest.rapidCount, 8);
});
