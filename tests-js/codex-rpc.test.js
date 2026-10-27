import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter, once} from 'node:events';
import {PassThrough} from 'node:stream';
import {CodexRpcClient} from '../src/core/codex-rpc.js';

class FakeProcess extends EventEmitter {
  constructor() {
    super();
    this.exitCode = null;
    this.stdout = new PassThrough();
    this.stderr = new PassThrough();
    this.messages = [];
    this.stdin = {write: (line) => this.messages.push(JSON.parse(line))};
  }

  kill() {
    this.exitCode = 0;
  }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

test('quota failures retry twice, ignore late replies, and cancel retries on stop', (t) => {
  t.mock.timers.enable({apis: ['setTimeout']});
  const process = new FakeProcess();
  const client = new CodexRpcClient({executable: 'codex', version: 'test', spawnProcess: () => process});
  const failures = [];
  const quotas = [];
  client.on('failure', (failure) => failures.push(failure));
  client.on('quota', (quota) => quotas.push(quota));
  client.start();
  process.stdout.write('{"id":0,"result":{}}\n');
  const reads = () => process.messages.filter((message) => message.method === 'account/rateLimits/read');
  assert.equal(reads().length, 1);
  assert.equal(client.requestRateLimits(), false);
  t.mock.timers.tick(15000);
  assert.equal(failures[0].detail, 'timeout');
  process.stdout.write(
    JSON.stringify({id: reads()[0].id, result: {rateLimits: {primary: {usedPercent: 1}}}}) + '\n'
  );
  assert.equal(quotas.length, 0);
  t.mock.timers.tick(2000);
  assert.equal(reads().length, 2);
  process.stdout.write(JSON.stringify({id: reads()[1].id, error: {message: 'secret'}}) + '\n');
  t.mock.timers.tick(5000);
  assert.equal(reads().length, 3);
  process.stdout.write(JSON.stringify({id: reads()[2].id, result: {}}) + '\n');
  t.mock.timers.tick(30000);
  assert.equal(reads().length, 3);
  assert.equal(failures.length, 3);
  assert.equal(client.requestRateLimits(), true);
  process.stdout.write(JSON.stringify({id: reads()[3].id, error: {}}) + '\n');
  client.stop();
  t.mock.timers.tick(30000);
  assert.equal(reads().length, 4);
});

test('successful retry restores quota and does not issue another retry', (t) => {
  t.mock.timers.enable({apis: ['setTimeout']});
  const process = new FakeProcess();
  const client = new CodexRpcClient({executable: 'codex', version: 'test', spawnProcess: () => process});
  client.start();
  process.stdout.write('{"id":0,"result":{}}\n');
  process.stdout.write('{"id":11,"error":{}}\n');
  t.mock.timers.tick(2000);
  let result;
  client.on('quota', (value) => {
    result = value;
  });
  process.stdout.write('{"id":13,"result":{"rateLimits":{"primary":{"usedPercent":25}}}}\n');
  assert.equal(result.usedPercent, 25);
  const count = process.messages.length;
  t.mock.timers.tick(30000);
  assert.equal(process.messages.length, count);
  client.stop();
});

test('initializes the app server and reads quota plus account activity', async () => {
  const process = new FakeProcess();
  const client = new CodexRpcClient({executable: 'codex', version: 'test', spawnProcess: () => process});
  assert.equal(client.requestRateLimits(), false);
  assert.equal(client.requestUsage(), false);
  client.start();
  client.start();
  assert.equal(process.messages[0].method, 'initialize');
  process.stdout.write('not-json\n');
  process.stdout.write(`${JSON.stringify({id: 0, result: {}})}\n`);
  await flush();
  const quotaRequest = process.messages.find((message) => message.method === 'account/rateLimits/read');
  const usageRequest = process.messages.find((message) => message.method === 'account/usage/read');
  assert.ok(quotaRequest);
  assert.ok(usageRequest);

  const quotaPromise = once(client, 'quota');
  process.stdout.write(
    `${JSON.stringify({
      id: quotaRequest.id,
      result: {rateLimits: {primary: {usedPercent: 25, resetsAt: 1900000000}}}
    })}\n`
  );
  const [quota] = await quotaPromise;
  assert.equal(quota.usedPercent, 25);

  const usagePromise = once(client, 'usage');
  process.stdout.write(
    `${JSON.stringify({
      id: usageRequest.id,
      result: {summary: {currentStreakDays: 4}, dailyUsageBuckets: []}
    })}\n`
  );
  const [usage] = await usagePromise;
  assert.equal(usage.summary.currentStreakDays, 4);

  process.stdout.write(`${JSON.stringify({method: 'account/rateLimits/updated', params: {}})}\n`);
  await flush();
  assert.equal(process.messages.filter((message) => message.method === 'account/rateLimits/read').length, 2);
  client.stop();
  assert.equal(client.running, false);
});

test('reports initialization, read, and optional usage failures separately', async () => {
  const initProcess = new FakeProcess();
  const initClient = new CodexRpcClient({
    executable: 'codex',
    version: 'test',
    spawnProcess: () => initProcess
  });
  const initFailure = once(initClient, 'failure');
  initClient.start();
  initProcess.stdout.write(`${JSON.stringify({id: 0, error: {message: 'no'}})}\n`);
  assert.equal((await initFailure)[0].code, 'E03');
  initClient.stop();

  const process = new FakeProcess();
  const client = new CodexRpcClient({executable: 'codex', version: 'test', spawnProcess: () => process});
  client.start();
  process.stdout.write(`${JSON.stringify({id: 0, result: {}})}\n`);
  await flush();
  const quotaRequest = process.messages.find((message) => message.method === 'account/rateLimits/read');
  const usageRequest = process.messages.find((message) => message.method === 'account/usage/read');
  const readFailure = once(client, 'failure');
  process.stdout.write(`${JSON.stringify({id: quotaRequest.id, error: {}})}\n`);
  assert.equal((await readFailure)[0].code, 'E04');
  const unavailable = once(client, 'usage-unavailable');
  process.stdout.write(`${JSON.stringify({id: usageRequest.id, error: {}})}\n`);
  await unavailable;
  client.stop();
});

test('reports process start and unexpected exit failures', async () => {
  const failed = new CodexRpcClient({
    executable: 'codex',
    version: 'test',
    spawnProcess: () => {
      const error = new Error('spawn');
      error.code = 'ENOENT';
      throw error;
    }
  });
  const startFailure = once(failed, 'failure');
  failed.start();
  assert.deepEqual(await startFailure, [{code: 'E02', detail: 'ENOENT'}]);

  const process = new FakeProcess();
  const client = new CodexRpcClient({executable: 'codex', version: 'test', spawnProcess: () => process});
  client.start();
  const exitFailure = once(client, 'failure');
  process.emit('exit', 1);
  assert.equal((await exitFailure)[0].code, 'E05');
  client.stop();
});
