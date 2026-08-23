import fs from 'node:fs';
import path from 'node:path';

const MINIMUM_SAMPLE_INTERVAL_MS = 60_000;
const UNCHANGED_SAMPLE_INTERVAL_MS = 5 * 60_000;
const MAXIMUM_SAMPLES = 2000;

export class QuotaHistoryStore {
  constructor(filePath, {enabled = false, retentionDays = 30, now = () => Date.now()} = {}) {
    this.filePath = filePath;
    this.enabled = Boolean(enabled);
    this.retentionDays = normalizeRetention(retentionDays);
    this.now = now;
    this.samples = this.enabled ? this.#load() : [];
  }

  getSamples() {
    return structuredClone(this.samples);
  }

  get status() {
    return {enabled: this.enabled, retentionDays: this.retentionDays, sampleCount: this.samples.length};
  }

  record(snapshot, at = this.now()) {
    const sample = normalizeSample({...snapshot, at});
    if (!sample) return false;
    const last = this.samples.at(-1);
    if (!shouldRecord(last, sample)) return false;
    this.samples.push(sample);
    this.#prune();
    this.#save();
    return true;
  }

  setEnabled(value) {
    const enabled = Boolean(value);
    if (enabled === this.enabled) return this.status;
    this.enabled = enabled;
    if (enabled) {
      this.samples = mergeSamples(this.#readFile(), this.samples);
      this.#prune();
      this.#save();
    }
    return this.status;
  }

  setRetentionDays(value) {
    this.retentionDays = normalizeRetention(value);
    this.#prune();
    this.#save();
    return this.status;
  }

  clear() {
    this.samples = [];
    try {
      fs.rmSync(this.filePath, {force: true});
    } catch {
      // A locked or already removed history file should not stop the overlay.
    }
    return this.status;
  }

  #load() {
    const samples = this.#readFile();
    this.samples = samples;
    this.#prune();
    return this.samples;
  }

  #readFile() {
    try {
      const loaded = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      return Array.isArray(loaded?.samples)
        ? loaded.samples
            .map(normalizeSample)
            .filter(Boolean)
            .sort((left, right) => left.at - right.at)
        : [];
    } catch {
      return [];
    }
  }

  #prune() {
    const cutoff = this.now() - this.retentionDays * 86400000;
    this.samples = mergeSamples(
      [],
      this.samples.filter((sample) => sample.at >= cutoff && sample.at <= this.now() + 5 * 60_000)
    ).slice(-MAXIMUM_SAMPLES);
  }

  #save() {
    if (!this.enabled) return;
    fs.mkdirSync(path.dirname(this.filePath), {recursive: true});
    const temporary = `${this.filePath}.tmp`;
    const payload = {schemaVersion: 1, samples: this.samples};
    fs.writeFileSync(temporary, `${JSON.stringify(payload, null, 2)}\n`, {encoding: 'utf8', mode: 0o600});
    fs.renameSync(temporary, this.filePath);
  }
}

export function normalizeSample(value) {
  const at = finite(value?.at, 0);
  const usedPercent = finite(value?.usedPercent, Number.NaN);
  if (!at || !Number.isFinite(usedPercent)) return null;
  return {
    at: Math.trunc(at),
    limitId: cleanLimitId(value?.limitId),
    resetsAt: Math.max(0, Math.trunc(finite(value?.resetsAt, 0))),
    usedPercent: round(clamp(usedPercent, 0, 100), 2),
    windowDurationMins: Math.max(0, Math.trunc(finite(value?.windowDurationMins, 0)))
  };
}

function shouldRecord(last, next) {
  if (!last) return true;
  const interval = next.at - last.at;
  if (interval < MINIMUM_SAMPLE_INTERVAL_MS) return false;
  if (next.limitId !== last.limitId || next.resetsAt !== last.resetsAt) return true;
  if (Math.abs(next.usedPercent - last.usedPercent) >= 0.1) return true;
  return interval >= UNCHANGED_SAMPLE_INTERVAL_MS;
}

function mergeSamples(...collections) {
  const byKey = new Map();
  for (const collection of collections) {
    for (const raw of collection) {
      const sample = normalizeSample(raw);
      if (!sample) continue;
      byKey.set(`${sample.at}:${sample.limitId}:${sample.resetsAt}`, sample);
    }
  }
  return [...byKey.values()].sort((left, right) => left.at - right.at);
}

function cleanLimitId(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  return (text || 'codex').replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 80) || 'codex';
}

function normalizeRetention(value) {
  const parsed = Math.trunc(finite(value, 30));
  return [7, 14, 30, 90].includes(parsed) ? parsed : 30;
}

function finite(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
