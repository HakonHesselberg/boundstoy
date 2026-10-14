export const AUDIO_OUTPUT = Object.freeze({
  boostDb: 12, kneeStart: .7, ceiling: .85, curveSamples: 4097,
});

/** One output calibration for gameplay and standalone listening rooms. */
export function createAudioOutput(context) {
  const input = context.createGain(), ceiling = context.createWaveShaper(), volume = context.createGain();
  input.gain.setValueAtTime(10 ** (AUDIO_OUTPUT.boostDb / 20), context.currentTime);
  const curve = new Float32Array(AUDIO_OUTPUT.curveSamples);
  for (let i = 0; i < curve.length; i++) {
    const x = i * 2 / (curve.length - 1) - 1, magnitude = Math.abs(x);
    const progress = (magnitude - AUDIO_OUTPUT.kneeStart) / (1 - AUDIO_OUTPUT.kneeStart);
    curve[i] = magnitude <= AUDIO_OUTPUT.kneeStart ? x : Math.sign(x) *
      (AUDIO_OUTPUT.kneeStart + (AUDIO_OUTPUT.ceiling - AUDIO_OUTPUT.kneeStart) * progress * (2 - progress));
  }
  ceiling.curve = curve;
  // Oversampling after the shaper can ring above its peak ceiling.
  ceiling.oversample = 'none';
  volume.gain.setValueAtTime(1, context.currentTime);
  input.connect(ceiling);
  ceiling.connect(volume);
  volume.connect(context.destination);
  return { input, volume, dispose() { input.disconnect(); ceiling.disconnect(); volume.disconnect(); } };
}
