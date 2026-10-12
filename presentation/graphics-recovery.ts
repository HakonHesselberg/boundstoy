/** Presentation gate, independent of simulation and storage. */
export class GraphicsRecovery {
  status: 'ready' | 'lost' | 'restoring' | 'restored' | 'failed' = 'ready';
  private freeze: () => void;
  private onUnavailable: () => void;
  constructor(freeze: () => void, onUnavailable: () => void) {
    this.freeze = freeze; this.onUnavailable = onUnavailable;
  }
  get available() { return this.status === 'ready' || this.status === 'restored'; }
  get awaitingResume() { return this.status === 'restored'; }
  lose() {
    if (!this.available) return;
    this.status = 'lost';
    this.freeze();
    // BT-045 integration point: called once per loss, after clocks/input freeze.
    this.onUnavailable();
  }
  restore(redraw: () => void) {
    if (this.status !== 'lost') return;
    this.status = 'restoring';
    try {
      redraw();
      this.status = 'restored';
    } catch (error) {
      this.status = 'failed';
      throw error;
    }
  }
  resume() {
    if (!this.available) return false;
    this.status = 'ready';
    return true;
  }
}
