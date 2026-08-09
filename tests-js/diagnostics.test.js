import test from 'node:test';
import assert from 'node:assert/strict';
import {Diagnostics, sanitizeDetail} from '../src/core/diagnostics.js';

test('short diagnostics never expose local paths or long IDs', () => {
  const diagnostics = new Diagnostics('zh-CN');
  diagnostics.set('E02', 'C:\\Users\\Alice\\Secret\\codex.exe 0123456789abcdef0123456789abcdef');
  const result = diagnostics.short();
  assert.ok(result.length <= 200);
  assert.doesNotMatch(result, /Alice|Secret|0123456789abcdef/);
  assert.match(result, /^E02 \|/);
});

test('diagnostic detail is one short line', () => {
  assert.equal(sanitizeDetail('first\r\nsecond'), 'first second');
});
