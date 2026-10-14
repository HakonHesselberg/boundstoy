import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOUNDS, SOUND_MIX } from '../data/sounds.ts';

const output = fileURLToPath(new URL('../public/audio/ice-candidates/', import.meta.url));
const rate = 48000, duration = 12, targetLufs = -30;
const sha256 = (buffer: Buffer) => createHash('sha256').update(buffer).digest('hex');
const clothHash = 'd5668f27ef78b35da8920c23d54942f3342d4405ce3a5b4a3e165ec0122f6c26';

function ffmpeg(args: string[], input?: Buffer) {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...args], { input, maxBuffer: 32 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`FFmpeg failed: ${result.stderr.toString()}`);
  return result;
}

export function measure(pcm: Buffer) {
  const result = ffmpeg(['-f', 'f32le', '-ar', String(rate), '-ac', '2', '-i', 'pipe:0',
    '-af', 'ebur128=peak=true', '-f', 'null', '-'], pcm);
  const summary = result.stderr.toString().split('Summary:').at(-1)!;
  const lufs = Number(summary.match(/\bI:\s+(-?[\d.]+) LUFS/)?.[1]);
  const truePeakDb = Number(summary.match(/\bPeak:\s+(-?[\d.]+) dBFS/)?.[1]);
  assert.ok(Number.isFinite(lufs) && Number.isFinite(truePeakDb), `Cannot measure loudness: ${summary}`);
  return { lufs, truePeakDb };
}

export function wave(pcm: Buffer) {
  const wav = Buffer.alloc(44 + pcm.length / 2);
  wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22);
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 4, 28);
  wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36);
  wav.writeUInt32LE(wav.length - 44, 40);
  for (let i = 0; i < pcm.length / 4; i++) {
    const value = pcm.readFloatLE(i * 4);
    assert.ok(Number.isFinite(value) && Math.abs(value) < .5, 'Unsafe preview sample');
    wav.writeInt16LE(Math.round(value * 32767), 44 + i * 2);
  }
  return wav;
}

export function prepareIceCandidates(renders: string, cloth: string) {
  assert.equal(sha256(readFileSync(cloth)), clothHash, 'Unexpected cloth source: license/provenance must be rechecked');
  mkdirSync(output, { recursive: true });
  const definitions = [
    {
      id: 'weightless', label: 'A · Weightless pad',
      description: 'Rounded, floating sine tones. An open F4/C5 dyad with a slow entrance and a little space.',
      license: 'CC0-1.0', file: join(renders, 'weightless.wav'), filter: 'atrim=duration=12,asetpts=PTS-STARTPTS',
      provenance: 'Original Boundstoy composition and sine patch, rendered by Strudel. No external samples.',
    },
    {
      id: 'silk', label: 'B · Silk glide',
      description: 'An unpitched fabric gesture, stretched into a fine, soft swish. No chord underneath.',
      license: 'CC-BY-3.0', file: cloth,
      filter: 'atrim=start=6.32:end=7.55,asetpts=PTS-STARTPTS,highpass=f=850:p=2,lowpass=f=2700:p=2,atempo=0.5,atempo=0.5,atempo=0.5,apad=whole_dur=12,atrim=duration=12',
      provenance: 'Vinrax, Cloth swing sounds (cloth_sounds.flac), CC BY 3.0. Edited, filtered, time-stretched and mastered by Boundstoy.',
    },
    {
      id: 'veil', label: 'C · Airy musical veil',
      description: 'A lighter, vowel-shaped triangle chord with more diffusion. A soft synthetic vocal colour, not a choir sample.',
      license: 'CC0-1.0', file: join(renders, 'veil.wav'), filter: 'atrim=duration=12,asetpts=PTS-STARTPTS',
      provenance: 'Original Boundstoy composition and triangle/formant patch, rendered by Strudel. No external samples.',
    },
  ];
  const candidates = definitions.map(definition => {
    if (definition.id !== 'silk') {
      const evidence = readFileSync(join(renders, `${definition.id}.render.json`));
      const parsed = JSON.parse(evidence.toString());
      assert.equal(parsed.rawSha256, sha256(readFileSync(definition.file)), 'Raw render hash mismatch');
      assert.equal(parsed.patternSha256, sha256(readFileSync(join(output, `${definition.id}.strudel.js`))), 'Pattern changed since rendering');
      writeFileSync(join(output, `${definition.id}.render.json`), evidence);
    }
    const pcm = ffmpeg(['-i', definition.file, '-af', definition.filter, '-ar', String(rate), '-ac', '2', '-f', 'f32le', 'pipe:1']).stdout;
    assert.equal(pcm.length, duration * rate * 2 * 4);
    for (let frame = 0; frame < duration * rate; frame++) {
      const time = frame / rate;
      const attack = Math.min(1, time / (definition.id === 'silk' ? 1.3 : .2));
      const release = Math.min(1, (duration - 1 / rate - time) / 2.5);
      const envelope = Math.sin(attack * Math.PI / 2) ** 2 * Math.sin(release * Math.PI / 2) ** 2;
      for (let channel = 0; channel < 2; channel++) {
        const offset = (frame * 2 + channel) * 4;
        pcm.writeFloatLE(pcm.readFloatLE(offset) * envelope, offset);
      }
    }
    const before = measure(pcm), gainDb = targetLufs - before.lufs, gain = 10 ** (gainDb / 20);
    for (let i = 0; i < pcm.length; i += 4) pcm.writeFloatLE(pcm.readFloatLE(i) * gain, i);
    const wav = wave(pcm);
    // Measure the actual quantized delivery, not just the float intermediate.
    const quantized = Buffer.alloc(pcm.length);
    for (let i = 0; i < wav.length - 44; i += 2) quantized.writeFloatLE(wav.readInt16LE(44 + i) / 32768, i * 2);
    const measured = measure(quantized);
    assert.ok(Math.abs(measured.lufs - targetLufs) < .6 && measured.truePeakDb < -6);
    writeFileSync(join(output, `${definition.id}.wav`), wav);
    const { file: _file, filter, ...details } = definition;
    console.log(`${definition.id}: ${measured.lufs} LUFS; ${measured.truePeakDb} dBTP`);
    return { ...details, file: `${definition.id}.wav`, sha256: sha256(wav), ...measured,
      sourceSha256: sha256(readFileSync(definition.file)), filter, gainDb };
  });
  const context = ([
    ['bump', 4], ['warning', 7], ['blast', 7.225],
  ] as const).map(([id, time]) => ({
    id, time, file: `../${SOUNDS[id].sample}.wav`, gain: SOUNDS[id].gain * SOUND_MIX.masterGain,
    attack: SOUND_MIX.attack, release: SOUND_MIX.release,
  }));
  writeFileSync(join(output, 'manifest.json'), JSON.stringify({
    selected: null, sampleRate: rate, seconds: duration, targetLufs,
    mastering: 'Static EBU R128 loudness matching; cosine endpoint fades; no dynamic loudness normalization.',
    ffmpeg: spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' }).stdout.split('\n')[0],
    candidates, context,
  }, null, 2) + '\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  assert.equal(args.length, 2, 'Usage: node scripts/prepare-ice-candidates.ts /path/to/strudel/renders /path/to/cloth_sounds.flac');
  prepareIceCandidates(resolve(args[0]), resolve(args[1]));
}
