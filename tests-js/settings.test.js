import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {normalizeSettings, SettingsStore} from '../src/core/settings.js';

test('persists only compact user settings', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cqo-settings-'));
  try {
    const file = path.join(root, 'settings.json');
    const settings = new SettingsStore(file);
    settings.update({
      placement: {y: -4},
      telemetryEnabled: false,
      overlayMode: 'insight',
      overlayTheme: 'light',
      history: {enabled: true, retentionDays: 14},
      alerts: {enabled: true, threshold: 30}
    });
    settings.update({placement: {x: 8}});
    const reloaded = new SettingsStore(file).get();
    assert.deepEqual(reloaded.placement, {x: 8, y: -4});
    assert.equal(reloaded.telemetryEnabled, false);
    assert.equal(reloaded.overlayMode, 'insight');
    assert.equal(reloaded.overlayTheme, 'light');
    assert.deepEqual(reloaded.history, {enabled: true, retentionDays: 14});
    assert.deepEqual(reloaded.alerts, {enabled: true, threshold: 30, paceRisk: true});
  } finally {
    fs.rmSync(root, {recursive: true, force: true});
  }
});

test('normalizes corrupted or unknown settings to a safe schema', () => {
  const normalized = normalizeSettings({
    schemaVersion: 999,
    placement: {x: 900, y: 'bad'},
    overlayMode: 'giant',
    overlayTheme: 'invalid',
    history: {enabled: 'yes', retentionDays: 365},
    alerts: {enabled: true, threshold: 99, paceRisk: false},
    codexCliPath: 123,
    unknownSecret: 'discard me'
  });
  assert.equal(normalized.schemaVersion, 2);
  assert.deepEqual(normalized.placement, {x: 80, y: 0});
  assert.equal(normalized.overlayMode, 'balanced');
  assert.equal(normalized.overlayTheme, 'dark');
  assert.deepEqual(normalized.history, {enabled: false, retentionDays: 30});
  assert.deepEqual(normalized.alerts, {enabled: true, threshold: 20, paceRisk: false});
  assert.equal(normalized.codexCliPath, null);
  assert.equal('unknownSecret' in normalized, false);
});
