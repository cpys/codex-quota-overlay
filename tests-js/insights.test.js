import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateQuotaInsights} from '../src/core/insights.js';

const now = Date.parse('2026-08-23T12:00:00Z');
const resetsAt = (now + 4 * 3600000) / 1000;

test('detects a pace that will exhaust quota before reset', () => {
  const insights = calculateQuotaInsights(
    [
      {at: now - 30 * 60000, usedPercent: 20, resetsAt, limitId: 'codex'},
      {at: now - 15 * 60000, usedPercent: 25, resetsAt, limitId: 'codex'},
      {at: now, usedPercent: 35, resetsAt, limitId: 'codex'}
    ],
    {usedPercent: 35, resetsAt, limitId: 'codex'},
    now
  );
  assert.equal(insights.burnRatePerHour, 30);
  assert.equal(insights.safeRatePerHour, 16.25);
  assert.equal(insights.status, 'risk');
  assert.ok(insights.exhaustsAt < resetsAt * 1000);
  assert.equal(insights.confidence, 'medium');
});

test('reports on-track, steady, and learning states defensively', () => {
  const onTrack = calculateQuotaInsights(
    [
      {at: now - 60 * 60000, usedPercent: 10, resetsAt, limitId: 'codex'},
      {at: now, usedPercent: 15, resetsAt, limitId: 'codex'}
    ],
    {usedPercent: 15, resetsAt, limitId: 'codex'},
    now
  );
  assert.equal(onTrack.burnRatePerHour, 5);
  assert.equal(onTrack.status, 'on-track');

  const steady = calculateQuotaInsights(
    [
      {at: now - 10 * 60000, usedPercent: 15, resetsAt, limitId: 'codex'},
      {at: now, usedPercent: 15, resetsAt, limitId: 'codex'}
    ],
    {usedPercent: 15, resetsAt, limitId: 'codex'},
    now
  );
  assert.equal(steady.status, 'steady');
  assert.equal(steady.exhaustsAt, null);

  const learning = calculateQuotaInsights([], {usedPercent: 15, resetsAt, limitId: 'codex'}, now);
  assert.equal(learning.status, 'learning');
  assert.equal(learning.confidence, 'none');
});

test('starts a new trend segment after quota drops within a reset window', () => {
  const insights = calculateQuotaInsights(
    [
      {at: now - 30 * 60000, usedPercent: 80, resetsAt, limitId: 'codex'},
      {at: now - 20 * 60000, usedPercent: 10, resetsAt, limitId: 'codex'},
      {at: now, usedPercent: 20, resetsAt, limitId: 'codex'}
    ],
    {usedPercent: 20, resetsAt, limitId: 'codex'},
    now
  );
  assert.equal(insights.burnRatePerHour, 30);
  assert.equal(insights.sampleCount, 2);
});
