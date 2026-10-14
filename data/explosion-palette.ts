export type ExplosionCandidate = Readonly<{
  id: 'soft-magic' | 'airy-puff' | 'rounded-pop' | 'glass-bloom' | 'wooden-knock' | 'deep-cushion' | 'electric-snap' | 'arcade-burst';
  label: string;
  description: string;
  warningDescription: string;
  blastDescription: string;
  frequency: number;
  decay: number;
}>;

export const EXPLOSION_PALETTE: readonly ExplosionCandidate[] = Object.freeze(([
  { id: 'soft-magic', label: 'Soft magic', frequency: 523.25, decay: .56,
    description: 'A gentle, tonal direction to sit beside the Weightless ice pad.',
    warningDescription: 'A short gathering of rounded harmonics.',
    blastDescription: 'A soft, open fifth that blooms and falls away; no jingle.' },
  { id: 'airy-puff', label: 'Airy puff', frequency: 900, decay: .20,
    description: 'The preferred direction, softened for frequent bursts: less hiss, less bite and a shorter tail.',
    warningDescription: 'A subdued intake of air, without a bright hiss.',
    blastDescription: 'A soft, rounded breath that clears quickly; 3 dB gentler than the other sketches.' },
  { id: 'rounded-pop', label: 'Rounded pop', frequency: 280, decay: .30,
    description: 'A small elastic gesture: more bubble than bomb.',
    warningDescription: 'A quiet, rising hollow tone.',
    blastDescription: 'A quick pitch drop into a cushioned pop.' },
  { id: 'glass-bloom', label: 'Glass bloom', frequency: 659.25, decay: .62,
    description: 'Delicate glass-like colour, with the hard edge softened.',
    warningDescription: 'Fine resonances gathering into focus.',
    blastDescription: 'A diffuse cluster of upper harmonics, not shattering glass.' },
  { id: 'wooden-knock', label: 'Wooden knock', frequency: 230, decay: .28,
    description: 'Dry, organic and rhythmic; a less magical alternative.',
    warningDescription: 'A short brushed-wood swell.',
    blastDescription: 'A muted, hollow wooden tap with almost no lingering tail.' },
  { id: 'deep-cushion', label: 'Deep cushion', frequency: 135, decay: .48,
    description: 'A soft lower-register impact; fuller rather than louder.',
    warningDescription: 'A warm, low-mid pressure swell.',
    blastDescription: 'A rounded low pulse with enough upper body for small speakers.' },
  { id: 'electric-snap', label: 'Electric snap', frequency: 440, decay: .34,
    description: 'A brighter synthetic contrast, kept short rather than buzzy.',
    warningDescription: 'A compact harmonic charge-up.',
    blastDescription: 'A softened FM snap with a fast falling centre.' },
  { id: 'arcade-burst', label: 'Arcade burst', frequency: 350, decay: .40,
    description: 'The punchier reference: stylised energy, not a realistic weapon.',
    warningDescription: 'A smooth, ascending hollow pulse.',
    blastDescription: 'A band-limited tonal burst with a little filtered impact texture.' },
] satisfies ExplosionCandidate[]).map(candidate => Object.freeze(candidate)));

export const EXPLOSION_AUDIO = Object.freeze({
  sampleRate: 48000,
  warningSeconds: 27 / 120,
  patternInterval: 1.2,
  patternCount: 4,
  rapidInterval: .25,
  rapidCount: 8,
  measurementRepeats: 6,
  targetLufs: Object.freeze({ warning: -40, blast: -33 }),
  maximumPeak: .16,
  startDelay: .04,
});

export const AIRY_PUFF_AUDIO = Object.freeze({
  warningLowpassStart: 350,
  warningLowpassEnd: 1000,
  blastLowpass: 900,
  blastAttack: .018,
  blastDecayRate: 26,
  loudnessOffsetDb: -3,
});

export const EXPLOSION_SELECTION = Object.freeze({ blast: 'airy-puff', warning: null });
