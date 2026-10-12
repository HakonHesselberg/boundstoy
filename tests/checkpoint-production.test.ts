import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AFTERSHOCK_WORLD as world } from '../data/aftershock-world.ts';
import { EIGHT_SECTION_ROUTES, MIDDLE_APPROACHES, CHECKPOINT_WORLD_ROUTES, OPENING_ROUTES,
  openingCommand as c } from '../data/aftershock-world-replays.ts';
import { createState, step, hazardEnabled, hazardTick, restartCheckpoint, lethalAt } from '../core/simulation.ts';
import { completeEight, CHECKPOINT_RECOVERIES } from './fixtures/aftershock-world.ts';
import { runProduction, productionRecovery } from './fixtures/checkpoint-production.ts';
import { createCheckpointSnapshot } from '../application/run-snapshot.ts';
import { OPENING_FAILURES, MIDDLE_FAILURES, COMBINED_FAILURES, FINALE_FAILURES } from './fixtures/aftershock-world-failures.ts';
import { paint, placeSaw } from '../core/editor.ts';
import { parseLevel } from '../core/level.ts';
import { localBlast } from '../presentation/audio.ts';
import { createPulse, updatePulse } from '../presentation/hazard-visuals.ts';

test('Production opts into owned local clocks without rewriting historical geometry or witnesses', () => {
  assert.equal(world.revision, 2);
  assert.equal(world.puzzleMode, 'checkpoint');
  assert.deepEqual(world.tiles, completeEight.tiles);
  assert.deepEqual(world.sections, completeEight.sections);
  assert.deepEqual(world.checkpoints, completeEight.checkpoints);
  assert.equal(completeEight.puzzleMode, undefined);
  const origins = [0, 507, 1339, 1872, 2539, 3272, 4072, 4773];
  for (const [i, hazard] of world.hazards.entries()) {
    const owner = world.sections.findIndex(s => s.id === hazard.sectionId);
    assert.ok(owner >= 0);
    assert.equal(hazard.phase, (completeEight.hazards[i].phase + origins[owner]) % hazard.period);
  }
});

test('Production ordinary and shelter shortcut are legal input-only deathless witnesses', () => {
  const fast = [...MIDDLE_APPROACHES.fast, ...EIGHT_SECTION_ROUTES.ordinary.slice(MIDDLE_APPROACHES.ordinary.length)];
  assert.deepEqual(CHECKPOINT_WORLD_ROUTES.fast, fast);
  for (const [route, ticks] of [[EIGHT_SECTION_ROUTES.ordinary, 5752], [fast, 5648]] as const) {
    let state = createState(world);
    const arrivals: number[] = [];
    for (const command of route) for (let i = 0; i < command.ticks; i++) {
      const before = state;
      state = step(world, state, command);
      assert.ok(Math.abs(Math.hypot(state.position.x - before.position.x, state.position.y - before.position.y) - .03) < 1e-9,
        `no idle/blocked comparator padding at ${state.tick}`);
      assert.equal(state.deaths, 0, `death at ${state.tick}`);
      if (state.event === 'checkpoint') {
        arrivals.push(state.tick);
        assert.equal(hazardTick(state), 0);
      }
      for (const h of world.hazards)
        assert.equal(hazardEnabled(world, h, state), !state.won && h.sectionId === world.sections[state.visited.length].id);
    }
    assert.equal(state.won, true);
    assert.equal(state.tick, ticks);
    assert.equal(arrivals.length, 7);
    if (ticks === 5752) assert.deepEqual(arrivals, [507, 1339, 1872, 2539, 3272, 4072, 4773]);
  }
});

test('Production all seven CPs recover from normalized saves, explicit restart and phase-preserving live deaths', t => {
  for (const [index, fixture] of CHECKPOINT_RECOVERIES.entries()) {
    const entry = runProduction(createState(world), fixture.prefix);
    assert.equal(entry.deaths, 0);
    const death = runProduction(entry, fixture.attempt);
    assert.equal(death.deaths, 1);
    assert.equal(death.respawnTicks, 54);
    let live = death;
    for (let n = 0; n < 54; n++) {
      live = step(world, live, c(1));
      assert.equal(live.patternOffset, entry.patternOffset);
    }
    assert.equal(live.tick, death.tick + 54);
    const durable = createCheckpointSnapshot(world, 'production-recovery', death).state;
    assert.deepEqual(durable, restartCheckpoint(world, death));
    assert.equal(hazardTick(durable), 0);
    assert.equal(durable.deaths, 1); assert.equal(durable.tick, death.tick);
    const a = productionRecovery(durable, index), b = productionRecovery(live, index);
    assert.deepEqual(runProduction(restartCheckpoint(world, death), a.commands), a.state);
    t.diagnostic(`CP${index + 1}: death=${death.tick}; restart/reload wait=${a.wait}, end=${a.state.tick}; live respawn wait=${b.wait}, end=${b.state.tick}`);
  }
});

test('Production actual ordinary active phases require the taught transfers and timing', () => {
  const entries = CHECKPOINT_RECOVERIES.map(f => runProduction(createState(world), f.prefix));
  for (const failure of OPENING_FAILURES) {
    const start = failure.section === 0 ? createState(world) : entries[0];
    const commands = failure.section === 0 ? failure.commands : failure.commands.slice(1);
    const death = runProduction(start, commands);
    assert.equal(death.deaths, 1, failure.name);
    assert.equal(death.deathCause, 'pulse');
    assert.equal(lethalAt(world, death.position, hazardTick(death), death), 'pulse');
  }
  for (const [failures, offset] of [[MIDDLE_FAILURES, 1], [COMBINED_FAILURES, 3], [FINALE_FAILURES, 5]] as const)
    for (const f of failures.filter(f => f.incoming === 'ordinary')) {
      const death = runProduction(entries[offset + f.section], f.commands);
      assert.equal(death.deaths, 1, f.name);
      assert.equal(death.tick, f.tick, f.name);
      assert.equal(death.deathCause, f.cause, f.name);
      assert.equal(lethalAt(world, death.position, hazardTick(death), death), f.cause);
    }
});

test('Production measures initial legal delay margins at every actual in-field ordinary decision', t => {
  const entries = [createState(world), ...CHECKPOINT_RECOVERIES.map(f => runProduction(createState(world), f.prefix))];
  const routes = [OPENING_ROUTES[0].ordinary, ...CHECKPOINT_RECOVERIES.map(f => f.route)];
  for (const [section, route] of routes.entries()) {
    const margins: number[] = [];
    for (let at = 0; at < route.length; at++) {
      const start = runProduction(entries[section], route.slice(0, at));
      let margin = -1;
      for (let delay = 0; delay <= 40; delay++) {
        const end = runProduction(start, [c(delay), ...route.slice(at)]);
        if (end.deaths || (section === 7 ? !end.won : end.visited.length !== section + 1)) break;
        margin = delay;
      }
      assert.ok(margin >= 12, `section ${section + 1}, decision ${at}: ${margin}`);
      margins.push(margin);
    }
    t.diagnostic(`section ${section + 1}: inclusive initial delay margins ${JSON.stringify(margins)} (search capped at 40)`);
  }
});

test('Checkpoint editor creates owned pulses and saws with validated JSON roundtrip', () => {
  const pulse = paint(world, { x: 3, y: 3 }, 'pulse');
  assert.equal(pulse.hazards.at(-1)?.sectionId, world.sections[0].id);
  const saw = placeSaw(pulse, { x: 46, y: 1 }, { x: 46, y: 5 });
  assert.equal(saw.hazards.at(-1)?.sectionId, world.sections[2].id);
  assert.deepEqual(parseLevel(JSON.parse(JSON.stringify(saw))), saw);
});

test('Dormant pulse at phase zero has no fake blast, warning, glow or debris', () => {
  const view = createPulse();
  const pulse = { kind: 'pulse' as const, x: 3, y: 3, period: 480, phase: 0, on: 1 };
  updatePulse(view, pulse, 0, false, false);
  assert.equal(view.burst.visible, false);
  assert.equal(view.warning.visible, false);
  assert.equal(view.tint.material.opacity, 0, 'no charge glow');
  assert.equal(view.frame.visible, true, 'the pad is still identifiable');
});

test('Production sound ignores dormant hazards and clock resets', () => {
  const state = createState(world);
  const h = world.hazards.find(h => h.kind === 'pulse' && h.sectionId === world.sections[1].id)!;
  assert.ok(h && h.kind === 'pulse');
  const tick = h.period - h.phase;
  assert.equal(localBlast(world, { x: h.x + .5, y: h.y + .5 }, tick - 1, tick, state), false);
  assert.equal(localBlast(world, state.position, 506, 0, state), false);
});
