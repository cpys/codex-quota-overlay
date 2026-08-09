import {EventEmitter} from 'node:events';
import {spawn} from 'node:child_process';
import readline from 'node:readline';
import os from 'node:os';
import {parseQuotaResult} from './quota.js';

export class CodexRpcClient extends EventEmitter {
  constructor({executable, version, spawnProcess = spawn}) {
    super();
    this.executable = executable;
    this.version = version;
    this.spawnProcess = spawnProcess;
    this.process = null;
    this.initialized = false;
    this.nextRequestId = 10;
    this.pendingRateLimitIds = new Set();
    this.disposed = false;
  }

  get running() {
    return Boolean(this.process && this.process.exitCode === null && !this.disposed);
  }

  start() {
    if (this.running) return;
    this.disposed = false;
    try {
      this.process = this.spawnProcess(this.executable, ['app-server'], {
        cwd: os.homedir(),
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });
    } catch (error) {
      this.emit('failure', {code: 'E02', detail: error?.code ?? error?.name});
      return;
    }
    this.process.once('error', error => this.emit('failure', {code: 'E02', detail: error?.code ?? error?.name}));
    this.process.once('exit', () => {
      if (!this.disposed) this.emit('failure', {code: 'E05'});
    });
    this.process.stderr.resume();
    const lines = readline.createInterface({input: this.process.stdout, crlfDelay: Infinity});
    lines.on('line', line => this.#handleLine(line));
    this.#send({
      method: 'initialize',
      id: 0,
      params: {clientInfo: {name: 'codex_quota_overlay', title: 'Codex Quota Overlay', version: this.version}}
    });
  }

  requestRateLimits() {
    if (!this.initialized || !this.running) return false;
    const id = ++this.nextRequestId;
    this.pendingRateLimitIds.add(id);
    this.#send({method: 'account/rateLimits/read', id});
    return true;
  }

  stop() {
    this.disposed = true;
    this.initialized = false;
    this.pendingRateLimitIds.clear();
    if (this.process && this.process.exitCode === null) this.process.kill();
    this.process = null;
  }

  #handleLine(line) {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }
    if (message.id === 0) {
      if (message.error) {
        this.emit('failure', {code: 'E03'});
        return;
      }
      this.initialized = true;
      this.#send({method: 'initialized', params: {}});
      this.requestRateLimits();
      return;
    }
    if (message.method === 'account/rateLimits/updated') {
      this.requestRateLimits();
      return;
    }
    if (this.pendingRateLimitIds.has(message.id)) {
      this.pendingRateLimitIds.delete(message.id);
      if (message.error) {
        this.emit('failure', {code: 'E04'});
        return;
      }
      const snapshot = parseQuotaResult(message.result);
      if (snapshot) this.emit('quota', snapshot);
      else this.emit('failure', {code: 'E04', detail: 'invalid response'});
    }
  }

  #send(message) {
    try {
      this.process?.stdin.write(`${JSON.stringify(message)}\n`);
    } catch (error) {
      this.emit('failure', {code: 'E04', detail: error?.code ?? error?.name});
    }
  }
}
