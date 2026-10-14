import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOUND_DEMO, SOUND_DEMO_REPLAY, SOUND_DEMO_RECOVERY, SOUND_ICE_DEMO, SOUND_ICE_REPLAY } from '../data/sound-demo.ts';
import { LEVELS } from '../data/levels.ts';
import { EXPLOSION_PUZZLES } from '../data/explosion-puzzles.ts';
import { createState, restartCheckpoint, step } from '../core/simulation.ts';
import { soundEvents } from '../presentation/audio.ts';
import { iceMotion } from '../presentation/audio.ts';

test('SoundGarden_UsesExistingSurfacesAndIsNotAProductionOrExplosionCourse', () => {
  const { level } = SOUND_DEMO;
  for (const tile of ['.', ':', '~', '=']) assert.ok(level.tiles.some(row => row.includes(tile)));
  assert.ok(!LEVELS.some(l => l.id === level.id));
  assert.ok(!EXPLOSION_PUZZLES.some(p => p.level.id === level.id));
  assert.equal(level.checkpoints.length, 1);
  assert.ok(level.goal.x - level.checkpoints[0].x > 6);
  assert.ok(Object.isFrozen(level));
});

test('SoundGarden_LegalReplayAuditionsEverySurfaceCheckpointAndFinish', () => {
  const { level } = SOUND_DEMO;
  let state = createState(level);
  const cues = new Set<string>();
  for (const command of SOUND_DEMO_REPLAY) for (let i = 0; i < command.ticks && !state.won; i++) {
    const before = state;
    state = step(level, state, command);
    for (const cue of soundEvents(level, before, state)) cues.add(cue);
  }
  assert.equal(state.won, true);
  assert.equal(state.deaths, 0);
  assert.equal(state.tick, 769);
  for (const cue of ['step', 'mud', 'soft', 'hard', 'checkpoint', 'warning', 'blast', 'win'])
    assert.ok(cues.has(cue), `route must demonstrate ${cue}`);
});

test('SoundGarden_CheckpointRestartHasSafeDownstreamRecovery', () => {
  const { level } = SOUND_DEMO;
  let state = createState(level);
  for (let i = 0; i < 1500 && state.visited.length === 0; i++) state = step(level, state, { x: 1, y: 0 });
  assert.equal(state.visited.length, 1);
  state = restartCheckpoint(level, state);
  for (let i = 0; i < 300 && state.deaths === 0; i++) state = step(level, state, { x: 1, y: 0 });
  assert.equal(state.deaths, 1, 'dashing from the restart point is a real wave failure');
  const restart = restartCheckpoint(level, state);
  for (let margin = -24; margin <= 24; margin++) {
    state = restart;
    for (const [index, command] of SOUND_DEMO_RECOVERY.entries()) {
      const ticks = command.ticks + (index === 0 ? margin : 0);
      for (let i = 0; i < ticks && !state.won; i++) state = step(level, state, command);
    }
    assert.equal(state.won, true, `recovery with ${margin} tick wait error`);
    assert.equal(state.deaths, restart.deaths);
  }
});

test('IceRoom_LongReleasedKeyGlideReflectsWithNearbyDangerAndSafeExit', () => {
  const { level } = SOUND_ICE_DEMO;
  assert.ok(!LEVELS.some(l => l.id === level.id));
  assert.ok(!EXPLOSION_PUZZLES.some(p => p.level.id === level.id));
  assert.equal(level.checkpoints.length, 0, 'single audition room needs no checkpoint');
  let state = createState(level), sliding = 0, reflected = false;
  const cues = new Set<string>();
  for (let i = 0; i < 1150; i++) {
    const before = state;
    state = step(level, state, i < 40 ? { x: 1, y: 0 } : { x: 0, y: 0 });
    if (iceMotion(level, before, state) === 'soft') sliding++;
    if (before.velocity.x > 0 && state.velocity.x < 0) reflected = true;
    for (const cue of soundEvents(level, before, state)) cues.add(cue);
  }
  assert.ok(sliding >= 960, 'at least eight seconds of uninterrupted-motion material');
  assert.ok(reflected);
  assert.equal(state.deaths, 0);
  for (const cue of ['bump', 'warning', 'blast']) assert.ok(cues.has(cue), cue);
  for (let margin = -10; margin <= 10; margin++) {
    state = createState(level);
    for (const [index, command] of SOUND_ICE_REPLAY.entries())
      for (let i = 0; i < command.ticks + (index === 0 ? margin : 0) && !state.won; i++)
        state = step(level, state, command);
    assert.equal(state.won, true, `safe exit with ${margin} ticks at turn`);
    assert.equal(state.deaths, 0);
    if (margin === 0) assert.equal(state.tick, 820);
  }
});
