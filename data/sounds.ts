import { EXPLOSION_SELECTION } from './explosion-palette.ts';

type SoundDefinition = Readonly<{
  label: string; description: string; sample: string; gain: number;
  rates: readonly number[]; spacing: number; cooldown: number; priority: number;
}>;
const cue = (label: string, description: string, sample: string, gain: number,
  rates: readonly number[], cooldown: number, priority = 0, spacing = 0): SoundDefinition =>
  Object.freeze({ label, description, sample, gain, rates: Object.freeze(rates), cooldown, priority, spacing });

export const APPROVED_BOARD_SOUNDS = Object.freeze({ death: 'death-feather', ui: 'ui-tick' });

/** Approved feedback sounds alongside the remaining physical-palette cues. */
export const SOUNDS = Object.freeze({
  step: cue('Footsteps', 'Recorded stone contact, with weight and a little grit.', 'physical-v2/step/sound', 0.12, [1], 0.16),
  mud: cue('Mud', 'A slower recorded granular scuff.', 'physical-v2/mud/sound', 0.11, [1], 0.25),
  soft: cue('Soft ice', 'A low, continuous-feeling friction wash.', 'physical-v2/soft/sound', 0.07, [1], 0.18),
  hard: cue('Hard ice', 'A finer, sharper edge sliding over the surface.', 'physical-v2/hard/sound', 0.065, [1], 0.18),
  bump: cue('Wall contact', 'A solid recorded knock on ice contact.', 'physical-v2/bump/sound', 0.19, [1], 0.12, 1),
  warning: cue('Warning', 'A rising fuse texture during the visible warning.', 'physical-v2/warning/sound', 0.15, [1], 0.08, 2),
  blast: cue('Explosion', 'Airy puff: a soft, rounded breath with a short tail.',
    `explosion-candidates/${EXPLOSION_SELECTION.blast}-blast`, 1.2, [1], 0.055, 2),
  death: cue('Retry', 'Falling feather: a soft downward gesture that settles away.',
    `sound-board/${APPROVED_BOARD_SOUNDS.death}`, 2, [1], 0.25, 3),
  checkpoint: cue('Checkpoint', 'A compact latch settling into place.', 'physical-v2/checkpoint/sound', 0.18, [1], 0.25, 3),
  win: cue('Exit', 'A warm pressure release opening out, not a melody.', 'physical-v2/win/sound', 0.20, [1], 0.5, 4),
  ui: cue('Button', 'Soft tick: a tiny, rounded confirmation.',
    `sound-board/${APPROVED_BOARD_SOUNDS.ui}`, 2, [1], 0.06, 1),
});
export type SoundId = keyof typeof SOUNDS;
export const SOUND_IDS = Object.freeze(Object.keys(SOUNDS) as SoundId[]);
export const SOUND_SAMPLES = Object.freeze([...new Set(SOUND_IDS.map(id => SOUNDS[id].sample))]);
export const SOUND_MIX = Object.freeze({
  maxVoices: 8, masterGain: 0.5, attack: 0.005, release: 0.025,
  stepTicks: 24, mudTicks: 42, glideTicks: 30, movementThreshold: 0.001,
});
