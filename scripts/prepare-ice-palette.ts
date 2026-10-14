import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ICE_PALETTE, ICE_PALETTE_IDS, ICE_PALETTE_AUDIO as settings } from '../data/ice-palette.ts';
import { measure, wave } from './prepare-ice-candidates.ts';

const output = fileURLToPath(new URL('../public/audio/ice-palette/', import.meta.url));
const hash = (data: Buffer) => createHash('sha256').update(data).digest('hex');

export function makeIceLoop(wav: Buffer) {
  const rate = settings.sampleRate, start = settings.captureStartSeconds * rate;
  assert.equal(wav.readUInt16LE(20), 1); assert.equal(wav.readUInt16LE(22), 2);
  assert.equal(wav.readUInt32LE(24), rate); assert.equal(wav.readUInt16LE(34), 16);
  assert.ok((wav.length - 44) / 4 >= start + (settings.loopMaxSeconds + settings.crossfadeSeconds) * rate);
  const data = new Float32Array((wav.length - 44) / 2);
  for (let i = 0; i < data.length; i++) data[i] = wav.readInt16LE(44 + i * 2) / 32768;
  const window = Math.round(rate * .12), coarseStep = Math.round(rate * .001);
  const minimum = settings.loopMinSeconds * rate, maximum = settings.loopMaxSeconds * rate;
  const score = (lag: number) => {
    let dot = 0, a = 0, b = 0;
    for (let frame = 0; frame < window; frame++) for (let channel = 0; channel < 2; channel++) {
      const x = data[(start + frame) * 2 + channel], y = data[(start + lag + frame) * 2 + channel];
      dot += x * y; a += x * x; b += y * y;
    }
    return a && b ? dot / Math.sqrt(a * b) : -1;
  };
  let frames = minimum, correlation = -1;
  for (let lag = minimum; lag <= maximum; lag += coarseStep) {
    const value = score(lag);
    if (value > correlation) { frames = lag; correlation = value; }
  }
  const coarse = frames;
  for (let lag = Math.max(minimum, coarse - coarseStep); lag <= Math.min(maximum, coarse + coarseStep); lag++) {
    const value = score(lag);
    if (value > correlation) { frames = lag; correlation = value; }
  }
  const pcm = Buffer.alloc(frames * 2 * 4), fade = settings.crossfadeSeconds * rate;
  for (let frame = 0; frame < frames; frame++) {
    const blend = frame < fade ? Math.sin(frame / fade * Math.PI / 2) ** 2 : 1;
    for (let channel = 0; channel < 2; channel++) {
      const head = data[(start + frame) * 2 + channel];
      const tail = frame < fade ? data[(start + frames + frame) * 2 + channel] : 0;
      pcm.writeFloatLE(head * blend + tail * (1 - blend), (frame * 2 + channel) * 4);
    }
  }
  return { pcm, frames, correlation };
}

export function prepareIcePalette(renders: string) {
  const sounds = ICE_PALETTE_IDS.map(id => {
    const raw = readFileSync(join(renders, `${id}.wav`));
    const evidence = JSON.parse(readFileSync(join(renders, `${id}.render.json`), 'utf8'));
    const pattern = readFileSync(join(output, `${id}.strudel.js`));
    assert.equal(evidence.rawSha256, hash(raw)); assert.equal(evidence.patternSha256, hash(pattern));
    const { pcm, frames, correlation } = makeIceLoop(raw);
    const gainDb = settings.targetLufs - measure(pcm).lufs;
    for (let i = 0; i < pcm.length; i += 4) pcm.writeFloatLE(pcm.readFloatLE(i) * 10 ** (gainDb / 20), i);
    const master = wave(pcm), quantized = Buffer.alloc(pcm.length);
    for (let i = 0; i < master.length - 44; i += 2) quantized.writeFloatLE(master.readInt16LE(44 + i) / 32768, i * 2);
    const measured = measure(quantized);
    assert.ok(Math.abs(measured.lufs - settings.targetLufs) < .6 && measured.truePeakDb < -14, `${id}: unsafe or unmatched master`);
    writeFileSync(join(output, `${id}.wav`), master);
    writeFileSync(join(output, `${id}.render.json`), JSON.stringify(evidence, null, 2) + '\n');
    console.log(`${id}: ${(frames / settings.sampleRate).toFixed(3)}s, ${measured.lufs} LUFS, ${measured.truePeakDb} dBTP, correlation ${correlation.toFixed(4)}`);
    return { id, ...ICE_PALETTE[id], frames, ...measured, correlation, gainDb, license: 'CC0-1.0',
      sha256: hash(master), rawSha256: hash(raw), patternSha256: hash(pattern) };
  });
  writeFileSync(join(output, 'manifest.json'), JSON.stringify({
    engine: '@strudel/web@1.3.0', sampleRate: settings.sampleRate,
    process: 'Steady-state phase-matched loop with one-second cosine overlap; static EBU R128 mastering. No envelope retrigger at the join.',
    sounds,
  }, null, 2) + '\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.equal(process.argv.length, 3, 'Usage: node scripts/prepare-ice-palette.ts /path/to/retained/strudel-renders');
  prepareIcePalette(resolve(process.argv[2]));
}
