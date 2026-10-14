export type IceSurface = 'soft' | 'hard';
export type IceVariant = 'wind' | 'pad';
export const ICE_SAMPLES = Object.freeze({
  wind: 'ice-study/wind/sound', pad: 'ice-study/pad/sound',
});
export const ICE_AUDIO = Object.freeze({
  sampleRate: 32000, loopSeconds: 4, previewSeconds: 8,
  attack: 0.28, release: 0.24, filterTime: 0.08, windQ: 0.4,
  rootHz: 147, intervals: Object.freeze([1, 1.5, 2.25]),
  soft: Object.freeze({ windGain: 0.09, padGain: 0.022, cutoff: 1800 }),
  hard: Object.freeze({ windGain: 0.08, padGain: 0.018, cutoff: 3200 }),
});
