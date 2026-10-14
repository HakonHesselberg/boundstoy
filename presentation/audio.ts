import type { Level, Point } from '../core/level.ts';
import { DT, hazardEnabled, hazardSample, hazardTick, terrainAt, type State } from '../core/simulation.ts';
import { checkpointPuzzles } from '../core/world.ts';
import { SOUNDS, SOUND_MIX, SOUND_SAMPLES, type SoundId } from '../data/sounds.ts';
import { selectWorldView } from './world-camera.ts';
import { ICE_AUDIO, ICE_SAMPLES, type IceSurface, type IceVariant } from '../data/ice-audio.ts';
import { ICE_PALETTE, ICE_PALETTE_AUDIO, isIceSound, type IceSoundId } from '../data/ice-palette.ts';
import { createAudioOutput } from '../public/audio/output.js';

export const MAX_AUDIO_VOICES = SOUND_MIX.maxVoices;
export const AUDIO_SAMPLES = Object.freeze([...SOUND_SAMPLES, ...Object.values(ICE_SAMPLES)]);
type Voice = { gain: GainNode; priority: number };
type GlideVoice = { gain: GainNode; filter?: BiquadFilterNode };
export type GlideVariant = IceVariant | IceSoundId;
type Glide = { surface: IceSurface; variant: GlideVariant; sources: AudioBufferSourceNode[]; until?: number };
const glideTiming = (variant: GlideVariant) => isIceSound(variant) ? ICE_PALETTE_AUDIO : ICE_AUDIO;

export class Audio {
  private context?: AudioContext;
  private master?: GainNode;
  private output?: ReturnType<typeof createAudioOutput>;
  private enabled = false;
  private volume = 0.5;
  private voices = new Map<AudioBufferSourceNode, Voice>();
  private buffers = new Map<string, AudioBuffer>();
  private lastPlayed = new Map<SoundId, number>();
  private loading?: Promise<void>;
  private baseLoaded = false;
  private paletteLoading = new Map<IceSoundId, Promise<void>>();
  private generation = 0;
  private disposed = false;
  private abort = new AbortController();
  private glide?: Glide;
  private glideVoices = new Map<AudioBufferSourceNode, GlideVoice>();

  private baseUrl: string;
  constructor(baseUrl = '/') { this.baseUrl = baseUrl; }

  setVolume(volume: number) {
    if (!Number.isFinite(volume) || volume < 0 || volume > 1) throw new Error('Sound volume must be between 0 and 1.');
    this.volume = volume;
    if (volume === 0) this.stop();
    if (this.output && this.context) this.output.volume.gain.setTargetAtTime(volume, this.context.currentTime, 0.02);
  }

  async setEnabled(enabled: boolean, variant?: GlideVariant): Promise<void> {
    if (this.disposed) throw new Error('Sound has been disposed.');
    const generation = ++this.generation;
    if (!enabled) {
      this.enabled = false;
      this.stop();
      await this.context?.suspend();
      return;
    }
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.setValueAtTime(SOUND_MIX.masterGain, this.context.currentTime);
      this.output = createAudioOutput(this.context);
      this.output.volume.gain.setValueAtTime(this.volume, this.context.currentTime);
      this.master.connect(this.output.input);
    }
    // Resume synchronously inside the user gesture, before fetching/decoding.
    const resume = this.context.resume();
    if (!this.baseLoaded && !this.loading) {
      const context = this.context;
      this.loading = Promise.all(AUDIO_SAMPLES.map(async name => {
        const response = await fetch(`${this.baseUrl}audio/${name}.wav`, { signal: this.abort.signal });
        if (!response.ok) throw new Error(`Could not load ${name} sound (${response.status}).`);
        const buffer = await context.decodeAudioData(await response.arrayBuffer());
        return [name, buffer] as const;
      })).then(entries => {
        if (!this.disposed) {
          for (const [name, buffer] of entries) this.buffers.set(name, buffer);
          this.baseLoaded = true;
        }
      })
        .finally(() => { this.loading = undefined; });
    }
    try {
      await Promise.all([resume, this.loading, variant && isIceSound(variant) ? this.loadPalette(variant) : undefined]);
      if (generation === this.generation && !this.disposed) this.enabled = true;
    } catch (error) {
      if (generation === this.generation) {
        this.enabled = false; this.stop();
      }
      throw error;
    }
  }

  private loadPalette(id: IceSoundId): Promise<void> {
    const name = ICE_PALETTE[id].sample;
    if (this.buffers.has(name)) return Promise.resolve();
    const pending = this.paletteLoading.get(id);
    if (pending) return pending;
    const context = this.context!;
    const loading = (async () => {
      const response = await fetch(`${this.baseUrl}audio/${name}.wav`, { signal: this.abort.signal });
      if (!response.ok) throw new Error(`Could not load ${ICE_PALETTE[id].label} (${response.status}).`);
      const buffer = await context.decodeAudioData(await response.arrayBuffer());
      if (!this.disposed) this.buffers.set(name, buffer);
    })().finally(() => this.paletteLoading.delete(id));
    this.paletteLoading.set(id, loading);
    return loading;
  }

  isGlideReady(variant: GlideVariant) {
    return isIceSound(variant) ? this.buffers.has(ICE_PALETTE[variant].sample) : this.baseLoaded;
  }

  play(event: SoundId) {
    if (!this.enabled || !this.context || !this.master || this.context.state !== 'running' || this.volume === 0) return;
    const definition = SOUNDS[event], now = this.context.currentTime;
    if (now - (this.lastPlayed.get(event) ?? -Infinity) < definition.cooldown) return;
    const buffer = this.buffers.get(definition.sample);
    if (!buffer) throw new Error(`Sound ${definition.sample} was not loaded.`);
    while (this.voices.size + this.glideVoices.size + definition.rates.length > MAX_AUDIO_VOICES) {
      const victim = [...this.voices].find(([, voice]) => voice.priority < definition.priority);
      if (!victim) return;
      this.stopVoice(...victim);
    }
    this.lastPlayed.set(event, now);
    definition.rates.forEach((rate, index) => {
      const context = this.context!;
      const source = context.createBufferSource(), gain = context.createGain();
      const start = now + index * definition.spacing, duration = buffer.duration / rate;
      const attack = Math.min(SOUND_MIX.attack, duration / 4);
      const release = Math.min(SOUND_MIX.release, duration / 3);
      source.buffer = buffer; source.playbackRate.setValueAtTime(rate, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(definition.gain, start + attack);
      gain.gain.setValueAtTime(definition.gain, start + duration - release);
      gain.gain.linearRampToValueAtTime(0, start + duration);
      source.connect(gain).connect(this.master!);
      this.voices.set(source, { gain, priority: definition.priority });
      source.onended = () => {
        source.disconnect(); gain.disconnect(); this.voices.delete(source);
      };
      source.start(start); source.stop(start + duration);
    });
  }

  updateGlide(surface: IceSurface | null, variant: GlideVariant) {
    if (!surface) { this.releaseGlide(); return; }
    if (!this.enabled || !this.context || !this.master || this.context.state !== 'running' || this.volume === 0) return;
    let until: number | undefined;
    if (this.glide && this.glide.variant !== variant && (isIceSound(this.glide.variant) || isIceSound(variant))) {
      until = this.glide.until;
      if (until !== undefined && this.context.currentTime >= until - glideTiming(this.glide.variant).release) return;
      this.releaseGlide();
    }
    if (!this.glide) {
      const palette = isIceSound(variant) ? ICE_PALETTE[variant] : undefined;
      const needed = palette ? 1 : 2;
      while (this.voices.size + this.glideVoices.size + needed > MAX_AUDIO_VOICES) {
        const retired = this.glideVoices.entries().next().value;
        if (!retired) return;
        this.stopGlideVoice(...retired);
      }
      const create = (name: 'wind' | 'pad') => {
        const source = this.context!.createBufferSource(), gain = this.context!.createGain();
        const buffer = this.buffers.get(ICE_SAMPLES[name]);
        if (!buffer) throw new Error(`Sound ${ICE_SAMPLES[name]} was not loaded.`);
        source.buffer = buffer; source.loop = true;
        gain.gain.setValueAtTime(0, this.context!.currentTime);
        const filter = name === 'wind' ? this.context!.createBiquadFilter() : undefined;
        if (filter) {
          filter.type = 'lowpass'; filter.Q.setValueAtTime(ICE_AUDIO.windQ, this.context!.currentTime);
          filter.frequency.setValueAtTime(ICE_AUDIO[surface].cutoff, this.context!.currentTime);
          source.connect(filter).connect(gain);
        } else source.connect(gain);
        gain.connect(this.master!);
        this.glideVoices.set(source, { gain, filter });
        source.onended = () => {
          source.disconnect(); gain.disconnect(); filter?.disconnect(); this.glideVoices.delete(source);
          if (this.glide?.sources.includes(source)) this.glide = undefined;
        };
        source.start();
        return source;
      };
      if (palette) {
        const buffer = this.buffers.get(palette.sample);
        if (!buffer) throw new Error(`Sound ${palette.sample} was not loaded.`);
        const source = this.context.createBufferSource(), gain = this.context.createGain(), filter = this.context.createBiquadFilter();
        source.buffer = buffer; source.loop = true;
        gain.gain.setValueAtTime(0, this.context.currentTime);
        filter.type = 'lowpass'; filter.Q.setValueAtTime(ICE_PALETTE_AUDIO.filterQ, this.context.currentTime);
        filter.frequency.setValueAtTime(surface === 'soft' ? ICE_PALETTE_AUDIO.softCutoff : ICE_PALETTE_AUDIO.hardCutoff, this.context.currentTime);
        source.connect(filter).connect(gain).connect(this.master);
        this.glideVoices.set(source, { gain, filter });
        source.onended = () => {
          source.disconnect(); gain.disconnect(); filter.disconnect(); this.glideVoices.delete(source);
          if (this.glide?.sources.includes(source)) this.glide = undefined;
        };
        this.glide = { surface, variant, sources: [source], until };
        source.start();
      } else this.glide = { surface, variant, sources: [create('wind'), create('pad')], until };
      this.applyGlide();
      if (until !== undefined) for (const source of this.glide.sources) source.stop(until);
    } else if (this.glide.surface !== surface || this.glide.variant !== variant) {
      const surfaceChanged = this.glide.surface !== surface;
      this.glide.surface = surface; this.glide.variant = variant;
      this.applyGlide(surfaceChanged);
    }
  }

  auditionGlide(surface: IceSurface, variant: GlideVariant) {
    this.stop();
    this.updateGlide(surface, variant);
    if (!this.glide || !this.context) return;
    this.glide.until = this.context.currentTime + glideTiming(variant).previewSeconds;
    this.applyGlide();
    for (const source of this.glide.sources) source.stop(this.glide.until);
  }

  private applyGlide(updateWind = true) {
    if (!this.glide || !this.context) return;
    const { surface, variant, sources, until } = this.glide, now = this.context.currentTime;
    const [wind, pad] = sources, timing = glideTiming(variant), palette = isIceSound(variant);
    if (until !== undefined && now >= until - timing.release) return;
    const mix = ICE_AUDIO[surface];
    const targets: [AudioBufferSourceNode, number][] = palette
      ? [[sources[0], ICE_PALETTE_AUDIO.gain]]
      : [[wind, mix.windGain], [pad, variant === 'pad' ? mix.padGain : 0]];
    for (const [source, target] of targets) {
      if (!palette && source === wind && !updateWind) continue;
      const voice = this.glideVoices.get(source)!;
      const rampEnd = until === undefined ? now + timing.attack : Math.min(now + timing.attack, Math.max(now, until - timing.release));
      voice.gain.gain.cancelAndHoldAtTime(now);
      voice.gain.gain.linearRampToValueAtTime(target, rampEnd);
      if (until !== undefined) {
        voice.gain.gain.setValueAtTime(target, Math.max(rampEnd, until - timing.release));
        voice.gain.gain.linearRampToValueAtTime(0, until);
      }
      const cutoff = palette ? surface === 'soft' ? ICE_PALETTE_AUDIO.softCutoff : ICE_PALETTE_AUDIO.hardCutoff : mix.cutoff;
      voice.filter?.frequency.setTargetAtTime(cutoff, now, palette ? ICE_PALETTE_AUDIO.filterTime : ICE_AUDIO.filterTime);
    }
  }

  private releaseGlide() {
    if (!this.glide || !this.context) return;
    const now = this.context.currentTime;
    const release = glideTiming(this.glide.variant).release;
    for (const source of this.glide.sources) {
      const voice = this.glideVoices.get(source)!;
      voice.gain.gain.cancelAndHoldAtTime(now);
      voice.gain.gain.linearRampToValueAtTime(0, now + release);
      source.stop(now + release);
    }
    this.glide = undefined;
  }

  private stopGlideVoice(source: AudioBufferSourceNode, voice: GlideVoice) {
    source.onended = null; source.stop(); source.disconnect(); voice.gain.disconnect(); voice.filter?.disconnect();
    this.glideVoices.delete(source);
  }

  private stopVoice(source: AudioBufferSourceNode, voice: Voice) {
    source.onended = null; source.stop(); source.disconnect(); voice.gain.disconnect();
    this.voices.delete(source);
  }

  stop() {
    for (const entry of this.voices) this.stopVoice(...entry);
    for (const entry of this.glideVoices) this.stopGlideVoice(...entry);
    this.glideVoices.clear(); this.glide = undefined;
    this.lastPlayed.clear();
  }

  inspect() {
    return { enabled: this.enabled, loaded: this.buffers.size, voices: this.voices.size + this.glideVoices.size,
      loops: this.glideVoices.size, glide: this.glide ? { surface: this.glide.surface, variant: this.glide.variant } : null,
      volume: this.volume, state: this.context?.state ?? 'uncreated' };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.generation++; this.abort.abort();
    this.enabled = false; this.stop(); this.buffers.clear(); this.master?.disconnect();
    this.output?.dispose();
    void this.context?.close().catch(error => console.error('[Boundstoy] Could not close sound', error));
  }
}

export function iceMotion(level: Level, before: State, after: State): IceSurface | null {
  if (after.tick !== before.tick + 1 || after.won || before.respawnTicks > 0 || after.respawnTicks > 0 || after.event === 'death') return null;
  if (Math.hypot(after.position.x - before.position.x, after.position.y - before.position.y) <= SOUND_MIX.movementThreshold
    || Math.hypot(after.velocity.x, after.velocity.y) === 0) return null;
  const terrain = terrainAt(level, after.position).id;
  return terrain === 'soft' || terrain === 'hard' ? terrain : null;
}

export function soundEvents(level: Level, before: State, after: State): SoundId[] {
  if (after.tick !== before.tick + 1 || before.won) return [];
  if (after.event !== 'none') return [after.event];
  if (before.respawnTicks > 0) return [];
  const events: SoundId[] = [];
  if (after.patternOffset === before.patternOffset) {
    if (localPulse(level, after.position, hazardTick(before), hazardTick(after), after, 'warning')) events.push('warning');
    if (localBlast(level, after.position, hazardTick(before), hazardTick(after), after)) events.push('blast');
  }
  const moved = Math.hypot(after.position.x - before.position.x, after.position.y - before.position.y) > SOUND_MIX.movementThreshold;
  const ground = terrainAt(level, after.position).id;
  const previousGround = terrainAt(level, before.position);
  const turn = Math.abs(Math.atan2(before.velocity.x * after.velocity.y - before.velocity.y * after.velocity.x,
    before.velocity.x * after.velocity.x + before.velocity.y * after.velocity.y));
  const impact = previousGround.id === 'soft' && turn > previousGround.turnRate * DT + 1e-8
    || previousGround.id === 'hard' && Math.hypot(before.velocity.x, before.velocity.y) > 0
      && Math.hypot(after.velocity.x, after.velocity.y) === 0;
  if (impact) events.push('bump');
  if (moved) {
    const cue = ground === 'soft' ? 'soft' : ground === 'hard' ? 'hard' : ground === 'mud' ? 'mud' : 'step';
    const interval = cue === 'mud' ? SOUND_MIX.mudTicks : cue === 'step' ? SOUND_MIX.stepTicks : SOUND_MIX.glideTicks;
    if (after.tick % interval === 0) events.push(cue);
  }
  return events;
}
/** Follow the same position-based view as rendering, including safe connectors
 * and backtracking. Checkpoint worlds require actual progression context. */
export function localBlast(level: Level, position: Point, previousTick: number, tick: number, state?: State): boolean {
  return localPulse(level, position, previousTick, tick, state, 'active');
}
function localPulse(level: Level, position: Point, previousTick: number, tick: number, state: State | undefined,
  phase: 'active' | 'warning'): boolean {
  if (checkpointPuzzles(level) && !state) throw new Error('localBlast requires state for checkpoint puzzleMode.');
  if (tick !== previousTick + 1) return false;
  const sections = level.version === 2 ? selectWorldView(level, position).sections : null;
  return level.hazards.some(hazard => hazard.kind === 'pulse'
    && (!state || hazardEnabled(level, hazard, state))
    && (!sections || level.version === 2 && sections.some(i => {
      const b = level.sections[i].bounds;
      return hazard.x >= b.x && hazard.x < b.x + b.width && hazard.y >= b.y && hazard.y < b.y + b.height;
    }))
    && !hazardSample(hazard, previousTick)[phase] && hazardSample(hazard, tick)[phase]);
}
