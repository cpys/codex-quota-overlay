import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {SettingsStore} from '../src/core/settings.js';

test('persists only compact user settings', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cqo-settings-'));
  try {
    const file = path.join(root, 'settings.json');
    const settings = new SettingsStore(file);
    settings.update({placement: {y: -4}, telemetryEnabled: false});
    settings.update({placement: {x: 8}});
    const reloaded = new SettingsStore(file).get();
    assert.deepEqual(reloaded.placement, {x: 8, y: -4});
    assert.equal(reloaded.telemetryEnabled, false);
  } finally {
    fs.rmSync(root, {recursive: true, force: true});
  }
});
