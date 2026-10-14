import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SAMPLE_RATE = 32000;
type DesignedSound = 'soft' | 'hard' | 'warning' | 'blast' | 'death' | 'checkpoint' | 'win';
const durations: Record<DesignedSound, number> = {
  soft: 0.42, hard: 0.36, warning: 0.225, blast: 0.42, death: 0.30, checkpoint: 0.32, win: 0.65,
};

/** Offline material synthesis: seeded friction, filtered pressure and short FM mechanisms. */
export function renderDesignedSound(id: DesignedSound): Float32Array {
  const duration = durations[id], result = new Float32Array(Math.round(duration * SAMPLE_RATE));
  let seed = [...id].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 0x51de);
  let low = 0, bass = 0, phase = 0;
  for (let i = 0; i < result.length; i++) {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    const white = (seed >>> 0) / 0x80000000 - 1, t = i / SAMPLE_RATE, progress = t / duration;
    low += 0.22 * (white - low);
    bass += 0.014 * (white - bass);
    const air = white - low;
    let sample = 0;
    switch (id) {
      case 'soft':
        sample = (low * 1.4 + air * 0.05) * (0.88 + 0.12 * Math.sin(t * 2 * Math.PI * 7));
        break;
      case 'hard':
        sample = (low * 0.65 + air * 0.22) * (0.9 + 0.1 * Math.sin(t * 2 * Math.PI * 19));
        break;
      case 'warning':
        phase += 2 * Math.PI * (420 + 1100 * progress ** 2) / SAMPLE_RATE;
        sample = (low * 0.8 + air * 0.2 + Math.sin(phase + 0.8 * Math.sin(phase * 1.31)) * 0.12)
          * progress ** 0.7;
        break;
      case 'blast':
        phase += 2 * Math.PI * (48 + 115 * Math.exp(-t * 32)) / SAMPLE_RATE;
        sample = white * 0.8 * Math.exp(-t * 65) + low * 1.5 * Math.exp(-t * 15)
          + (bass * 2.5 + Math.sin(phase) * 0.4) * Math.exp(-t * 17);
        break;
      case 'death':
        phase += 2 * Math.PI * (65 + 210 * Math.exp(-t * 14)) / SAMPLE_RATE;
        sample = (Math.sin(phase + 0.7 * Math.sin(phase * 1.47)) * 0.35 + low * 0.6)
          * Math.exp(-t * 13);
        break;
      case 'checkpoint':
        phase += 2 * Math.PI * (360 - 140 * Math.exp(-t * 45)) / SAMPLE_RATE;
        sample = low * 0.75 * Math.exp(-t * 70)
          + Math.sin(phase + 0.45 * Math.sin(phase * 2)) * 0.3 * Math.exp(-t * 15);
        break;
      case 'win':
        phase += 2 * Math.PI * (185 + 160 * (1 - Math.exp(-t * 8))) / SAMPLE_RATE;
        sample = (Math.sin(phase) * 0.3 + Math.sin(phase * 2) * 0.05 + low * 0.35)
          * (1 - Math.exp(-t * 40)) * Math.exp(-t * 5);
        break;
    }
    const attack = id === 'soft' || id === 'hard' ? 0.045 : id === 'blast' ? 0.0015 : 0.004;
    const release = id === 'warning' ? 0.006 : id === 'soft' || id === 'hard' ? 0.09 : 0.035;
    result[i] = sample * Math.min(1, t / attack) * Math.min(1, (duration - t) / release);
  }
  return result;
}

export function writeMaster(output: string, id: string, samples: Float32Array) {
  let peak = 0, energy = 0;
  for (const value of samples) {
    if (!Number.isFinite(value)) throw new Error(`${id} contains non-finite PCM.`);
    peak = Math.max(peak, Math.abs(value)); energy += value * value;
  }
  if (peak === 0) throw new Error(`${id} is silent.`);
  const pcm = Buffer.alloc(samples.length * 2), gain = 10 ** (-3 / 20) / peak;
  for (let i = 0; i < samples.length; i++) pcm.writeInt16LE(Math.round(samples[i] * gain * 32767), i * 2);
  const header = Buffer.alloc(44);
  header.write('RIFF'); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24); header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
  mkdirSync(resolve(output, id), { recursive: true });
  writeFileSync(resolve(output, id, 'sound.wav'), Buffer.concat([header, pcm]));
  console.log(`${id}: ${(samples.length / SAMPLE_RATE).toFixed(3)}s; peak -3 dBFS; RMS ${(20 * Math.log10(Math.sqrt(energy / samples.length) * gain)).toFixed(1)} dBFS`);
}

export function prepareAudio(footsteps: string, foley: string) {
  const output = resolve('public/audio/physical-v2');
  const recordings = [
    ['step', footsteps, 'Fantozzi-footsteps/flac/Fantozzi-StoneL1.flac', 0.26, 100, 7000],
    ['mud', footsteps, 'Fantozzi-footsteps/flac/Fantozzi-SandL2.flac', 0.32, 100, 5500],
    ['bump', foley, 'hit_01.ogg', 0.20, 70, 6500],
    ['ui', foley, 'switch_01.ogg', 0.12, 250, 7000],
  ] as const;
  for (const [id, archive, source, duration, highpass, lowpass] of recordings) {
    const audio = execFileSync('bsdtar', ['-xOf', resolve(archive), source]);
    const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', 'pipe:0', '-ac', '1', '-ar', String(SAMPLE_RATE),
      '-af', `highpass=f=${highpass},lowpass=f=${lowpass},acompressor=threshold=0.18:ratio=3:attack=0.5:release=45,apad,atrim=duration=${duration},afade=t=in:d=0.002,afade=t=out:st=${duration - 0.025}:d=0.025`,
      '-f', 'f32le', 'pipe:1'], { input: audio });
    const samples = new Float32Array(raw.length / 4);
    for (let i = 0; i < samples.length; i++) samples[i] = raw.readFloatLE(i * 4);
    writeMaster(output, id, samples);
  }
  for (const id of Object.keys(durations) as DesignedSound[]) writeMaster(output, id, renderDesignedSound(id));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [footsteps, foley] = process.argv.slice(2);
  if (!footsteps || !foley) throw new Error('Provide Fantozzi-footsteps.7z and 100-CC0-SFX.zip paths.');
  prepareAudio(footsteps, foley);
}
