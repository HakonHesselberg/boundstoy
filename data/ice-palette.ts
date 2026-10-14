const sound = (id: string, label: string, family: string, description: string) =>
  Object.freeze({ label, family, description, sample: `ice-palette/${id}` });

export const ICE_PALETTE = Object.freeze({
  weightless: sound('weightless', 'Weightless pad', 'Round pads', 'The original floating F/C sine pad, now a sustained loop.'),
  'warm-organ': sound('warm-organ', 'Warm organ', 'Round pads', 'Rounded low-mid triangle tones, soft and full rather than windy.'),
  'single-ribbon': sound('single-ribbon', 'Single ribbon', 'Round pads', 'One clear, gently coloured tone: no chord or bass drone.'),
  veil: sound('veil', 'Airy musical veil', 'Airy voices', 'The original vowel-shaped triangle chord with a diffuse, vocal colour.'),
  'hollow-flute': sound('hollow-flute', 'Hollow flute', 'Airy voices', 'An open, hollow upper voice without a breath-noise layer.'),
  'hushed-choir': sound('hushed-choir', 'Hushed choir', 'Airy voices', 'A soft synthetic vowel harmony, not a sampled choir.'),
  'velvet-strings': sound('velvet-strings', 'Velvet strings', 'Soft strings', 'Heavily softened saw tones: a rounded, bowed-sounding cushion.'),
  'distant-glow': sound('distant-glow', 'Distant glow', 'Soft strings', 'A thin high string colour with a distant, restrained shimmer.'),
  'floating-fifths': sound('floating-fifths', 'Floating fifths', 'Soft strings', 'A broad, open fifth with soft triangle harmonics.'),
  'glass-halo': sound('glass-halo', 'Glass halo', 'Delicate harmonics', 'Gentle harmonic FM, held without a bell strike or arpeggio.'),
  'soft-shimmer': sound('soft-shimmer', 'Soft shimmer', 'Delicate harmonics', 'A light upper harmonic veil over a small, rounded body.'),
  'warm-reed': sound('warm-reed', 'Warm reed', 'Delicate harmonics', 'A quiet, woody vowel colour with a more focused middle.'),
});
export type IceSoundId = keyof typeof ICE_PALETTE;
export const ICE_PALETTE_IDS = Object.freeze(Object.keys(ICE_PALETTE) as IceSoundId[]);
export const isIceSound = (id: string): id is IceSoundId => Object.hasOwn(ICE_PALETTE, id);
export const ICE_PALETTE_AUDIO = Object.freeze({
  sampleRate: 48000, targetLufs: -30, previewSeconds: 12,
  attack: .45, release: .4, gain: 2, softCutoff: 4000, hardCutoff: 5200, filterQ: .4, filterTime: .08,
  loopMinSeconds: 6, loopMaxSeconds: 10, crossfadeSeconds: 1, captureStartSeconds: 8,
});
