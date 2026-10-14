import { test } from 'node:test';
import assert from 'node:assert/strict';
import { worldSummary, formatTime, controlsHint, sectionPips } from '../application/menu-model.ts';
import { AFTERSHOCK_WORLD as world } from '../data/aftershock-world.ts';
import { createState } from '../core/simulation.ts';

test('MenuModel_FormatTime_UsesMinutesSecondsAndHundredths', () => {
  assert.equal(formatTime(0), '00:00.00');
  assert.equal(formatTime(120), '00:01.00');
  assert.equal(formatTime(120 * 75 + 6), '01:15.05');
});

test('MenuModel_NewWorld_OffersPlayWithoutReplacement', () => {
  const summary = worldSummary(world, null, undefined);
  assert.equal(summary.status, 'new');
  assert.equal(summary.primaryLabel, 'Play');
  assert.equal(summary.canNewRun, false);
  assert.equal(summary.section, null);
  assert.equal(summary.progressLine, `${world.sections.length} sections · one continuous run`);
  assert.equal(summary.bestLine, 'No record yet');
  assert.equal(summary.deathless, false);
});

test('MenuModel_SavedRun_ContinuesAtItsSectionWithTotals', () => {
  const state = { ...createState(world), tick: 240, deaths: 3, visited: world.checkpoints.slice(0, 2).map(p => `${p.x},${p.y}`) };
  const summary = worldSummary(world, { state }, { ticks: 6000, deaths: 1 });
  assert.equal(summary.status, 'continue');
  assert.equal(summary.primaryLabel, 'Continue');
  assert.equal(summary.canNewRun, true);
  assert.deepEqual(summary.section, { index: 2, total: world.sections.length, title: world.sections[2].name });
  assert.equal(summary.progressLine, `Section 3 of ${world.sections.length} · 00:02.00 · 3 retries`);
  assert.equal(summary.bestLine, 'Best 00:50.00 · 1 retry');
  assert.equal(summary.deathless, false);
});

test('MenuModel_CompletedWorld_ReportsDeathlessFromCleanRecord', () => {
  const summary = worldSummary(world, null, { ticks: 5752, deaths: 2, cleanTicks: 5900 });
  assert.equal(summary.status, 'complete');
  assert.equal(summary.primaryLabel, 'Play again');
  assert.equal(summary.deathless, true);
  assert.equal(summary.progressLine, 'Cleared · try for a faster time');
});

test('MenuModel_SectionPips_MarkDoneCurrentAndAhead', () => {
  assert.deepEqual(sectionPips({ index: 2, total: 5, title: '' }), ['done', 'done', 'current', 'ahead', 'ahead']);
  assert.deepEqual(sectionPips(null), []);
});

test('MenuModel_ControlsHint_MatchesTheInputDevice', () => {
  assert.match(controlsHint(false), /WASD or arrow keys/);
  assert.doesNotMatch(controlsHint(true), /WASD/);
  assert.match(controlsHint(true), /Hold the arrows/);
});
