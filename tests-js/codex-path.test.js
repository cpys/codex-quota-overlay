import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {findCodexExecutable} from '../src/core/codex-path.js';

test('a manually configured CLI path wins on supported platforms', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cqo-cli-'));
  try {
    const executable = path.join(root, 'codex');
    fs.writeFileSync(executable, 'test');
    assert.equal(findCodexExecutable({platform: 'darwin', configuredPath: executable, home: root, env: {}}), executable);
  } finally {
    fs.rmSync(root, {recursive: true, force: true});
  }
});

test('discovers the newest macOS Codex desktop runtime', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'cqo-cli-mac-'));
  try {
    const directory = path.join(home, 'Library', 'Application Support', 'OpenAI', 'Codex', 'bin', 'current');
    fs.mkdirSync(directory, {recursive: true});
    const executable = path.join(directory, 'codex');
    fs.writeFileSync(executable, 'test');
    assert.equal(findCodexExecutable({platform: 'darwin', home, env: {}}), executable);
  } finally {
    fs.rmSync(home, {recursive: true, force: true});
  }
});

test('discovers the newest Windows Codex desktop runtime', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cqo-cli-win-'));
  try {
    const older = path.join(root, 'OpenAI', 'Codex', 'bin', 'old');
    const newer = path.join(root, 'OpenAI', 'Codex', 'bin', 'new');
    fs.mkdirSync(older, {recursive: true});
    fs.mkdirSync(newer, {recursive: true});
    fs.writeFileSync(path.join(older, 'codex.exe'), 'old');
    fs.writeFileSync(path.join(newer, 'codex.exe'), 'new');
    const now = new Date();
    fs.utimesSync(path.join(newer, 'codex.exe'), now, new Date(now.getTime() + 1000));
    const result = findCodexExecutable({platform: 'win32', env: {LOCALAPPDATA: root}, home: root});
    assert.equal(result, path.join(newer, 'codex.exe'));
  } finally {
    fs.rmSync(root, {recursive: true, force: true});
  }
});
