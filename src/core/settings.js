import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

export const DEFAULT_SETTINGS = Object.freeze({
  schemaVersion: 2,
  placement: Object.freeze({x: 0, y: 0}),
  overlayMode: 'balanced',
  overlayTheme: 'dark',
  history: Object.freeze({enabled: false, retentionDays: 30}),
  alerts: Object.freeze({enabled: false, threshold: 20, paceRisk: true}),
  telemetryEnabled: null,
  codexCliPath: null,
  installationId: null,
  lastHeartbeatUtc: null
});

export class SettingsStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.value = this.#load();
  }

  get() {
    return structuredClone(this.value);
  }

  update(patch) {
    const candidate = merge(this.value, patch);
    this.value = normalizeSettings(candidate);
    this.#save();
    return this.get();
  }

  ensureInstallationId() {
    if (!this.value.installationId) this.update({installationId: randomUUID()});
    return this.value.installationId;
  }

  #load() {
    try {
      return normalizeSettings(JSON.parse(fs.readFileSync(this.filePath, 'utf8')));
    } catch {
      return structuredClone(DEFAULT_SETTINGS);
    }
  }

  #save() {
    fs.mkdirSync(path.dirname(this.filePath), {recursive: true});
    const temporary = `${this.filePath}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(this.value, null, 2)}\n`, {encoding: 'utf8', mode: 0o600});
    fs.renameSync(temporary, this.filePath);
  }
}

export function normalizeSettings(value = {}) {
  const historySource = value.history && typeof value.history === 'object' ? value.history : {};
  const alertsSource = value.alerts && typeof value.alerts === 'object' ? value.alerts : {};
  const placementSource = value.placement && typeof value.placement === 'object' ? value.placement : {};
  const overlayMode = ['compact', 'balanced', 'insight'].includes(value.overlayMode)
    ? value.overlayMode
    : DEFAULT_SETTINGS.overlayMode;
  const retentionDays = [7, 14, 30, 90].includes(Number(historySource.retentionDays))
    ? Number(historySource.retentionDays)
    : DEFAULT_SETTINGS.history.retentionDays;
  const threshold = [10, 20, 30].includes(Number(alertsSource.threshold))
    ? Number(alertsSource.threshold)
    : DEFAULT_SETTINGS.alerts.threshold;

  return {
    schemaVersion: DEFAULT_SETTINGS.schemaVersion,
    placement: {
      x: clampInteger(placementSource.x, -80, 80, 0),
      y: clampInteger(placementSource.y, -40, 40, 0)
    },
    overlayMode,
    overlayTheme: value.overlayTheme === 'light' ? 'light' : 'dark',
    history: {
      enabled: historySource.enabled === true,
      retentionDays
    },
    alerts: {
      enabled: alertsSource.enabled === true,
      threshold,
      paceRisk: alertsSource.paceRisk !== false
    },
    telemetryEnabled:
      value.telemetryEnabled === true ? true : value.telemetryEnabled === false ? false : null,
    codexCliPath: nullableString(value.codexCliPath, 2048),
    installationId: nullableString(value.installationId, 128),
    lastHeartbeatUtc: nullableString(value.lastHeartbeatUtc, 64)
  };
}

function merge(base, patch) {
  const safePatch = patch && typeof patch === 'object' ? patch : {};
  return {
    ...structuredClone(base),
    ...safePatch,
    placement: {...(base?.placement ?? DEFAULT_SETTINGS.placement), ...objectOrEmpty(safePatch.placement)},
    history: {...(base?.history ?? DEFAULT_SETTINGS.history), ...objectOrEmpty(safePatch.history)},
    alerts: {...(base?.alerts ?? DEFAULT_SETTINGS.alerts), ...objectOrEmpty(safePatch.alerts)}
  };
}

function objectOrEmpty(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function nullableString(value, maximumLength) {
  return typeof value === 'string' && value ? value.slice(0, maximumLength) : null;
}

function clampInteger(value, minimum, maximum, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, Math.round(parsed))) : fallback;
}
