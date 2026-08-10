import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const electronDist = path.join(root, 'node_modules', 'electron', 'dist');
const electronExecutable = path.join(electronDist, 'electron.exe');
const builderCli = path.join(root, 'node_modules', 'electron-builder', 'out', 'cli', 'cli.js');
const args = [builderCli, '--win', 'dir', '--x64', '--publish', 'never'];

if (existsSync(electronExecutable)) {
  args.push(`--config.electronDist=${electronDist}`);
  console.log(`Reusing the installed Electron runtime from ${electronDist}.`);
} else {
  console.log('The installed Electron runtime is absent; electron-builder will download it.');
}

const result = spawnSync(process.execPath, args, {
  cwd: root,
  env: process.env,
  stdio: 'inherit'
});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
