import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AFTERSHOCK_WORLD, AFTERSHOCK_OPENING, AFTERSHOCK_MIDDLE, AFTERSHOCK_COMBINED, AFTERSHOCK_FINALE,
  CHECKPOINT_PHASE_ORIGINS, AFTERSHOCK_PAD_GROUPS } from '../data/aftershock-world.ts';
import { DEFAULT_EXPLOSION_STYLE } from '../data/explosion-styles.ts';
import type { Pulse } from '../core/level.ts';

const pads = AFTERSHOCK_WORLD.hazards.filter((h): h is Pulse => h.kind === 'pulse');
const styleOf = (pad: Pulse) => pad.style ?? DEFAULT_EXPLOSION_STYLE;

test('AftershockStyles_OnlyCosmeticFieldsChange', () => {
  const fragments = [...AFTERSHOCK_OPENING, ...AFTERSHOCK_MIDDLE, ...AFTERSHOCK_COMBINED, ...AFTERSHOCK_FINALE];
  const expected = fragments.flatMap((fragment, index) => fragment.hazards.map(hazard => ({
    ...hazard, sectionId: fragment.section.id, phase: (hazard.phase + CHECKPOINT_PHASE_ORIGINS[index]) % hazard.period })));
  const stripped = AFTERSHOCK_WORLD.hazards.map(hazard => {
    if (hazard.kind !== 'pulse') return hazard;
    const { style: _style, ...timing } = hazard;
    return timing;
  });
  assert.deepEqual(stripped, expected, 'positions, periods, phases and ownership are untouched');
  assert.equal(AFTERSHOCK_WORLD.revision, 2, 'cosmetic styling keeps existing saves valid');
});

test('AftershockStyles_EachRhythmGroupHasOneColourAndNeighbouringGroupsContrast', () => {
  const sections = new Map<string, Map<string, Set<string>>>();
  for (const pad of pads) {
    const group = AFTERSHOCK_PAD_GROUPS(pad);
    const byGroup = sections.get(pad.sectionId!) ?? new Map<string, Set<string>>();
    byGroup.set(group, (byGroup.get(group) ?? new Set()).add(styleOf(pad)));
    sections.set(pad.sectionId!, byGroup);
  }
  for (const [section, groups] of sections) {
    for (const [group, styles] of groups) assert.equal(styles.size, 1, `${section}/${group}: one colour per rhythm group`);
    const colours = [...groups.values()].map(styles => [...styles][0]);
    if (groups.size > 1) assert.equal(new Set(colours).size, groups.size, `${section}: groups are told apart by colour`);
  }
  const count = (index: number) => sections.get(`aftershock-section-${index}`)?.size ?? 0;
  assert.equal(count(1), 1, 'the opening travelling front is a single colour');
  assert.equal(count(7), 1, 'the front crossing the patrol is a single colour');
  for (const index of [2, 4, 5, 6, 8]) assert.ok(count(index) >= 2, `section ${index} contrasts its groups`);
  assert.ok(new Set(pads.map(styleOf)).size === 4, 'the world uses all four styles');
});
