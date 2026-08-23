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
  for (const file of ['src/renderer/index.html', 'src/renderer/dashboard.html']) {
    const html = read(file);
    assert.match(html, /default-src 'none'/);
    assert.match(html, /connect-src 'none'/);
    assert.match(html, /base-uri 'none'/);
    assert.match(html, /form-action 'none'/);
  }
});

test('dashboard bridge is narrow and every main-process handler validates its sender', () => {
  const preload = read('src/dashboard-preload.cjs');
  const main = read('src/main.js');
  assert.match(preload, /dashboard:get-state/);
  assert.doesNotMatch(preload, /require\(['"](?:fs|child_process|path)/);
  assert.match(main, /function assertDashboardSender/);
  assert.match(main, /event\.sender !== dashboardWindow\.webContents/);
  assert.match(main, /event\.senderFrame\?\.url !== rendererUrl/);
  assert.match(main, /dashboardWindow\.webContents\.setWindowOpenHandler\(\(\) => \(\{action: 'deny'\}\)\)/);
});

test('quota history is opt-in and stores only normalized aggregate fields', () => {
  const settings = read('src/core/settings.js');
  const history = read('src/core/history.js');
  assert.match(settings, /history: Object\.freeze\(\{enabled: false/);
  assert.doesNotMatch(history, /account|conversation|prompt|response|token/i);
  assert.match(history, /limitId:/);
  assert.match(history, /usedPercent:/);
  assert.match(history, /resetsAt:/);
});

test('packaged self-test renders both real product surfaces before reporting success', () => {
  const source = read('src/main.js');
  assert.match(source, /await createOverlayWindow\(\)/);
  assert.match(source, /await createDashboardWindow\(\{show: false\}\)/);
  assert.match(source, /overlayRender\.width >= 140/);
  assert.match(source, /overlayRender\.height >= 32/);
  assert.match(source, /dashboardRender\.title === 'Codex Quota Center'/);
  assert.match(source, /dashboardRender\.bridgeVersion === VERSION/);
  assert.match(source, /dashboardRender\.sections >= 3/);
});

test('packaging enables Electron integrity fuses', () => {
  const metadata = JSON.parse(read('package.json'));
  assert.equal(metadata.build.asar, true);
  assert.equal(metadata.build.electronFuses.runAsNode, false);
  assert.equal(metadata.build.electronFuses.enableEmbeddedAsarIntegrityValidation, true);
  assert.equal(metadata.build.electronFuses.onlyLoadAppFromAsar, true);
});

test('Windows packaging falls back when the installed Electron runtime is absent', () => {
  const source = read('scripts/build-windows.mjs');
  assert.match(source, /existsSync\(electronExecutable\)/);
  assert.match(source, /--config\.electronDist=/);
  assert.match(source, /electron-builder will download it/);
});

test('website download links match the release version', () => {
  const version = read('VERSION').trim();
  const siteSource = `${read('site/index.html')}\n${read('site/site.js')}`;
  const linkedVersions = [...siteSource.matchAll(/releases\/download\/v([0-9]+\.[0-9]+\.[0-9]+)/g)].map(
    (match) => match[1]
  );
  assert.ok(linkedVersions.length >= 1);
  assert.deepEqual(new Set(linkedVersions), new Set([version]));
  assert.doesNotMatch(siteSource, /CodexQuotaOverlay-mac-/);
});

test('release workflow publishes stable Windows assets only after macOS compatibility validation', () => {
  const workflow = read('.github/workflows/release.yml');
  assert.match(workflow, /macos-validation:/);
  assert.match(workflow, /needs: \[windows, macos-validation\]/);
  assert.match(workflow, /prerelease: false/);
  assert.match(workflow, /make_latest: true/);
  assert.match(workflow, /name: windows-release\s+path: release-assets/);
  assert.doesNotMatch(workflow, /name: macos-release|SHA256SUMS-macOS/);
});

test('website Chinese copy covers every translatable element', () => {
  const html = read('site/index.html');
  const site = read('site/site.js');
  const keys = [...html.matchAll(/data-i18n="([a-zA-Z0-9]+)"/g)].map((match) => match[1]);
  assert.ok(keys.length >= 25);
  for (const key of new Set(keys)) {
    assert.match(site, new RegExp(`\\b${key}:`), `Missing zh-CN translation for ${key}`);
  }
});
