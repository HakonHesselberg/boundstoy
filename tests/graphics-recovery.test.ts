import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GraphicsRecovery } from '../presentation/graphics-recovery.ts';

test('GraphicsRecovery_Loss_FreezesBeforeNotificationAndGatesUntilExplicitResume', () => {
  const events: string[] = [];
  const gate = new GraphicsRecovery(() => events.push('freeze'), () => {
    assert.equal(gate.available, false);
    events.push('unavailable');
  });
  assert.equal(gate.available, true);
  gate.lose(); gate.lose();
  assert.deepEqual(events, ['freeze', 'unavailable']);
  assert.equal(gate.resume(), false);
  gate.restore(() => {
    assert.equal(gate.available, false);
    assert.equal(gate.resume(), false);
    events.push('draw');
  });
  assert.equal(gate.available, true);
  assert.equal(gate.awaitingResume, true);
  assert.equal(gate.resume(), true);
  assert.equal(gate.awaitingResume, false);
  gate.restore(() => assert.fail('duplicate restoration'));
  gate.lose();
  assert.deepEqual(events, ['freeze', 'unavailable', 'draw', 'freeze', 'unavailable']);
});

test('GraphicsRecovery_RedrawFailure_KeepsGateClosedUntilReload', () => {
  const gate = new GraphicsRecovery(() => {}, () => {});
  gate.lose();
  assert.throws(() => gate.restore(() => { throw new Error('GPU failed'); }), /GPU failed/);
  assert.equal(gate.status, 'failed');
  assert.equal(gate.available, false);
  assert.equal(gate.resume(), false);
  gate.restore(() => assert.fail('failed recovery must not silently retry'));
});
