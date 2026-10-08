export class Audio {
  private context?: AudioContext;
  private enabled = false;

  async toggle(): Promise<boolean> {
    if (this.enabled) {
      this.enabled = false;
      await this.context?.suspend();
      return false;
    }
    this.context ??= new AudioContext();
    await this.context.resume();
    this.enabled = true;
    this.play('checkpoint');
    return true;
  }

  play(event: 'death' | 'checkpoint' | 'win' | 'blast') {
    if (!this.enabled || !this.context || this.context.state !== 'running') return;
    const notes = event === 'blast' ? [95] : event === 'death' ? [150, 65] : event === 'win' ? [392, 494, 587, 784] : [523, 784];
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
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start); oscillator.stop(start + 0.26);
    });
  }

  dispose() { void this.context?.close(); }
}
