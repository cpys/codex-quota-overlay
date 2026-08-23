import test from 'node:test';
import assert from 'node:assert/strict';
import {parseUsageResult} from '../src/core/usage.js';

test('parses account activity summaries and ordered daily buckets', () => {
  const usage = parseUsageResult({
    summary: {
      lifetimeTokens: 1234567,
      peakDailyTokens: 45678,
      longestRunningTurnSec: 540,
      currentStreakDays: 8,
      longestStreakDays: 14
    },
    dailyUsageBuckets: [
      {startDate: '2026-08-22', tokens: 200},
      {startDate: 'invalid', tokens: 999},
      {startDate: '2026-08-21', tokens: 100}
    ]
  });
  assert.equal(usage.summary.currentStreakDays, 8);
  assert.deepEqual(usage.dailyUsageBuckets, [
    {startDate: '2026-08-21', tokens: 100},
    {startDate: '2026-08-22', tokens: 200}
  ]);
});

test('rejects empty usage responses and clamps unsafe values', () => {
  assert.equal(parseUsageResult({summary: {}, dailyUsageBuckets: []}), null);
  const usage = parseUsageResult({
    summary: {lifetimeTokens: Number.POSITIVE_INFINITY, currentStreakDays: 3.8}
  });
  assert.equal(usage.summary.lifetimeTokens, null);
  assert.equal(usage.summary.currentStreakDays, 3);
});
