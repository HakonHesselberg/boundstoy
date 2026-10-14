import { createAudioOutput } from './output.js';

// Shared finite listening-room playback; never connected to game state or storage.
export class AuditionPlayer {
  constructor(status, playing) {
    this.status = status;
    this.playing = playing;
    this.buffers = new Map();
    this.sources = new Map();
    this.generation = 0;
    this.volume = .7;
    this.mono = false;
    this.started = null;
    window.addEventListener('blur', () => this.stop());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.stop(); });
    window.addEventListener('pagehide', () => {
      this.stop();
      const context = this.context;
      this.output?.dispose();
      this.context = undefined;
      if (context && context.state !== 'closed') {
        void context.close().catch(error => {
          console.error('Audio close failed', error);
          this.status(`Audio close failed: ${error.message}. Reload this page.`);
        });
      }
    });
  }

  stop(message = 'Stopped.') {
    this.generation++;
    this.loading?.abort();
    this.loading = undefined;
    for (const [source, gain] of this.sources) {
      source.onended = null;
      source.stop(); source.disconnect(); gain.disconnect();
    }
    this.sources.clear();
    this.started = null;
    this.playing(false);
    this.status(message);
  }

  setVolume(value) {
    if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error('Volume must be between zero and one.');
    this.volume = value;
    if (this.context && this.context.state !== 'closed') {
      this.master.gain.setTargetAtTime(value, this.context.currentTime, .015);
    }
    if (!value) this.stop('Muted.');
  }

  setMono(value) {
    this.mono = value;
    if (this.channels) this.channels.channelCount = value ? 1 : 2;
  }

  get elapsed() {
    return this.started === null || !this.context ? null : this.context.currentTime - this.started;
  }

  async load(file, signal) {
    if (this.buffers.has(file)) return;
    const response = await fetch(file, { signal });
    if (!response.ok) throw new Error(`Cannot load ${file}: HTTP ${response.status}`);
    const decoded = await this.context.decodeAudioData(await response.arrayBuffer());
    signal.throwIfAborted();
    this.buffers.set(file, decoded);
  }

  async play(events, label, delay = .04) {
    this.stop();
    if (!this.volume) { this.status('Volume is zero. Raise it before playing.'); return; }
    const ticket = this.generation, controller = new AbortController();
    this.loading = controller;
    try {
      if (!events.length || events.length > 8 || events.some(event =>
        !Number.isFinite(event.time) || event.time < 0 || !event.file)) {
        throw new Error('A preview must contain one to eight valid finite events.');
      }
      if (!this.context || this.context.state === 'closed') {
        this.context = new AudioContext();
        this.output = createAudioOutput(this.context);
        this.master = this.output.volume;
        this.channels = this.context.createGain();
        this.channels.channelCountMode = 'explicit';
        this.channels.connect(this.output.input);
      }
      const resumed = this.context.resume();
      this.master.gain.value = this.volume;
      this.channels.channelCount = this.mono ? 1 : 2;
      this.status(`Loading ${label}...`);
      await Promise.all([resumed, ...new Set(events.map(event => event.file))].map(value =>
        typeof value === 'string' ? this.load(value, controller.signal) : value));
      if (ticket !== this.generation) return;
      if (document.hidden) { this.stop(); return; }
      if (this.context.state !== 'running') throw new Error('Audio is suspended. Press Play again to resume.');
      this.loading = undefined;
      this.started = this.context.currentTime + delay;
      for (const event of events) {
        const decoded = this.buffers.get(event.file), source = this.context.createBufferSource(), gain = this.context.createGain();
        const start = this.started + event.time;
        source.buffer = decoded;
        if (event.attack) {
          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(event.gain ?? 1, start + Math.min(event.attack, decoded.duration / 4));
          gain.gain.setValueAtTime(event.gain ?? 1, start + decoded.duration - Math.min(event.release ?? 0, decoded.duration / 3));
          gain.gain.linearRampToValueAtTime(0, start + decoded.duration);
        } else gain.gain.value = event.gain ?? 1;
        source.connect(gain).connect(this.channels);
        source.onended = () => {
          source.disconnect(); gain.disconnect(); this.sources.delete(source);
          if (ticket === this.generation && !this.sources.size) {
            this.started = null; this.playing(false); this.status('Preview finished.');
          }
        };
        this.sources.set(source, gain);
        source.start(start); source.stop(start + decoded.duration);
      }
      this.playing(true);
      this.status(`Playing ${label}.`);
    } catch (error) {
      if (ticket === this.generation) this.stop(`Playback failed: ${error.message}. Press Play to retry.`);
    }
  }
}
