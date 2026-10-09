import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readPreferences } from '../application/preferences.ts';

test('Preferences_FreshVisit_IsMutedWithComfortableVolume', () => {
  assert.deepEqual(readPreferences(null), { version: 1, sound: false, volume: 0.5 });
});

test('Preferences_SavedChoice_RoundtripsWithoutChangingProgress', () => {
  const saved = { version: 1, sound: true, volume: 0.25 };
  assert.deepEqual(readPreferences(JSON.stringify(saved)), saved);
});

test('Preferences_InvalidVersionOrMix_ReportsErrorInsteadOfSilentlyResetting', () => {
  for (const value of [{ version: 2, sound: false, volume: 0.5 }, { version: 1, sound: 'on', volume: 0.5 },
    { version: 1, sound: true, volume: -1 }, { version: 1, sound: true, volume: 1.01 },
    { version: 1, sound: true, volume: null }, null]) {
    assert.throws(() => readPreferences(JSON.stringify(value)), /preferences/i);
  }
});
