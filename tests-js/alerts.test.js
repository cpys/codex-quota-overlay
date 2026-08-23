import test from 'node:test';
import assert from 'node:assert/strict';
import {QuotaAlertTracker} from '../src/core/alerts.js';

test('emits threshold and pace alerts only once per quota cycle', () => {
  const tracker = new QuotaAlertTracker();
  const settings = {enabled: true, threshold: 20, paceRisk: true};
  const snapshot = {limitId: 'codex', resetsAt: 1900000000, usedPercent: 82};
  assert.deepEqual(tracker.evaluate(snapshot, {status: 'on-track'}, settings), [
    {kind: 'threshold', remaining: 18, threshold: 20}
  ]);
  assert.deepEqual(tracker.evaluate(snapshot, {status: 'on-track'}, settings), []);

  const newCycle = {...snapshot, resetsAt: 1900003600, usedPercent: 40};
  const risk = {status: 'risk', confidence: 'medium', exhaustsAt: 1800000000000};
  assert.equal(tracker.evaluate(newCycle, risk, settings)[0].kind, 'pace-risk');
  assert.deepEqual(tracker.evaluate(newCycle, risk, settings), []);
  tracker.reset();
  assert.equal(tracker.evaluate(newCycle, risk, settings)[0].kind, 'pace-risk');
});

test('does not emit alerts unless enabled or based on an unlearned forecast', () => {
  const tracker = new QuotaAlertTracker();
  const snapshot = {limitId: 'codex', resetsAt: 1, usedPercent: 95};
  assert.deepEqual(tracker.evaluate(snapshot, {status: 'risk', confidence: 'none'}, {enabled: false}), []);
  assert.deepEqual(
    tracker.evaluate(snapshot, {status: 'risk', confidence: 'none'}, {enabled: true, threshold: 10}),
    [{kind: 'threshold', remaining: 5, threshold: 10}]
  );
});
