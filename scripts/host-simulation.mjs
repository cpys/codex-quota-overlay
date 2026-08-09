import assert from 'node:assert/strict';
import {classifyTarget} from '../src/core/target-window.js';
import {placeOverlay} from '../src/core/placement.js';

const cases = [
  {
    name: 'Windows Codex at 150% display scale',
    platform: 'win32',
    window: {bounds: {x: 0, y: 0, width: 1280, height: 800}, owner: {name: 'ChatGPT', path: 'C:\\Users\\test\\AppData\\Local\\OpenAI\\Codex\\ChatGPT.exe'}}
  },
  {
    name: 'macOS Codex x64/arm64 identity without title permission',
    platform: 'darwin',
    window: {title: '', bounds: {x: 0, y: 25, width: 1512, height: 920}, owner: {name: 'Codex', bundleId: 'com.openai.codex'}}
  }
];

for (const testCase of cases) {
  const result = classifyTarget(testCase.window, testCase.platform, testCase.options);
  assert.equal(result.matched, true, testCase.name);
  const point = placeOverlay(testCase.window.bounds, {width: 560, height: 43});
  assert.ok(point.x >= testCase.window.bounds.x, testCase.name);
  assert.ok(point.y >= testCase.window.bounds.y, testCase.name);
  process.stdout.write(`PASS ${testCase.name}: ${point.x},${point.y}\n`);
}
