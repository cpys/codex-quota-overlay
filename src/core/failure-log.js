import fs from 'node:fs';
import path from 'node:path';

// Only fixed categories are persisted; never serialize server errors or stderr.
export function writeFailureLog(file, failure) {
  try {
    const code = ['E01', 'E02', 'E03', 'E04', 'E05'].includes(failure.code) ? failure.code : 'E04';
    const reason = ['timeout', 'transport', 'rpc-error', 'invalid-response'].includes(failure.detail)
      ? failure.detail
      : 'unspecified';
    fs.mkdirSync(path.dirname(file), {recursive: true});
    if (fs.existsSync(file) && fs.statSync(file).size >= 64 * 1024) {
      fs.rmSync(`${file}.1`, {force: true});
      fs.renameSync(file, `${file}.1`);
    }
    fs.appendFileSync(file, `${JSON.stringify({at: new Date().toISOString(), code, reason})}\n`, {
      encoding: 'utf8',
      mode: 0o600
    });
  } catch {
    // A full or read-only disk must not interrupt quota recovery.
  }
}
