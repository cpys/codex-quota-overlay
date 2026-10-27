import {EventEmitter} from 'node:events';
import {spawn} from 'node:child_process';
import readline from 'node:readline';
import os from 'node:os';
import {parseQuotaResult} from './quota.js';
import {parseUsageResult} from './usage.js';

function errorDetail(error) {
  if (error && typeof error === 'object' && 'code' in error) return String(error.code);
  return error instanceof Error ? error.name : undefined;
}

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
    this.pendingUsageIds = new Set();
    this.disposed = false;
    this.quotaTimer = null;
    this.retryTimer = null;
    this.retryAttempt = 0;
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
      this.emit('failure', {code: 'E02', detail: errorDetail(error)});
      return;
    }
    this.process.once('error', (error) => this.emit('failure', {code: 'E02', detail: errorDetail(error)}));
    this.process.once('exit', () => {
      clearTimeout(this.quotaTimer);
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
      this.pendingRateLimitIds.clear();
      if (!this.disposed) this.emit('failure', {code: 'E05'});
    });
    this.process.stderr.resume();
    this.process.stdin.on?.('error', () => {
      if (this.pendingRateLimitIds.size) this.#quotaFailed('transport');
    });
    const lines = readline.createInterface({input: this.process.stdout, crlfDelay: Infinity});
    lines.on('line', (line) => this.#handleLine(line));
    this.#send({
      method: 'initialize',
      id: 0,
      params: {clientInfo: {name: 'codex_quota_overlay', title: 'Codex Quota Overlay', version: this.version}}
    });
  }

  requestRateLimits() {
    if (this.pendingRateLimitIds.size || this.retryTimer) return false;
    this.retryAttempt = 0;
    return this.#readQuota();
  }

  #readQuota() {
    if (!this.initialized || !this.running) return false;
    const id = ++this.nextRequestId;
    this.pendingRateLimitIds.add(id);
    this.quotaTimer = setTimeout(() => this.#quotaFailed('timeout'), 15_000);
    this.quotaTimer.unref?.();
    this.#send({method: 'account/rateLimits/read', id});
    return true;
  }

  #quotaFailed(reason) {
    clearTimeout(this.quotaTimer);
    this.pendingRateLimitIds.clear();
    const delay = [2000, 5000][this.retryAttempt];
    if (delay && !this.disposed) {
      this.retryAttempt++;
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        this.#readQuota();
      }, delay);
      this.retryTimer.unref?.();
    }
    this.emit('failure', {code: 'E04', detail: reason});
  }

  requestUsage() {
    if (!this.initialized || !this.running) return false;
    const id = ++this.nextRequestId;
    this.pendingUsageIds.add(id);
    this.#send({method: 'account/usage/read', id});
    return true;
  }

  stop() {
    clearTimeout(this.quotaTimer);
    clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.disposed = true;
    this.initialized = false;
    this.pendingRateLimitIds.clear();
    this.pendingUsageIds.clear();
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
      this.requestUsage();
      return;
    }
    if (message.method === 'account/rateLimits/updated') {
      this.requestRateLimits();
      return;
    }
    if (this.pendingRateLimitIds.has(message.id)) {
      this.pendingRateLimitIds.delete(message.id);
      clearTimeout(this.quotaTimer);
      if (message.error) {
        this.#quotaFailed('rpc-error');
        return;
      }
      const snapshot = parseQuotaResult(message.result);
      if (snapshot) this.emit('quota', snapshot);
      else this.#quotaFailed('invalid-response');
      return;
    }
    if (this.pendingUsageIds.has(message.id)) {
      this.pendingUsageIds.delete(message.id);
      if (message.error) {
        this.emit('usage-unavailable');
        return;
      }
      const snapshot = parseUsageResult(message.result);
      if (snapshot) this.emit('usage', snapshot);
      else this.emit('usage-unavailable');
    }
  }

  #send(message) {
    try {
      this.process?.stdin.write(`${JSON.stringify(message)}\n`);
    } catch (_error) {
      if (this.pendingRateLimitIds.has(message.id)) this.#quotaFailed('transport');
      else this.emit('failure', {code: 'E04', detail: 'transport'});
    }
  }
}
