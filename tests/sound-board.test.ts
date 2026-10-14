import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { SOUND_BOARD, SOUND_BOARD_ROLES } from '../data/sound-board.ts';
import { renderBoardSound } from '../scripts/prepare-sound-board.ts';
import { SOUNDS, SOUND_MIX } from '../data/sounds.ts';
import { ICE_PALETTE_IDS } from '../data/ice-palette.ts';
import { AUDIO_SAMPLES } from '../presentation/audio.ts';

const root = new URL('../public/audio/sound-board/', import.meta.url);
const hash = (data: Buffer) => createHash('sha256').update(data).digest('hex');

test('SoundBoard_TwoOriginalDeterministicAlternativesPerRemainingOneShotRole', () => {
  assert.deepEqual(SOUND_BOARD_ROLES.map(role => role.id),
    ['step', 'mud', 'bump', 'warning', 'death', 'checkpoint', 'win', 'ui']);
  const signatures = new Set<string>();
  for (const role of SOUND_BOARD_ROLES) {
    assert.ok(Object.isFrozen(role) && Object.isFrozen(role.options));
    assert.equal(role.options.length, 2);
    for (const option of role.options) {
      assert.ok(Object.isFrozen(option) && Object.isFrozen(option.tones));
      const samples = renderBoardSound(option);
      assert.deepEqual(samples, renderBoardSound(option));
      assert.ok(samples.every(Number.isFinite));
      assert.equal(samples[0], 0); assert.equal(samples.at(-1), 0);
      assert.ok(samples.some(sample => Math.abs(sample) > .01));
      assert.equal(samples.length, Math.round(option.seconds * 48000));
      if (role.id === 'warning') assert.equal(option.seconds, 27 / 120);
      signatures.add(hash(Buffer.from(samples.buffer)));
    }
  }
  assert.equal(signatures.size, 16);
});

test('SoundBoard_ManifestReusesCurrentSoundsAndIceAndMatchesAlternativeRoleLevels', () => {
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', root), 'utf8'));
  assert.equal(manifest.groups.length, 9);
  assert.equal(manifest.entries.length, 36);
  assert.deepEqual(manifest.selected, { death: 'death-feather', ui: 'ui-tick' });
  assert.equal(manifest.repeatCount, 4);
  assert.equal(manifest.approvedExplosion.file, '../explosion-candidates/airy-puff-blast.wav');
  assert.equal(manifest.approvedExplosion.gain, SOUNDS.blast.gain * SOUND_MIX.masterGain);
  assert.equal(manifest.sourceSha256, hash(readFileSync(new URL('../scripts/prepare-sound-board.ts', import.meta.url))));
  assert.equal(manifest.registrySha256, hash(readFileSync(new URL('../data/sound-board.ts', import.meta.url))));
  assert.deepEqual(AUDIO_SAMPLES.filter(path => path.startsWith('sound-board/')),
    ['sound-board/death-feather', 'sound-board/ui-tick']);
  let newAssetBytes = 0;
  for (const role of SOUND_BOARD_ROLES) {
    const authoring = manifest.groups.find((group: { id: string }) => group.id === role.id).authoringReference;
    assert.equal(authoring.file, `../physical-v2/${role.id}/sound.wav`, 'Master against a fixed source, never the generated selection');
    assert.equal(authoring.gain, { step: .06, mud: .055, bump: .095, warning: .075,
      death: .095, checkpoint: .09, win: .1, ui: .045 }[role.id]);
    assert.equal(authoring.sha256, hash(readFileSync(new URL(authoring.file, root))));
    assert.ok(authoring.measurementInterval >= Math.max(authoring.seconds, ...role.options.map(sound => sound.seconds)));
    const entries = manifest.entries.filter((entry: { role: string }) => entry.role === role.id);
    const approved = role.id === 'death' || role.id === 'ui';
    assert.equal(entries.length, approved ? 2 : 3);
    const current = entries.find((entry: { kind: string }) => entry.kind === 'current');
    assert.equal(current.file, approved ? `${manifest.selected[role.id]}.wav` : `../${SOUNDS[role.id].sample}.wav`);
    assert.equal(Boolean(current.approved), approved);
    assert.equal(current.gain, SOUNDS[role.id].gain * SOUND_MIX.masterGain);
    for (const entry of entries) {
      const wav = readFileSync(new URL(entry.file, root));
      assert.equal(hash(wav), entry.sha256);
      assert.equal(entry.license, 'CC0-1.0');
      assert.ok(Math.abs(entry.eventLufs - current.eventLufs) <= .3);
      if (role.id === 'warning') assert.equal(entry.seconds, .225);
      if (entry.kind === 'alternative') {
        newAssetBytes += wav.length;
        assert.equal(entry.gain, 1);
        assert.equal(wav.readUInt16LE(22), 2);
        assert.equal(wav.readUInt32LE(24), 48000);
        assert.equal(wav.readUInt16LE(34), 16);
        let peak = 0;
        for (let i = 44; i < wav.length; i += 4) {
          assert.equal(wav.readInt16LE(i), wav.readInt16LE(i + 2));
          peak = Math.max(peak, Math.abs(wav.readInt16LE(i) / 32768));
        }
        assert.ok(peak > .005 && peak < .16);
        assert.equal(wav.readInt16LE(44), 0);
        assert.equal(wav.readInt16LE(wav.length - 2), 0);
      }
    }
  }
  assert.equal(new Set(manifest.entries.map((entry: { file: string }) => entry.file)).size, 36, 'No duplicated approved cards');
  assert.ok(newAssetBytes < 1_800_000, `${newAssetBytes}: compact bank including longer jingles`);
  const ice = manifest.entries.filter((entry: { role: string }) => entry.role === 'ice');
  assert.equal(ice.length, 14);
  for (const id of ICE_PALETTE_IDS) {
    const entry = ice.find((entry: { id: string }) => entry.id === `ice-${id}`);
    assert.equal(entry.file, `../ice-palette/${id}.wav`);
    assert.equal(entry.kind, 'ice-option');
    assert.ok(entry.seconds >= 6 && entry.seconds <= 10);
    assert.equal(entry.repeat, false);
    assert.equal(entry.sha256, hash(readFileSync(new URL(entry.file, root))));
  }
  for (const id of ['soft', 'hard'] as const) {
    const entry = ice.find((entry: { id: string }) => entry.id === `ice-${id}-current`);
    assert.equal(entry.file, `../${SOUNDS[id].sample}.wav`);
    assert.equal(entry.gain, SOUNDS[id].gain * SOUND_MIX.masterGain);
  }
  assert.match(readFileSync(new URL('../index.html', import.meta.url), 'utf8'), /audio\/sound-board\/index\.html/);
});

test('SoundBoard_JinglesRenderEveryNoteAtItsAuthoredTimeWithFiniteTails', () => {
  for (const role of SOUND_BOARD_ROLES.filter(role => role.id === 'checkpoint' || role.id === 'win')) {
    for (const option of role.options) {
      const sum = new Float64Array(Math.round(option.seconds * SOUND_BOARD.sampleRate));
      for (const note of option.notes) {
        const samples = renderBoardSound({ ...option, notes: [note] });
        const first = Math.floor(note.at * SOUND_BOARD.sampleRate);
        const last = Math.ceil((note.at + note.seconds) * SOUND_BOARD.sampleRate);
        assert.ok(samples.subarray(0, first).every(value => value === 0), `${option.id}: no early note`);
        assert.ok(samples.subarray(first, last).some(value => Math.abs(value) > .01), `${option.id}: note really sounds`);
        assert.ok(samples.subarray(last).every(value => value === 0), `${option.id}: note ends on time`);
        samples.forEach((value, index) => { sum[index] += value; });
      }
      renderBoardSound(option).forEach((value, index) =>
        assert.ok(Math.abs(value - sum[index]) < 1e-6, `${option.id}: complete authored phrase`));
    }
  }
});

test('SoundBoard_RefreshedRolesHaveDistinctTactileChoicesAndActualJingleSequences', () => {
  const expected = {
    step: ['step-shoe', 'step-patter'], mud: ['mud-tread', 'mud-sticky'],
    bump: ['bump-rubber', 'bump-fabric'],
    checkpoint: ['checkpoint-hearth', 'checkpoint-home'],
    win: ['win-fanfare', 'win-victory'],
  };
  for (const [id, ids] of Object.entries(expected)) {
    const role = SOUND_BOARD_ROLES.find(role => role.id === id)!;
    assert.deepEqual(role.options.map(option => option.id), ids);
    for (const option of role.options) {
      if (id === 'checkpoint' || id === 'win') {
        assert.ok(option.notes.length >= (id === 'win' ? 4 : 3), 'A sequence, not another static chord');
        assert.ok(Object.isFrozen(option.notes));
        assert.ok(option.notes.every(note => Object.isFrozen(note) && Object.isFrozen(note.frequencies)));
        assert.ok(option.notes.at(-1)!.at - option.notes[0].at >= .3);
        assert.ok(option.notes.every(note => note.at >= 0 && note.at + note.seconds <= option.seconds));
        assert.ok(option.seconds >= (id === 'win' ? 1.2 : .8));
        assert.ok(role.interval > option.seconds, 'Jingle repeats must not overlap');
        if (id === 'checkpoint') {
          assert.equal(option.jingleTimbre, 'warm');
          assert.ok(Math.max(...option.notes.flatMap(note => [...note.frequencies])) < 600);
        } else {
          assert.equal(option.jingleTimbre, 'brass');
          assert.ok(Math.max(...option.notes.at(-1)!.frequencies) > option.notes[0].frequencies[0]);
        }
      }
    }
  }
});
