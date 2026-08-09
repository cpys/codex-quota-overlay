import test from 'node:test';
import assert from 'node:assert/strict';
import {parseQuotaResult, quotaView} from '../src/core/quota.js';

test('parses quota and available reset cards into one line', () => {
  const snapshot = parseQuotaResult({
    rateLimits: {primary: {usedPercent: 38.4, resetsAt: 1760000000}},
    rateLimitResetCredits: {
      availableCount: 2,
      credits: [
        {status: 'available', expiresAt: 1760100000, title: 'one'},
        {status: 'used', expiresAt: 1760200000, title: 'ignored'}
      ]
    }
  });
  assert.equal(snapshot.usedPercent, 38.4);
  assert.equal(snapshot.resetCards.length, 1);
  const view = quotaView(snapshot, 'zh-CN', new Date('2025-10-09T00:00:00+08:00'));
  assert.match(view.text, /^剩余 62%  ·  /);
  assert.match(view.text, /Reset ×2/);
  assert.match(view.text, /另 1 张到期时间未知/);
  assert.equal(view.accent, '#4dd18d');
});

test('rejects a response without primary quota data', () => {
  assert.equal(parseQuotaResult({rateLimits: {}}), null);
});
