import test from 'node:test';
import assert from 'node:assert/strict';
import {validateHeartbeat} from '../src/index.js';

const valid = {
  schemaVersion: 1,
  event: 'daily_active',
  installationId: '12345678-1234-1234-1234-123456789abc',
  appVersion: '0.2.0',
  platform: 'windows',
  osVersion: '10.0.26200',
  locale: 'zh-CN',
  sentAt: '2026-08-09T15:00:00.000Z'
};

test('accepts only supported desktop platforms', () => {
  assert.equal(validateHeartbeat(valid), null);
  assert.equal(validateHeartbeat({...valid, platform: 'macos'}), null);
  assert.equal(validateHeartbeat({...valid, platform: 'linux'}), 'invalid platform');
});

test('rejects extra-sensitive values that do not fit the schema', () => {
  assert.equal(
    validateHeartbeat({...valid, installationId: 'account@example.com'}),
    'invalid installationId'
  );
});
