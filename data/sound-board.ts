import type { SoundId } from './sounds.ts';

type BoardNote = Readonly<{ at: number; seconds: number; frequencies: readonly number[]; gain: number }>;
const note = (at: number, seconds: number, frequencies: readonly number[], gain = 1): BoardNote =>
  ({ at, seconds, frequencies, gain });

export type BoardSound = Readonly<{
  id: string; label: string; description: string; seconds: number;
  tones: readonly number[]; noise: number; cutoff: number;
  attack: number; decay: number; pitchEnd: number; rising: boolean;
  texture: 'smooth' | 'grain' | 'wood' | 'rubber';
  pulses: readonly number[]; notes: readonly BoardNote[]; jingleTimbre: 'warm' | 'brass';
}>;
const option = (id: string, label: string, description: string, seconds: number,
  design: Partial<Omit<BoardSound, 'id' | 'label' | 'description' | 'seconds'>>): BoardSound =>
  Object.freeze({ id, label, description, seconds, noise: 0, cutoff: 900, attack: .018,
    decay: 16, pitchEnd: 1, rising: false, texture: 'smooth', jingleTimbre: 'warm', ...design,
    tones: Object.freeze([...(design.tones ?? [])]), pulses: Object.freeze([...(design.pulses ?? [])]),
    notes: Object.freeze((design.notes ?? []).map(value => Object.freeze({
      ...value, frequencies: Object.freeze([...value.frequencies]),
    }))) });
type BoardRole = Readonly<{
  id: Exclude<SoundId, 'blast' | 'soft' | 'hard'>;
  label: string; description: string; interval: number; referenceGain: number; options: readonly BoardSound[];
}>;
const role = (id: BoardRole['id'], label: string, description: string, interval: number, referenceGain: number,
  options: BoardSound[]): BoardRole => Object.freeze({ id, label, description, interval, referenceGain, options: Object.freeze(options) });

export const SOUND_BOARD_ROLES = Object.freeze([
  role('step', 'Footsteps', 'Fresh tactile directions: a dry heel/toe contact or a light wooden patter.', .25, .06, [
    option('step-shoe', 'Soft shoe', 'Two tiny unpitched heel/toe contacts, rather than a musical bubble.', .17,
      { noise: 1, cutoff: 1800, pulses: [.016, .065], decay: 8, attack: .008 }),
    option('step-patter', 'Wooden patter', 'A small dry woody contact; its upper resonances disappear quickly.', .18,
      { tones: [420, 755, 1241], noise: .2, texture: 'wood', cutoff: 1300, decay: 28, attack: .007 }),
  ]),
  role('mud', 'Mud', 'Fresh granular and sticky textures, without the old low chord or soft brush.', .4, .055, [
    option('mud-tread', 'Damp tread', 'An irregular, compact grain of damp contact with a second soft compression.', .25,
      { noise: 1, texture: 'grain', cutoff: 1700, pulses: [.035, .11], attack: .016, decay: 7 }),
    option('mud-sticky', 'Sticky release', 'A short, grainy pull that gathers before releasing; no pitched squeeze.', .26,
      { noise: 1, texture: 'grain', cutoff: 1400, rising: true, attack: .025 }),
  ]),
  role('bump', 'Wall contact', 'Try an elastic rubber nudge or a dry fabric catch, not another hollow knock.', .5, .095, [
    option('bump-rubber', 'Rubber nudge', 'A brief elastic body with a rounded, quickly settling edge.', .17,
      { tones: [240], texture: 'rubber', pitchEnd: .65, decay: 24, attack: .012 }),
    option('bump-fabric', 'Fabric catch', 'A compact unpitched scrunch, like a padded surface catching motion.', .14,
      { noise: 1, texture: 'grain', cutoff: 1900, decay: 25, attack: .01 }),
  ]),
  role('warning', 'Buildup', 'Each warning lasts the actual 225 ms; compare it with the approved puff.', .5, .075, [
    option('warning-breath', 'Gathering breath', 'A subdued intake of air, not a fuse or machinery.', .225,
      { noise: 1, cutoff: 900, rising: true, attack: .03 }),
    option('warning-glow', 'Faint glow', 'A soft harmonic gathering, without an alarm-like edge.', .225,
      { tones: [349.23, 523.25], rising: true, pitchEnd: 1.12, attack: .035 }),
  ]),
  role('death', 'Retry', 'Falling feather is approved and used in the game. The other option remains unselected.', .8, .095, [
    option('death-feather', 'Falling feather', 'A rounded tone settles downward and disappears.', .34,
      { tones: [392, 588], pitchEnd: .65, decay: 11, attack: .025 }),
    option('death-exhale', 'Soft exhale', 'A short, non-tonal breath out; no mechanical wind-down.', .30,
      { noise: 1, cutoff: 800, decay: 12, attack: .035 }),
  ]),
  role('checkpoint', 'Checkpoint', 'Warm little arrival jingles: lower-register notes that settle into a welcoming harmony.', 1.3, .09, [
    option('checkpoint-hearth', 'Hearth notes', 'Three rounded F-major steps, finishing in a warm open harmony.', .92,
      { decay: 0, notes: [note(0, .4, [174.61, 349.23], .85), note(.16, .4, [220], .8),
        note(.34, .55, [261.63, 349.23])] }),
    option('checkpoint-home', 'Coming home', 'A gentle three-gesture reply that resolves downward into a soft F-major chord.', 1.04,
      { decay: 0, notes: [note(0, .45, [261.63]), note(.18, .45, [220, 349.23], .85),
        note(.38, .62, [174.61, 261.63, 349.23])] }),
  ]),
  role('win', 'Exit', 'Short triumphant jingles: a clear rising phrase and a full resolving chord, not just a pad.', 1.9, .10, [
    option('win-fanfare', 'Little fanfare', 'A rounded brass-like C-F-A rise opens into a victorious F-major chord.', 1.45,
      { decay: 0, jingleTimbre: 'brass', notes: [note(0, .32, [261.63], .8), note(.17, .32, [349.23], .85),
        note(.34, .34, [440], .9), note(.56, .85, [349.23, 440, 523.25])] }),
    option('win-victory', 'Victory flourish', 'A buoyant five-gesture flourish, with a bright top note over the final harmony.', 1.65,
      { decay: 0, jingleTimbre: 'brass', notes: [note(0, .3, [349.23], .8), note(.16, .3, [523.25], .8),
        note(.34, .32, [440], .8), note(.54, .32, [698.46], .9), note(.78, .82, [349.23, 523.25, 880])] }),
  ]),
  role('ui', 'Buttons', 'Soft tick is approved and used in the game. The other option remains unselected.', .25, .045, [
    option('ui-tick', 'Soft tick', 'A tiny, rounded upper touch, not a switch snap.', .09,
      { tones: [698.46], decay: 45, attack: .008 }),
    option('ui-round', 'Round click', 'A lower, cushioned dot with a hint of air.', .11,
      { tones: [392], noise: .12, cutoff: 900, decay: 35, attack: .012 }),
  ]),
]);

export const SOUND_BOARD = Object.freeze({
  sampleRate: 48000, repeatCount: 4, measurementInterval: 1.2,
  measurementCount: 6, measurementGap: .15, maximumPeak: .16, loudnessTolerance: .2,
});

export const SOUND_BOARD_TIMBRE = Object.freeze({
  grainSeconds: .012, grainFloor: .1, grainSmoothing: .015, pulseWidth: .02,
  woodPartialDecay: 35, rubberDepth: .8, rubberRatio: 1.3, rubberDecay: 40,
  noteAttack: .025, noteRelease: .14, noteDecay: 1.6,
  warm: Object.freeze([1, .22, .06]), brass: Object.freeze([1, .45, .24, .1]),
});
