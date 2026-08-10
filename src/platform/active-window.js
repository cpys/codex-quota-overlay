import {spawn} from 'node:child_process';
import path from 'node:path';
import readline from 'node:readline';

export class ActiveWindowProvider {
  constructor({platform = process.platform, helperRoot}) {
    this.platform = platform;
    this.helperRoot = helperRoot;
    this.helper = null;
    this.current = undefined;
    this.lastStartAttempt = 0;
  }

  start() {
    if (this.helper || !['win32', 'darwin'].includes(this.platform)) return;
    if (Date.now() - this.lastStartAttempt < 5000) return;
    this.lastStartAttempt = Date.now();
    const executable =
      this.platform === 'win32'
        ? path.join(this.helperRoot, 'windows', 'active-window-helper.exe')
        : path.join(this.helperRoot, 'macos', 'active-window-helper');
    try {
      this.helper = spawn(executable, [], {stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true});
      const lines = readline.createInterface({input: this.helper.stdout, crlfDelay: Infinity});
      lines.on('line', (line) => {
        try {
          this.current = JSON.parse(line);
        } catch {
          // Ignore incomplete helper output without persisting it.
        }
      });
      this.helper.on('error', () => {
        this.helper = null;
        this.current = undefined;
      });
      this.helper.on('exit', () => {
        this.helper = null;
        this.current = undefined;
      });
    } catch {
      this.helper = null;
      this.current = undefined;
    }
  }

  async getActiveWindow() {
    if (!this.helper) this.start();
    return this.current;
  }

  stop() {
    this.helper?.kill();
    this.helper = null;
    this.current = undefined;
  }
}
