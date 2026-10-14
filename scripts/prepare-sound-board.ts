import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOUND_BOARD as settings, SOUND_BOARD_ROLES, SOUND_BOARD_TIMBRE as timbre, type BoardSound } from '../data/sound-board.ts';
import { APPROVED_BOARD_SOUNDS, SOUNDS, SOUND_MIX, type SoundId } from '../data/sounds.ts';
import { ICE_PALETTE, ICE_PALETTE_AUDIO, ICE_PALETTE_IDS } from '../data/ice-palette.ts';
import { measure, wave } from './prepare-ice-candidates.ts';

const audioRoot = fileURLToPath(new URL('../public/audio/', import.meta.url));
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const tau = 2 * Math.PI;
const ease = (value: number) => value * value * (3 - 2 * value);

export function renderBoardSound(sound: BoardSound): Float32Array {
  const samples = new Float32Array(Math.round(sound.seconds * settings.sampleRate));
  let seed = [...sound.id].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 9401);
  let low = 0, smooth = 0, phase = 0, grain = 1, grainTarget = 1;
  const coefficient = 1 - Math.exp(-tau * sound.cutoff / settings.sampleRate);
  const grainFrames = Math.round(timbre.grainSeconds * settings.sampleRate);
  const notes = sound.notes.map(note => ({ ...note, first: Math.round(note.at * settings.sampleRate),
    last: Math.round((note.at + note.seconds) * settings.sampleRate) }));
  for (let i = 0; i < samples.length; i++) {
    const t = i / settings.sampleRate, progress = i / (samples.length - 1);
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    low += coefficient * ((seed >>> 0) / 0x80000000 - 1 - low);
    smooth += coefficient * (low - smooth);
    phase += tau * (1 + (sound.pitchEnd - 1) * progress) / settings.sampleRate;
    let sample = smooth * sound.noise * 2;
    if (sound.texture === 'grain') {
      if (i % grainFrames === 0) grainTarget = timbre.grainFloor + (1 - timbre.grainFloor) * (seed >>> 0) / 0xffffffff;
      grain += (grainTarget - grain) * timbre.grainSmoothing;
      sample *= grain;
    }
    sound.tones.forEach((frequency, index) => {
      const angle = phase * frequency;
      let tone = sound.texture === 'rubber'
        ? Math.sin(angle + timbre.rubberDepth * Math.sin(angle * timbre.rubberRatio) * Math.exp(-t * timbre.rubberDecay))
        : Math.sin(angle);
      if (sound.texture === 'wood') tone *= Math.exp(-t * index * timbre.woodPartialDecay);
      sample += tone / (index + 1);
    });
    if (sound.pulses.length) sample *= sound.pulses.reduce((sum, at) =>
      sum + Math.exp(-(((t - at) / timbre.pulseWidth) ** 2)), 0);
    for (const note of notes) {
      if (i < note.first || i >= note.last) continue;
      const age = (i - note.first) / settings.sampleRate;
      const envelope = ease(Math.min(1, age / timbre.noteAttack))
        * ease(Math.min(1, (note.seconds - age) / timbre.noteRelease)) * Math.exp(-age * timbre.noteDecay);
      let voice = 0;
      for (const frequency of note.frequencies) timbre[sound.jingleTimbre].forEach((weight, harmonic) => {
        voice += weight * Math.sin(tau * frequency * (harmonic + 1) * age);
      });
      sample += voice * envelope * note.gain / Math.sqrt(note.frequencies.length);
    }
    const attack = Math.min(1, t / sound.attack);
    const release = Math.min(1, (samples.length - 1 - i) / settings.sampleRate / .035);
    const envelope = attack * attack * (3 - 2 * attack) * release * release * (3 - 2 * release);
    samples[i] = sample * envelope * (sound.rising ? .05 + .95 * progress ** 1.4 : Math.exp(-t * sound.decay));
  }
  samples[0] = 0; samples[samples.length - 1] = 0;
  return samples;
}

function stereo(samples: Float32Array): Buffer {
  const pcm = Buffer.alloc(samples.length * 8);
  samples.forEach((value, frame) => {
    pcm.writeFloatLE(value, frame * 8); pcm.writeFloatLE(value, frame * 8 + 4);
  });
  return pcm;
}

function eventTrain(pcm: Buffer, gain: number, interval: number): Buffer {
  const stride = Math.round(interval * settings.sampleRate);
  const train = Buffer.alloc(stride * 8 * settings.measurementCount);
  const frames = pcm.length / 8, seconds = frames / settings.sampleRate;
  assert.ok(frames <= stride, 'Measurement interval must include the complete sound');
  const attack = Math.min(SOUND_MIX.attack, seconds / 4), release = Math.min(SOUND_MIX.release, seconds / 3);
  for (let repeat = 0; repeat < settings.measurementCount; repeat++) for (let i = 0; i < frames; i++) {
    const time = i / settings.sampleRate;
    const envelope = Math.min(1, time / attack, (seconds - time) / release);
    for (let channel = 0; channel < 2; channel++) {
      const value = pcm.readFloatLE(i * 8 + channel * 4) * gain * envelope;
      train.writeFloatLE(value, (repeat * stride + i) * 8 + channel * 4);
    }
  }
  return train;
}

function reference(sample: string, gain: number, attack: number = SOUND_MIX.attack, release: number = SOUND_MIX.release) {
  const bytes = readFileSync(resolve(audioRoot, `${sample}.wav`));
  return { file: `../${sample}.wav`, seconds: (bytes.length - 44) / bytes.readUInt32LE(28),
    gain, attack, release, sha256: hash(bytes), license: 'CC0-1.0' };
}

function gameReference(id: SoundId) {
  const cue = SOUNDS[id];
  return { ...reference(cue.sample, cue.gain * SOUND_MIX.masterGain),
    id: `${id}-current`, label: `Current ${cue.label.toLowerCase()}`, description: cue.description,
    kind: 'current', repeat: true, provenance: 'Existing gameplay sound; see ../physical-v2/LICENSE.txt.' };
}

export function prepareSoundBoard(output: string) {
  mkdirSync(output, { recursive: true });
  const groups = SOUND_BOARD_ROLES.map(role => ({ id: role.id, label: role.label, description: role.description,
    authoringReference: { ...reference(`physical-v2/${role.id}/sound`, role.referenceGain),
      measurementInterval: Math.max(settings.measurementInterval, ...role.options.map(sound => sound.seconds + settings.measurementGap)) } }));
  const entries = SOUND_BOARD_ROLES.flatMap((role, index) => {
    const authoring = groups[index].authoringReference, interval = authoring.measurementInterval;
    const decoded = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i',
      resolve(audioRoot, 'sound-board', authoring.file), '-ar', String(settings.sampleRate), '-ac', '2', '-f', 'f32le', 'pipe:1'],
    { maxBuffer: 4 * 1024 * 1024 });
    if (decoded.error) throw decoded.error;
    if (decoded.status !== 0) throw new Error(`Cannot decode ${role.id}: ${decoded.stderr}`);
    const target = measure(eventTrain(decoded.stdout, authoring.gain, interval)).lufs;
    const alternatives = role.options.map(sound => {
      const raw = stereo(renderBoardSound(sound));
      let gainDb = target - measure(eventTrain(raw, 1, interval)).lufs;
      for (let pass = 0; pass < 4; pass++) {
        const pcm = Buffer.alloc(raw.length), gain = 10 ** (gainDb / 20);
        for (let i = 0; i < pcm.length; i += 4) pcm.writeFloatLE(raw.readFloatLE(i) * gain, i);
        const wav = wave(pcm), quantized = Buffer.alloc(pcm.length);
        let peak = 0;
        for (let i = 0; i < pcm.length; i += 4) {
          const value = wav.readInt16LE(44 + i / 2) / 32768;
          quantized.writeFloatLE(value, i); peak = Math.max(peak, Math.abs(value));
        }
        const measured = measure(eventTrain(quantized, 1, interval));
        if (Math.abs(measured.lufs - target) <= settings.loudnessTolerance) {
          assert.ok(peak < settings.maximumPeak, `${sound.id}: unsafe peak ${peak}`);
          const file = `${sound.id}.wav`;
          writeFileSync(resolve(output, file), wav);
          console.log(`${sound.id}: ${measured.lufs} event LUFS (reference ${target}), peak ${peak.toFixed(4)}`);
          return { id: sound.id, label: sound.label, description: sound.description, seconds: sound.seconds,
            role: role.id, kind: 'alternative', repeat: true, interval: role.interval, file, gain: 1,
            attack: SOUND_MIX.attack, release: SOUND_MIX.release, sha256: hash(wav), license: 'CC0-1.0',
            provenance: 'Original Boundstoy seeded offline synthesis; no recordings, samples or external instruments.',
            eventLufs: measured.lufs, targetEventLufs: target, truePeakDb: measured.truePeakDb, gainDb };
        }
        gainDb += target - measured.lufs;
      }
      throw new Error(`${sound.id}: loudness matching did not converge`);
    });
    const selection = role.id === 'death' || role.id === 'ui' ? APPROVED_BOARD_SOUNDS[role.id] : undefined;
    const approved = alternatives.find(entry => entry.id === selection);
    assert.ok(!selection || approved, `${role.id}: approved sound must exist in the authored bank`);
    const current = approved ? { ...approved, id: `${role.id}-current`, kind: 'current', approved: true }
      : { ...gameReference(role.id), role: role.id, interval: role.interval, eventLufs: target };
    return [current, ...alternatives.filter(entry => entry.id !== selection)];
  });
  const ice = [
    ...(['soft', 'hard'] as const).map(id => ({ ...gameReference(id), id: `ice-${id}-current`, role: 'ice', interval: .25 })),
    ...ICE_PALETTE_IDS.map(id => ({ ...reference(ICE_PALETTE[id].sample, ICE_PALETTE_AUDIO.gain * SOUND_MIX.masterGain,
      ICE_PALETTE_AUDIO.attack, ICE_PALETTE_AUDIO.release),
    id: `ice-${id}`, label: ICE_PALETTE[id].label, description: `${ICE_PALETTE[id].family}: ${ICE_PALETTE[id].description}`,
    role: 'ice', kind: 'ice-option', repeat: false,
    provenance: 'Existing original CC0 Strudel export; see ../ice-palette/manifest.json and LICENSE.txt.' })),
  ];
  writeFileSync(resolve(output, 'manifest.json'), JSON.stringify({
    selected: APPROVED_BOARD_SOUNDS, sampleRate: settings.sampleRate, repeatCount: settings.repeatCount,
    measurement: 'Six events per role, with the interval recorded in its authoring reference (at least 1.2 seconds). Fixed original physical-palette gain and gameplay fades; never normalize against a previously generated candidate. Alternatives match their role reference, not other roles. Ice previews retain existing source levels.',
    sourceSha256: hash(readFileSync(fileURLToPath(import.meta.url))),
    registrySha256: hash(readFileSync(new URL('../data/sound-board.ts', import.meta.url))),
    groups: [...groups,
      { id: 'ice', label: 'Ice', description: 'Current movement cues and twelve existing musical directions. One finite source preview with fades; in-game movement filters may differ.' }],
    entries: [...entries, ...ice], approvedExplosion: reference(SOUNDS.blast.sample, SOUNDS.blast.gain * SOUND_MIX.masterGain),
  }, null, 2) + '\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  prepareSoundBoard(resolve(process.argv[2] ?? 'public/audio/sound-board'));
}
