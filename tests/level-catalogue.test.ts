import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trialSets, findTrial, nextTrial, trialCredit, isDevMode, MAX_TRIALS_PER_SET } from '../application/level-catalogue.ts';
import { EXPLOSION_PUZZLES } from '../data/explosion-puzzles.ts';
import { CLASSIC_BOUNDS } from '../data/classic-bounds.ts';
import { ICE_ESCAPES } from '../data/ice-escapes.ts';
import { SOUND_DEMOS } from '../data/sound-demo.ts';
import { PULSE_LINE } from '../data/pulse-line.ts';
import { GLIDE_LINE } from '../data/glide-line.ts';
import { TEST_LEVELS, TENTATIVE } from '../data/test-levels.ts';

test('LevelCatalogue_PlayerMode_ListsTrialSetsWithoutDeveloperRooms', () => {
  const sets = trialSets({ dev: false });
  const expected = [['designed', [PULSE_LINE, GLIDE_LINE]], ['test', TEST_LEVELS], ['tentative', TENTATIVE],
    ['explosions', EXPLOSION_PUZZLES], ['classic', CLASSIC_BOUNDS], ['ice', ICE_ESCAPES]] as const;
  // Draft sets such as Test levels are hidden while empty.
  const shown = expected.filter(([, items]) => items.length > 0);
  assert.deepEqual(sets.map(set => set.id), shown.map(([id]) => id));
  assert.deepEqual(sets.map(set => set.items), shown.map(([, items]) => items));
  for (const set of sets) {
    assert.ok(set.title.length > 0 && set.summary.length > 0);
    assert.ok(set.items.length > 0 && set.items.length <= MAX_TRIALS_PER_SET, `${set.id} fits one grid`);
  }
  assert.ok(!sets.flatMap(set => set.items).some(item => SOUND_DEMOS.includes(item)));
});

test('LevelCatalogue_DevMode_AddsSoundGardenLast', () => {
  const sets = trialSets({ dev: true });
  assert.equal(sets.at(-1)?.id, 'sound');
  assert.deepEqual(sets.at(-1)?.items, SOUND_DEMOS);
});

test('LevelCatalogue_EveryTrialIdIsUniqueAndFindable', () => {
  const sets = trialSets({ dev: true }), ids = sets.flatMap(set => set.items.map(item => item.level.id));
  assert.equal(new Set(ids).size, ids.length);
  const entry = findTrial(sets, CLASSIC_BOUNDS[2].level.id);
  assert.equal(entry?.set.id, 'classic');
  assert.equal(entry?.index, 2);
  assert.equal(entry?.puzzle, CLASSIC_BOUNDS[2]);
  assert.equal(findTrial(sets, 'missing'), undefined);
});

test('LevelCatalogue_NextTrial_StaysInsideItsSetAndEndsWithNull', () => {
  const sets = trialSets({ dev: false });
  assert.equal(nextTrial(sets, ICE_ESCAPES[0].level.id), ICE_ESCAPES[1]);
  assert.equal(nextTrial(sets, ICE_ESCAPES.at(-1)!.level.id), null);
  assert.equal(nextTrial(sets, 'missing'), null);
});

test('LevelCatalogue_TrialCredit_NamesSourcesOnlyForAdaptations', () => {
  assert.equal(trialCredit(EXPLOSION_PUZZLES[0]), null);
  const bound = CLASSIC_BOUNDS[0];
  assert.equal(trialCredit(bound), `After ${bound.source.map} by ${bound.source.author}`);
  const ice = ICE_ESCAPES[0];
  assert.equal(trialCredit(ice), `After ${ice.source.reference} · ${ice.source.credit}`);
});

test('LevelCatalogue_DevMode_RequiresAnExplicitQueryFlag', () => {
  assert.equal(isDevMode(''), false);
  assert.equal(isDevMode('?level=1'), false);
  assert.equal(isDevMode('?dev'), true);
  assert.equal(isDevMode('?debug&journey=2'), true);
});
