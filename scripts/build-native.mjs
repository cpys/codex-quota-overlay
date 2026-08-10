import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = path.join(root, 'build', 'native');
fs.mkdirSync(outputRoot, {recursive: true});

if (process.platform === 'win32') {
  const compilerCandidates = [
    path.join(process.env.WINDIR || 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe'),
    path.join(process.env.WINDIR || 'C:\\Windows', 'Microsoft.NET', 'Framework', 'v4.0.30319', 'csc.exe')
  ];
  const compiler = compilerCandidates.find(fs.existsSync);
  if (!compiler) throw new Error('C# compiler not found');
  const outputDirectory = path.join(outputRoot, 'windows');
  fs.mkdirSync(outputDirectory, {recursive: true});
  run(compiler, [
    '/nologo',
    '/optimize+',
    '/target:exe',
    `/out:${path.join(outputDirectory, 'active-window-helper.exe')}`,
    path.join(root, 'native', 'windows', 'ActiveWindowHelper.cs')
  ]);
} else if (process.platform === 'darwin') {
  const outputDirectory = path.join(outputRoot, 'macos');
  fs.mkdirSync(outputDirectory, {recursive: true});
  const source = path.join(root, 'native', 'macos', 'ActiveWindowHelper.swift');
  const x64 = path.join(outputDirectory, 'active-window-helper-x64');
  const arm64 = path.join(outputDirectory, 'active-window-helper-arm64');
  const universal = path.join(outputDirectory, 'active-window-helper');
  const common = ['-O', '-framework', 'Cocoa', '-framework', 'CoreGraphics', source];
  run('xcrun', ['swiftc', '-target', 'x86_64-apple-macos11', ...common, '-o', x64]);
  run('xcrun', ['swiftc', '-target', 'arm64-apple-macos11', ...common, '-o', arm64]);
  run('lipo', ['-create', x64, arm64, '-output', universal]);
  fs.chmodSync(universal, 0o755);
  run('codesign', ['--force', '--sign', '-', universal]);
  fs.rmSync(x64, {force: true});
  fs.rmSync(arm64, {force: true});
} else {
  throw new Error('Codex Quota Overlay supports native builds on Windows and macOS only.');
}

function run(command, args) {
  const result = spawnSync(command, args, {cwd: root, stdio: 'inherit', windowsHide: true});
  if (result.status !== 0) throw new Error(`${command} failed with exit code ${result.status}`);
}
