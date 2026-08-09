import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

export function findCodexExecutable({platform = process.platform, env = process.env, home = os.homedir(), configuredPath = null} = {}) {
  if (isExecutableFile(configuredPath)) return configuredPath;
  const explicit = env.CODEX_CLI_PATH;
  if (isExecutableFile(explicit)) return explicit;

  const candidates = [];
  if (platform === 'win32') {
    const local = env.LOCALAPPDATA;
    if (local) {
      const root = path.join(local, 'OpenAI', 'Codex', 'bin');
      try {
        const versions = fs.readdirSync(root, {withFileTypes: true})
          .filter(entry => entry.isDirectory())
          .map(entry => path.join(root, entry.name, 'codex.exe'))
          .filter(isExecutableFile)
          .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
        candidates.push(...versions);
      } catch {
        // The desktop runtime is optional when a PATH installation exists.
      }
    }
    candidates.push(...commandLookup('where.exe', ['codex.exe']));
  } else {
    if (platform === 'darwin') {
      candidates.push(
        '/Applications/Codex.app/Contents/Resources/codex',
        '/Applications/Codex.app/Contents/Resources/bin/codex',
        path.join(home, 'Applications', 'Codex.app', 'Contents', 'Resources', 'codex'),
        '/opt/homebrew/bin/codex',
        '/usr/local/bin/codex',
        path.join(home, '.npm-global', 'bin', 'codex'),
        path.join(home, 'Library', 'pnpm', 'codex')
      );
      candidates.push(...versionedCandidates(path.join(home, 'Library', 'Application Support', 'OpenAI', 'Codex', 'bin'), 'codex'));
      candidates.push(...versionedCandidates(path.join(home, 'Library', 'Application Support', 'Codex', 'bin'), 'codex'));
    }
    candidates.push(path.join(home, '.local', 'bin', 'codex'));
    candidates.push(...commandLookup('which', ['codex'], env));
  }
  return candidates.find(isExecutableFile) ?? null;
}

function versionedCandidates(root, executableName) {
  try {
    return fs.readdirSync(root, {withFileTypes: true})
      .filter(entry => entry.isDirectory())
      .map(entry => path.join(root, entry.name, executableName))
      .filter(isExecutableFile)
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  } catch {
    return [];
  }
}

function commandLookup(command, args, env = process.env) {
  try {
    const result = spawnSync(command, args, {encoding: 'utf8', windowsHide: true, env});
    if (result.status !== 0) return [];
    return result.stdout.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function isExecutableFile(value) {
  if (!value) return false;
  try {
    return fs.statSync(value).isFile();
  } catch {
    return false;
  }
}
