import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AIRY_PUFF_AUDIO as puff, EXPLOSION_AUDIO as settings, EXPLOSION_PALETTE, EXPLOSION_SELECTION, type ExplosionCandidate } from '../data/explosion-palette.ts';
import { measure, wave } from './prepare-ice-candidates.ts';

type Part = 'warning' | 'blast';
const hash = (data: Buffer) => createHash('sha256').update(data).digest('hex');
const tau = 2 * Math.PI;

export function renderExplosionCandidate(candidate: ExplosionCandidate, part: Part): Float32Array {
  const warning = part === 'warning', rate = settings.sampleRate;
  const duration = warning ? settings.warningSeconds : candidate.decay;
  const pcm = new Float32Array(Math.round(duration * rate));
  let seed = [...`${candidate.id}/${part}`].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 8401);
  let low = 0, high = 0, phase = 0, softAir = 0;
  for (let i = 0; i < pcm.length; i++) {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    const noise = (seed >>> 0) / 0x80000000 - 1;
    const t = i / rate, progress = i / (pcm.length - 1);
    const airy = candidate.id === 'airy-puff';
    const cutoff = airy
      ? warning ? puff.warningLowpassStart + (puff.warningLowpassEnd - puff.warningLowpassStart) * progress ** 2 : puff.blastLowpass
      : warning ? 500 + 1700 * progress ** 2 : 2400;
    low += (1 - Math.exp(-tau * cutoff / rate)) * (noise - low);
    high += (1 - Math.exp(-tau * 300 / rate)) * (noise - high);
    const air = low - high;
    const frequency = candidate.frequency * (warning ? .7 + .4 * progress ** 2 : 1);
    phase += tau * frequency / rate;
    let sample = 0;
    switch (candidate.id) {
      case 'soft-magic':
        sample = Math.sin(phase) * .65 + Math.sin(phase * 1.5) * .25 + Math.sin(phase * 2) * .1;
        if (!warning) sample *= Math.exp(-t * 9);
        break;
      case 'airy-puff':
        softAir += (1 - Math.exp(-tau * cutoff / rate)) * (air - softAir);
        sample = softAir * 2;
        if (!warning) sample *= Math.exp(-t * puff.blastDecayRate);
        break;
      case 'rounded-pop': {
        const bend = tau * (150 * t + 150 * (1 - Math.exp(-t * 48)) / 48);
        sample = warning ? Math.sin(phase) + Math.sin(phase * 2) * .08
          : Math.sin(bend) * Math.exp(-t * 25);
        break;
      }
      case 'glass-bloom':
        sample = (Math.sin(phase) * .55 + Math.sin(phase * 2.71) * .25 + Math.sin(phase * 4.13) * .08);
        if (!warning) sample *= Math.exp(-t * 11);
        break;
      case 'wooden-knock':
        sample = warning ? low * 1.4 + Math.sin(phase) * .12
          : (Math.sin(phase) * .5 + Math.sin(phase * 1.73) * .28) * Math.exp(-t * 22)
            + low * .3 * Math.exp(-t * 42);
        break;
      case 'deep-cushion':
        sample = Math.sin(phase) * .7 + Math.sin(phase * 2) * .4 + Math.sin(phase * 3) * .12;
        if (!warning) sample *= Math.exp(-t * 15);
        break;
      case 'electric-snap': {
        const bend = warning ? phase : tau * (180 * t + 650 * (1 - Math.exp(-t * 40)) / 40);
        sample = Math.sin(bend + Math.sin(bend * 2) * (warning ? .3 + progress * .6 : Math.exp(-t * 30)));
        if (!warning) sample *= Math.exp(-t * 24);
        break;
      }
      case 'arcade-burst': {
        const bend = warning ? phase : tau * (130 * t + 390 * (1 - Math.exp(-t * 32)) / 32);
        sample = Math.sin(bend) * .6 + Math.sin(bend * 3) * .14 + Math.sin(bend * 5) * .035;
        if (!warning) sample = sample * Math.exp(-t * 19) + low * .55 * Math.exp(-t * 38);
        break;
      }
    }
    const attack = Math.min(1, t / (warning ? .025 : airy ? puff.blastAttack : .003));
    const release = Math.min(1, (pcm.length - 1 - i) / rate / (warning ? .006 : .045));
    const envelope = attack * attack * (3 - 2 * attack) * release * release * (3 - 2 * release);
    pcm[i] = i === 0 || i === pcm.length - 1 ? 0 : sample * envelope * (warning ? .08 + .92 * progress ** 1.4 : 1);
  }
  return pcm;
}

function stereo(samples: Float32Array): Buffer {
  const pcm = Buffer.alloc(samples.length * 8);
  samples.forEach((value, frame) => {
    pcm.writeFloatLE(value, frame * 8); pcm.writeFloatLE(value, frame * 8 + 4);
  });
  return pcm;
}

function eventTrain(pcm: Buffer): Buffer {
  const intervalBytes = Math.round(settings.patternInterval * settings.sampleRate) * 8;
  const train = Buffer.alloc(intervalBytes * settings.measurementRepeats);
  for (let i = 0; i < settings.measurementRepeats; i++) pcm.copy(train, i * intervalBytes);
  return train;
}

export function prepareExplosionPalette(output: string) {
  mkdirSync(output, { recursive: true });
  const candidates = EXPLOSION_PALETTE.map(candidate => {
    const assets = (['warning', 'blast'] as const).map(part => {
      const raw = renderExplosionCandidate(candidate, part), original = stereo(raw);
      const targetLufs = settings.targetLufs[part] + (candidate.id === 'airy-puff' ? puff.loudnessOffsetDb : 0);
      let gainDb = targetLufs - measure(eventTrain(original)).lufs;
      let master: { wav: Buffer; measured: ReturnType<typeof measure>; gainDb: number } | undefined;
      // Short-event gating can move after gain/quantization; remeasure the delivery.
      for (let pass = 0; pass < 4; pass++) {
        const gain = 10 ** (gainDb / 20), pcm = Buffer.alloc(original.length);
        for (let offset = 0; offset < pcm.length; offset += 4) pcm.writeFloatLE(original.readFloatLE(offset) * gain, offset);
        const wav = wave(pcm), quantized = Buffer.alloc(pcm.length);
        let peak = 0;
        for (let offset = 0; offset < pcm.length; offset += 4) {
          const value = wav.readInt16LE(44 + offset / 2) / 32768;
          quantized.writeFloatLE(value, offset); peak = Math.max(peak, Math.abs(value));
        }
        const measured = measure(eventTrain(quantized));
        if (Math.abs(measured.lufs - targetLufs) <= .2) {
          assert.ok(peak < settings.maximumPeak && measured.truePeakDb < -15.5, `${candidate.id}/${part}: insufficient headroom`);
          master = { wav, measured, gainDb }; break;
        }
        gainDb += targetLufs - measured.lufs;
      }
      assert.ok(master, `${candidate.id}/${part}: loudness matching did not converge`);
      const { wav, measured } = master;
      const file = `${candidate.id}-${part}.wav`;
      writeFileSync(resolve(output, file), wav);
      console.log(`${file}: ${measured.lufs} event LUFS; ${measured.truePeakDb} dBTP`);
      return { file, seconds: raw.length / settings.sampleRate, targetEventLufs: targetLufs, eventLufs: measured.lufs,
        truePeakDb: measured.truePeakDb, gainDb, sha256: hash(wav) };
    });
    return { ...candidate, license: 'CC0-1.0',
      provenance: 'Original Boundstoy seeded offline synthesis; no recordings, external samples or third-party compositions.',
      warning: assets[0], blast: assets[1] };
  });
  writeFileSync(resolve(output, 'manifest.json'), JSON.stringify({
    selected: EXPLOSION_SELECTION, sampleRate: settings.sampleRate, warningSeconds: settings.warningSeconds,
    patternInterval: settings.patternInterval, patternCount: settings.patternCount, startDelay: settings.startDelay,
    rapidInterval: settings.rapidInterval, rapidCount: settings.rapidCount,
    measurement: 'Each component repeated six times at 1.2-second intervals, silence-padded; EBU R128 integrated event-train loudness, not standalone short-clip LUFS.',
    targetLufs: settings.targetLufs,
    mastering: 'Static component gain, smooth endpoints, centred stereo PCM16. No limiter or dynamic normalization.',
    source: 'scripts/prepare-explosion-palette.ts + data/explosion-palette.ts',
    sourceSha256: hash(readFileSync(fileURLToPath(import.meta.url))),
    registrySha256: hash(readFileSync(new URL('../data/explosion-palette.ts', import.meta.url))),
    candidates,
  }, null, 2) + '\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  prepareExplosionPalette(resolve(process.argv[2] ?? 'public/audio/explosion-candidates'));
}
