import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {writeFailureLog} from '../src/core/failure-log.js';

test('logs only allowlisted categories, rotates bounded files, and tolerates disk failures', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'quota-log-'));
  try {
    const file = path.join(root, 'errors.jsonl');
    writeFailureLog(file, {code: 'E04', detail: 'timeout', token: 'private'});
    writeFailureLog(file, {code: 'private', detail: 'https://secret/token email@example.com'});
    const rows = fs.readFileSync(file, 'utf8').trim().split('\n').map(JSON.parse);
    assert.deepEqual(Object.keys(rows[0]), ['at', 'code', 'reason']);
    assert.equal(rows[0].reason, 'timeout');
    assert.equal(rows[1].reason, 'unspecified');
    assert.equal(rows[1].code, 'E04');
    fs.writeFileSync(file, 'x'.repeat(65536));
    writeFailureLog(file, {code: 'E04', detail: 'transport'});
    assert.equal(fs.statSync(file + '.1').size, 65536);
    assert.ok(fs.statSync(file).size < 200);
    assert.doesNotThrow(() => writeFailureLog(path.join(file, 'impossible'), {code: 'E04'}));
  } finally {
    fs.rmSync(root, {recursive: true, force: true});
  }
});
