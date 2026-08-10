import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('Windows helper exposes bounds without reading window titles', () => {
  const source = fs.readFileSync(new URL('../native/windows/ActiveWindowHelper.cs', import.meta.url), 'utf8');
  assert.match(source, /GetForegroundWindow/);
  assert.match(source, /GetWindowRect/);
  assert.match(source, /Local\\\\CodexQuotaOverlay/);
  assert.doesNotMatch(source, /GetWindowText/);
});

test('macOS helper is title-free and built as a universal executable', () => {
  const helper = fs.readFileSync(
    new URL('../native/macos/ActiveWindowHelper.swift', import.meta.url),
    'utf8'
  );
  const build = fs.readFileSync(new URL('../scripts/build-native.mjs', import.meta.url), 'utf8');
  assert.match(helper, /frontmostApplication/);
  assert.match(helper, /bundleIdentifier/);
  assert.doesNotMatch(helper, /kCGWindowName|CGWindowListCreateImage/);
  assert.match(build, /x86_64-apple-macos11/);
  assert.match(build, /arm64-apple-macos11/);
  assert.match(build, /lipo/);
  assert.match(build, /codesign/);
});
