import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {normalizeSample, QuotaHistoryStore} from '../src/core/history.js';

test('keeps session history in memory until persistence is explicitly enabled', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cqo-history-'));
  let now = Date.parse('2026-08-23T12:00:00Z');
  const file = path.join(root, 'quota-history.json');
  try {
    const history = new QuotaHistoryStore(file, {enabled: false, retentionDays: 30, now: () => now});
    const snapshot = {limitId: 'codex', resetsAt: 1900000000, usedPercent: 10, windowDurationMins: 300};
    assert.equal(history.record(snapshot), true);
    now += 30_000;
    assert.equal(history.record({...snapshot, usedPercent: 11}), false);
    now += 90_000;
    assert.equal(history.record({...snapshot, usedPercent: 11}), true);
    assert.equal(fs.existsSync(file), false);
    history.setEnabled(true);
    assert.equal(fs.existsSync(file), true);
    assert.equal(new QuotaHistoryStore(file, {enabled: true, now: () => now}).getSamples().length, 2);
    history.clear();
    assert.equal(fs.existsSync(file), false);
  } finally {
    fs.rmSync(root, {recursive: true, force: true});
  }
});

test('records unchanged checkpoints sparsely and prunes by retention', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cqo-history-prune-'));
  let now = Date.parse('2026-08-23T12:00:00Z');
  try {
    const history = new QuotaHistoryStore(path.join(root, 'history.json'), {
      enabled: true,
      retentionDays: 7,
      now: () => now
    });
    const snapshot = {limitId: 'codex', resetsAt: 1900000000, usedPercent: 20};
    history.record(snapshot, now - 8 * 86400000);
    history.record(snapshot, now);
    now += 2 * 60000;
    assert.equal(history.record(snapshot), false);
    now += 4 * 60000;
    assert.equal(history.record(snapshot), true);
    history.setRetentionDays(14);
    assert.deepEqual(history.status, {enabled: true, retentionDays: 14, sampleCount: 2});
  } finally {
    fs.rmSync(root, {recursive: true, force: true});
  }
});

test('normalizes history samples without retaining arbitrary fields', () => {
  assert.deepEqual(
    normalizeSample({
      at: 1700000000000,
      limitId: 'codex/<secret>',
      resetsAt: '1800000000',
      usedPercent: 140,
      windowDurationMins: 60.9,
      account: 'discard'
    }),
    {
      at: 1700000000000,
      limitId: 'codexsecret',
      resetsAt: 1800000000,
      usedPercent: 100,
      windowDurationMins: 60
    }
  );
  assert.equal(normalizeSample({at: 0, usedPercent: 'bad'}), null);
});
