export type Preferences = Readonly<{ version: 1; sound: boolean; volume: number }>;
export const PREFERENCES_KEY = 'boundstoy.preferences.v1';
export const DEFAULT_PREFERENCES: Preferences = Object.freeze({ version: 1, sound: false, volume: 0.5 });

export function readPreferences(source: string | null): Preferences {
  if (source === null) return DEFAULT_PREFERENCES;
  const value: unknown = JSON.parse(source);
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1
    || !('sound' in value) || typeof value.sound !== 'boolean'
    || !('volume' in value) || typeof value.volume !== 'number'
    || !Number.isFinite(value.volume) || value.volume < 0 || value.volume > 1) {
    throw new Error('Saved sound preferences are invalid.');
  }
  return { version: 1, sound: value.sound, volume: value.volume };
}
