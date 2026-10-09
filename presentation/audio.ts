export const MAX_AUDIO_VOICES = 8;
const MAX_MASTER_GAIN = 0.5;

export class Audio {
  private context?: AudioContext;
  private master?: GainNode;
  private enabled = false;
  private volume = 0.5;
  private voices = new Map<OscillatorNode, GainNode>();

  setVolume(volume: number) {
    if (!Number.isFinite(volume) || volume < 0 || volume > 1) throw new Error('Sound volume must be between 0 and 1.');
    this.volume = volume;
    if (this.master && this.context) this.master.gain.setTargetAtTime(volume * MAX_MASTER_GAIN, this.context.currentTime, 0.02);
  }

  async setEnabled(enabled: boolean): Promise<void> {
    if (!enabled) {
      this.enabled = false;
      this.stopVoices();
      await this.context?.suspend();
      return;
    }
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.setValueAtTime(this.volume * MAX_MASTER_GAIN, this.context.currentTime);
      this.master.connect(this.context.destination);
    }
    await this.context.resume();
    this.enabled = true;
  }

  play(event: 'death' | 'checkpoint' | 'win' | 'blast') {
    if (!this.enabled || !this.context || !this.master || this.context.state !== 'running' || this.volume === 0) return;
    const notes = event === 'blast' ? [95] : event === 'death' ? [150, 65] : event === 'win' ? [392, 494, 587, 784] : [523, 784];
    if (this.voices.size + notes.length > MAX_AUDIO_VOICES) {
      if (event === 'blast') return;
      this.stopVoices();
    }
    notes.forEach((frequency, index) => {
      const context = this.context!;
      const oscillator = context.createOscillator(), gain = context.createGain();
      const start = context.currentTime + index * 0.09;
      oscillator.type = event === 'death' || event === 'blast' ? 'triangle' : 'sine';
      oscillator.frequency.setValueAtTime(frequency, start);
      oscillator.frequency.exponentialRampToValueAtTime(event === 'blast' ? 28 : frequency * 0.85, start + 0.2);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.07, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
      oscillator.connect(gain).connect(this.master!);
      this.voices.set(oscillator, gain);
      oscillator.onended = () => {
        oscillator.disconnect(); gain.disconnect(); this.voices.delete(oscillator);
      };
      oscillator.start(start); oscillator.stop(start + 0.26);
    });
  }

  private stopVoices() {
    for (const [oscillator, gain] of this.voices) {
      oscillator.onended = null;
      oscillator.stop(); oscillator.disconnect(); gain.disconnect();
    }
    this.voices.clear();
  }

  dispose() {
    this.enabled = false; this.stopVoices(); this.master?.disconnect();
    void this.context?.close().catch(error => console.error('[Boundstoy] Could not close sound', error));
  }
}
