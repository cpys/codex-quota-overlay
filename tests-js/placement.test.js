import test from 'node:test';
import assert from 'node:assert/strict';
import {physicalToDipBounds, placeOverlay} from '../src/core/placement.js';

test('places a one-line overlay beside the Codex title area', () => {
  const result = placeOverlay({x: 0, y: 0, width: 1600, height: 1000}, {width: 500, height: 43});
  assert.deepEqual(result, {x: 640, y: 52});
});

test('keeps a wide overlay within the right edge', () => {
  const result = placeOverlay({x: 100, y: 50, width: 1000, height: 700}, {width: 700, height: 43});
  assert.equal(result.x, 376);
  assert.equal(result.y, 83);
});

test('normalizes physical pixels for scaled Windows displays', () => {
  assert.deepEqual(
    physicalToDipBounds({x: 300, y: 150, width: 1800, height: 1200}, 'win32', 1.5),
    {x: 200, y: 100, width: 1200, height: 800}
  );
});
