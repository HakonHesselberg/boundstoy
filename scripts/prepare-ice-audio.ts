import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ICE_AUDIO } from '../data/ice-audio.ts';
import { writeMaster } from './prepare-audio.ts';

export function renderIceLoop(id: 'wind' | 'pad'): Float32Array {
  const { sampleRate, loopSeconds, rootHz, intervals } = ICE_AUDIO;
  const result = new Float32Array(sampleRate * loopSeconds);
  if (id === 'wind') {
    const noise = new Float32Array(result.length);
    let seed = 0x1ce78, low = 0, rumble = 0;
    for (let i = 0; i < noise.length; i++) {
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
      noise[i] = (seed >>> 0) / 0x80000000 - 1;
    }
    // Warm the filters through one full cycle so their state is periodic too.
    for (let pass = 0; pass < 2; pass++) for (let i = 0; i < noise.length; i++) {
      low += 0.15 * (noise[i] - low);
      rumble += 0.008 * (noise[i] - rumble);
      const phase = 2 * Math.PI * i / result.length;
      result[i] = (low - rumble) * (0.96 + 0.03 * Math.cos(phase) + 0.01 * Math.sin(phase * 2));
    }
  } else {
    const weights = [0.56, 0.27, 0.17];
    for (let i = 0; i < result.length; i++) {
      const t = i / sampleRate;
      for (const [index, ratio] of intervals.entries()) {
        const phase = 2 * Math.PI * rootHz * ratio * t;
        // All partials complete integer cycles; slow detuning adds a gentle chorus.
        result[i] += weights[index] * (Math.sin(phase) + 0.06 * Math.sin(phase * 2)
          + 0.12 * Math.sin(phase + 2 * Math.PI * t / loopSeconds)
          + 0.12 * Math.sin(phase - 2 * Math.PI * t / loopSeconds));
      }
    }
  }
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  for (const id of ['wind', 'pad'] as const) writeMaster(resolve('public/audio/ice-study'), id, renderIceLoop(id));
