import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyTarget} from '../src/core/target-window.js';

const bounds = {x: 10, y: 20, width: 1400, height: 900};

test('matches the Windows Codex desktop runtime but not arbitrary ChatGPT names', () => {
  assert.equal(
    classifyTarget(
      {bounds, owner: {name: 'ChatGPT', path: 'C:\\Users\\u\\AppData\\Local\\OpenAI\\Codex\\ChatGPT.exe'}},
      'win32'
    ).matched,
    true
  );
  assert.equal(
    classifyTarget(
      {
        bounds,
        owner: {
          name: 'ChatGPT',
          path: 'C:\\Program Files\\WindowsApps\\OpenAI.Codex_26.8.0_x64__id\\app\\ChatGPT.exe'
        }
      },
      'win32'
    ).matched,
    true
  );
  assert.equal(
    classifyTarget({bounds, owner: {name: 'ChatGPT', path: 'C:\\Other\\ChatGPT.exe'}}, 'win32').matched,
    false
  );
  assert.equal(
    classifyTarget({bounds, owner: {name: 'Codex', path: 'C:\\Unrelated\\Codex\\tool.exe'}}, 'win32').matched,
    false
  );
});

test('matches macOS without reading a conversation title', () => {
  const result = classifyTarget(
    {title: '', bounds, owner: {name: 'Codex', bundleId: 'com.openai.codex'}},
    'darwin'
  );
  assert.equal(result.matched, true);
});

test('rejects unsupported platforms', () => {
  assert.equal(classifyTarget({bounds, owner: {name: 'Codex'}}, 'linux').matched, false);
});
