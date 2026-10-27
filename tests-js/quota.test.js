import test from 'node:test';
import assert from 'node:assert/strict';
import {formatCountdown, parseQuotaResult, quotaView} from '../src/core/quota.js';

test('stale quota keeps the last percentage and explicitly marks its timestamp', () => {
  const snapshot = parseQuotaResult({rateLimits: {primary: {usedPercent: 25, resetsAt: 1900000000}}});
  const updatedAt = Date.now() - 60000;
  for (const locale of ['zh-CN', 'en-US']) {
    const view = quotaView(snapshot, locale, new Date(), {mode: 'compact', stale: true, updatedAt});
    assert.equal(view.remaining, 75);
    assert.equal(view.status, 'stale');
    assert.match(view.text, locale === 'zh-CN' ? /更新失败 · 上次/ : /Update failed · last/);
    assert.match(
      view.text,
      new RegExp(
        new Intl.DateTimeFormat(locale, {hour: '2-digit', minute: '2-digit', hour12: false}).format(updatedAt)
      )
    );
    assert.notEqual(quotaView(snapshot, locale).status, 'stale');
  }
});

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
  assert.match(view.text, /^剩余 62% {2}· {2}/);
  assert.match(view.text, /Reset ×2/);
  assert.match(view.text, /另 1 张到期时间未知/);
  assert.equal(view.accent, '#4dd18d');
});

test('rejects a response without primary quota data', () => {
  assert.equal(parseQuotaResult({rateLimits: {}}), null);
});

test('parses multi-bucket and secondary quota windows from the current protocol', () => {
  const snapshot = parseQuotaResult({
    rateLimits: {
      limitId: 'codex',
      primary: {usedPercent: 12, resetsAt: 1760000000, windowDurationMins: 300},
      secondary: {usedPercent: 44, resetsAt: 1760500000, windowDurationMins: 10080}
    },
    rateLimitsByLimitId: {
      codex: {
        limitId: 'codex',
        primary: {usedPercent: 12, resetsAt: 1760000000, windowDurationMins: 300}
      },
      codex_other: {
        limitName: 'Other',
        primary: {usedPercent: 61, resetsAt: 1760100000, windowDurationMins: 60}
      }
    }
  });
  assert.equal(snapshot.buckets.length, 2);
  assert.equal(snapshot.buckets[0].windows.length, 2);
  assert.equal(snapshot.buckets[1].limitId, 'codex_other');
  assert.equal(snapshot.windowDurationMins, 300);
});

test('renders compact and insight overlay modes', () => {
  const now = new Date('2025-10-09T00:00:00Z');
  const snapshot = {usedPercent: 36, resetsAt: now.getTime() / 1000 + 3900, resetCount: 0, resetCards: []};
  const compact = quotaView(snapshot, 'en-US', now, {mode: 'compact'});
  assert.match(compact.text, /^64% left {2}· {2}Reset in 1h 5m$/);
  const insight = quotaView(snapshot, 'zh-CN', now, {
    mode: 'insight',
    insights: {burnRatePerHour: 12.45, status: 'risk', exhaustsAt: now.getTime() + 3600000}
  });
  assert.match(insight.text, /消耗 12%\/时/);
  assert.match(insight.text, /预计 \d{2}:\d{2} 用尽/);
  assert.equal(insight.accent, '#ff8a65');
  assert.equal(formatCountdown(0, 'zh-CN', now), '重置未知');
});
