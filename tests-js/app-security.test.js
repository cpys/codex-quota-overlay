import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('renderer is sandboxed and navigation is denied', () => {
  const source = read('src/main.js');
  assert.match(source, /contextIsolation:\s*true/);
  assert.match(source, /nodeIntegration:\s*false/);
  assert.match(source, /sandbox:\s*true/);
  assert.match(source, /setWindowOpenHandler\(\(\) => \(\{action: 'deny'\}\)\)/);
  assert.match(source, /will-navigate/);
});

test('renderer uses a restrictive content security policy', () => {
  const html = read('src/renderer/index.html');
  assert.match(html, /default-src 'none'/);
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /base-uri 'none'/);
  assert.match(html, /form-action 'none'/);
});

test('packaged self-test renders the real overlay before reporting success', () => {
  const source = read('src/main.js');
  assert.match(source, /await createOverlayWindow\(\)/);
  assert.match(source, /render\.width >= 140/);
  assert.match(source, /render\.height >= 32/);
});

test('packaging enables Electron integrity fuses', () => {
  const metadata = JSON.parse(read('package.json'));
  assert.equal(metadata.build.asar, true);
  assert.equal(metadata.build.electronFuses.runAsNode, false);
  assert.equal(metadata.build.electronFuses.enableEmbeddedAsarIntegrityValidation, true);
  assert.equal(metadata.build.electronFuses.onlyLoadAppFromAsar, true);
});

test('website download links match the release version', () => {
  const version = read('VERSION').trim();
  const siteSource = `${read('site/index.html')}\n${read('site/site.js')}`;
  const linkedVersions = [...siteSource.matchAll(/releases\/download\/v([0-9]+\.[0-9]+\.[0-9]+)/g)].map(
    (match) => match[1]
  );
  assert.ok(linkedVersions.length >= 3);
  assert.deepEqual(new Set(linkedVersions), new Set([version]));
});
