export const AUDIO_OUTPUT: Readonly<{
  boostDb: number; kneeStart: number; ceiling: number; curveSamples: number;
}>;
export function createAudioOutput(context: BaseAudioContext): {
  input: GainNode;
  volume: GainNode;
  dispose(): void;
};
